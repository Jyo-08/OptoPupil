export type FaceLandmarkerStatus =
  | 'uninitialized'
  | 'loading_wasm'
  | 'loading_model'
  | 'ready'
  | 'error';

export interface FaceLandmarkerState {
  status: FaceLandmarkerStatus;
  errorMessage: string | null;
  loadProgressPercent: number;
}
