/**
 * Core type definitions for OptoPupil Computer Vision & Pupil Detection Engine.
 * Provides strict contracts for landmark coordinates, ocular extraction,
 * pupil geometry, temporal stabilization, and tracking states.
 */

export interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface PixelPoint {
  x: number;
  y: number;
}

export interface EyeLandmarkSet {
  contour: NormalizedLandmark[];
  innerCorner: NormalizedLandmark;
  outerCorner: NormalizedLandmark;
  upperEyelid: NormalizedLandmark;
  lowerEyelid: NormalizedLandmark;
  boundingBox: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
}

export interface IrisLandmarkSet {
  center: NormalizedLandmark;
  perimeter: NormalizedLandmark[];
  estimatedRadiusNorm: number;
}

export interface ExtractedOcularData {
  leftEye: EyeLandmarkSet | null;
  rightEye: EyeLandmarkSet | null;
  leftIris: IrisLandmarkSet | null;
  rightIris: IrisLandmarkSet | null;
  interpupillaryDistanceNorm?: number;
}

export type TrackingStatus = 'GOOD' | 'DEGRADED' | 'LOST';

export type PupilDetectionStatus = 'DETECTED' | 'UNCERTAIN' | 'LOST';

export interface StabilityStats {
  sampleCount: number;
  minDiameterPx: number;
  maxDiameterPx: number;
  meanDiameterPx: number;
  medianDiameterPx: number;
  rangePx: number;
  stdDevPx: number;
  cvPercent: number; // Coefficient of variation: (stdDev / mean) * 100%
}

export interface PupilGeometry {
  detected: boolean;
  status: PupilDetectionStatus;
  // Normalized coordinates (0 to 1) for canvas rendering and responsive alignment
  centerNorm: NormalizedLandmark | null;
  // Pixel coordinates in native video frame space
  centerPx: PixelPoint | null;
  radiusPx: number | null;
  diameterPx: number | null;
  // Calibrated real-world physical diameter in millimeters
  diameterMm?: number | null;
  // Ellipse fitting properties (major/minor axis & orientation angle)
  majorAxisPx?: number;
  minorAxisPx?: number;
  angleRad?: number;
  // Measured quality heuristics (darkness contrast & circularity score)
  contrastScore?: number;
  circularityScore?: number;
  // Rolling quantitative stability statistics
  stability?: StabilityStats;
}

export interface BilateralPupilData {
  leftPupil: PupilGeometry;
  rightPupil: PupilGeometry;
  rawLeftPupil: PupilGeometry;
  rawRightPupil: PupilGeometry;
}

export interface TrackingQuality {
  status: TrackingStatus;
  faceDetected: boolean;
  leftEyeDetected: boolean;
  rightEyeDetected: boolean;
  leftIrisDetected: boolean;
  rightIrisDetected: boolean;
  guidanceMessage: string;
  fps: number;
  faceBoundingBox?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

export interface VisionFrameOutput {
  timestamp: number;
  allLandmarks: NormalizedLandmark[] | null;
  ocularData: ExtractedOcularData;
  pupilData: BilateralPupilData;
  tracking: TrackingQuality;
  neuralShadowData?: import('../vision/ml/types').BilateralNeuralPupilResult | null;
  neuralTelemetry?: import('../vision/ml/types').NeuralComparisonTelemetry | null;
}
