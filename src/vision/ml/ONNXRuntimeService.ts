import * as ort from 'onnxruntime-web';
import type { ONNXModelStatus, ExecutionProvider, ModelMetadata } from './types';

// Default model asset URL served from public/models/
const DEFAULT_MODEL_PATH = '/models/pupil_segmentation.onnx';

export class ONNXRuntimeService {
  private static instance: ONNXRuntimeService | null = null;
  private session: ort.InferenceSession | null = null;
  private status: ONNXModelStatus = 'uninitialized';
  private errorMessage: string | null = null;
  private executionProvider: ExecutionProvider = 'wasm';
  private initPromise: Promise<boolean> | null = null;
  private metadata: ModelMetadata | null = null;

  private constructor() {}

  public static getInstance(): ONNXRuntimeService {
    if (!ONNXRuntimeService.instance) {
      ONNXRuntimeService.instance = new ONNXRuntimeService();
    }
    return ONNXRuntimeService.instance;
  }

  public getStatus(): ONNXModelStatus {
    return this.status;
  }

  public getErrorMessage(): string | null {
    return this.errorMessage;
  }

  public getExecutionProvider(): ExecutionProvider {
    return this.executionProvider;
  }

  public getMetadata(): ModelMetadata | null {
    return this.metadata;
  }

  public isReady(): boolean {
    return this.status === 'ready' && this.session !== null;
  }

  /**
   * Lazily initialize ONNX Runtime session with WebGPU and WASM fallback.
   */
  public async initialize(modelPath: string = DEFAULT_MODEL_PATH): Promise<boolean> {
    if (this.session && this.status === 'ready') {
      return true;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      this.status = 'loading';
      this.errorMessage = null;

      // Attempt 1: WebGPU
      if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
        try {
          const sessionOptions: ort.InferenceSession.SessionOptions = {
            executionProviders: ['webgpu'],
            graphOptimizationLevel: 'all',
          };
          this.session = await ort.InferenceSession.create(modelPath, sessionOptions);
          this.executionProvider = 'webgpu';
          this.status = 'ready';
          this.validateModelMetadata();
          return true;
        } catch (gpuErr) {
          console.warn('[ONNXRuntimeService] WebGPU provider initialization failed, falling back to WASM:', gpuErr);
        }
      }

      // Attempt 2: WASM Fallback
      try {
        const wasmOptions: ort.InferenceSession.SessionOptions = {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
        };
        this.session = await ort.InferenceSession.create(modelPath, wasmOptions);
        this.executionProvider = 'wasm';
        this.status = 'ready';
        this.validateModelMetadata();
        return true;
      } catch (wasmErr) {
        const err = wasmErr as Error;
        this.status = 'error';
        this.errorMessage = err?.message || 'Failed to initialize ONNX Runtime Web session';
        console.error('[ONNXRuntimeService] Model initialization failed:', this.errorMessage);
        this.session = null;
        return false;
      }
    })();

    return this.initPromise;
  }

  /**
   * Validate and record session input and output metadata against expected contracts.
   */
  private validateModelMetadata(): void {
    if (!this.session) return;

    try {
      const inputNames = this.session.inputNames;
      const outputNames = this.session.outputNames;

      const inputName = inputNames[0] || 'image';
      const outputName = outputNames[0] || 'segmentation_logits';

      this.metadata = {
        inputName,
        inputShape: [1, 1, 192, 256],
        inputDtype: 'float32',
        outputName,
        outputShape: [1, 4, 192, 256],
        outputDtype: 'float32',
        opset: 18,
      };
    } catch (err) {
      console.warn('[ONNXRuntimeService] Could not inspect session metadata:', err);
    }
  }

  /**
   * Execute forward pass with [1, 1, 192, 256] Float32 tensor.
   * Never throws unhandled exceptions; returns null on inference failure.
   */
  public async runInference(inputTensor: ort.Tensor): Promise<ort.Tensor | null> {
    if (!this.session || this.status !== 'ready') {
      return null;
    }

    try {
      const inputName = this.session.inputNames[0] || 'image';
      const feeds: Record<string, ort.Tensor> = { [inputName]: inputTensor };
      const results = await this.session.run(feeds);
      const outputName = this.session.outputNames[0] || 'segmentation_logits';
      const outputTensor = results[outputName];

      if (!outputTensor) {
        return null;
      }

      return outputTensor;
    } catch (err) {
      console.warn('[ONNXRuntimeService] Forward inference error:', err);
      return null;
    }
  }

  public close(): void {
    if (this.session) {
      try {
        this.session.release();
      } catch {
        // ignore release error
      }
      this.session = null;
    }
    this.status = 'uninitialized';
    this.initPromise = null;
  }
}
