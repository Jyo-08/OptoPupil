import type {
  NormalizedLandmark,
  EyeLandmarkSet,
  IrisLandmarkSet,
  ExtractedOcularData,
} from '../../types/vision';
import { MEDIAPIPE_INDICES } from './indices';

export class EyeExtractor {
  /**
   * Extract both eye contours and iris landmarks from the full 478-point landmark array.
   */
  public static extractOcularData(landmarks: NormalizedLandmark[] | null): ExtractedOcularData {
    if (!landmarks || landmarks.length < 478) {
      return {
        leftEye: null,
        rightEye: null,
        leftIris: null,
        rightIris: null,
      };
    }

    const leftEye = this.extractEyeContour(landmarks, MEDIAPIPE_INDICES.LEFT_EYE);
    const rightEye = this.extractEyeContour(landmarks, MEDIAPIPE_INDICES.RIGHT_EYE);
    const leftIris = this.extractIris(landmarks, MEDIAPIPE_INDICES.LEFT_IRIS);
    const rightIris = this.extractIris(landmarks, MEDIAPIPE_INDICES.RIGHT_IRIS);

    // Calculate normalized interpupillary distance if both iris centers exist
    let interpupillaryDistanceNorm: number | undefined;
    if (leftIris && rightIris) {
      const dx = leftIris.center.x - rightIris.center.x;
      const dy = leftIris.center.y - rightIris.center.y;
      interpupillaryDistanceNorm = Math.sqrt(dx * dx + dy * dy);
    }

    return {
      leftEye,
      rightEye,
      leftIris,
      rightIris,
      interpupillaryDistanceNorm,
    };
  }

  private static extractEyeContour(
    landmarks: NormalizedLandmark[],
    indices: typeof MEDIAPIPE_INDICES.LEFT_EYE | typeof MEDIAPIPE_INDICES.RIGHT_EYE
  ): EyeLandmarkSet | null {
    const contour = indices.CONTOUR.map((idx) => landmarks[idx]).filter(Boolean);
    const innerCorner = landmarks[indices.INNER_CORNER];
    const outerCorner = landmarks[indices.OUTER_CORNER];
    const upperEyelid = landmarks[indices.UPPER_LID_CENTER];
    const lowerEyelid = landmarks[indices.LOWER_LID_CENTER];

    if (!innerCorner || !outerCorner || !upperEyelid || !lowerEyelid || contour.length < 4) {
      return null;
    }

    let minX = 1;
    let minY = 1;
    let maxX = 0;
    let maxY = 0;

    for (const pt of contour) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }

    return {
      contour,
      innerCorner,
      outerCorner,
      upperEyelid,
      lowerEyelid,
      boundingBox: {
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX,
        height: maxY - minY,
      },
    };
  }

  private static extractIris(
    landmarks: NormalizedLandmark[],
    indices: typeof MEDIAPIPE_INDICES.LEFT_IRIS | typeof MEDIAPIPE_INDICES.RIGHT_IRIS
  ): IrisLandmarkSet | null {
    const center = landmarks[indices.CENTER];
    const perimeter = indices.PERIMETER.map((idx) => landmarks[idx]).filter(Boolean);

    if (!center || perimeter.length < 4) {
      return null;
    }

    // Calculate average Euclidean distance from center to 4 perimeter points (normalized)
    let radiusSum = 0;
    for (const pt of perimeter) {
      const dx = pt.x - center.x;
      const dy = pt.y - center.y;
      radiusSum += Math.sqrt(dx * dx + dy * dy);
    }
    const estimatedRadiusNorm = radiusSum / perimeter.length;

    return {
      center,
      perimeter,
      estimatedRadiusNorm,
    };
  }
}
