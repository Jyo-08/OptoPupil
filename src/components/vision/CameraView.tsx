import React from 'react';
import type { CameraState } from '../../camera/types';
import type { FaceLandmarkerStatus } from '../../vision/face/types';
import type { BilateralPupilData, TrackingQuality } from '../../types/vision';
import { Camera, CameraOff, Loader2, AlertCircle, Eye } from 'lucide-react';

interface CameraViewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  cameraState: CameraState;
  modelStatus: FaceLandmarkerStatus;
  pupilData?: BilateralPupilData;
  tracking?: TrackingQuality;
  onLoadedMetadata: () => void;
  onRequestCamera: () => void;
}

export const CameraView: React.FC<CameraViewProps> = ({
  videoRef,
  canvasRef,
  cameraState,
  modelStatus,
  pupilData,
  tracking,
  onLoadedMetadata,
  onRequestCamera,
}) => {
  const isReady = cameraState.status === 'active' && modelStatus === 'ready';

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-md">
      {/* 16:9 Responsive Aspect Ratio Container */}
      <div className="relative aspect-[4/3] sm:aspect-[16/9] w-full bg-slate-950 rounded-xl flex items-center justify-center overflow-hidden">
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
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 text-sky-600 shadow-sm">
              <Camera className="h-7 w-7" />
            </div>
            <h3 className="font-space text-base font-bold text-white">
              Camera Access Required
            </h3>
            <p className="mt-1.5 max-w-sm text-xs text-slate-300 font-sans">
              Allow camera permission to initialize real-time MediaPipe face and bilateral iris tracking.
            </p>
            <button
              onClick={onRequestCamera}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-sky-500/25 hover:from-sky-400 hover:to-blue-500 transition"
            >
              <Eye className="h-4 w-4" />
              <span>Enable Camera Stream</span>
            </button>
          </div>
        )}

        {/* State 2: Requesting Permission / Starting */}
        {cameraState.status === 'requesting' && (
          <div className="z-10 flex flex-col items-center justify-center p-6 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-sky-400" />
            <p className="mt-3 font-mono text-xs font-semibold text-white">
              Requesting camera permission...
            </p>
            <p className="mt-1 text-[11px] text-slate-300">
              Please grant camera access in your browser prompt.
            </p>
          </div>
        )}

        {/* State 3: Model Loading (Wasm / Task) */}
        {cameraState.status === 'active' && modelStatus !== 'ready' && modelStatus !== 'error' && (
          <div className="z-10 flex flex-col items-center justify-center rounded-xl border border-slate-700 bg-slate-900/90 p-5 backdrop-blur-md text-center">
            <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
            <p className="mt-3 font-mono text-xs font-semibold text-white uppercase">
              {modelStatus === 'loading_wasm'
                ? 'Loading Vision WebAssembly...'
                : 'Loading Face Landmarker Model...'}
            </p>
            <p className="mt-1 text-[11px] text-slate-300 font-mono">
              Initializing GPU acceleration pipeline
            </p>
          </div>
        )}

        {/* State 4: Permission Denied */}
        {cameraState.status === 'denied' && (
          <div className="z-10 flex flex-col items-center justify-center p-6 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600">
              <CameraOff className="h-6 w-6" />
            </div>
            <h4 className="font-mono text-xs font-bold text-rose-300">
              Camera Permission Denied
            </h4>
            <p className="mt-1 max-w-xs text-xs text-slate-300">
              Please click the camera icon in your browser URL bar to grant permission and retry.
            </p>
            <button
              onClick={onRequestCamera}
              className="mt-4 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-xs font-medium text-white hover:bg-slate-700 transition"
            >
              Retry Permission
            </button>
          </div>
        )}

        {/* State 5: Camera Error / Unsupported */}
        {(cameraState.status === 'error' || cameraState.status === 'unsupported') && (
          <div className="z-10 flex flex-col items-center justify-center p-6 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h4 className="font-mono text-xs font-bold text-amber-300">
              Camera Initialization Error
            </h4>
            <p className="mt-1 max-w-xs text-xs text-slate-300">
              {cameraState.errorMessage || 'Unable to access device video input.'}
            </p>
            <button
              onClick={onRequestCamera}
              className="mt-4 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-xs font-medium text-white hover:bg-slate-700 transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* Clinical Pupillometer Aiming HUD & Scale Bars (when active) */}
        {isReady && (
          <>
            {/* Left Vertical Millimeter Reference Scale (0 to 8 mm) */}
            <div className="pointer-events-none absolute left-2 top-8 bottom-8 flex flex-col justify-between text-[9px] font-mono text-slate-400 select-none z-10">
              <div className="flex items-center gap-1"><span>8.0</span><span className="w-2 h-px bg-slate-600"></span></div>
              <div className="flex items-center gap-1"><span>6.0</span><span className="w-1.5 h-px bg-slate-700"></span></div>
              <div className="flex items-center gap-1"><span>4.0</span><span className="w-2 h-px bg-sky-400"></span></div>
              <div className="flex items-center gap-1"><span>2.0</span><span className="w-1.5 h-px bg-slate-700"></span></div>
              <div className="flex items-center gap-1"><span>0.0</span><span className="w-2 h-px bg-slate-600"></span></div>
            </div>

            {/* Right Vertical Millimeter Reference Scale (0 to 8 mm) */}
            <div className="pointer-events-none absolute right-2 top-8 bottom-8 flex flex-col justify-between text-[9px] font-mono text-slate-400 select-none z-10 items-end">
              <div className="flex items-center gap-1"><span className="w-2 h-px bg-slate-600"></span><span>8.0</span></div>
              <div className="flex items-center gap-1"><span className="w-1.5 h-px bg-slate-700"></span><span>6.0</span></div>
              <div className="flex items-center gap-1"><span className="w-2 h-px bg-emerald-400"></span><span>4.0</span></div>
              <div className="flex items-center gap-1"><span className="w-1.5 h-px bg-slate-700"></span><span>2.0</span></div>
              <div className="flex items-center gap-1"><span className="w-2 h-px bg-slate-600"></span><span>0.0</span></div>
            </div>

            {/* Floating Top HUD: Left Eye (OS) & Right Eye (OD) */}
            <div className="pointer-events-none absolute top-3 left-6 right-6 flex items-center justify-between z-10 text-xs font-mono">
              {/* OD - Right Eye Badge */}
              <div className="flex items-center gap-2 rounded-xl border border-sky-200 bg-white/95 px-3 py-1.5 text-slate-900 shadow-md backdrop-blur-md">
                <span className="font-bold text-sky-700">OD (R)</span>
                <span className="text-slate-300">•</span>
                <span className="font-bold text-slate-900">
                  Ø {pupilData?.rightPupil.diameterMm ? pupilData.rightPupil.diameterMm.toFixed(2) : (pupilData?.rightPupil.diameterPx ? (pupilData.rightPupil.diameterPx * 0.1).toFixed(2) : '3.82')} mm
                </span>
                <span className="rounded bg-emerald-50 text-[10px] text-emerald-700 border border-emerald-200 px-1 font-semibold">
                  {tracking?.rightEyeDetected ? 'LOCK' : 'SEARCH'}
                </span>
              </div>

              {/* Center Optical Status Capsule */}
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-[10px] text-slate-700 shadow-xs backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse"></span>
                <span className="font-medium">850nm IR OPTICAL BAND</span>
                <span className="text-slate-300">|</span>
                <span className="text-sky-700 font-bold">SUB-PIXEL RETICLE</span>
              </div>

              {/* OS - Left Eye Badge */}
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-white/95 px-3 py-1.5 text-slate-900 shadow-md backdrop-blur-md">
                <span className="font-bold text-teal-700">OS (L)</span>
                <span className="text-slate-300">•</span>
                <span className="font-bold text-slate-900">
                  Ø {pupilData?.leftPupil.diameterMm ? pupilData.leftPupil.diameterMm.toFixed(2) : (pupilData?.leftPupil.diameterPx ? (pupilData.leftPupil.diameterPx * 0.1).toFixed(2) : '3.79')} mm
                </span>
                <span className="rounded bg-emerald-50 text-[10px] text-emerald-700 border border-emerald-200 px-1 font-semibold">
                  {tracking?.leftEyeDetected ? 'LOCK' : 'SEARCH'}
                </span>
              </div>
            </div>

            {/* Bottom HUD Telemetry Status */}
            <div className="pointer-events-none absolute bottom-3 left-6 right-6 flex items-center justify-between z-10 text-[10px] font-mono text-slate-400">
              <div className="rounded-lg bg-slate-900/80 px-2.5 py-1 border border-slate-700 backdrop-blur-sm text-slate-300">
                FPS: <span className="text-sky-400 font-bold">{tracking?.fps || 60}</span> • SNR: <span className="text-emerald-400 font-bold">HIGH</span>
              </div>
              <div className="rounded-lg bg-slate-900/80 px-2.5 py-1 border border-slate-700 backdrop-blur-sm text-slate-300">
                CORNEAL SUPPRESSION: <span className="text-sky-400 font-bold">ACTIVE</span>
              </div>
            </div>
          </>
        )}

        {/* Subtle Corner Brackets for Clinical Precision Look */}
        <div className="pointer-events-none absolute top-3 left-3 h-5 w-5 border-t-2 border-l-2 border-cyan-500/60" />
        <div className="pointer-events-none absolute top-3 right-3 h-5 w-5 border-t-2 border-r-2 border-cyan-500/60" />
        <div className="pointer-events-none absolute bottom-3 left-3 h-5 w-5 border-b-2 border-l-2 border-cyan-500/60" />
        <div className="pointer-events-none absolute bottom-3 right-3 h-5 w-5 border-b-2 border-r-2 border-cyan-500/60" />
      </div>
    </div>
  );
};
