import { useState, useEffect, useRef, useCallback } from 'react';
import type { CameraState, CameraStatus } from './types';

interface UseCameraOptions {
  autoStart?: boolean;
  preferredFacingMode?: 'user' | 'environment';
  idealWidth?: number;
  idealHeight?: number;
}

export function useCamera(options: UseCameraOptions = {}) {
  const {
    autoStart = false,
    preferredFacingMode = 'user',
    idealWidth = 1280,
    idealHeight = 720,
  } = options;

  const [state, setState] = useState<CameraState>({
    status: 'idle',
    stream: null,
    resolution: { width: 0, height: 0, aspectRatio: 16 / 9 },
    errorMessage: null,
    deviceId: null,
    availableDevices: [],
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Stop active stream and release hardware
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setState((prev) => ({
      ...prev,
      status: 'idle',
      stream: null,
      errorMessage: null,
    }));
  }, []);

  // Enumerate connected cameras
  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      setState((prev) => ({ ...prev, availableDevices: videoDevices }));
    } catch {
      // ignore device list error
    }
  }, []);

  // Request camera access
  const startCamera = useCallback(
    async (deviceId?: string) => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setState((prev) => ({
          ...prev,
          status: 'unsupported',
          errorMessage: 'Camera API (getUserMedia) is not supported in this browser.',
        }));
        return;
      }

      // Stop any existing stream first to avoid hardware lock
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      setState((prev) => ({
        ...prev,
        status: 'requesting',
        errorMessage: null,
      }));

      try {
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: deviceId
            ? {
                deviceId: { exact: deviceId },
                width: { ideal: idealWidth },
                height: { ideal: idealHeight },
              }
            : {
                facingMode: preferredFacingMode,
                width: { ideal: idealWidth },
                height: { ideal: idealHeight },
              },
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = mediaStream;

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          // Ensure play is called once metadata is ready
          await videoRef.current.play().catch(() => {
            // Auto-play policy might trigger if unmuted, but audio is false
          });
        }

        // Get actual track settings if available
        const videoTrack = mediaStream.getVideoTracks()[0];
        const trackSettings = videoTrack?.getSettings();
        const detectedWidth = trackSettings?.width || idealWidth;
        const detectedHeight = trackSettings?.height || idealHeight;

        setState((prev) => ({
          ...prev,
          status: 'active',
          stream: mediaStream,
          deviceId: trackSettings?.deviceId || deviceId || null,
          resolution: {
            width: detectedWidth,
            height: detectedHeight,
            aspectRatio: detectedHeight > 0 ? detectedWidth / detectedHeight : 16 / 9,
          },
          errorMessage: null,
        }));

        await refreshDevices();
      } catch (err: unknown) {
        const error = err as Error;
        let status: CameraStatus = 'error';
        let msg = 'Failed to access camera.';

        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          status = 'denied';
          msg = 'Camera permission was denied. Please allow camera access in your browser settings.';
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          status = 'error';
          msg = 'No camera device found on this system.';
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          status = 'error';
          msg = 'Camera is in use by another application or process.';
        } else if (error.message) {
          msg = error.message;
        }

        setState((prev) => ({
          ...prev,
          status,
          stream: null,
          errorMessage: msg,
        }));
      }
    },
    [idealHeight, idealWidth, preferredFacingMode, refreshDevices]
  );

  // Handle video metadata loaded to update resolution dynamically
  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      const v = videoRef.current;
      const width = v.videoWidth || 1280;
      const height = v.videoHeight || 720;
      setState((prev) => ({
        ...prev,
        resolution: {
          width,
          height,
          aspectRatio: height > 0 ? width / height : 16 / 9,
        },
      }));
    }
  }, []);

  useEffect(() => {
    if (autoStart) {
      startCamera();
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [autoStart, startCamera]);

  return {
    videoRef,
    cameraState: state,
    startCamera,
    stopCamera,
    refreshDevices,
    handleLoadedMetadata,
  };
}
