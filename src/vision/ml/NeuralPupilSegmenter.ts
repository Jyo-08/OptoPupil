import * as ort from 'onnxruntime-web';
import type { IrisLandmarkSet, EyeLandmarkSet } from '../../types/vision';
import type { SegmentationOutput, NeuralPupilGeometry } from './types';
import { ONNXRuntimeService } from './ONNXRuntimeService';
import { PupilGeometryExtractor, type CropInfo } from './PupilGeometryExtractor';

export interface SegmentOcularResult {
  segmentation: SegmentationOutput | null;
  geometry: NeuralPupilGeometry;
}

export class NeuralPupilSegmenter {
  private static offscreenCanvas: HTMLCanvasElement | null = null;
  private static offscreenCtx: CanvasRenderingContext2D | null = null;

  private static readonly MODEL_WIDTH = 256;
  private static readonly MODEL_HEIGHT = 192;
  private static readonly CHANNEL_STRIDE = 192 * 256; // 49,152 floats per channel

  private static getOffscreenContext(): CanvasRenderingContext2D | null {
    if (!this.offscreenCanvas) {
      this.offscreenCanvas = document.createElement('canvas');
      this.offscreenCanvas.width = this.MODEL_WIDTH;
      this.offscreenCanvas.height = this.MODEL_HEIGHT;
    }
    if (!this.offscreenCtx) {
      this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
    }
    return this.offscreenCtx;
  }

  /**
   * Preprocess ocular ROI from video frame, run ONNX neural segmentation, and extract pupil geometry.
   */
  public static async segmentOcularRegion(
    video: HTMLVideoElement,
    iris: IrisLandmarkSet | null,
    eye: EyeLandmarkSet | null
  ): Promise<SegmentOcularResult> {
    const defaultLost: NeuralPupilGeometry = {
      detected: false,
      status: 'LOST',
      areaPx: 0,
      centroidRoi: null,
      centroidVideo: null,
      centroidNorm: null,
      diameterPx: null,
      radiusPx: null,
      circularity: 0,
      boundingBoxRoi: null,
      geometryConfidence: 0,
    };

    if (!iris || !eye || video.readyState < 2) {
      return { segmentation: null, geometry: defaultLost };
    }

    const videoW = video.videoWidth || 1280;
    const videoH = video.videoHeight || 720;

    // Convert iris center and estimated radius to video pixel space
    const irisCenterX = iris.center.x * videoW;
    const irisCenterY = iris.center.y * videoH;
    const irisRadiusPx = iris.estimatedRadiusNorm * Math.min(videoW, videoH);

    if (irisRadiusPx < 4) {
      return { segmentation: null, geometry: defaultLost };
    }

    // Step 1: Compute 4:3 Isotropic Bounding Box centered on Iris
    // 4.8x iris radius ensures full eye opening + sclera context is captured without distortion
    const cropW = Math.min(
      Math.max(Math.ceil(irisRadiusPx * 4.8), 48),
      videoW
    );
    const cropH = Math.round(cropW * (this.MODEL_HEIGHT / this.MODEL_WIDTH)); // 4:3 ratio

    const cropX = Math.max(0, Math.min(Math.floor(irisCenterX - cropW / 2), videoW - cropW));
    const cropY = Math.max(0, Math.min(Math.floor(irisCenterY - cropH / 2), videoH - cropH));

    const cropInfo: CropInfo = {
      videoX: cropX,
      videoY: cropY,
      cropWidth: cropW,
      cropHeight: cropH,
      videoWidth: videoW,
      videoHeight: videoH,
    };

    // Step 2: Crop from Video Frame & Resize to 256x192 via Offscreen Canvas
    const ctx = this.getOffscreenContext();
    if (!ctx) {
      return { segmentation: null, geometry: defaultLost };
    }

    ctx.drawImage(
      video,
      cropX,
      cropY,
      cropW,
      cropH,
      0,
      0,
      this.MODEL_WIDTH,
      this.MODEL_HEIGHT
    );

    const imgData = ctx.getImageData(0, 0, this.MODEL_WIDTH, this.MODEL_HEIGHT);
    const rgba = imgData.data;

    // Step 3: Convert to Grayscale & Normalize to [0.0, 1.0] in NCHW [1, 1, 192, 256]
    const tensorData = new Float32Array(this.CHANNEL_STRIDE);
    for (let i = 0; i < this.CHANNEL_STRIDE; i++) {
      const idx4 = i * 4;
      const lum = 0.299 * rgba[idx4] + 0.587 * rgba[idx4 + 1] + 0.114 * rgba[idx4 + 2];
      tensorData[i] = lum / 255.0;
    }

    const inputTensor = new ort.Tensor('float32', tensorData, [1, 1, this.MODEL_HEIGHT, this.MODEL_WIDTH]);

    // Step 4: Run ONNX Neural Inference
    const ortService = ONNXRuntimeService.getInstance();
    const outputTensor = await ortService.runInference(inputTensor);

    if (!outputTensor) {
      return { segmentation: null, geometry: defaultLost };
    }

    // Step 5: Post-Processing & Argmax on 4-Class Output Logits [1, 4, 192, 256]
    const logits = outputTensor.data as Float32Array;
    const classMask = new Uint8Array(this.CHANNEL_STRIDE);
    const pupilMask = new Uint8Array(this.CHANNEL_STRIDE);
    let pupilPixelCount = 0;

    const stride0 = 0;
    const stride1 = this.CHANNEL_STRIDE;
    const stride2 = this.CHANNEL_STRIDE * 2;
    const stride3 = this.CHANNEL_STRIDE * 3;

    for (let i = 0; i < this.CHANNEL_STRIDE; i++) {
      const l0 = logits[stride0 + i]; // Background
      const l1 = logits[stride1 + i]; // Sclera / Eye
      const l2 = logits[stride2 + i]; // Pupil (Target Class 2)
      const l3 = logits[stride3 + i]; // Iris

      let maxLogit = l0;
      let argmaxClass = 0;

      if (l1 > maxLogit) {
        maxLogit = l1;
        argmaxClass = 1;
      }
      if (l2 > maxLogit) {
        maxLogit = l2;
        argmaxClass = 2;
      }
      if (l3 > maxLogit) {
        maxLogit = l3;
        argmaxClass = 3;
      }

      classMask[i] = argmaxClass;

      if (argmaxClass === 2) {
        pupilMask[i] = 1;
        pupilPixelCount++;
      }
    }

    const segmentation: SegmentationOutput = {
      classMask,
      pupilMask,
      width: this.MODEL_WIDTH,
      height: this.MODEL_HEIGHT,
      pupilPixelCount,
    };

    // Step 6: 8-Connected Component Analysis & Pupil Geometry Extraction
    const geometry = PupilGeometryExtractor.extractGeometry(pupilMask, cropInfo);

    return {
      segmentation,
      geometry,
    };
  }
}
