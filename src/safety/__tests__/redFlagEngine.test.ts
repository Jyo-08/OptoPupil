/**
 * OptoPupil - Deterministic Red-Flag Safety Engine Unit Tests
 * 
 * Verifies medical triage rule evaluation, symptom overrides, emergency transport alerts,
 * and deterministic safety guarantees.
 */

import { RedFlagEngine } from '../redFlagEngine';
import type { BilateralPLRReport, EyePLRMetrics, BilateralAsymmetryMetrics, ProcessedPLRSeries } from '../../plr/types';
import type { PatientContext } from '../types';

function createMockReport(overrides?: {
  leftEye?: Partial<EyePLRMetrics>;
  rightEye?: Partial<EyePLRMetrics>;
  bilateralAsymmetry?: Partial<BilateralAsymmetryMetrics>;
  isReliable?: boolean;
}): BilateralPLRReport {
  const defaultLeftEye: EyePLRMetrics = {
    baselineDiameterMm: 4.5,
    baselineDiameterPx: 45,
    minDiameterMm: 3.0,
    minDiameterPx: 30,
    constrictionAmplitudeMm: 1.5,
    constrictionPercentage: 33.3,
    latencyMs: 240,
    mcvMmS: 2.8,
    timeToMinDiameterMs: 950,
    averageConstrictionVelocityMmS: 1.9,
    recoveryTime75Ms: 2200,
    qualityScore: 92,
    responsePattern: 'NORMAL_REACTIVE',
    ...overrides?.leftEye,
  };

  const defaultRightEye: EyePLRMetrics = {
    baselineDiameterMm: 4.6,
    baselineDiameterPx: 46,
    minDiameterMm: 3.1,
    minDiameterPx: 31,
    constrictionAmplitudeMm: 1.5,
    constrictionPercentage: 32.6,
    latencyMs: 245,
    mcvMmS: 2.7,
    timeToMinDiameterMs: 960,
    averageConstrictionVelocityMmS: 1.85,
    recoveryTime75Ms: 2250,
    qualityScore: 90,
    responsePattern: 'NORMAL_REACTIVE',
    ...overrides?.rightEye,
  };

  const defaultAsymmetry: BilateralAsymmetryMetrics = {
    baselineAnisocoriaMm: Math.abs(defaultLeftEye.baselineDiameterMm - defaultRightEye.baselineDiameterMm),
    minAnisocoriaMm: Math.abs(defaultLeftEye.minDiameterMm - defaultRightEye.minDiameterMm),
    constrictionPercentageDiff: Math.abs(defaultLeftEye.constrictionPercentage - defaultRightEye.constrictionPercentage),
    amplitudeDifferenceMm: Math.abs(defaultLeftEye.constrictionAmplitudeMm - defaultRightEye.constrictionAmplitudeMm),
    latencyDifferenceMs: Math.abs(defaultLeftEye.latencyMs - defaultRightEye.latencyMs),
    mcvDifferenceMmS: Math.abs(defaultLeftEye.mcvMmS - defaultRightEye.mcvMmS),
    isSignificantAsymmetry: false,
    asymmetrySeverity: 'SYMMETRIC',
    ...overrides?.bilateralAsymmetry,
  };

  const defaultTimeSeries: ProcessedPLRSeries = {
    stimulusTiming: {
      stimulusOnsetTime: 1500,
      stimulusOffsetTime: 1700,
      configuredDurationMs: 200,
      actualDurationMs: 200,
    },
    leftEye: {
      timeMs: [0, 1500, 2000, 5000],
      rawMm: [4.5, 4.5, 3.0, 4.0],
      cleanMm: [4.5, 4.5, 3.0, 4.0],
      velocityMmS: [0, 0, -2.8, 0.5],
      confidence: [100, 100, 100, 100],
      isInterpolated: [false, false, false, false],
    },
    rightEye: {
      timeMs: [0, 1500, 2000, 5000],
      rawMm: [4.6, 4.6, 3.1, 4.1],
      cleanMm: [4.6, 4.6, 3.1, 4.1],
      velocityMmS: [0, 0, -2.7, 0.5],
      confidence: [100, 100, 100, 100],
      isInterpolated: [false, false, false, false],
    },
    totalDurationMs: 5200,
    averageFps: 30,
    recordingQualityScore: 92,
  };

  return {
    sessionId: 'test_session_123',
    timestamp: new Date().toISOString(),
    leftEye: defaultLeftEye,
    rightEye: defaultRightEye,
    bilateralAsymmetry: defaultAsymmetry,
    timeSeries: defaultTimeSeries,
    isReliable: overrides?.isReliable ?? true,
    overallQualityScore: 91,
    notes: [],
  };
}

const defaultCleanContext: PatientContext = {
  patientId: 'PT-001',
  ageYears: 24,
  mechanism: 'ROUTINE_BASELINE_SCREEN',
  timeElapsed: 'NOT_APPLICABLE',
  symptoms: [],
};

