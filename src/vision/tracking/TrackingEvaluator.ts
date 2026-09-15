import type {
  NormalizedLandmark,
  ExtractedOcularData,
  TrackingQuality,
  TrackingStatus,
} from '../../types/vision';
import { MEDIAPIPE_INDICES } from '../eyes/indices';

export class TrackingEvaluator {
  public static evaluate(
    landmarks: NormalizedLandmark[] | null,
    ocularData: ExtractedOcularData,
    currentFps: number
  ): TrackingQuality {
    if (!landmarks || landmarks.length === 0) {
      return {
        status: 'LOST',
        faceDetected: false,
        leftEyeDetected: false,
        rightEyeDetected: false,
        leftIrisDetected: false,
        rightIrisDetected: false,
        guidanceMessage: 'No face detected. Position your face in front of the camera.',
        fps: currentFps,
      };
    }

    const faceDetected = true;
    const leftEyeDetected = ocularData.leftEye !== null;
    const rightEyeDetected = ocularData.rightEye !== null;
    const leftIrisDetected = ocularData.leftIris !== null;
    const rightIrisDetected = ocularData.rightIris !== null;

    // Calculate face bounding box from silhouette oval
    let minX = 1;
    let minY = 1;
    let maxX = 0;
    let maxY = 0;

    for (const idx of MEDIAPIPE_INDICES.FACE_OVAL) {
      const pt = landmarks[idx];
      if (pt) {
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
      }
    }

    const faceWidth = maxX - minX;
    const faceBoundingBox = { minX, minY, maxX, maxY };

    // Check boundary clipping (face partially outside frame)
    const isNearEdge = minX < 0.05 || maxX > 0.95 || minY < 0.05 || maxY > 0.95;

    // Check face distance / scale (too small or too close)
    const isTooFar = faceWidth < 0.18;
    const isTooClose = faceWidth > 0.85;

    // Determine status and guidance
    let status: TrackingStatus = 'GOOD';
    let guidanceMessage = 'Tracking optimal. Keep your head steady.';

    if (!leftEyeDetected || !rightEyeDetected || !leftIrisDetected || !rightIrisDetected) {
      status = 'DEGRADED';
      if (!leftEyeDetected && !rightEyeDetected) {
        guidanceMessage = 'Eyes not detected. Ensure face and eyes are unobstructed.';
      } else if (!leftEyeDetected) {
        guidanceMessage = 'Left eye occluded or poorly visible.';
      } else if (!rightEyeDetected) {
        guidanceMessage = 'Right eye occluded or poorly visible.';
      } else {
        guidanceMessage = 'Iris tracking degraded. Adjust ambient lighting or position.';
      }
    } else if (isNearEdge) {
      status = 'DEGRADED';
      guidanceMessage = 'Face is near frame edge. Center your face in the guide.';
    } else if (isTooFar) {
      status = 'DEGRADED';
      guidanceMessage = 'Move slightly closer to the camera.';
    } else if (isTooClose) {
      status = 'DEGRADED';
      guidanceMessage = 'Move slightly back from the camera.';
    }

    return {
      status,
      faceDetected,
      leftEyeDetected,
      rightEyeDetected,
      leftIrisDetected,
      rightIrisDetected,
      guidanceMessage,
      fps: currentFps,
      faceBoundingBox,
    };
  }
}
