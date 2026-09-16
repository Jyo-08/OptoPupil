/**
 * Type definitions for OptoPupil Browser ONNX Neural Pupil Segmentation Subsystem.
 */

export type ONNXModelStatus = 'uninitialized' | 'loading' | 'ready' | 'error';
export type ExecutionProvider = 'webgpu' | 'wasm' | 'cpu';

export interface ModelMetadata {
  inputName: string;
  inputShape: number[];
  inputDtype: string;
  outputName: string;
  outputShape: number[];
  outputDtype: string;
  opset: number;
}

export interface SegmentationOutput {
  classMask: Uint8Array; // 192 * 256 containing class integers 0, 1, 2, 3
  pupilMask: Uint8Array; // 192 * 256 binary mask (1 for pupil, 0 otherwise)
  width: number; // 256
  height: number; // 192
  pupilPixelCount: number;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface NeuralPupilGeometry {
  detected: boolean;
  status: 'DETECTED' | 'UNCERTAIN' | 'LOST';
  areaPx: number;
  centroidRoi: { x: number; y: number } | null;
  centroidVideo: { x: number; y: number } | null;
  centroidNorm: { x: number; y: number; z: number } | null;
  diameterPx: number | null;
  radiusPx: number | null;
  circularity: number;
  boundingBoxRoi: BoundingBox | null;
  /**
   * Geometric circularity/contrast heuristic [0.0, 1.0].
   * NOTE: This is strictly a geometric tracking quality signal, NOT clinical diagnostic confidence.
   */
  geometryConfidence: number;
}

export interface BilateralNeuralPupilResult {
  timestamp: number;
  left: NeuralPupilGeometry;
  right: NeuralPupilGeometry;
  inferenceLatencyMs: number;
  executionProvider: ExecutionProvider;
  isShadowMode: boolean;
}

export interface NeuralComparisonTelemetry {
  leftDiameterDeltaPx: number | null; // neural.diameterPx - deterministic.diameterPx
  rightDiameterDeltaPx: number | null;
  leftCentroidDistancePx: number | null;
  rightCentroidDistancePx: number | null;
  mlFps: number;
  averageInferenceMs: number;
  executionProvider: ExecutionProvider;
  modelStatus: ONNXModelStatus;
}
