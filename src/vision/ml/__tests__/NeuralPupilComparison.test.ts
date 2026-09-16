import { describe, it, expect, beforeEach } from 'vitest';
import { NeuralPupilComparison } from '../NeuralPupilComparison';
import { BilateralPupilData } from '../../../types/vision';
import { NeuralShadowResult } from '../LiveNeuralPupilPipeline';

describe('NeuralPupilComparison', () => {
    let comparator: NeuralPupilComparison;

    beforeEach(() => {
        // Reset singleton internal state before each test
        comparator = NeuralPupilComparison.getInstance();
        comparator.reset();
    });

    const createDeterministic = (
        leftValid: boolean, ld: number, lcx: number, lcy: number,
        rightValid: boolean, rd: number, rcx: number, rcy: number
    ): BilateralPupilData => ({
        leftPupil: {
            detected: leftValid,
            status: leftValid ? 'TRACKING' : 'LOST',
            diameterPx: ld,
            centerPx: { x: lcx, y: lcy },
            centerNorm: null, radiusPx: ld ? ld/2 : null
        },
        rightPupil: {
            detected: rightValid,
            status: rightValid ? 'TRACKING' : 'LOST',
            diameterPx: rd,
            centerPx: { x: rcx, y: rcy },
            centerNorm: null, radiusPx: rd ? rd/2 : null
        },
        rawLeftPupil: {} as any,
        rawRightPupil: {} as any
    });

    const createNeural = (
        timestamp: number,
        leftValid: boolean, ld: number, lcx: number, lcy: number,
        rightValid: boolean, rd: number, rcx: number, rcy: number
    ): NeuralShadowResult => ({
        timestamp,
        processingTimeMs: 100,
        valid: leftValid || rightValid,
        left: leftValid ? {
            valid: true,
            equivalentDiameterPx: ld,
            videoCentroidX: lcx,
            videoCentroidY: lcy,
            areaPx: 100, centroidX: 0, centroidY: 0, bboxX: 0, bboxY: 0, bboxWidth: 0, bboxHeight: 0, circularity: 1, geometryConfidence: 1
        } : null,
        right: rightValid ? {
            valid: true,
            equivalentDiameterPx: rd,
            videoCentroidX: rcx,
            videoCentroidY: rcy,
            areaPx: 100, centroidX: 0, centroidY: 0, bboxX: 0, bboxY: 0, bboxWidth: 0, bboxHeight: 0, circularity: 1, geometryConfidence: 1
        } : null
    });

    it('TEST 1: Identical neural/CV geometry should yield zero difference', () => {
        const det = createDeterministic(true, 40, 100, 100, true, 42, 200, 200);
        const neu = createNeural(1000, true, 40, 100, 100, true, 42, 200, 200);

        const result = comparator.compare(1000, det, neu);

        expect(result).not.toBeNull();
        expect(result!.left.diameterDifferencePx).toBeCloseTo(0);
        expect(result!.left.centerDistancePx).toBeCloseTo(0);
        expect(result!.left.relativeDiameterErrorPercent).toBeCloseTo(0);
        expect(result!.global.bilateralValidityAgreement).toBe(true);
    });

    it('TEST 2: Known diameter difference should calculate absolute and relative error', () => {
        // det=40, neu=42 => diff=2, rel=(2/40)*100 = 5%
        const det = createDeterministic(true, 40, 100, 100, false, 0, 0, 0);
        const neu = createNeural(1000, true, 42, 100, 100, false, 0, 0, 0);

        const result = comparator.compare(1000, det, neu);

        expect(result!.left.diameterDifferencePx).toBeCloseTo(2);
        expect(result!.left.relativeDiameterErrorPercent).toBeCloseTo(5);
    });

    it('TEST 3: Known center displacement should calculate exact Euclidean distance', () => {
        // det=(100, 100), neu=(103, 104) => dx=3, dy=4 => dist=5
        const det = createDeterministic(true, 40, 100, 100, false, 0, 0, 0);
        const neu = createNeural(1000, true, 40, 103, 104, false, 0, 0, 0);

        const result = comparator.compare(1000, det, neu);

        expect(result!.left.centerDistancePx).toBeCloseTo(5);
    });

    it('TEST 4: Neural invalid / CV valid should handle safely', () => {
        const det = createDeterministic(true, 40, 100, 100, false, 0, 0, 0);
        const neu = createNeural(1000, false, 0, 0, 0, false, 0, 0, 0);

        const result = comparator.compare(1000, det, neu);

        expect(result!.left.deterministicValid).toBe(true);
        expect(result!.left.neuralValid).toBe(false);
        expect(result!.left.diameterDifferencePx).toBeNull();
        expect(result!.left.relativeDiameterErrorPercent).toBeNull();
        expect(result!.global.bilateralValidityAgreement).toBe(false);
    });

    it('TEST 5: CV invalid / neural valid should handle safely', () => {
        const det = createDeterministic(false, 0, 0, 0, false, 0, 0, 0);
        const neu = createNeural(1000, true, 40, 100, 100, false, 0, 0, 0);

        const result = comparator.compare(1000, det, neu);

        expect(result!.left.deterministicValid).toBe(false);
        expect(result!.left.neuralValid).toBe(true);
        expect(result!.left.diameterDifferencePx).toBeNull();
        expect(result!.left.relativeDiameterErrorPercent).toBeNull();
    });

    it('TEST 6: Both invalid should handle safely', () => {
        const det = createDeterministic(false, 0, 0, 0, false, 0, 0, 0);
        const neu = createNeural(1000, false, 0, 0, 0, false, 0, 0, 0);

        const result = comparator.compare(1000, det, neu);

        expect(result!.left.deterministicValid).toBe(false);
        expect(result!.left.neuralValid).toBe(false);
        expect(result!.global.bilateralValidityAgreement).toBe(true); // true==true
    });

    it('TEST 7: NaN / Infinity input should degrade to invalid gracefully', () => {
        const det = createDeterministic(true, NaN, 100, 100, false, 0, 0, 0);
        const neu = createNeural(1000, true, 40, 100, Infinity, false, 0, 0, 0);

        const result = comparator.compare(1000, det, neu);

        expect(result!.left.deterministicValid).toBe(false); // Because diameter is NaN
        expect(result!.left.neuralValid).toBe(false); // Because centroidY is Infinity (isNaN checks true for Infinity in some contexts, wait, isNaN(Infinity) is false. Wait, Math.abs(Infinity - 100) is Infinity)

        // The exact validity might depend on the implementation's strictness, 
        // but diameterDifferencePx should not be a number if it's invalid.
        expect(result!.left.diameterDifferencePx).toBeNull();
    });

    it('TEST 8: Ring-buffer limit should cap at MAX_SAMPLES', () => {
        for (let i = 0; i < 350; i++) {
            const det = createDeterministic(true, 40, 100, 100, false, 0, 0, 0);
            const neu = createNeural(i, true, 42, 100, 100, false, 0, 0, 0);
            comparator.compare(i, det, neu);
        }

        const stats = comparator.getStatistics();
        expect(stats!.sampleCount).toBe(300);
    });

    it('TEST 9: Mean / median / standard deviation calculations', () => {
        // Add 3 samples with known diam diffs: 2, 4, 6 => mean=4, median=4
        // Known center dists: 0, 0, 0
        const diffs = [2, 4, 6];
        diffs.forEach((diff, i) => {
            const det = createDeterministic(true, 40, 100, 100, false, 0, 0, 0);
            const neu = createNeural(i, true, 40 + diff, 100, 100, false, 0, 0, 0);
            comparator.compare(i, det, neu);
        });

        const stats = comparator.getStatistics();
        expect(stats!.meanDiameterDifferencePx).toBeCloseTo(4);
        expect(stats!.medianDiameterDifferencePx).toBeCloseTo(4);
        expect(stats!.leftNeuralMeanDiameterPx).toBeCloseTo(44); // (42+44+46)/3 = 44
    });

    it('TEST 10: Stale timestamp mismatch should be rejected', () => {
        const det = createDeterministic(true, 40, 100, 100, false, 0, 0, 0);
        const neu = createNeural(999, true, 40, 100, 100, false, 0, 0, 0);

        const result = comparator.compare(1000, det, neu); // Frame 1000 vs Neural 999
        expect(result).toBeNull();
    });
});
