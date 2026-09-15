import React from 'react';
import type { CameraState } from '../../camera/types';
import type { FaceLandmarkerStatus } from '../../vision/face/types';
import { Camera, CameraOff, Loader2, AlertCircle, Eye } from 'lucide-react';

interface CameraViewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  cameraState: CameraState;
  modelStatus: FaceLandmarkerStatus;
  onLoadedMetadata: () => void;
  onRequestCamera: () => void;
}

export const CameraView: React.FC<CameraViewProps> = ({
  videoRef,
  canvasRef,
  cameraState,
  modelStatus,
  onLoadedMetadata,
  onRequestCamera,
}) => {
  const isReady = cameraState.status === 'active' && modelStatus === 'ready';

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-slate-800 bg-[#0a0f1d] shadow-2xl">
      {/* 16:9 Responsive Aspect Ratio Container */}
      <div className="relative aspect-[4/3] sm:aspect-[16/9] w-full bg-[#050811] flex items-center justify-center overflow-hidden">
        {/* Live Video Element */}
        <video
          ref={videoRef}
          onLoadedMetadata={onLoadedMetadata}
          playsInline
          muted
          autoPlay
          className={`absolute inset-0 h-full w-full object-cover -scale-x-100 transition-opacity duration-300 ${
            cameraState.status === 'active' ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Live Canvas Landmark Overlay (-scale-x-100 to align perfectly with mirrored video) */}
        <canvas
          ref={canvasRef}
          className={`pointer-events-none absolute inset-0 h-full w-full object-cover -scale-x-100 transition-opacity duration-300 ${
            isReady ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* State 1: Camera Idle / Not Started */}
        {cameraState.status === 'idle' && (
          <div className="z-10 flex flex-col items-center justify-center p-6 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-950/40 text-cyan-400 shadow-lg">
              <Camera className="h-7 w-7" />
            </div>
            <h3 className="font-mono text-base font-bold text-slate-100">
              Camera Access Required
            </h3>
            <p className="mt-1.5 max-w-sm text-xs text-slate-400">
              Allow camera permission to initialize real-time MediaPipe face and bilateral iris tracking.
            </p>
            <button
              onClick={onRequestCamera}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-5 py-2.5 text-xs font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 hover:bg-cyan-400 transition"
            >
              <Eye className="h-4 w-4" />
              <span>Enable Camera Stream</span>
            </button>
          </div>
        )}

        {/* State 2: Requesting Permission / Starting */}
        {cameraState.status === 'requesting' && (
          <div className="z-10 flex flex-col items-center justify-center p-6 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-cyan-400" />
            <p className="mt-3 font-mono text-xs font-semibold text-slate-200">
              Requesting camera permission...
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Please grant camera access in your browser prompt.
            </p>
          </div>
        )}

        {/* State 3: Model Loading (Wasm / Task) */}
        {cameraState.status === 'active' && modelStatus !== 'ready' && modelStatus !== 'error' && (
          <div className="z-10 flex flex-col items-center justify-center rounded-xl border border-slate-800/80 bg-slate-950/80 p-5 backdrop-blur-md text-center">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
            <p className="mt-3 font-mono text-xs font-semibold text-slate-200 uppercase">
              {modelStatus === 'loading_wasm'
                ? 'Loading Vision WebAssembly...'
                : 'Loading Face Landmarker Model...'}
            </p>
            <p className="mt-1 text-[11px] text-slate-400 font-mono">
              Initializing GPU acceleration pipeline
            </p>
          </div>
        )}

        {/* State 4: Permission Denied */}
        {cameraState.status === 'denied' && (
          <div className="z-10 flex flex-col items-center justify-center p-6 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-950/40 text-rose-400">
              <CameraOff className="h-6 w-6" />
            </div>
            <h4 className="font-mono text-xs font-bold text-rose-300">
              Camera Permission Denied
            </h4>
            <p className="mt-1 max-w-xs text-xs text-slate-400">
              Please click the camera icon in your browser URL bar to grant permission and retry.
            </p>
            <button
              onClick={onRequestCamera}
              className="mt-4 rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
            >
              Retry Permission
            </button>
          </div>
        )}

        {/* State 5: Camera Error / Unsupported */}
        {(cameraState.status === 'error' || cameraState.status === 'unsupported') && (
          <div className="z-10 flex flex-col items-center justify-center p-6 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-950/40 text-amber-400">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h4 className="font-mono text-xs font-bold text-amber-300">
              Camera Initialization Error
            </h4>
            <p className="mt-1 max-w-xs text-xs text-slate-400">
              {cameraState.errorMessage || 'Unable to access device video input.'}
            </p>
            <button
              onClick={onRequestCamera}
              className="mt-4 rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* Subtle Corner Brackets for Clinical Precision Look */}
        <div className="pointer-events-none absolute top-3 left-3 h-5 w-5 border-t-2 border-l-2 border-cyan-500/50" />
        <div className="pointer-events-none absolute top-3 right-3 h-5 w-5 border-t-2 border-r-2 border-cyan-500/50" />
        <div className="pointer-events-none absolute bottom-3 left-3 h-5 w-5 border-b-2 border-l-2 border-cyan-500/50" />
        <div className="pointer-events-none absolute bottom-3 right-3 h-5 w-5 border-b-2 border-r-2 border-cyan-500/50" />
      </div>
    </div>
  );
};
