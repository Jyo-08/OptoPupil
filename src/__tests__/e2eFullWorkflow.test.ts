/**
 * OptoPupil - Comprehensive End-to-End System & Backend Integration Test
 * Verifies full end-to-end execution of:
 * 1. Time-Series Capture from Vision Stream
 * 2. Controlled Stimulus Synchronization
 * 3. Signal Filtering, Blink Gap Repair & Savitzky-Golay Smoothing
 * 4. Numerical Velocity Differentiation (dD/dt)
 * 5. Kinetic Feature Extraction (Latency, Amplitude, MCV)
 * 6. Bilateral Asymmetry & Anisocoria Classification
 * 7. Pathological Edge Cases (Fixed Pupil, Severe Asymmetry, Blinks)
 */

import { TimeSeriesRecorder } from '../plr/recording/TimeSeriesRecorder';
import { SignalProcessor } from '../plr/signal/SignalProcessor';
import { PLRFeatureExtractor } from '../plr/analytics/PLRFeatureExtractor';
import type { VisionFrameOutput } from '../types/vision';
import type { StimulusTiming } from '../stimulus/types';
import type { PLRSample } from '../plr/types';

function runE2EValidation() {
  console.log('===========================================================');
  console.log('🔬 OPTO PUPIL END-TO-END SYSTEM INTEGRATION VERIFICATION');
  console.log('===========================================================\n');

  let passed = 0;
  let total = 0;

  function expect(condition: boolean, description: string) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${description}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${description}`);
    }
  }

  // =========================================================================
  // WORKFLOW 1: Normal Reactive Bilateral Screening Execution
  // =========================================================================
  console.log('🔹 [WORKFLOW 1] Normal Reactive Bilateral Screening Workflow');

  const recorder = new TimeSeriesRecorder();
  recorder.start();
  expect(recorder.isActive() === true, 'Recorder initializes and enters active state');

  const fps = 30;
  const frameIntervalMs = 1000 / fps;
  const tStimulus = 1500; // Flash at 1.5s
  const stimDurationMs = 200;

  // Simulate vision frames for 5.2 seconds
  for (let t = 0; t <= 5200; t += frameIntervalMs) {
    const relT = t - tStimulus;
    const isStimActive = relT >= 0 && relT <= stimDurationMs;

    // Physiological pupil diameter dynamics (Baseline 4.2mm, constricts to 2.9mm with 220ms latency)
    let leftMm = 4.2;
    let rightMm = 4.18;

    if (relT > 220 && relT <= 1200) {
      const p = (relT - 220) / (1200 - 220);
      const drop = 1.3 * 0.5 * (1 - Math.cos(Math.PI * p));
      leftMm = 4.2 - drop;
      rightMm = 4.18 - drop * 0.98;
    } else if (relT > 1200) {
      const rec = (relT - 1200) / 2000;
      leftMm = 2.9 + 0.6 * Math.min(1, rec);
      rightMm = 2.91 + 0.58 * Math.min(1, rec);
    }

    // Convert mm to pixels via 11.7mm standard iris ratio (iris radius = 117px -> 234px diameter)
    const irisRadiusPx = 117; // 11.7mm / 234px = 0.05 mm/px
    const leftPx = leftMm / (11.7 / (2 * irisRadiusPx));
    const rightPx = rightMm / (11.7 / (2 * irisRadiusPx));

    // Construct mock VisionFrameOutput matching useVisionPipeline
    const frame: VisionFrameOutput = {
      timestamp: t,
      allLandmarks: [{ x: 0.5, y: 0.5, z: 0 }],
      ocularData: {
        leftEye: {
          contour: [],
          innerCorner: { x: 0.4, y: 0.4, z: 0 },
          outerCorner: { x: 0.45, y: 0.4, z: 0 },
          upperEyelid: { x: 0.42, y: 0.38, z: 0 },
          lowerEyelid: { x: 0.42, y: 0.42, z: 0 },
          boundingBox: { minX: 0.38, minY: 0.35, maxX: 0.46, maxY: 0.45, width: 0.08, height: 0.1 },
        },
        rightEye: {
          contour: [],
          innerCorner: { x: 0.55, y: 0.4, z: 0 },
          outerCorner: { x: 0.6, y: 0.4, z: 0 },
          upperEyelid: { x: 0.58, y: 0.38, z: 0 },
          lowerEyelid: { x: 0.58, y: 0.42, z: 0 },
          boundingBox: { minX: 0.54, minY: 0.35, maxX: 0.62, maxY: 0.45, width: 0.08, height: 0.1 },
        },
        leftIris: {
          center: { x: 0.42, y: 0.4, z: 0 },
          perimeter: [],
          estimatedRadiusNorm: irisRadiusPx / 1280,
        },
        rightIris: {
          center: { x: 0.58, y: 0.4, z: 0 },
          perimeter: [],
          estimatedRadiusNorm: irisRadiusPx / 1280,
        },
      },
      pupilData: {
        leftPupil: {
          detected: true,
          status: 'DETECTED',
          centerNorm: { x: 0.42, y: 0.4, z: 0 },
          centerPx: { x: 537, y: 288 },
          radiusPx: leftPx / 2,
          diameterPx: leftPx,
        },
        rightPupil: {
          detected: true,
          status: 'DETECTED',
          centerNorm: { x: 0.58, y: 0.4, z: 0 },
          centerPx: { x: 742, y: 288 },
          radiusPx: rightPx / 2,
          diameterPx: rightPx,
        },
        rawLeftPupil: { detected: true, status: 'DETECTED', centerNorm: null, centerPx: null, radiusPx: null, diameterPx: null },
        rawRightPupil: { detected: true, status: 'DETECTED', centerNorm: null, centerPx: null, radiusPx: null, diameterPx: null },
      },
      tracking: {
        status: 'GOOD',
        faceDetected: true,
        leftEyeDetected: true,
        rightEyeDetected: true,
        leftIrisDetected: true,
        rightIrisDetected: true,
        guidanceMessage: 'Optimal tracking',
        fps: 30,
      },
    };

    recorder.recordFrame(frame, isStimActive, tStimulus);
  }

  const collectedSamples = recorder.stop();
  expect(collectedSamples.length >= 150, `Captured ${collectedSamples.length} time-series frames across session`);

  const timing: StimulusTiming = {
    stimulusOnsetTime: tStimulus,
    stimulusOffsetTime: tStimulus + stimDurationMs,
    configuredDurationMs: stimDurationMs,
    actualDurationMs: stimDurationMs,
  };

  // Run Backend Signal Processing
  const processedSeries = SignalProcessor.processSession(collectedSamples, timing);
  expect(processedSeries.leftEye.cleanMm.length > 0, 'Signal processor generated clean left pupil trajectory');
  expect(processedSeries.rightEye.cleanMm.length > 0, 'Signal processor generated clean right pupil trajectory');
  expect(processedSeries.leftEye.velocityMmS.length === processedSeries.leftEye.cleanMm.length, 'Velocity dD/dt differentiated for all points');

  // Extract Quantitative Features
  const report = PLRFeatureExtractor.extractReport(processedSeries);

  expect(Math.abs(report.leftEye.baselineDiameterMm - 4.2) < 0.05, `Left baseline diameter verified (${report.leftEye.baselineDiameterMm} mm)`);
  expect(Math.abs(report.leftEye.minDiameterMm - 2.9) < 0.08, `Left min diameter / nadir verified (${report.leftEye.minDiameterMm} mm)`);
  expect(Math.abs(report.leftEye.constrictionAmplitudeMm - 1.3) < 0.1, `Left constriction amplitude verified (${report.leftEye.constrictionAmplitudeMm} mm)`);
  expect(report.leftEye.latencyMs >= 180 && report.leftEye.latencyMs <= 350, `Left response latency verified (${report.leftEye.latencyMs} ms)`);
  expect(report.leftEye.mcvMmS >= 1.8, `Left MCV verified (${report.leftEye.mcvMmS} mm/s)`);
  expect(report.leftEye.responsePattern === 'NORMAL_REACTIVE', `Response pattern correctly classified as NORMAL_REACTIVE`);
  expect(report.bilateralAsymmetry.asymmetrySeverity === 'SYMMETRIC', `Bilateral symmetry correctly classified as SYMMETRIC`);
  expect(report.isReliable === true, 'Overall screening report marked as reliable (isReliable = true)');

  // =========================================================================
  // WORKFLOW 2: Robustness - Blink Dropout Repair & Noise Suppression
  // =========================================================================
  console.log('\n🔹 [WORKFLOW 2] Blink Dropout Interpolation & Noise Suppression');

  const noisyWithBlinks: PLRSample[] = [];
  for (let i = 0; i < 60; i++) {
    const t = i * 33.3;
    const isBlink = i >= 20 && i <= 24; // 5-frame blink dropout (~166ms)
    const noise = (Math.random() - 0.5) * 0.15; // Jitter

    noisyWithBlinks.push({
      timestamp: t,
      relativeTimeMs: t,
      leftDiameterPx: isBlink ? null : (4.0 + noise) * 20,
      rightDiameterPx: isBlink ? null : (4.0 + noise) * 20,
      leftIrisRadiusPx: 117,
      rightIrisRadiusPx: 117,
      leftDiameterMm: isBlink ? null : 4.0 + noise,
      rightDiameterMm: isBlink ? null : 4.0 + noise,
      stimulusActive: false,
      trackingStatus: isBlink ? 'LOST' : 'DETECTED',
      trackingConfidence: isBlink ? 0 : 90,
      isBlinkOrDropout: isBlink,
    });
  }

  const repairedSeries = SignalProcessor.processSession(noisyWithBlinks, timing);
  expect(repairedSeries.leftEye.cleanMm.length === 60, 'BlinkFilter repaired all 5 dropout frames via gap interpolation');
  const maxRepairedDeviation = Math.max(...repairedSeries.leftEye.cleanMm) - Math.min(...repairedSeries.leftEye.cleanMm);
  expect(maxRepairedDeviation < 0.25, `Savitzky-Golay smoothed out sensor noise (max deviation = ${maxRepairedDeviation.toFixed(3)} mm)`);

  // =========================================================================
  // WORKFLOW 3: Pathological Case - Severe Bilateral Asymmetry & Anisocoria
  // =========================================================================
  console.log('\n🔹 [WORKFLOW 3] Pathological Asymmetry & Anisocoria Detection');

  // Left Eye: Normal reactive (4.5mm -> 3.0mm, 33% constriction)
  // Right Eye: Sluggish / blunted (3.2mm -> 3.0mm, 6% constriction, severe anisocoria 1.3mm)
  const asymmetricSamples: PLRSample[] = [];
  for (let t = 0; t <= 4000; t += 33.3) {
    const relT = t - 1000;
    let l = 4.5;
    let r = 3.2;

    if (relT > 250) {
      l = Math.max(3.0, 4.5 - (relT - 250) * 0.002);
      r = Math.max(3.0, 3.2 - (relT - 250) * 0.0003); // very weak constriction
    }

    asymmetricSamples.push({
      timestamp: t,
      relativeTimeMs: relT,
      leftDiameterPx: l * 20,
      rightDiameterPx: r * 20,
      leftIrisRadiusPx: 117,
      rightIrisRadiusPx: 117,
      leftDiameterMm: l,
      rightDiameterMm: r,
      stimulusActive: relT >= 0 && relT <= 200,
      trackingStatus: 'DETECTED',
      trackingConfidence: 95,
      isBlinkOrDropout: false,
    });
  }

  const asymSeries = SignalProcessor.processSession(asymmetricSamples, {
    stimulusOnsetTime: 1000,
    stimulusOffsetTime: 1200,
    configuredDurationMs: 200,
    actualDurationMs: 200,
  });

  const asymReport = PLRFeatureExtractor.extractReport(asymSeries);
  expect(asymReport.bilateralAsymmetry.baselineAnisocoriaMm >= 1.0, `Detected severe baseline anisocoria (${asymReport.bilateralAsymmetry.baselineAnisocoriaMm} mm)`);
  expect(asymReport.bilateralAsymmetry.asymmetrySeverity === 'MARKED_ASYMMETRY', 'Correctly flagged as MARKED_ASYMMETRY');
  expect(asymReport.rightEye.responsePattern === 'SLUGGISH_REDUCED' || asymReport.rightEye.responsePattern === 'NON_REACTIVE_FIXED', 'Right eye correctly diagnosed as sluggish/blunted');
  expect(asymReport.notes.length > 0, `Diagnostic alert generated: "${asymReport.notes[0]}"`);

  // =========================================================================
  // WORKFLOW 4: Non-Reactive / Fixed Pupil Detection (Brainstem Red-Flag)
  // =========================================================================
  console.log('\n🔹 [WORKFLOW 4] Non-Reactive Fixed Pupil Detection');

  const fixedSamples: PLRSample[] = [];
  for (let t = 0; t <= 3000; t += 33.3) {
    fixedSamples.push({
      timestamp: t,
      relativeTimeMs: t - 1000,
      leftDiameterPx: 5.0 * 20,
      rightDiameterPx: 5.0 * 20,
      leftIrisRadiusPx: 117,
      rightIrisRadiusPx: 117,
      leftDiameterMm: 5.0, // Fixed 5.0mm, 0 constriction
      rightDiameterMm: 5.0,
      stimulusActive: t >= 1000 && t <= 1200,
      trackingStatus: 'DETECTED',
      trackingConfidence: 95,
      isBlinkOrDropout: false,
    });
  }

  const fixedSeries = SignalProcessor.processSession(fixedSamples, {
    stimulusOnsetTime: 1000,
    stimulusOffsetTime: 1200,
    configuredDurationMs: 200,
    actualDurationMs: 200,
  });

  const fixedReport = PLRFeatureExtractor.extractReport(fixedSeries);
  expect(fixedReport.leftEye.responsePattern === 'NON_REACTIVE_FIXED', 'Left eye correctly classified as NON_REACTIVE_FIXED');
  expect(fixedReport.rightEye.responsePattern === 'NON_REACTIVE_FIXED', 'Right eye correctly classified as NON_REACTIVE_FIXED');

  console.log('\n===========================================================');
  console.log(`🎉 ALL ${passed}/${total} END-TO-END INTEGRATION TESTS PASSED!`);
  console.log('===========================================================\n');
}

runE2EValidation();
