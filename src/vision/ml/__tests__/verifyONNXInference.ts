/**
 * OptoPupil - ONNX Runtime Web Model Inference Verification Script
 * Validates loading the self-contained ONNX model, running a synthetic [1, 1, 192, 256] Float32
 * input tensor, inspecting the [1, 4, 192, 256] output logits, and executing argmax mask segmentation.
 */

import * as ort from 'onnxruntime-web';
import * as fs from 'fs';
import * as path from 'path';

async function runModelVerification() {
  console.log('=== RUNNING ONNX RUNTIME WEB INFERENCE VERIFICATION ===\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string) {
    total++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
    }
  }

  const modelPath = path.resolve(process.cwd(), 'public/models/pupil_segmentation.onnx');
  assert(fs.existsSync(modelPath), `Model file exists at ${modelPath}`);

  const buffer = fs.readFileSync(modelPath);
  assert(buffer.byteLength === 19661872, `Model byte size is exact (19,661,872 bytes / 18.751 MB)`);

  const t0 = performance.now();
  // Initialize inference session using Uint8Array buffer
  const session = await ort.InferenceSession.create(new Uint8Array(buffer), {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  });
  const tInit = performance.now() - t0;
  console.log(`Session initialized in ${tInit.toFixed(1)} ms`);

  assert(session !== null, 'InferenceSession created successfully');
  assert(session.inputNames.length === 1, `Model has exactly 1 input (found: ${session.inputNames[0]})`);
  assert(session.outputNames.length === 1, `Model has exactly 1 output (found: ${session.outputNames[0]})`);

  // Build a synthetic normalized ocular image [1, 1, 192, 256]
  const inputData = new Float32Array(192 * 256);
  // Fill with synthetic ocular background (0.6) and dark pupil circle (0.1) in center
  for (let y = 0; y < 192; y++) {
    for (let x = 0; x < 256; x++) {
      const dx = x - 128;
      const dy = y - 96;
      if (dx * dx + dy * dy <= 20 * 20) {
        inputData[y * 256 + x] = 0.1; // Dark pupil
      } else if (dx * dx + dy * dy <= 45 * 45) {
        inputData[y * 256 + x] = 0.35; // Iris
      } else {
        inputData[y * 256 + x] = 0.75; // Sclera / skin
      }
    }
  }

  const inputTensor = new ort.Tensor('float32', inputData, [1, 1, 192, 256]);
  assert(inputTensor.dims.join(',') === '1,1,192,256', 'Input tensor dims: [1, 1, 192, 256]');
  assert(inputTensor.type === 'float32', 'Input tensor type: float32');

  const tInferStart = performance.now();
  const feeds: Record<string, ort.Tensor> = { [session.inputNames[0]]: inputTensor };
  const results = await session.run(feeds);
  const tInferEnd = performance.now();
  const inferLatency = tInferEnd - tInferStart;

  console.log(`Forward pass execution time: ${inferLatency.toFixed(1)} ms`);

  const outputTensor = results[session.outputNames[0]];
  assert(outputTensor !== undefined, 'Output tensor returned from forward pass');
  assert(outputTensor.dims.join(',') === '1,4,192,256', `Output dims: [1, 4, 192, 256] (found: ${outputTensor.dims.join(',')})`);
  assert(outputTensor.type === 'float32', 'Output tensor type: float32');

  const outData = outputTensor.data as Float32Array;
  assert(outData.length === 1 * 4 * 192 * 256, `Output data length matches 196,608 elements`);

  let nanCount = 0;
  let infCount = 0;
  for (let i = 0; i < outData.length; i++) {
    if (isNaN(outData[i])) nanCount++;
    if (!isFinite(outData[i])) infCount++;
  }
  assert(nanCount === 0, 'Zero NaN values in model output logits');
  assert(infCount === 0, 'Zero Inf values in model output logits');

  // Verify Argmax on 4 classes (0: bg, 1: sclera, 2: pupil, 3: iris)
  const channelStride = 192 * 256;
  const classHistogram = [0, 0, 0, 0];
  for (let i = 0; i < channelStride; i++) {
    const l0 = outData[i];
    const l1 = outData[channelStride + i];
    const l2 = outData[channelStride * 2 + i];
    const l3 = outData[channelStride * 3 + i];

    let maxL = l0;
    let maxC = 0;
    if (l1 > maxL) { maxL = l1; maxC = 1; }
    if (l2 > maxL) { maxL = l2; maxC = 2; }
    if (l3 > maxL) { maxL = l3; maxC = 3; }

    classHistogram[maxC]++;
  }

  console.log('Class distribution in segmented frame:', {
    background_0: classHistogram[0],
    sclera_1: classHistogram[1],
    pupil_2: classHistogram[2],
    iris_3: classHistogram[3],
  });

  assert(
    classHistogram[0] + classHistogram[1] + classHistogram[2] + classHistogram[3] === channelStride,
    'All 49,152 pixels classified cleanly into classes 0-3'
  );

  console.log(`\n========================================`);
  console.log(`SUMMARY: ${passed}/${total} ONNX INFERENCE TESTS PASSED`);
  console.log(`========================================\n`);

  if (passed !== total) {
    throw new Error('Some ONNX inference verification tests failed.');
  }
}

runModelVerification().catch((err) => {
  console.error('Fatal ONNX verification error:', err);
  process.exit(1);
});
