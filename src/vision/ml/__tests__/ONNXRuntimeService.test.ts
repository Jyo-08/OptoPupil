import { describe, it, expect, beforeAll } from 'vitest';
import * as ort from 'onnxruntime-web';
import { ONNXRuntimeService } from '../ONNXRuntimeService';
import fs from 'fs';
import path from 'path';

describe('ONNXRuntimeService Smoke Test', () => {
    let service: ONNXRuntimeService;
    let modelBuffer: ArrayBufferLike;

    beforeAll(() => {
        service = ONNXRuntimeService.getInstance();
        const modelPath = path.resolve(__dirname, '../../../../public/models/pupil_segmentation.onnx');
        const buffer = fs.readFileSync(modelPath);
        // Create an ArrayBuffer from the Buffer
        modelBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        
        // For Node/Vitest environment, disable WebGPU and let WASM run since WebGPU is browser-only
        ort.env.wasm.numThreads = 1;
    });

    it('should initialize successfully, validate metadata, and run inference', async () => {
        // Initialize
        await service.initialize(modelBuffer);
        
        const session = service.getSession();
        expect(session).toBeDefined();

        // Create a deterministic input tensor [1, 1, 192, 256]
        const dims = [1, 1, 192, 256];
        const size = dims.reduce((a, b) => a * b);
        const inputData = new Float32Array(size);
        for (let i = 0; i < size; i++) {
            inputData[i] = (i % 255) / 255.0; // Deterministic values between 0 and 1
        }
        
        const inputTensor = new ort.Tensor('float32', inputData, dims);
        const feeds: Record<string, ort.Tensor> = {
            'image': inputTensor
        };

        // Run inference
        const results = await session.run(feeds);
        
        // Verify output exists
        expect(results).toHaveProperty('segmentation_logits');
        const outputTensor = results['segmentation_logits'];
        expect(outputTensor).toBeDefined();

        // Verify output shape
        expect(outputTensor.dims).toEqual([1, 4, 192, 256]);

        // Verify output contains finite numeric values
        const outputData = outputTensor.data as Float32Array;
        expect(outputData.length).toBeGreaterThan(0);
        
        let allFinite = true;
        for (let i = 0; i < 100; i++) { // check first 100 for speed
            if (!Number.isFinite(outputData[i])) {
                allFinite = false;
                break;
            }
        }
        expect(allFinite).toBe(true);

        const provider = service.getProviderUsed();
        console.log(`[Smoke Test] Inference success. Provider used: ${provider}`);
        
        // Explicitly assert we got a valid provider string
        expect(provider).toBeTruthy();
    });
});