export function runSafetyTests() {
  console.log('=== RUNNING DETERMINISTIC RED-FLAG SAFETY ENGINE VERIFICATION ===\n');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, desc: string) {
    total++;
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
    }
  }

  // Test 1
  const report1 = createMockReport();
  const a1 = RedFlagEngine.evaluate(report1, defaultCleanContext);
  assert(
    a1.urgency === 'NORMAL_GREEN' && !a1.requiresEmergencyTransport && !a1.requiresPlaySuspension && a1.triggers.length === 0,
    'Normal healthy symmetric PLR classified as NORMAL_GREEN'
  );

  // Test 2
  const report2 = createMockReport({
    leftEye: { baselineDiameterMm: 5.5 },
    rightEye: { baselineDiameterMm: 4.2 },
    bilateralAsymmetry: { baselineAnisocoriaMm: 1.3, isSignificantAsymmetry: true, asymmetrySeverity: 'MARKED_ASYMMETRY' },
  });
  const a2 = RedFlagEngine.evaluate(report2, defaultCleanContext);
  assert(
    a2.urgency === 'EMERGENCY_RED' && a2.requiresEmergencyTransport && a2.triggers.some(t => t.id === 'PLR_SEVERE_ANISOCORIA'),
    'Severe anisocoria (>= 1.0mm) triggers EMERGENCY_RED'
  );

  // Test 3
  const report3 = createMockReport({
    leftEye: { responsePattern: 'NON_REACTIVE_FIXED', constrictionPercentage: 2.1, constrictionAmplitudeMm: 0.1 },
    rightEye: { responsePattern: 'NON_REACTIVE_FIXED', constrictionPercentage: 1.8, constrictionAmplitudeMm: 0.08 },
  });
  const a3 = RedFlagEngine.evaluate(report3, defaultCleanContext);
  assert(
    a3.urgency === 'EMERGENCY_RED' && a3.triggers.some(t => t.id === 'PLR_BILATERAL_FIXED'),
    'Bilateral fixed pupils trigger EMERGENCY_RED'
  );

  // Test 4
  const report4 = createMockReport({
    leftEye: { responsePattern: 'NON_REACTIVE_FIXED', constrictionPercentage: 3.0 },
    rightEye: { responsePattern: 'NORMAL_REACTIVE', constrictionPercentage: 32.0 },
  });
  const a4 = RedFlagEngine.evaluate(report4, defaultCleanContext);
  assert(
    a4.urgency === 'EMERGENCY_RED' && a4.triggers.some(t => t.id === 'PLR_UNILATERAL_FIXED'),
    'Unilateral fixed pupil triggers EMERGENCY_RED'
  );

  // Test 5
  const normalReport = createMockReport();
  const traumaContext: PatientContext = {
    patientId: 'ATHLETE-09',
    mechanism: 'SPORTS_COLLISION',
    timeElapsed: 'LESS_THAN_30_MIN',
    symptoms: ['REPEATED_VOMITING', 'SEIZURE_CONVULSION'],
  };
  const a5 = RedFlagEngine.evaluate(normalReport, traumaContext);
  assert(
    a5.urgency === 'EMERGENCY_RED' && a5.triggers.some(t => t.id === 'SYM_REPEATED_VOMITING') && a5.triggers.some(t => t.id === 'SYM_SEIZURE_CONVULSION'),
    'Critical symptom override (Repeated vomiting + Seizure) triggers EMERGENCY_RED on normal PLR'
  );

  // Test 6
  const neckContext: PatientContext = {
    patientId: 'TRAUMA-42',
    mechanism: 'MOTOR_VEHICLE_ACCIDENT',
    timeElapsed: 'LESS_THAN_30_MIN',
    symptoms: ['NECK_PAIN_SPINAL_TENDERNESS'],
  };
  const a6 = RedFlagEngine.evaluate(normalReport, neckContext);
  assert(
    a6.urgency === 'EMERGENCY_RED' && a6.actionDirectives.some(a => a.includes('cervical spine immobilization')),
    'Cervical spine tenderness enforces spinal precaution directive'
  );

  // Test 7
  const report7 = createMockReport({
    leftEye: { mcvMmS: 1.1, responsePattern: 'SLUGGISH_REDUCED' },
    rightEye: { mcvMmS: 1.2, responsePattern: 'SLUGGISH_REDUCED' },
  });
  const a7 = RedFlagEngine.evaluate(report7, defaultCleanContext);
  assert(
    a7.urgency === 'OBSERVE_AMBER' && a7.requiresPlaySuspension && a7.triggers.some(t => t.id === 'PLR_SLUGGISH_RESPONSE'),
    'Sluggish constriction velocity (< 1.5mm/s) triggers OBSERVE_AMBER'
  );

  // Test 8
  const report8 = createMockReport({
    leftEye: { latencyMs: 345 },
    rightEye: { latencyMs: 350 },
  });
  const a8 = RedFlagEngine.evaluate(report8, defaultCleanContext);
  assert(
    a8.urgency === 'OBSERVE_AMBER' && a8.triggers.some(t => t.id === 'PLR_DELAYED_LATENCY'),
    'Delayed latency (> 320ms) triggers OBSERVE_AMBER'
  );

  // Test 9
  const report9 = createMockReport({
    isReliable: false,
    leftEye: { qualityScore: 30 },
    rightEye: { qualityScore: 28 },
  });
  const a9 = RedFlagEngine.evaluate(report9, defaultCleanContext);
  assert(
    a9.urgency === 'INCONCLUSIVE_GRAY' && a9.triggers.some(t => t.id === 'PLR_LOW_QUALITY'),
    'Degraded tracking quality classified as INCONCLUSIVE_GRAY'
  );

  console.log(`\nVerification complete: ${passed}/${total} tests passed.\n`);
  if (passed !== total) {
    throw new Error(`Safety engine test failure: ${total - passed} failed.`);
  }
}

const proc = (globalThis as unknown as { process?: { argv?: string[] } }).process;
if (proc && proc.argv && proc.argv[1]?.includes('redFlagEngine.test')) {
  runSafetyTests();
}
