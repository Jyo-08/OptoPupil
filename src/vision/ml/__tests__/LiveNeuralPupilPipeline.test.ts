import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LiveNeuralPupilPipeline } from '../LiveNeuralPupilPipeline';
import { ExtractedOcularData } from '../../../types/vision';

// Global mocks for DOM
const mockDrawImage = vi.fn();
const mockGetImageData = vi.fn().mockReturnValue({ width: 320, height: 240, data: new Uint8ClampedArray(320*240*4) });

global.document = {
    createElement: (tag: string) => {
        if (tag === 'canvas') {
            return {
                getContext: () => ({
                    drawImage: mockDrawImage,
                    getImageData: mockGetImageData
                }),
                width: 0,
                height: 0
            }
        }
        if (tag === 'video') {
            return {
                videoWidth: 1280,
                videoHeight: 720
            }
        }
        return {}
    }
} as any;

const mocks = vi.hoisted(() => {
    return {
        segmenterPromiseResolver: null as any,
        useSlowSegmenter: false
    };
});

vi.mock('../NeuralPupilSegmenter', () => {
    class MockSegmenter {
        segment = vi.fn().mockImplementation(() => {
            if (mocks.useSlowSegmenter) {
                return new Promise(res => {
                    mocks.segmenterPromiseResolver = res;
                });
            }
            return Promise.resolve({
                pupilMask: new Uint8Array(256 * 192),
                width: 256,
                height: 192
            });
        });
    }
    return { NeuralPupilSegmenter: MockSegmenter };
});

vi.mock('../PupilGeometryExtractor', () => {
    class MockExtractor {
        extract = vi.fn().mockReturnValue({
            valid: true,
            areaPx: 100,
            centroidX: 128,
            centroidY: 96,
            bboxX: 0,
            bboxY: 0,
            bboxWidth: 0,
            bboxHeight: 0,
            equivalentDiameterPx: 10,
            circularity: 0.9,
            geometryConfidence: 0.9
        });
    }
    return { PupilGeometryExtractor: MockExtractor };
});

vi.mock('../ONNXRuntimeService', () => {
    return {
        ONNXRuntimeService: {
            getInstance: () => ({
                initialize: vi.fn().mockResolvedValue(undefined)
            })
        }
    };
});

vi.mock('../NeuralPupilComparison', () => {
    class MockComparison {
        compare = vi.fn();
        reset = vi.fn();
    }
    const instance = new MockComparison();
    return {
        NeuralPupilComparison: {
            getInstance: () => instance
        }
    };
});

