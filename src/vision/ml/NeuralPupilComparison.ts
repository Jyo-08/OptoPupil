import type { BilateralPupilData, PupilGeometry } from '../../types/vision';
import type { NeuralShadowResult, NeuralPupilGeometry } from './LiveNeuralPupilPipeline';

export interface EyeComparison {
    deterministicValid: boolean;
    neuralValid: boolean;
    diameterDifferencePx: number | null;
    centerDistancePx: number | null;
    relativeDiameterErrorPercent: number | null;
    
    deterministicDiameterPx?: number;
    neuralDiameterPx?: number;
}

export interface ComparisonResult {
    timestamp: number;
    left: EyeComparison;
    right: EyeComparison;
    global: {
        bilateralValidityAgreement: boolean;
        meanDiameterDifferencePx: number | null;
        meanCenterDistancePx: number | null;
        comparisonValid: boolean;
    };
}

export interface EngineeringStatistics {
    sampleCount: number;
    validComparisonCount: number;
    meanDiameterDifferencePx: number;
    medianDiameterDifferencePx: number;
    meanCenterDistancePx: number;
    medianCenterDistancePx: number;
    neuralValidityRatePercent: number;
    deterministicValidityRatePercent: number;
    bilateralAgreementRatePercent: number;

    leftNeuralMeanDiameterPx: number;
    leftNeuralStdDevPx: number;
    leftNeuralCvPercent: number;
    rightNeuralMeanDiameterPx: number;
    rightNeuralStdDevPx: number;
    rightNeuralCvPercent: number;
}

export class NeuralPupilComparison {
    private static instance: NeuralPupilComparison;
    
    // Ring buffers for live statistics (max 300 items)
    private readonly MAX_SAMPLES = 300;
    private history: ComparisonResult[] = [];
    private neuralLeftDiameters: number[] = [];
    private neuralRightDiameters: number[] = [];
    private lastLogTime = 0;

    private constructor() {}

    public static getInstance(): NeuralPupilComparison {
        if (!NeuralPupilComparison.instance) {
            NeuralPupilComparison.instance = new NeuralPupilComparison();
        }
        return NeuralPupilComparison.instance;
    }

    public compare(
        timestamp: number, 
        deterministic: BilateralPupilData, 
        neural: NeuralShadowResult
    ): ComparisonResult | null {
        // Temporal Mismatch Rejection
        // The comparison layer rejects mismatches where the source timestamps don't align.
        if (timestamp !== neural.timestamp) {
            console.warn(`[NeuralPupilComparison] Stale mismatch: Source=${timestamp} !== Neural=${neural.timestamp}. Rejecting.`);
            return null;
        }

        const left = this.compareEye(deterministic.leftPupil, neural.left);
        const right = this.compareEye(deterministic.rightPupil, neural.right);

        let validCount = 0;
        let sumDiam = 0;
        let sumCenter = 0;

        if (left.diameterDifferencePx !== null) {
            validCount++;
            sumDiam += left.diameterDifferencePx;
            sumCenter += (left.centerDistancePx ?? 0);
        }
        if (right.diameterDifferencePx !== null) {
            validCount++;
            sumDiam += right.diameterDifferencePx;
            sumCenter += (right.centerDistancePx ?? 0);
        }

        const result: ComparisonResult = {
            timestamp,
            left,
            right,
            global: {
                bilateralValidityAgreement: 
                    (left.deterministicValid === left.neuralValid) && 
                    (right.deterministicValid === right.neuralValid),
                meanDiameterDifferencePx: validCount > 0 ? sumDiam / validCount : null,
                meanCenterDistancePx: validCount > 0 ? sumCenter / validCount : null,
                comparisonValid: validCount > 0
            }
        };

        this.accumulate(result, neural.left, neural.right);
        this.logLiveStatistics();

        return result;
    }

