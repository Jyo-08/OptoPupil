import * as ort from 'onnxruntime-web';
import type { IrisLandmarkSet, EyeLandmarkSet } from '../../types/vision';
import type { SegmentationOutput, NeuralPupilGeometry } from './types';
import { ONNXRuntimeService } from './ONNXRuntimeService';
import { PupilGeometryExtractor, type CropInfo } from './PupilGeometryExtractor';

export interface SegmentationResult {
  width: number;
  height: number;
  pupilMask: Uint8Array; // Binary mask (0 or 1)
  classMask: Uint8Array; // Class mask (0, 1, 2, 3)
  inferenceTimeMs: number;
}

export interface SegmentOcularResult {
  segmentation: SegmentationOutput | null;
  geometry: NeuralPupilGeometry;
}

export class NeuralPupilSegmenter {
  private onnxService: ONNXRuntimeService;
  private readonly TARGET_WIDTH = 256;
  private readonly TARGET_HEIGHT = 192;

  private static offscreenCanvas: HTMLCanvasElement | null = null;
  private static offscreenCtx: CanvasRenderingContext2D | null = null;
  private static readonly MODEL_WIDTH = 256;
  private static readonly MODEL_HEIGHT = 192;
  private static readonly CHANNEL_STRIDE = 192 * 256; // 49,152 floats per channel

  constructor() {
    this.onnxService = ONNXRuntimeService.getInstance();
  }

  /**
   * Performs a center crop to 4:3 aspect ratio if needed,
   * then resizes using bilinear interpolation, converts to grayscale,
   * normalizes to [0,1], and outputs a flat Float32Array suitable for ONNX [1, 1, 192, 256].
   */
  public preprocess(imageData: ImageData): Float32Array {
    const { width, height, data } = imageData;
    const targetAspect = this.TARGET_WIDTH / this.TARGET_HEIGHT;
    const currentAspect = width / height;

    let cropWidth = width;
    let cropHeight = height;
    let offsetX = 0;
    let offsetY = 0;

    // 1. Calculate center crop to exactly 4:3
    if (Math.abs(currentAspect - targetAspect) > 0.01) {
      if (currentAspect > targetAspect) {
        // Image is too wide
        cropWidth = Math.round(height * targetAspect);
        offsetX = Math.floor((width - cropWidth) / 2);
      } else {
        // Image is too tall
        cropHeight = Math.round(width / targetAspect);
        offsetY = Math.floor((height - cropHeight) / 2);
      }
    }

    // 2. Resize crop to 256x192 and convert to Grayscale float [0,1]
    const output = new Float32Array(this.TARGET_WIDTH * this.TARGET_HEIGHT);

    for (let y = 0; y < this.TARGET_HEIGHT; y++) {
      for (let x = 0; x < this.TARGET_WIDTH; x++) {
        // Map target pixel to crop coordinate
        const srcX = offsetX + (x + 0.5) * (cropWidth / this.TARGET_WIDTH) - 0.5;
        const srcY = offsetY + (y + 0.5) * (cropHeight / this.TARGET_HEIGHT) - 0.5;

        const x1 = Math.floor(srcX);
        const y1 = Math.floor(srcY);
        const x2 = x1 + 1;
        const y2 = y1 + 1;

        const fx = srcX - x1;
        const fy = srcY - y1;

        // Helper to get grayscale pixel
        const getGray = (px: number, py: number) => {
          const cx = Math.max(0, Math.min(px, width - 1));
          const cy = Math.max(0, Math.min(py, height - 1));
          const idx = (cy * width + cx) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          return (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;
        };

        const p11 = getGray(x1, y1);
        const p21 = getGray(x2, y1);
        const p12 = getGray(x1, y2);
        const p22 = getGray(x2, y2);

        const interp =
          p11 * (1 - fx) * (1 - fy) +
          p21 * fx * (1 - fy) +
          p12 * (1 - fx) * fy +
          p22 * fx * fy;

        output[y * this.TARGET_WIDTH + x] = interp;
      }
    }

    return output;
  }

  public async segment(imageData: ImageData): Promise<SegmentationResult> {
    const startTime = performance.now();

    // 1. Preprocess
    const tensorData = this.preprocess(imageData);
    const tensor = new ort.Tensor('float32', tensorData, [1, 1, this.TARGET_HEIGHT, this.TARGET_WIDTH]);

    // 2. Inference
    const session = this.onnxService.getSession();
    const feeds: Record<string, ort.Tensor> = {
      image: tensor,
    };
    const results = await session.run(feeds);
    const logits = results['segmentation_logits'];

    if (!logits || logits.dims.length !== 4) {
      throw new Error('Invalid logits returned from model.');
    }

    const logitsData = logits.data as Float32Array;

    // 3. Postprocess (Argmax over classes 0-3)
    const spatialSize = this.TARGET_WIDTH * this.TARGET_HEIGHT;
    const classMask = new Uint8Array(spatialSize);
    const pupilMask = new Uint8Array(spatialSize);

    // Logits shape: [1, 4, 192, 256].
    // Data is laid out as [batch, channel, y, x]
    // Channel offset = c * spatialSize
    for (let i = 0; i < spatialSize; i++) {
      let maxVal = -Infinity;
      let maxClass = 0;
      for (let c = 0; c < 4; c++) {
        const val = logitsData[c * spatialSize + i];
        if (val > maxVal) {
          maxVal = val;
          maxClass = c;
        }
      }
      classMask[i] = maxClass;
      pupilMask[i] = maxClass === 2 ? 1 : 0;
    }

    const inferenceTimeMs = performance.now() - startTime;

    return {
      width: this.TARGET_WIDTH,
      height: this.TARGET_HEIGHT,
      pupilMask,
      classMask,
      inferenceTimeMs,
    };
  }

  private static getOffscreenContext(): CanvasRenderingContext2D | null {
    if (!this.offscreenCanvas && typeof document !== 'undefined') {
      this.offscreenCanvas = document.createElement('canvas');
      this.offscreenCanvas.width = this.MODEL_WIDTH;
      this.offscreenCanvas.height = this.MODEL_HEIGHT;
    }
    if (this.offscreenCanvas && !this.offscreenCtx) {
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