describe('LiveNeuralPupilPipeline', () => {
    let videoMock: HTMLVideoElement;
    let pipeline: LiveNeuralPupilPipeline;

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.useSlowSegmenter = false;
        mocks.segmenterPromiseResolver = null;
        
        videoMock = document.createElement('video');
        
        // Reset singleton
        // @ts-ignore
        LiveNeuralPupilPipeline.instance = undefined;
        pipeline = LiveNeuralPupilPipeline.getInstance();

        // Reset throttle log time
        (pipeline as any).lastLogTime = 0;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const createFakeOcularData = (cx: number, cy: number, w: number): ExtractedOcularData => ({
        leftEye: {
            boundingBox: { width: w, height: w, minX: cx - w/2, minY: cy - w/2, maxX: cx + w/2, maxY: cy + w/2 },
            contour: [], innerCorner: {x:0, y:0, z:0}, outerCorner: {x:0, y:0, z:0}, upperEyelid: {x:0, y:0, z:0}, lowerEyelid: {x:0, y:0, z:0}
        },
        leftIris: {
            center: { x: cx, y: cy, z: 0 },
            perimeter: [], estimatedRadiusNorm: 0.02
        },
        rightEye: {
            boundingBox: { width: w, height: w, minX: cx - w/2, minY: cy - w/2, maxX: cx + w/2, maxY: cy + w/2 },
            contour: [], innerCorner: {x:0, y:0, z:0}, outerCorner: {x:0, y:0, z:0}, upperEyelid: {x:0, y:0, z:0}, lowerEyelid: {x:0, y:0, z:0}
        },
        rightIris: {
            center: { x: cx, y: cy, z: 0 },
            perimeter: [], estimatedRadiusNorm: 0.02
        },
        interpupillaryDistanceNorm: 0
    });

    it('should generate correct 4:3 crop and remain inside video bounds', async () => {
        const data = createFakeOcularData(0.5, 0.5, 0.1);
        data.rightEye = null;
        data.rightIris = null;

        const fakeDet = { leftPupil: { detected: false }, rightPupil: { detected: false } };
        await pipeline.processFrame(videoMock, data, fakeDet as any, 1000);

        expect(mockDrawImage).toHaveBeenCalled();
        const args = mockDrawImage.mock.calls[0];
        
        const expectedCropWidth = 320;
        const expectedCropHeight = 240;
        const expectedMinX = (0.5 * 1280) - 320/2; 
        const expectedMinY = (0.5 * 720) - 240/2; 

        expect(args[1]).toBe(expectedMinX);
        expect(args[2]).toBe(expectedMinY);
        expect(args[3]).toBe(expectedCropWidth);
        expect(args[4]).toBe(expectedCropHeight);
    });

    it('should correctly map model-space centroid to video coordinates', async () => {
        const data = createFakeOcularData(0.5, 0.5, 0.1);
        data.rightEye = null;
        data.rightIris = null;

        const fakeDet = { leftPupil: { detected: false }, rightPupil: { detected: false } };
        
        // We will spy on NeuralPupilComparison.getInstance().compare
        const { NeuralPupilComparison } = await import('../NeuralPupilComparison');
        const compareSpy = vi.spyOn(NeuralPupilComparison.getInstance(), 'compare');

        await pipeline.processFrame(videoMock, data, fakeDet as any, 1000);

        // Crop is 320x240, starting at (480, 240).
        // scaleX = 320 / 256 = 1.25
        // scaleY = 240 / 192 = 1.25
        // expected videoX = 480 + 128 * 1.25 = 480 + 160 = 640
        // expected videoY = 240 + 96 * 1.25 = 240 + 120 = 360

        expect(compareSpy).toHaveBeenCalled();
        const calledArgs = compareSpy.mock.calls[0];
        // calledArgs[2] is the NeuralShadowResult
        expect(calledArgs[2].left?.videoCentroidX).toBeCloseTo(640);
        expect(calledArgs[2].left?.videoCentroidY).toBeCloseTo(360);
    });

    it('should return safely for out-of-bounds crops without NaN or Infinity', async () => {
        const data = createFakeOcularData(0, 0, 0.2); 
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        const fakeDet = { leftPupil: { detected: false }, rightPupil: { detected: false } };
        await pipeline.processFrame(videoMock, data, fakeDet as any, 1000);
        expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should process both left and right eyes independently from the same timestamp', async () => {
        const data = createFakeOcularData(0.5, 0.5, 0.1);

        const fakeDet = { leftPupil: { detected: false }, rightPupil: { detected: false } };
        await pipeline.processFrame(videoMock, data, fakeDet as any, 1000);
        expect(mockDrawImage).toHaveBeenCalledTimes(2);
    });

    it('should throttle and prevent overlapping inference (Inference Gate)', async () => {
        const data = createFakeOcularData(0.5, 0.5, 0.1);
        data.rightEye = null;
        data.rightIris = null;

        mocks.useSlowSegmenter = true;

        const fakeDet = { leftPupil: { detected: false }, rightPupil: { detected: false } };
        const p1 = pipeline.processFrame(videoMock, data, fakeDet as any, 1000);
        
        // Wait a tiny bit to ensure p1 has engaged isInferring
        await new Promise(r => setTimeout(r, 10));

        const p2 = pipeline.processFrame(videoMock, data, fakeDet as any, 1016);

        await p2; // Should resolve immediately because of throttle
        expect((pipeline as any).isInferring).toBe(true); 

        // Resolve p1 manually
        if (mocks.segmenterPromiseResolver) {
            mocks.segmenterPromiseResolver({
                pupilMask: new Uint8Array(256 * 192),
                width: 256,
                height: 192
            });
        }
        await p1;

        expect((pipeline as any).isInferring).toBe(false); 
    });
});