    private compareEye(deterministic: PupilGeometry, neural: NeuralPupilGeometry | null): EyeComparison {
        // Strict validity checks
        const deterministicValid = deterministic.detected && 
            deterministic.diameterPx !== null && 
            deterministic.diameterPx > 0 &&
            deterministic.centerPx !== null &&
            isFinite(deterministic.centerPx.x) &&
            isFinite(deterministic.centerPx.y);

        const neuralValid = !!(neural && 
            neural.valid && 
            neural.equivalentDiameterPx !== null &&
            neural.equivalentDiameterPx > 0 &&
            isFinite(neural.videoCentroidX) &&
            isFinite(neural.videoCentroidY));

        let diameterDifferencePx: number | null = null;
        let centerDistancePx: number | null = null;
        let relativeDiameterErrorPercent: number | null = null;

        if (deterministicValid && neuralValid && neural && deterministic.centerPx && deterministic.diameterPx) {
            // Diameter difference
            const dDet = deterministic.diameterPx;
            const dNeu = neural.equivalentDiameterPx;
            
            diameterDifferencePx = Math.abs(dNeu - dDet);
            if (dDet > 0) {
                relativeDiameterErrorPercent = (diameterDifferencePx / dDet) * 100.0;
            }

            // Center distance in pixel space
            const dx = neural.videoCentroidX - deterministic.centerPx.x;
            const dy = neural.videoCentroidY - deterministic.centerPx.y;
            centerDistancePx = Math.sqrt(dx * dx + dy * dy);
            
            // Safety against NaNs leaking from malformed math
            if (!isFinite(diameterDifferencePx)) diameterDifferencePx = null;
            if (!isFinite(centerDistancePx as number)) centerDistancePx = null;
            if (relativeDiameterErrorPercent !== null && !isFinite(relativeDiameterErrorPercent)) {
                relativeDiameterErrorPercent = null;
            }

            return {
                deterministicValid,
                neuralValid,
                diameterDifferencePx,
                centerDistancePx,
                relativeDiameterErrorPercent,
                deterministicDiameterPx: dDet,
                neuralDiameterPx: dNeu
            };
        }

        return {
            deterministicValid,
            neuralValid,
            diameterDifferencePx,
            centerDistancePx,
            relativeDiameterErrorPercent
        };
    }

    private accumulate(res: ComparisonResult, nl: NeuralPupilGeometry | null, nr: NeuralPupilGeometry | null) {
        this.history.push(res);
        if (this.history.length > this.MAX_SAMPLES) this.history.shift();

        if (nl && nl.valid && nl.equivalentDiameterPx !== null && isFinite(nl.equivalentDiameterPx)) {
            this.neuralLeftDiameters.push(nl.equivalentDiameterPx);
            if (this.neuralLeftDiameters.length > this.MAX_SAMPLES) this.neuralLeftDiameters.shift();
        }
        if (nr && nr.valid && nr.equivalentDiameterPx !== null && isFinite(nr.equivalentDiameterPx)) {
            this.neuralRightDiameters.push(nr.equivalentDiameterPx);
            if (this.neuralRightDiameters.length > this.MAX_SAMPLES) this.neuralRightDiameters.shift();
        }
    }

    public getStatistics(): EngineeringStatistics | null {
        if (this.history.length === 0) return null;

        const sampleCount = this.history.length;
        let validComparisonCount = 0;
        let neuralValidCount = 0;
        let detValidCount = 0;
        let agreementCount = 0;

        const allDiamDiffs: number[] = [];
        const allCenterDists: number[] = [];

        for (const h of this.history) {
            if (h.global.comparisonValid) validComparisonCount++;
            if (h.left.neuralValid || h.right.neuralValid) neuralValidCount++;
            if (h.left.deterministicValid || h.right.deterministicValid) detValidCount++;
            if (h.global.bilateralValidityAgreement) agreementCount++;

            if (h.left.diameterDifferencePx !== null) allDiamDiffs.push(h.left.diameterDifferencePx);
            if (h.right.diameterDifferencePx !== null) allDiamDiffs.push(h.right.diameterDifferencePx);
            if (h.left.centerDistancePx !== null) allCenterDists.push(h.left.centerDistancePx);
            if (h.right.centerDistancePx !== null) allCenterDists.push(h.right.centerDistancePx);
        }

        allDiamDiffs.sort((a, b) => a - b);
        allCenterDists.sort((a, b) => a - b);

        const meanDiam = allDiamDiffs.length > 0 ? allDiamDiffs.reduce((a, b) => a + b, 0) / allDiamDiffs.length : 0;
        const medianDiam = allDiamDiffs.length > 0 ? allDiamDiffs[Math.floor(allDiamDiffs.length / 2)] : 0;
        
        const meanCenter = allCenterDists.length > 0 ? allCenterDists.reduce((a, b) => a + b, 0) / allCenterDists.length : 0;
        const medianCenter = allCenterDists.length > 0 ? allCenterDists[Math.floor(allCenterDists.length / 2)] : 0;

        const calcStats = (arr: number[]) => {
            if (arr.length === 0) return { mean: 0, std: 0, cv: 0 };
            const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
            const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length;
            const std = Math.sqrt(variance);
            const cv = mean > 0 ? (std / mean) * 100 : 0;
            return { mean, std, cv };
        };

        const leftStats = calcStats(this.neuralLeftDiameters);
        const rightStats = calcStats(this.neuralRightDiameters);

        return {
            sampleCount,
            validComparisonCount,
            meanDiameterDifferencePx: meanDiam,
            medianDiameterDifferencePx: medianDiam,
            meanCenterDistancePx: meanCenter,
            medianCenterDistancePx: medianCenter,
            neuralValidityRatePercent: (neuralValidCount / sampleCount) * 100,
            deterministicValidityRatePercent: (detValidCount / sampleCount) * 100,
            bilateralAgreementRatePercent: (agreementCount / sampleCount) * 100,
            
            leftNeuralMeanDiameterPx: leftStats.mean,
            leftNeuralStdDevPx: leftStats.std,
            leftNeuralCvPercent: leftStats.cv,
            rightNeuralMeanDiameterPx: rightStats.mean,
            rightNeuralStdDevPx: rightStats.std,
            rightNeuralCvPercent: rightStats.cv
        };
    }

