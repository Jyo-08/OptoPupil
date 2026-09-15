import React from 'react';
import type { TrackingQuality, BilateralPupilData } from '../../types/vision';
import type { CameraState } from '../../camera/types';
import type { FaceLandmarkerStatus } from '../../vision/face/types';
import { StatusBadge } from '../common/StatusBadge';
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Cpu, Compass, Activity } from 'lucide-react';

interface TrackingPanelProps {
  tracking: TrackingQuality;
  pupilData: BilateralPupilData;
  cameraState: CameraState;
  modelStatus: FaceLandmarkerStatus;
  modelError: string | null;
  onRetryCamera?: () => void;
  onSwitchCamera?: (deviceId: string) => void;
}

export const TrackingPanel: React.FC<TrackingPanelProps> = ({
  tracking,
  cameraState,
  modelStatus,
  modelError,
  onRetryCamera,
  onSwitchCamera,
}) => {
  return (
    <div className="flex flex-col gap-4">
      {/* Primary Tracking Quality Card */}
      <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-cyan-400" />
            <span className="font-mono text-xs font-semibold tracking-wider text-slate-200 uppercase">
              Tracking State
            </span>
          </div>
          <StatusBadge status={tracking.status} size="md" />
        </div>

        {/* Guidance Alert Message */}
        <div className={`mt-3 rounded-lg border p-3 text-xs leading-relaxed transition-colors ${
          tracking.status === 'GOOD'
            ? 'border-emerald-600/30 bg-emerald-950/30 text-emerald-300'
            : tracking.status === 'DEGRADED'
            ? 'border-amber-600/30 bg-amber-950/30 text-amber-200'
            : 'border-slate-700 bg-slate-900/80 text-slate-300'
        }`}>
          <div className="flex items-start gap-2">
            {tracking.status === 'GOOD' ? (
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-400 mt-0.5" />
            ) : tracking.status === 'DEGRADED' ? (
              <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-400 mt-0.5" />
            ) : (
              <XCircle className="h-4 w-4 flex-shrink-0 text-slate-400 mt-0.5" />
            )}
            <p className="font-medium">{tracking.guidanceMessage}</p>
          </div>
        </div>

        {/* Detection Breakdown Grid */}
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="flex items-center justify-between rounded-md border border-slate-800/80 bg-slate-900/40 p-2">
            <span className="text-slate-400">FACE:</span>
            <span className={tracking.faceDetected ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
              {tracking.faceDetected ? 'DETECTED' : 'NONE'}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-md border border-slate-800/80 bg-slate-900/40 p-2">
            <span className="text-slate-400">FPS:</span>
            <span className="text-cyan-300 font-bold">{tracking.fps} FPS</span>
          </div>

          <div className="flex items-center justify-between rounded-md border border-slate-800/80 bg-slate-900/40 p-2">
            <span className="text-slate-400">LEFT EYE:</span>
            <span className={tracking.leftEyeDetected ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
              {tracking.leftEyeDetected ? 'DETECTED' : 'LOST'}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-md border border-slate-800/80 bg-slate-900/40 p-2">
            <span className="text-slate-400">RIGHT EYE:</span>
            <span className={tracking.rightEyeDetected ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
              {tracking.rightEyeDetected ? 'DETECTED' : 'LOST'}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-md border border-slate-800/80 bg-slate-900/40 p-2">
            <span className="text-slate-400">LEFT IRIS:</span>
            <span className={tracking.leftIrisDetected ? 'text-cyan-300 font-bold' : 'text-slate-500'}>
              {tracking.leftIrisDetected ? 'DETECTED' : 'LOST'}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-md border border-slate-800/80 bg-slate-900/40 p-2">
            <span className="text-slate-400">RIGHT IRIS:</span>
            <span className={tracking.rightIrisDetected ? 'text-cyan-300 font-bold' : 'text-slate-500'}>
              {tracking.rightIrisDetected ? 'DETECTED' : 'LOST'}
            </span>
          </div>
        </div>
      </div>

      {/* Hardware & Pipeline Diagnostics Card */}
      <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg text-xs">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-cyan-400" />
            <span className="font-mono text-xs font-semibold tracking-wider text-slate-200 uppercase">
              System Diagnostics
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
            <Activity className="h-3 w-3" />
            <span>GPU PIPELINE</span>
          </div>
        </div>

        <div className="mt-3 space-y-2 font-mono">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-400">MEDIAPIPE VISION:</span>
            <span className={`font-semibold ${
              modelStatus === 'ready'
                ? 'text-emerald-400'
                : modelStatus === 'error'
                ? 'text-rose-400'
                : 'text-amber-400'
            }`}>
              {modelStatus.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-400">INPUT RESOLUTION:</span>
            <span className="text-slate-200">
              {cameraState.resolution.width > 0
                ? `${cameraState.resolution.width} × ${cameraState.resolution.height}`
                : 'Awaiting feed'}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-400">CAMERA STATUS:</span>
            <span className="text-cyan-300 uppercase">{cameraState.status}</span>
          </div>
        </div>

        {/* Camera Selector if multiple devices found */}
        {cameraState.availableDevices.length > 1 && (
          <div className="mt-3 border-t border-slate-800 pt-3">
            <label className="block text-[11px] font-mono text-slate-400 mb-1">
              INPUT CAMERA:
            </label>
            <select
              value={cameraState.deviceId || ''}
              onChange={(e) => onSwitchCamera?.(e.target.value)}
              className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
            >
              {cameraState.availableDevices.map((dev) => (
                <option key={dev.deviceId} value={dev.deviceId}>
                  {dev.label || `Camera ${dev.deviceId.slice(0, 5)}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Model or Camera Error Retry */}
        {(cameraState.status === 'error' || cameraState.status === 'denied' || modelError) && (
          <div className="mt-3 border-t border-slate-800 pt-3">
            <p className="text-[11px] text-rose-400 mb-2">
              {cameraState.errorMessage || modelError}
            </p>
            {onRetryCamera && (
              <button
                onClick={onRetryCamera}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-slate-800 py-1.5 font-medium text-slate-200 hover:bg-slate-700 transition"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Retry Camera Permission</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
