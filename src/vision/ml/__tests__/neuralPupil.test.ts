/**
 * OptoPupil - Neural Pupil Segmentation & Geometry Unit Tests
 * Validates 8-connected component analysis, centroid calculation, circularity,
 * coordinate mapping, and argmax mask post-processing.
 */

import { PupilGeometryExtractor, type CropInfo } from '../PupilGeometryExtractor';

function runTests() {
  console.log('=== RUNNING OPTO PUPIL NEURAL ML UNIT TESTS ===\n');

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

  const crop: CropInfo = {
    videoX: 400,
    videoY: 200,
    cropWidth: 200,
    cropHeight: 150,
    videoWidth: 1280,
    videoHeight: 720,
  };

  // -------------------------------------------------------------
  // Test 1: Empty Mask -> Returns LOST Status with Safe Nulls
  // -------------------------------------------------------------
  console.log('--- Test Suite 1: Empty Mask ---');
  const emptyMask = new Uint8Array(192 * 256);
  const emptyGeom = PupilGeometryExtractor.extractGeometry(emptyMask, crop);

  assert(emptyGeom.detected === false, 'Empty Mask: detected is false');
  assert(emptyGeom.status === 'LOST', 'Empty Mask: status is LOST');
  assert(emptyGeom.diameterPx === null, 'Empty Mask: diameterPx is null');
  assert(emptyGeom.centroidVideo === null, 'Empty Mask: centroidVideo is null');
  assert(!isNaN(emptyGeom.circularity), 'Empty Mask: circularity is not NaN');

  // -------------------------------------------------------------
  // Test 2: Tiny Noise Component (< 10 px) -> Filtered Out as LOST
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 2: Noise Filtering (< 10px) ---');
  const noiseMask = new Uint8Array(192 * 256);
  // Set 5 pixels of noise
  noiseMask[10 * 256 + 10] = 1;
  noiseMask[10 * 256 + 11] = 1;
  noiseMask[11 * 256 + 10] = 1;
  noiseMask[11 * 256 + 11] = 1;
  noiseMask[12 * 256 + 10] = 1;

  const noiseGeom = PupilGeometryExtractor.extractGeometry(noiseMask, crop);
  assert(noiseGeom.detected === false, 'Noise (< 10px): Filtered out, detected is false');
  assert(noiseGeom.status === 'LOST', 'Noise (< 10px): status is LOST');

  // -------------------------------------------------------------
  // Test 3: Synthetic Circular Pupil Disk -> Known Geometry
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 3: Synthetic Circular Pupil Geometry ---');
  const diskMask = new Uint8Array(192 * 256);
  const centerRoiX = 128;
  const centerRoiY = 96;
  const targetRadiusRoi = 15; // 30px diameter circle in ROI space
  let expectedPixelCount = 0;

  for (let y = 0; y < 192; y++) {
    for (let x = 0; x < 256; x++) {
      const dx = x - centerRoiX;
      const dy = y - centerRoiY;
      if (dx * dx + dy * dy <= targetRadiusRoi * targetRadiusRoi) {
        diskMask[y * 256 + x] = 1;
        expectedPixelCount++;
      }
    }
  }

  const diskGeom = PupilGeometryExtractor.extractGeometry(diskMask, crop);

  assert(diskGeom.detected === true, 'Synthetic Pupil: detected is true');
  assert(diskGeom.status === 'DETECTED', 'Synthetic Pupil: status is DETECTED');
  assert(diskGeom.areaPx === expectedPixelCount, 'Synthetic Pupil: exact pixel area matches');
  assert(
    Math.abs(diskGeom.centroidRoi!.x - centerRoiX) < 0.5,
    `Synthetic Pupil: Centroid X (${diskGeom.centroidRoi!.x}) matches ground truth (${centerRoiX})`
  );
  assert(
    Math.abs(diskGeom.centroidRoi!.y - centerRoiY) < 0.5,
    `Synthetic Pupil: Centroid Y (${diskGeom.centroidRoi!.y}) matches ground truth (${centerRoiY})`
  );

  // Expected diameter in video space:
  // ROI diameter ≈ 30px. scaleX = 200 / 256 = 0.78125 -> videoDiameter ≈ 23.4px
  const expectedVideoDiameter = (2 * targetRadiusRoi) * (crop.cropWidth / 256);
  assert(
    Math.abs(diskGeom.diameterPx! - expectedVideoDiameter) < 1.0,
    `Synthetic Pupil: Video diameter (${diskGeom.diameterPx}px) matches scale projection (~${expectedVideoDiameter.toFixed(1)}px)`
  );

  // Check circularity score (> 0.75 for a discrete rasterized disk)
  assert(
    diskGeom.circularity >= 0.75,
    `Synthetic Pupil: High circularity score (${diskGeom.circularity}) for circular disk`
  );

  // Check video coordinate projection
  const expectedVideoX = crop.videoX + centerRoiX * (crop.cropWidth / 256);
  const expectedVideoY = crop.videoY + centerRoiY * (crop.cropHeight / 192);
  assert(
    Math.abs(diskGeom.centroidVideo!.x - expectedVideoX) < 1.0,
    `Synthetic Pupil: Video Centroid X (${diskGeom.centroidVideo!.x}) matches projection (${expectedVideoX})`
  );
  assert(
    Math.abs(diskGeom.centroidVideo!.y - expectedVideoY) < 1.0,
    `Synthetic Pupil: Video Centroid Y (${diskGeom.centroidVideo!.y}) matches projection (${expectedVideoY})`
  );

  // Check normalized coordinates
  const expectedNormX = expectedVideoX / crop.videoWidth;
  const expectedNormY = expectedVideoY / crop.videoHeight;
  assert(
    Math.abs(diskGeom.centroidNorm!.x - expectedNormX) < 0.005,
    `Synthetic Pupil: Normalized X (${diskGeom.centroidNorm!.x}) matches [0, 1] projection (${expectedNormX.toFixed(4)})`
  );
  assert(
    Math.abs(diskGeom.centroidNorm!.y - expectedNormY) < 0.005,
    `Synthetic Pupil: Normalized Y (${diskGeom.centroidNorm!.y}) matches [0, 1] projection (${expectedNormY.toFixed(4)})`
  );

  // -------------------------------------------------------------
  // Test 4: Multiple Connected Components -> Picks Largest
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 4: Largest Component Selection ---');
  const multiMask = new Uint8Array(192 * 256);
  // Component 1 (small): 12 pixels
  for (let y = 10; y < 14; y++) {
    for (let x = 10; x < 13; x++) {
      multiMask[y * 256 + x] = 1;
    }
  }
  // Component 2 (larger, true pupil): 40 pixels
  for (let y = 80; y < 88; y++) {
    for (let x = 80; x < 85; x++) {
      multiMask[y * 256 + x] = 1;
    }
  }

  const multiGeom = PupilGeometryExtractor.extractGeometry(multiMask, crop);
  assert(multiGeom.detected === true, 'Multi-component: detected is true');
  assert(multiGeom.areaPx === 40, 'Multi-component: correctly selects largest component (40px vs 12px)');
  assert(
    multiGeom.centroidRoi!.x >= 80 && multiGeom.centroidRoi!.x <= 85,
    'Multi-component: centroid corresponds to largest component'
  );

  console.log(`\n========================================`);
  console.log(`SUMMARY: ${passed}/${total} TESTS PASSED`);
  console.log(`========================================\n`);

  if (passed !== total) {
    throw new Error('Some neural pupil unit tests failed.');
  }
}

runTests();