    private logLiveStatistics() {
        if (typeof performance === 'undefined') return;
        const now = performance.now();
        
        // Log approximately once per second
        if (now - this.lastLogTime > 1000) {
            this.lastLogTime = now;
            
            const stats = this.getStatistics();
            if (!stats || stats.sampleCount === 0) return;

            const latest = this.history[this.history.length - 1];

            console.groupCollapsed(`%cOPTOPUPIL NEURAL COMPARISON (ENGINEERING AGREEMENT)`, 'color: #3b82f6; font-weight: bold;');
            
            console.log(`%cLEFT`, 'color: #94a3b8; font-weight: bold;');
            if (latest.left.diameterDifferencePx !== null && latest.left.deterministicDiameterPx && latest.left.neuralDiameterPx) {
                console.log(`CV diameter: ${latest.left.deterministicDiameterPx.toFixed(1)} px`);
                console.log(`Neural diameter: ${latest.left.neuralDiameterPx.toFixed(1)} px`);
                console.log(`Difference: ${latest.left.diameterDifferencePx.toFixed(1)} px`);
                console.log(`Center distance: ${latest.left.centerDistancePx?.toFixed(1)} px`);
            } else {
                console.log('Invalid or no agreement');
            }

            console.log(`\n%cRIGHT`, 'color: #94a3b8; font-weight: bold;');
            if (latest.right.diameterDifferencePx !== null && latest.right.deterministicDiameterPx && latest.right.neuralDiameterPx) {
                console.log(`CV diameter: ${latest.right.deterministicDiameterPx.toFixed(1)} px`);
                console.log(`Neural diameter: ${latest.right.neuralDiameterPx.toFixed(1)} px`);
                console.log(`Difference: ${latest.right.diameterDifferencePx.toFixed(1)} px`);
                console.log(`Center distance: ${latest.right.centerDistancePx?.toFixed(1)} px`);
            } else {
                console.log('Invalid or no agreement');
            }

            console.log(`\n%cSTATISTICS (Last ${stats.sampleCount} frames)`, 'color: #94a3b8; font-weight: bold;');
            console.log(`Neural validity: L ${(stats.neuralValidityRatePercent).toFixed(0)}% / R ${(stats.neuralValidityRatePercent).toFixed(0)}%`);
            console.log(`Bilateral Agreement Rate: ${stats.bilateralAgreementRatePercent.toFixed(1)}%`);
            console.log(`Mean Diam Diff: ${stats.meanDiameterDifferencePx.toFixed(2)} px`);
            console.log(`Mean Center Dist: ${stats.meanCenterDistancePx.toFixed(2)} px`);
            console.log(`Left Neural Stability (CV%): ${stats.leftNeuralCvPercent.toFixed(2)}%`);
            console.log(`Right Neural Stability (CV%): ${stats.rightNeuralCvPercent.toFixed(2)}%`);

            console.groupEnd();
        }
    }

    public reset() {
        this.history = [];
        this.neuralLeftDiameters = [];
        this.neuralRightDiameters = [];
    }
}
