/**
 * OptoPupil - PLR Engine Algorithmic Verification Test
 * Validates BlinkFilter, SignalSmoother, Differentiator, and PLRFeatureExtractor
 * using synthetic physiological PLR curves with known ground-truth parameters.
 */

import { BlinkFilter, type RawDataPoint } from '../signal/BlinkFilter';
import { SignalSmoother } from '../signal/SignalSmoother';
import { Differentiator } from '../signal/Differentiator';
import { SignalProcessor } from '../signal/SignalProcessor';
import { PLRFeatureExtractor } from '../analytics/PLRFeatureExtractor';
import type { PLRSample } from '../types';
import type { StimulusTiming } from '../../stimulus/types';

function runVerification() {
  console.log('=== RUNNING OPTO PUPIL PLR ENGINE VERIFICATION ===\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${testName}`);
    }
  }

  // -------------------------------------------------------------
  // Test 1: BlinkFilter - Short Gap Interpolation
  // -------------------------------------------------------------
  console.log('--- Test Suite 1: BlinkFilter ---');
  const rawPoints: RawDataPoint[] = [
    { timeMs: 0, value: 4.0, confidence: 90 },
    { timeMs: 33, value: 4.0, confidence: 90 },
    { timeMs: 66, value: null, confidence: 10 }, // Blink dropout
    { timeMs: 100, value: null, confidence: 10 }, // Blink dropout
    { timeMs: 133, value: 4.0, confidence: 90 },
    { timeMs: 166, value: 4.0, confidence: 90 },
  ];

  const filtered = BlinkFilter.filterBlinks(rawPoints);
  assert(filtered.length === 6, 'BlinkFilter: Preserves array length across 67ms blink gap');
  assert(
    filtered[2].isInterpolated && filtered[3].isInterpolated,
    'BlinkFilter: Marks gap samples as isInterpolated = true'
  );
  assert(
    Math.abs(filtered[2].value - 4.0) < 0.01 && Math.abs(filtered[3].value - 4.0) < 0.01,
    'BlinkFilter: Linearly interpolates pupil diameter accurately'
  );

  // -------------------------------------------------------------
  // Test 2: SignalSmoother - Savitzky-Golay Polynomial Smoothing
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 2: SignalSmoother ---');
  // Noisy constant signal
  const noisy = [4.0, 4.2, 3.8, 4.1, 3.9, 4.0, 4.1, 3.9, 4.0];
  const smoothed = SignalSmoother.smooth(noisy, 5);
  assert(smoothed.length === noisy.length, 'SignalSmoother: Output length matches input');
  const maxNoise = Math.max(...smoothed) - Math.min(...smoothed);
  const rawNoise = Math.max(...noisy) - Math.min(...noisy);
  assert(maxNoise < rawNoise, 'SignalSmoother: Reduces variance/jitter on noisy signal');

  // -------------------------------------------------------------
  // Test 3: Differentiator - Central Difference Velocity (dD/dt)
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 3: Differentiator ---');
  // Constant contraction of 2 mm/s: D(t) = 4.0 - 2.0 * (t/1000)
  const timeMs = [0, 50, 100, 150, 200];
  const diameters = timeMs.map((t) => 4.0 - 2.0 * (t / 1000));
  const velocities = Differentiator.computeVelocity(timeMs, diameters);
  assert(velocities.length === timeMs.length, 'Differentiator: Output velocity length matches');
  assert(
    Math.abs(velocities[2] - (-2.0)) < 0.05,
    'Differentiator: Computes accurate central difference slope (-2.0 mm/s)'
  );

  // -------------------------------------------------------------
  // Test 4: Synthetic Physiological PLR Waveform Feature Extraction
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 4: PLRFeatureExtractor with Known PLR Waveform ---');

  // Ground Truth Parameters:
  // Baseline = 4.2 mm (pre-stimulus -1500ms to 0ms)
  // Latency = ~220 ms
  // Constriction Nadir = 2.8 mm at t = 1100ms
  // Amplitude = 1.4 mm (33.3% constriction)
  const syntheticSamples: PLRSample[] = [];
  const fps = 30;
  const frameIntervalMs = 1000 / fps;
  const tStimulus = 1500; // Stimulus at t = 1500ms (1.5s baseline)

  for (let t = 0; t <= 5200; t += frameIntervalMs) {
    const relT = t - tStimulus; // ms relative to stimulus
    let leftMm = 4.2;
    let rightMm = 4.15;

    if (relT > 220 && relT <= 1100) {
      // Active constriction phase (sigmoidal/cosine shape)
      const phaseNorm = (relT - 220) / (1100 - 220); // 0 to 1
      const constrictLeft = 1.4 * 0.5 * (1 - Math.cos(Math.PI * phaseNorm));
      const constrictRight = 1.35 * 0.5 * (1 - Math.cos(Math.PI * phaseNorm));
      leftMm = 4.2 - constrictLeft;
      rightMm = 4.15 - constrictRight;
    } else if (relT > 1100) {
      // Redilation / recovery phase
      const recPhase = (relT - 1100) / 2500;
      leftMm = 2.8 + 0.6 * Math.min(1, recPhase);
      rightMm = 2.8 + 0.55 * Math.min(1, recPhase);
    }

    syntheticSamples.push({
      timestamp: t,
      relativeTimeMs: Math.round(relT),
      leftDiameterPx: leftMm * 20,
      rightDiameterPx: rightMm * 20,
      leftIrisRadiusPx: 117,
      rightIrisRadiusPx: 117,
      leftDiameterMm: Number(leftMm.toFixed(3)),
      rightDiameterMm: Number(rightMm.toFixed(3)),
      stimulusActive: relT >= 0 && relT <= 200,
      trackingStatus: 'DETECTED',
      trackingConfidence: 95,
      isBlinkOrDropout: false,
    });
  }

  const timing: StimulusTiming = {
    stimulusOnsetTime: tStimulus,
    stimulusOffsetTime: tStimulus + 200,
    configuredDurationMs: 200,
    actualDurationMs: 200,
  };

  const processedSeries = SignalProcessor.processSession(syntheticSamples, timing);
  const report = PLRFeatureExtractor.extractReport(processedSeries);

  console.log('Extracted Left Eye Kinetics:', {
    baselineMm: report.leftEye.baselineDiameterMm,
    minMm: report.leftEye.minDiameterMm,
    amplitudeMm: report.leftEye.constrictionAmplitudeMm,
    constrictionPct: report.leftEye.constrictionPercentage,
    latencyMs: report.leftEye.latencyMs,
    mcvMmS: report.leftEye.mcvMmS,
    pattern: report.leftEye.responsePattern,
  });

  console.log('Extracted Bilateral Asymmetry:', {
    anisocoria: report.bilateralAsymmetry.baselineAnisocoriaMm,
    constrictionDelta: report.bilateralAsymmetry.constrictionPercentageDiff,
    severity: report.bilateralAsymmetry.asymmetrySeverity,
  });

  assert(
    Math.abs(report.leftEye.baselineDiameterMm - 4.2) <= 0.05,
    'PLRFeatureExtractor: Baseline diameter extracted accurately (~4.2 mm)'
  );
  assert(
    Math.abs(report.leftEye.minDiameterMm - 2.8) <= 0.08,
    'PLRFeatureExtractor: Constriction nadir extracted accurately (~2.8 mm)'
  );
  assert(
    Math.abs(report.leftEye.constrictionAmplitudeMm - 1.4) <= 0.1,
    'PLRFeatureExtractor: Constriction amplitude extracted accurately (~1.4 mm)'
  );
  assert(
    Math.abs(report.leftEye.constrictionPercentage - 33.3) <= 2.5,
    'PLRFeatureExtractor: Constriction percentage extracted accurately (~33%)'
  );
  assert(
    report.leftEye.latencyMs >= 180 && report.leftEye.latencyMs <= 350,
    'PLRFeatureExtractor: Response latency extracted within physiological window (180-350 ms)'
  );
  assert(
    report.leftEye.mcvMmS >= 2.0,
    'PLRFeatureExtractor: Maximum constriction velocity detected (> 2.0 mm/s)'
  );
  assert(
    report.leftEye.responsePattern === 'NORMAL_REACTIVE',
    'PLRFeatureExtractor: Classified pattern as NORMAL_REACTIVE'
  );
  assert(
    report.bilateralAsymmetry.asymmetrySeverity === 'SYMMETRIC',
    'PLRFeatureExtractor: Classified bilateral symmetry as SYMMETRIC'
  );
  assert(report.isReliable === true, 'PLRFeatureExtractor: Valid session marked as reliable');

  console.log(`\n========================================`);
  console.log(`SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log(`========================================\n`);

  if (passedTests === totalTests) {
    console.log('✅ ALL PLR ENGINE ALGORITHMS VERIFIED SUCCESSFULLY.');
  } else {
    throw new Error('Some verification tests failed.');
  }
}

runVerification();
