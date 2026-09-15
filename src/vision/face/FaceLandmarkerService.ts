import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { NormalizedLandmark } from '../../types/vision';
import type { FaceLandmarkerStatus } from './types';

// Official Google MediaPipe hosted model and wasm locations
const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
const MODEL_ASSET_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export class FaceLandmarkerService {
  private static instance: FaceLandmarkerService | null = null;
  private landmarker: FaceLandmarker | null = null;
  private status: FaceLandmarkerStatus = 'uninitialized';
  private errorMessage: string | null = null;
  private initPromise: Promise<FaceLandmarker> | null = null;

  private constructor() {}

  public static getInstance(): FaceLandmarkerService {
    if (!FaceLandmarkerService.instance) {
      FaceLandmarkerService.instance = new FaceLandmarkerService();
    }
    return FaceLandmarkerService.instance;
  }

  public getStatus(): FaceLandmarkerStatus {
    return this.status;
  }

  public getErrorMessage(): string | null {
    return this.errorMessage;
  }

  public isReady(): boolean {
    return this.status === 'ready' && this.landmarker !== null;
  }

  public async initialize(
    onStatusChange?: (status: FaceLandmarkerStatus, error?: string) => void
  ): Promise<FaceLandmarker> {
    if (this.landmarker && this.status === 'ready') {
      return this.landmarker;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        this.status = 'loading_wasm';
        onStatusChange?.('loading_wasm');

        const filesetResolver = await FilesetResolver.forVisionTasks(WASM_CDN);

        this.status = 'loading_model';
        onStatusChange?.('loading_model');

        // Attempt GPU acceleration first, fallback to CPU
        let faceLandmarker: FaceLandmarker;
        try {
          faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
              modelAssetPath: MODEL_ASSET_URL,
              delegate: 'GPU',
            },
            outputFaceBlendshapes: false,
            outputFacialTransformationMatrixes: false,
            runningMode: 'VIDEO',
            numFaces: 1,
            minFaceDetectionConfidence: 0.5,
            minFacePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });
        } catch {
          // Fallback to CPU delegate if GPU delegate failed
          faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
              modelAssetPath: MODEL_ASSET_URL,
              delegate: 'CPU',
            },
            outputFaceBlendshapes: false,
            outputFacialTransformationMatrixes: false,
            runningMode: 'VIDEO',
            numFaces: 1,
            minFaceDetectionConfidence: 0.5,
            minFacePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });
        }

        this.landmarker = faceLandmarker;
        this.status = 'ready';
        this.errorMessage = null;
        onStatusChange?.('ready');
        return faceLandmarker;
      } catch (err: unknown) {
        const error = err as Error;
        this.status = 'error';
        this.errorMessage = error?.message || 'Failed to initialize MediaPipe Face Landmarker';
        this.initPromise = null;
        onStatusChange?.('error', this.errorMessage);
        throw error;
      }
    })();

    return this.initPromise;
  }

  /**
   * Process a live video frame and return all 478 landmarks (including irises).
   */
  public detectFrame(
    videoElement: HTMLVideoElement,
    timestampMs: number
  ): NormalizedLandmark[] | null {
    if (!this.landmarker || this.status !== 'ready') {
      return null;
    }

    if (videoElement.readyState < 2) {
      return null;
    }

    try {
      const results = this.landmarker.detectForVideo(videoElement, timestampMs);
      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        return results.faceLandmarks[0] as NormalizedLandmark[];
      }
      return null;
    } catch {
      return null;
    }
  }

  public close(): void {
    if (this.landmarker) {
      try {
        this.landmarker.close();
      } catch {
        // ignore close error
      }
      this.landmarker = null;
    }
    this.status = 'uninitialized';
    this.initPromise = null;
  }
}
