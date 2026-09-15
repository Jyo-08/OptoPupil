/**
 * Core type definitions for OptoPupil Computer Vision Milestone 1.
 * Provides strict contracts for landmark coordinates, ocular extraction, and tracking state.
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
  tracking: TrackingQuality;
}
