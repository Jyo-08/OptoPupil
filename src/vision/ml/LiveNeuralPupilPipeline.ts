import { ExtractedOcularData, EyeLandmarkSet, IrisLandmarkSet, BilateralPupilData } from '../../types/vision';
import { NeuralPupilSegmenter } from './NeuralPupilSegmenter';
import { PupilGeometryExtractor, PupilGeometryResult } from './PupilGeometryExtractor';
import { ONNXRuntimeService } from './ONNXRuntimeService';
import { NeuralPupilComparison } from './NeuralPupilComparison';

export interface NeuralPupilGeometry extends PupilGeometryResult {
    videoCentroidX: number;
    videoCentroidY: number;
}

export interface NeuralShadowResult {
    timestamp: number;
    left: NeuralPupilGeometry | null;
    right: NeuralPupilGeometry | null;
    processingTimeMs: number;
    valid: boolean;
}

export class LiveNeuralPupilPipeline {
    private static instance: LiveNeuralPupilPipeline;
    private segmenter: NeuralPupilSegmenter;
    private geometryExtractor: PupilGeometryExtractor;
    private isInferring: boolean = false;
    private offscreenCanvas: HTMLCanvasElement | null = null;
    private offscreenCtx: CanvasRenderingContext2D | null = null;
    private lastLogTime = 0;

    private constructor() {
        this.segmenter = new NeuralPupilSegmenter();
        this.geometryExtractor = new PupilGeometryExtractor();
        
        // Ensure ONNX runtime is initializing asynchronously
        ONNXRuntimeService.getInstance().initialize().catch(console.error);

        if (typeof document !== 'undefined') {
            this.offscreenCanvas = document.createElement('canvas');
            this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
        }
    }

    public static getInstance(): LiveNeuralPupilPipeline {
        if (!LiveNeuralPupilPipeline.instance) {
            LiveNeuralPupilPipeline.instance = new LiveNeuralPupilPipeline();
        }
        return LiveNeuralPupilPipeline.instance;
    }

    /**
     * Non-blocking entry point for the shadow pipeline.
     * Skips the frame if an inference batch is already in flight.
     */
    public async processFrame(video: HTMLVideoElement, ocularData: ExtractedOcularData, deterministicData: BilateralPupilData, timestamp: number): Promise<void> {
        if (this.isInferring) {
            return;
        }
        this.isInferring = true;

        try {
            const startMs = performance.now();
            
            // Extract and infer independently for both eyes using the same video frame timestamp
            const leftPromise = ocularData.leftIris && ocularData.leftEye 
                ? this.processEye(video, ocularData.leftIris, ocularData.leftEye) 
                : Promise.resolve(null);
                
            const rightPromise = ocularData.rightIris && ocularData.rightEye 
                ? this.processEye(video, ocularData.rightIris, ocularData.rightEye) 
                : Promise.resolve(null);
            
            const [leftResult, rightResult] = await Promise.all([leftPromise, rightPromise]);
            
            const duration = performance.now() - startMs;
            const valid = !!(leftResult?.valid || rightResult?.valid);
            
            const result: NeuralShadowResult = {
                timestamp,
                left: leftResult,
                right: rightResult,
                processingTimeMs: duration,
                valid
            };

            if (valid) {
                // Pass to comparison validation layer
                NeuralPupilComparison.getInstance().compare(timestamp, deterministicData, result);
            }
        } finally {
            this.isInferring = false;
        }
    }

    private async processEye(video: HTMLVideoElement, iris: IrisLandmarkSet, eye: EyeLandmarkSet): Promise<NeuralPupilGeometry | null> {
        if (!this.offscreenCanvas || !this.offscreenCtx) {
            return null; // Safety for non-DOM environments or initialization failures
        }

        const videoWidth = video.videoWidth || video.width;
        const videoHeight = video.videoHeight || video.height;
        
        if (videoWidth === 0 || videoHeight === 0) return null;

        const cx = iris.center.x * videoWidth;
        const cy = iris.center.y * videoHeight;

        // Dynamic 4:3 crop sizing based on eye bounding box width
        const eyeWidthPx = eye.boundingBox.width * videoWidth;
        const cropWidth = Math.round(eyeWidthPx * 2.5); // 2.5x context multiplier
        const cropHeight = Math.round(cropWidth * 0.75); // EXACTLY 4:3 aspect ratio

        const minX = Math.round(cx - cropWidth / 2);
        const minY = Math.round(cy - cropHeight / 2);
        
        // Return null if crop bounding box exceeds video frame (avoids padding artifacts and distortions)
        if (minX < 0 || minY < 0 || minX + cropWidth > videoWidth || minY + cropHeight > videoHeight) {
            return null;
        }

        this.offscreenCanvas.width = cropWidth;
        this.offscreenCanvas.height = cropHeight;
        
        try {
            this.offscreenCtx.drawImage(
                video, 
                minX, minY, cropWidth, cropHeight, 
                0, 0, cropWidth, cropHeight
            );
        } catch (e) {
            return null; // Handle video rendering interruption safely
        }

        const imageData = this.offscreenCtx.getImageData(0, 0, cropWidth, cropHeight);
        
        // Neural Segmentation
        const segmentResult = await this.segmenter.segment(imageData);
        
        // Geometry Extraction
        const geometry = this.geometryExtractor.extract(segmentResult.pupilMask, segmentResult.width, segmentResult.height);
        
        if (!geometry.valid) {
            return {
                ...geometry,
                videoCentroidX: 0,
                videoCentroidY: 0
            };
        }

        /**
         * Coordinate Mapping Transformation:
         * modelCentroidX is in the normalized/resized 256x192 model coordinate space.
         * We map it back to the original video coordinate space using the crop scale factor.
         */
        const scaleX = cropWidth / segmentResult.width;
        const scaleY = cropHeight / segmentResult.height;
        
        const videoCentroidX = minX + geometry.centroidX * scaleX;
        const videoCentroidY = minY + geometry.centroidY * scaleY;

        return {
            ...geometry,
            videoCentroidX,
            videoCentroidY
        };
    }
}
