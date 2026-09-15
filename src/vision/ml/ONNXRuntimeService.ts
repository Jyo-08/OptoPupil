import * as ort from 'onnxruntime-web';

export class ONNXRuntimeService {
    private static instance: ONNXRuntimeService;
    private session: ort.InferenceSession | null = null;
    private initializationPromise: Promise<void> | null = null;
    private providerUsed: string = '';

    private constructor() {}

    public static getInstance(): ONNXRuntimeService {
        if (!ONNXRuntimeService.instance) {
            ONNXRuntimeService.instance = new ONNXRuntimeService();
        }
        return ONNXRuntimeService.instance;
    }

    public async initialize(testModelSource?: string | ArrayBufferLike | Uint8Array): Promise<void> {
        if (this.session) {
            return;
        }

        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = this._initialize(testModelSource);
        return this.initializationPromise;
    }

    private async _initialize(testModelSource?: string | ArrayBufferLike | Uint8Array): Promise<void> {
        try {
            // Default model URL as required
            const modelSource = testModelSource || '/models/pupil_segmentation.onnx';

            // Try WebGPU first, then WASM
            try {
                this.session = await ort.InferenceSession.create(modelSource, {
                    executionProviders: ['webgpu']
                });
                this.providerUsed = 'webgpu';
            } catch (e) {
                console.warn('WebGPU execution provider failed or is unavailable. Falling back to WASM.');
                this.session = await ort.InferenceSession.create(modelSource, {
                    executionProviders: ['wasm']
                });
                this.providerUsed = 'wasm';
            }

            this.validateModelMetadata();
            console.log(`ONNX session initialized successfully using ${this.providerUsed} provider.`);
        } catch (error) {
            this.session = null;
            this.initializationPromise = null;
            throw new Error(`Failed to initialize ONNX Runtime session: ${(error as Error).message}`);
        }
    }

    private validateModelMetadata(): void {
        if (!this.session) {
            throw new Error('Session not initialized');
        }

        const inputNames = this.session.inputNames;
        if (inputNames.length !== 1 || inputNames[0] !== 'image') {
            throw new Error(`Invalid model input name. Expected 'image', got: ${inputNames.join(', ')}`);
        }

        const outputNames = this.session.outputNames;
        if (outputNames.length !== 1 || outputNames[0] !== 'segmentation_logits') {
            throw new Error(`Invalid model output name. Expected 'segmentation_logits', got: ${outputNames.join(', ')}`);
        }
    }

    public getSession(): ort.InferenceSession {
        if (!this.session) {
            throw new Error('ONNXRuntimeService is not initialized. Call initialize() first.');
        }
        return this.session;
    }

    public getProviderUsed(): string {
        return this.providerUsed;
    }
}
