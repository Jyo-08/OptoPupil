/**
 * Centralized MediaPipe Face Landmarker Landmark Indices.
 * MediaPipe Face Mesh provides 468 standard facial landmarks + 10 iris refinement landmarks (indices 468-477).
 * All indices are strictly catalogued and documented here without magic numbers.
 */

export const MEDIAPIPE_INDICES = {
  // Left Iris (Viewer Right if mirrored, Subject Left)
  LEFT_IRIS: {
    CENTER: 468,
    TOP: 469,
    RIGHT: 470,
    BOTTOM: 471,
    LEFT: 472,
    ALL: [468, 469, 470, 471, 472] as const,
    PERIMETER: [469, 470, 471, 472] as const,
  },

  // Right Iris (Viewer Left if mirrored, Subject Right)
  RIGHT_IRIS: {
    CENTER: 473,
    TOP: 474,
    RIGHT: 475,
    BOTTOM: 476,
    LEFT: 477,
    ALL: [473, 474, 475, 476, 477] as const,
    PERIMETER: [474, 475, 476, 477] as const,
  },

  // Left Eye Contour Landmarks (Subject Left Eye)
  LEFT_EYE: {
    INNER_CORNER: 362,
    OUTER_CORNER: 263,
    UPPER_LID_CENTER: 386,
    LOWER_LID_CENTER: 374,
    CONTOUR: [
      362, 382, 381, 380, 374, 373, 390, 249,
      263, 466, 388, 387, 386, 385, 384, 398
    ] as const,
  },

  // Right Eye Contour Landmarks (Subject Right Eye)
  RIGHT_EYE: {
    INNER_CORNER: 133,
    OUTER_CORNER: 33,
    UPPER_LID_CENTER: 159,
    LOWER_LID_CENTER: 145,
    CONTOUR: [
      33, 7, 163, 144, 145, 153, 154, 155,
      133, 173, 157, 158, 159, 160, 161, 246
    ] as const,
  },

  // Key Face Landmarks for orientation and distance estimation
  FACE_CORE: {
    NOSE_TIP: 1,
    CHIN: 152,
    FOREHEAD: 10,
    LEFT_CHEEK: 234,
    RIGHT_CHEEK: 454,
  },

  // Face Silhouette Outer Contour for alignment guide
  FACE_OVAL: [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
    397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
    172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
  ] as const,
} as const;
