export type CameraStatus = 
  | 'idle'
  | 'requesting'
  | 'active'
  | 'denied'
  | 'unsupported'
  | 'error';

export interface CameraResolution {
  width: number;
  height: number;
  aspectRatio: number;
}

export interface CameraState {
  status: CameraStatus;
  stream: MediaStream | null;
  resolution: CameraResolution;
  errorMessage: string | null;
  deviceId: string | null;
  availableDevices: MediaDeviceInfo[];
}
