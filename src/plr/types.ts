/**
 * OptoPupil - Pupillary Light Reflex (PLR) Kinetic Types & Data Contracts
 * Standardized data contracts for time-series recording, signal filtering,
 * numerical differentiation, and quantitative bilateral feature extraction.
 */

import type { StimulusTiming } from '../stimulus/types';
import type { PupilDetectionStatus } from '../types/vision';

/** Standard average human horizontal iris diameter in millimeters */
export const STANDARD_HUMAN_IRIS_DIAMETER_MM = 11.7;

/**
 * Raw or intermediate sample captured per video/animation frame.
 */
export interface PLRSample {
  /** Timestamp in milliseconds from performance.now() */
  timestamp: number;
  /** Relative time in milliseconds relative to stimulus onset (t - tStimulus) */
  relativeTimeMs: number;
  /** Left pupil measured diameter in pixels (null if lost/occluded) */
  leftDiameterPx: number | null;
  /** Right pupil measured diameter in pixels (null if lost/occluded) */
  rightDiameterPx: number | null;
  /** Left iris radius in pixels for physical millimeter scaling */
  leftIrisRadiusPx: number | null;
  /** Right iris radius in pixels for physical millimeter scaling */
  rightIrisRadiusPx: number | null;
  /** Left pupil physical diameter in millimeters (calibrated) */
  leftDiameterMm: number | null;
  /** Right pupil physical diameter in millimeters (calibrated) */
  rightDiameterMm: number | null;
  /** Whether the light stimulus flash was active at this sample */
  stimulusActive: boolean;
  /** Tracking quality status for this frame */
  trackingStatus: PupilDetectionStatus;
  /** Tracking confidence score (0 - 100%) */
  trackingConfidence: number;
  /** Flag indicating blink or occluded sample */
  isBlinkOrDropout: boolean;
}

/**
 * Cleaned, smoothed, and differentiated time-series trajectories for an eye.
 */
export interface CleanedEyeSeries {
  /** Uniform or time-aligned timestamps relative to stimulus (ms) */
  timeMs: number[];
  /** Raw un-smoothed diameter (mm) */
  rawMm: number[];
  /** Interpolated & smoothed diameter (mm) */
  cleanMm: number[];
  /** First derivative / constriction velocity dD/dt (mm/s) */
  velocityMmS: number[];
  /** Confidence / validity score per frame (0 - 100%) */
  confidence: number[];
  /** Flag array indicating interpolated/repaired samples */
  isInterpolated: boolean[];
}

/**
 * Processed bilateral PLR time-series containing both eyes and stimulus timing.
 */
export interface ProcessedPLRSeries {
  /** High-precision stimulus timing event */
  stimulusTiming: StimulusTiming;
  /** Cleaned Left Eye Series */
  leftEye: CleanedEyeSeries;
  /** Cleaned Right Eye Series */
  rightEye: CleanedEyeSeries;
  /** Total valid duration of recording (ms) */
  totalDurationMs: number;
  /** Average recording sampling rate (FPS) */
  averageFps: number;
  /** Overall recording quality score (0 - 100%) */
  recordingQualityScore: number;
}

/**
 * Quantitative kinetic parameters for a single eye.
 */
export interface EyePLRMetrics {
  /** Baseline pupil diameter prior to stimulus (mm) */
  baselineDiameterMm: number;
  /** Baseline pupil diameter in pixels (px) */
  baselineDiameterPx: number;
  /** Minimum pupil diameter at peak constriction (mm) */
  minDiameterMm: number;
  /** Minimum pupil diameter in pixels (px) */
  minDiameterPx: number;
  /** Absolute constriction amplitude: Baseline - Min (mm) */
  constrictionAmplitudeMm: number;
  /** Relative percentage constriction: ((Baseline - Min) / Baseline) * 100 (%) */
  constrictionPercentage: number;
  /** Response latency: time from stimulus onset to constriction initiation (ms) */
  latencyMs: number;
  /** Maximum Constriction Velocity: peak negative dD/dt magnitude (mm/s) */
  mcvMmS: number;
  /** Time from stimulus onset to peak constriction / nadir (ms) */
  timeToMinDiameterMs: number;
  /** Average constriction velocity from onset to nadir (mm/s) */
  averageConstrictionVelocityMmS: number;
  /** 75% Recovery Time from minimum constriction (ms, or null if recovery window incomplete) */
  recoveryTime75Ms: number | null;
  /** Signal-to-noise ratio / tracking reliability score for this eye (0 - 100%) */
  qualityScore: number;
  /** Classification status of the response pattern */
  responsePattern: 'NORMAL_REACTIVE' | 'SLUGGISH_REDUCED' | 'NON_REACTIVE_FIXED' | 'INCONCLUSIVE';
}

/**
 * Bilateral comparison and asymmetry indices between Left and Right eyes.
 */
export interface BilateralAsymmetryMetrics {
  /** Baseline Anisocoria: |Baseline_L - Baseline_R| (mm) */
  baselineAnisocoriaMm: number;
  /** Peak Constriction Anisocoria: |Min_L - Min_R| (mm) */
  minAnisocoriaMm: number;
  /** Difference in Constriction Percentage: |Constriction%_L - Constriction%_R| (%) */
  constrictionPercentageDiff: number;
  /** Difference in Constriction Amplitude: |Amp_L - Amp_R| (mm) */
  amplitudeDifferenceMm: number;
  /** Difference in Response Latency: |Latency_L - Latency_R| (ms) */
  latencyDifferenceMs: number;
  /** Difference in Maximum Constriction Velocity: |MCV_L - MCV_R| (mm/s) */
  mcvDifferenceMmS: number;
  /** Whether the bilateral asymmetry exceeds standard physiological threshold (>0.4mm anisocoria or >10% constriction delta) */
  isSignificantAsymmetry: boolean;
  /** Clinical/screening summary flag */
  asymmetrySeverity: 'SYMMETRIC' | 'MILD_ASYMMETRY' | 'MARKED_ASYMMETRY';
}

/**
 * Complete comprehensive PLR screening output report.
 */
export interface BilateralPLRReport {
  /** Unique session ID */
  sessionId: string;
  /** ISO timestamp of screening */
  timestamp: string;
  /** Left Eye Quantitative Metrics */
  leftEye: EyePLRMetrics;
  /** Right Eye Quantitative Metrics */
  rightEye: EyePLRMetrics;
  /** Bilateral Asymmetry Analysis */
  bilateralAsymmetry: BilateralAsymmetryMetrics;
  /** Cleaned time-series data for charting */
  timeSeries: ProcessedPLRSeries;
  /** Overall screening reliability status */
  isReliable: boolean;
  /** Overall data quality score (0 - 100%) */
  overallQualityScore: number;
  /** Diagnostic notes and warnings */
  notes: string[];
}

/**
 * Recording protocol state machine phases.
 */
export type RecordingPhase =
  | 'IDLE'                  // Waiting to start
  | 'STABILIZING'           // Verifying face lock before capture
  | 'BASELINE'              // Capturing pre-stimulus dark/ambient baseline (~1.5s)
  | 'STIMULUS'              // Delivering full-screen white flash (~200ms)
  | 'CONSTRICTION_RECOVERY' // Capturing post-stimulus constriction & recovery (~3.5s)
  | 'PROCESSING'            // Filtering signal & extracting kinetic features
  | 'COMPLETE'              // Screening report ready
  | 'FAILED_INCONCLUSIVE';  // Insufficient valid frames / tracking lost
