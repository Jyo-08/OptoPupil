import { describe, it, expect } from 'vitest';
import { EyeExtractor } from '../EyeExtractor';
import { TrackingEvaluator } from '../../tracking/TrackingEvaluator';
import { MEDIAPIPE_INDICES } from '../indices';
import type { NormalizedLandmark } from '../../../types/vision';

function createMockLandmarks(count: number): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = [];
  for (let i = 0; i < count; i++) {
    landmarks.push({
      x: 0.5,
      y: 0.5,
      z: 0.0,
      visibility: 1.0,
    });
  }

  // Populate Left Eye (Subject Left, x around 0.6)
  for (const idx of MEDIAPIPE_INDICES.LEFT_EYE.CONTOUR) {
    landmarks[idx] = { x: 0.58 + (idx % 5) * 0.01, y: 0.40 + (idx % 3) * 0.01, z: 0, visibility: 1.0 };
  }
  landmarks[MEDIAPIPE_INDICES.LEFT_EYE.INNER_CORNER] = { x: 0.55, y: 0.41, z: 0, visibility: 1.0 };
  landmarks[MEDIAPIPE_INDICES.LEFT_EYE.OUTER_CORNER] = { x: 0.65, y: 0.41, z: 0, visibility: 1.0 };
  landmarks[MEDIAPIPE_INDICES.LEFT_EYE.UPPER_LID_CENTER] = { x: 0.60, y: 0.38, z: 0, visibility: 1.0 };
  landmarks[MEDIAPIPE_INDICES.LEFT_EYE.LOWER_LID_CENTER] = { x: 0.60, y: 0.44, z: 0, visibility: 1.0 };

  // Populate Right Eye (Subject Right, x around 0.4)
  for (const idx of MEDIAPIPE_INDICES.RIGHT_EYE.CONTOUR) {
    landmarks[idx] = { x: 0.38 + (idx % 5) * 0.01, y: 0.40 + (idx % 3) * 0.01, z: 0, visibility: 1.0 };
  }
  landmarks[MEDIAPIPE_INDICES.RIGHT_EYE.INNER_CORNER] = { x: 0.45, y: 0.41, z: 0, visibility: 1.0 };
  landmarks[MEDIAPIPE_INDICES.RIGHT_EYE.OUTER_CORNER] = { x: 0.35, y: 0.41, z: 0, visibility: 1.0 };
  landmarks[MEDIAPIPE_INDICES.RIGHT_EYE.UPPER_LID_CENTER] = { x: 0.40, y: 0.38, z: 0, visibility: 1.0 };
  landmarks[MEDIAPIPE_INDICES.RIGHT_EYE.LOWER_LID_CENTER] = { x: 0.40, y: 0.44, z: 0, visibility: 1.0 };

  // Face Oval for bounding box
  for (const idx of MEDIAPIPE_INDICES.FACE_OVAL) {
    landmarks[idx] = { x: 0.3 + (idx % 10) * 0.04, y: 0.2 + (idx % 10) * 0.06, z: 0, visibility: 1.0 };
  }

  // Populate Irises if >= 478
  if (count >= 478) {
    landmarks[MEDIAPIPE_INDICES.LEFT_IRIS.CENTER] = { x: 0.60, y: 0.41, z: 0, visibility: 1.0 };
    landmarks[MEDIAPIPE_INDICES.LEFT_IRIS.TOP] = { x: 0.60, y: 0.39, z: 0, visibility: 1.0 };
    landmarks[MEDIAPIPE_INDICES.LEFT_IRIS.BOTTOM] = { x: 0.60, y: 0.43, z: 0, visibility: 1.0 };
    landmarks[MEDIAPIPE_INDICES.LEFT_IRIS.RIGHT] = { x: 0.62, y: 0.41, z: 0, visibility: 1.0 };
    landmarks[MEDIAPIPE_INDICES.LEFT_IRIS.LEFT] = { x: 0.58, y: 0.41, z: 0, visibility: 1.0 };

    landmarks[MEDIAPIPE_INDICES.RIGHT_IRIS.CENTER] = { x: 0.40, y: 0.41, z: 0, visibility: 1.0 };
    landmarks[MEDIAPIPE_INDICES.RIGHT_IRIS.TOP] = { x: 0.40, y: 0.39, z: 0, visibility: 1.0 };
    landmarks[MEDIAPIPE_INDICES.RIGHT_IRIS.BOTTOM] = { x: 0.40, y: 0.43, z: 0, visibility: 1.0 };
    landmarks[MEDIAPIPE_INDICES.RIGHT_IRIS.RIGHT] = { x: 0.42, y: 0.41, z: 0, visibility: 1.0 };
    landmarks[MEDIAPIPE_INDICES.RIGHT_IRIS.LEFT] = { x: 0.38, y: 0.41, z: 0, visibility: 1.0 };
  }

  return landmarks;
}

describe('EyeExtractor Deterministic Pipeline', () => {
  it('should extract both eyes and both irises from standard 478-landmark MediaPipe output', () => {
    const landmarks = createMockLandmarks(478);
    const ocularData = EyeExtractor.extractOcularData(landmarks);

    // Left Eye verification
    expect(ocularData.leftEye).not.toBeNull();
    expect(ocularData.leftEye?.contour.length).toBe(16);
    expect(ocularData.leftEye?.boundingBox.width).toBeGreaterThan(0);
    expect(ocularData.leftEye?.boundingBox.height).toBeGreaterThan(0);

    // Right Eye verification
    expect(ocularData.rightEye).not.toBeNull();
    expect(ocularData.rightEye?.contour.length).toBe(16);
    expect(ocularData.rightEye?.boundingBox.width).toBeGreaterThan(0);
    expect(ocularData.rightEye?.boundingBox.height).toBeGreaterThan(0);

    // Irises verification
    expect(ocularData.leftIris).not.toBeNull();
    expect(ocularData.leftIris?.center.x).toBeCloseTo(0.60);
    expect(ocularData.leftIris?.perimeter.length).toBe(4);
    expect(ocularData.leftIris?.estimatedRadiusNorm).toBeGreaterThan(0);

    expect(ocularData.rightIris).not.toBeNull();
    expect(ocularData.rightIris?.center.x).toBeCloseTo(0.40);
    expect(ocularData.rightIris?.perimeter.length).toBe(4);
    expect(ocularData.rightIris?.estimatedRadiusNorm).toBeGreaterThan(0);

    // IPD verification
    expect(ocularData.interpupillaryDistanceNorm).toBeCloseTo(0.20, 2);
  });

  it('should gracefully handle 468 landmarks by extracting eye contours without iris failure', () => {
    const landmarks = createMockLandmarks(468);
    const ocularData = EyeExtractor.extractOcularData(landmarks);

    expect(ocularData.leftEye).not.toBeNull();
    expect(ocularData.rightEye).not.toBeNull();
    expect(ocularData.leftIris).toBeNull();
    expect(ocularData.rightIris).toBeNull();
  });

  it('should evaluate tracking as GOOD when both eyes and irises are present', () => {
    const landmarks = createMockLandmarks(478);
    const ocularData = EyeExtractor.extractOcularData(landmarks);
    const tracking = TrackingEvaluator.evaluate(landmarks, ocularData, 30);

    expect(tracking.status).toBe('GOOD');
    expect(tracking.faceDetected).toBe(true);
    expect(tracking.leftEyeDetected).toBe(true);
    expect(tracking.rightEyeDetected).toBe(true);
    expect(tracking.leftIrisDetected).toBe(true);
    expect(tracking.rightIrisDetected).toBe(true);
  });
});
