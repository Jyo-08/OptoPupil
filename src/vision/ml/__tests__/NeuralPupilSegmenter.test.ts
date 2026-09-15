import { describe, it, expect, beforeAll } from 'vitest';
import { NeuralPupilSegmenter } from '../NeuralPupilSegmenter';
import { ONNXRuntimeService } from '../ONNXRuntimeService';
import fs from 'fs';
import path from 'path';

describe('NeuralPupilSegmenter Smoke Test', () => {
    let segmenter: NeuralPupilSegmenter;

    beforeAll(async () => {
        const service = ONNXRuntimeService.getInstance();
        const modelPath = path.resolve(__dirname, '../../../../public/models/pupil_segmentation.onnx');
        const buffer = fs.readFileSync(modelPath);
        const modelBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        
        // Let WASM run single-threaded in Node
        const ort = await import('onnxruntime-web');
        ort.env.wasm.numThreads = 1;
        
        await service.initialize(modelBuffer);
        segmenter = new NeuralPupilSegmenter();
    });

    const createSyntheticImageData = (width: number, height: number): ImageData => {
        const data = new Uint8ClampedArray(width * height * 4);
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 128;     // R
            data[i + 1] = 128; // G
            data[i + 2] = 128; // B
            data[i + 3] = 255; // A
        }
        return { width, height, data, colorSpace: 'srgb' } as any as ImageData;
    };

    it('should preprocess 4:3 input exactly to 256x192 without aspect ratio distortion', () => {
        const input = createSyntheticImageData(800, 600); // 4:3
        const tensorData = segmenter.preprocess(input);
        
        expect(tensorData.length).toBe(256 * 192);
        
        // 128 grayscale normalized is roughly 0.5019
        // Y = (0.299*128 + 0.587*128 + 0.114*128) / 255 = 128 / 255 = 0.50196
        expect(tensorData[0]).toBeCloseTo(128 / 255, 3);
        
        // Values are within [0,1]
        let allValid = true;
        for (let i = 0; i < tensorData.length; i++) {
            if (tensorData[i] < 0 || tensorData[i] > 1) {
                allValid = false;
                break;
            }
        }
        expect(allValid).toBe(true);
    });

    it('should center-crop non-4:3 input (1:1 square) to 4:3 and output 256x192', () => {
        // Create 1:1 square (600x600)
        const input = createSyntheticImageData(600, 600);
        const tensorData = segmenter.preprocess(input);
        
        expect(tensorData.length).toBe(256 * 192);
    });

    it('should run end-to-end inference and return valid segmentation mask', async () => {
        const input = createSyntheticImageData(256, 192); // exact match
        const result = await segmenter.segment(input);

        // Verify dimensions
        expect(result.width).toBe(256);
        expect(result.height).toBe(192);
        
        // Verify class mask classes
        let validClasses = true;
        for (let i = 0; i < result.classMask.length; i++) {
            const val = result.classMask[i];
            if (val !== 0 && val !== 1 && val !== 2 && val !== 3) {
                validClasses = false;
                break;
            }
        }
        expect(validClasses).toBe(true);

        // Verify pupil mask is binary 0 or 1
        let binaryPupil = true;
        for (let i = 0; i < result.pupilMask.length; i++) {
            const val = result.pupilMask[i];
            if (val !== 0 && val !== 1) {
                binaryPupil = false;
                break;
            }
        }
        expect(binaryPupil).toBe(true);
        
        // Verify inference time is tracked
        expect(result.inferenceTimeMs).toBeGreaterThan(0);
    });
});
