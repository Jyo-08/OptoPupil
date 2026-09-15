import * as ort from 'onnxruntime-web';
import { ONNXRuntimeService } from './ONNXRuntimeService';

export interface SegmentationResult {
    width: number;
    height: number;
    pupilMask: Uint8Array; // Binary mask (0 or 1)
    classMask: Uint8Array; // Class mask (0, 1, 2, 3)
    inferenceTimeMs: number;
}

export class NeuralPupilSegmenter {
    private onnxService: ONNXRuntimeService;
    private readonly TARGET_WIDTH = 256;
    private readonly TARGET_HEIGHT = 192;

    constructor() {
        this.onnxService = ONNXRuntimeService.getInstance();
    }

    /**
     * Performs a center crop to 4:3 aspect ratio if needed,
     * then resizes using bilinear interpolation, converts to grayscale,
     * normalizes to [0,1], and outputs a flat Float32Array suitable for ONNX [1, 1, 192, 256].
     */
    public preprocess(imageData: ImageData): Float32Array {
        const { width, height, data } = imageData;
        const targetAspect = this.TARGET_WIDTH / this.TARGET_HEIGHT;
        const currentAspect = width / height;

        let cropWidth = width;
        let cropHeight = height;
        let offsetX = 0;
        let offsetY = 0;

        // 1. Calculate center crop to exactly 4:3
        if (Math.abs(currentAspect - targetAspect) > 0.01) {
            if (currentAspect > targetAspect) {
                // Image is too wide
                cropWidth = Math.round(height * targetAspect);
                offsetX = Math.floor((width - cropWidth) / 2);
            } else {
                // Image is too tall
                cropHeight = Math.round(width / targetAspect);
                offsetY = Math.floor((height - cropHeight) / 2);
            }
        }

        // 2. Resize crop to 256x192 and convert to Grayscale float [0,1]
        const output = new Float32Array(this.TARGET_WIDTH * this.TARGET_HEIGHT);
        
        for (let y = 0; y < this.TARGET_HEIGHT; y++) {
            for (let x = 0; x < this.TARGET_WIDTH; x++) {
                // Map target pixel to crop coordinate
                const srcX = offsetX + (x + 0.5) * (cropWidth / this.TARGET_WIDTH) - 0.5;
                const srcY = offsetY + (y + 0.5) * (cropHeight / this.TARGET_HEIGHT) - 0.5;

                const x1 = Math.floor(srcX);
                const y1 = Math.floor(srcY);
                const x2 = x1 + 1;
                const y2 = y1 + 1;
                
                const fx = srcX - x1;
                const fy = srcY - y1;

                // Helper to get grayscale pixel
                const getGray = (px: number, py: number) => {
                    const cx = Math.max(0, Math.min(px, width - 1));
                    const cy = Math.max(0, Math.min(py, height - 1));
                    const idx = (cy * width + cx) * 4;
                    const r = data[idx];
                    const g = data[idx + 1];
                    const b = data[idx + 2];
                    return (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;
                };

                const p11 = getGray(x1, y1);
                const p21 = getGray(x2, y1);
                const p12 = getGray(x1, y2);
                const p22 = getGray(x2, y2);

                const interp = p11 * (1 - fx) * (1 - fy) +
                               p21 * fx * (1 - fy) +
                               p12 * (1 - fx) * fy +
                               p22 * fx * fy;

                output[y * this.TARGET_WIDTH + x] = interp;
            }
        }

        return output;
    }

    public async segment(imageData: ImageData): Promise<SegmentationResult> {
        const startTime = performance.now();

        // 1. Preprocess
        const tensorData = this.preprocess(imageData);
        const tensor = new ort.Tensor('float32', tensorData, [1, 1, this.TARGET_HEIGHT, this.TARGET_WIDTH]);

        // 2. Inference
        const session = this.onnxService.getSession();
        const feeds: Record<string, ort.Tensor> = {
            'image': tensor
        };
        const results = await session.run(feeds);
        const logits = results['segmentation_logits'];

        if (!logits || logits.dims.length !== 4) {
            throw new Error('Invalid logits returned from model.');
        }

        const logitsData = logits.data as Float32Array;
        
        // 3. Postprocess (Argmax over classes 0-3)
        const spatialSize = this.TARGET_WIDTH * this.TARGET_HEIGHT;
        const classMask = new Uint8Array(spatialSize);
        const pupilMask = new Uint8Array(spatialSize);

        // Logits shape: [1, 4, 192, 256]. 
        // Data is laid out as [batch, channel, y, x]
        // Channel offset = c * spatialSize
        for (let i = 0; i < spatialSize; i++) {
            let maxVal = -Infinity;
            let maxClass = 0;
            for (let c = 0; c < 4; c++) {
                const val = logitsData[c * spatialSize + i];
                if (val > maxVal) {
                    maxVal = val;
                    maxClass = c;
                }
            }
            classMask[i] = maxClass;
            pupilMask[i] = maxClass === 2 ? 1 : 0;
        }

        const inferenceTimeMs = performance.now() - startTime;

        return {
            width: this.TARGET_WIDTH,
            height: this.TARGET_HEIGHT,
            pupilMask,
            classMask,
            inferenceTimeMs
        };
    }
}
