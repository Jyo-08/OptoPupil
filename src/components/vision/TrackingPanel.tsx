import React from 'react';
import type { TrackingQuality, BilateralPupilData } from '../../types/vision';
import type { CameraState } from '../../camera/types';
import type { FaceLandmarkerStatus } from '../../vision/face/types';
import type { ONNXModelStatus, ExecutionProvider, NeuralComparisonTelemetry } from '../../vision/ml/types';
import { StatusBadge } from '../common/StatusBadge';
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Cpu, Compass, Activity, Brain } from 'lucide-react';

interface TrackingPanelProps {
  tracking: TrackingQuality;
  pupilData: BilateralPupilData;
  cameraState: CameraState;
  modelStatus: FaceLandmarkerStatus;
  modelError: string | null;
  neuralModelStatus?: ONNXModelStatus;
  neuralProvider?: ExecutionProvider;
  neuralTelemetry?: NeuralComparisonTelemetry;
  onRetryCamera?: () => void;
  onSwitchCamera?: (deviceId: string) => void;
}

export const TrackingPanel: React.FC<TrackingPanelProps> = ({
  tracking,
  cameraState,
  modelStatus,
  modelError,
  neuralModelStatus = 'uninitialized',
  neuralProvider = 'wasm',
  neuralTelemetry,
  onRetryCamera,
  onSwitchCamera,
}) => {
  return (
    <div className="flex flex-col gap-4">
      {/* Primary Tracking Quality Card */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-sky-600" />
            <span className="font-mono text-xs font-semibold tracking-wider text-slate-900 uppercase">
              Tracking State
            </span>
          </div>
          <StatusBadge status={tracking.status} size="md" />
        </div>

        {/* Guidance Alert Message */}
        <div className={`mt-3 rounded-lg border p-3 text-xs leading-relaxed transition-colors ${
          tracking.status === 'GOOD'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
            : tracking.status === 'DEGRADED'
            ? 'border-amber-200 bg-amber-50 text-amber-900'
            : 'border-slate-200 bg-slate-50 text-slate-700'
        }`}>
          <div className="flex items-start gap-2">
            {tracking.status === 'GOOD' ? (
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600 mt-0.5" />
            ) : tracking.status === 'DEGRADED' ? (
              <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600 mt-0.5" />
            ) : (
              <XCircle className="h-4 w-4 flex-shrink-0 text-slate-500 mt-0.5" />
            )}
            <p className="font-medium">{tracking.guidanceMessage}</p>
          </div>
        </div>

        {/* Detection Breakdown Grid */}
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50/70 p-2">
            <span className="text-slate-500">FACE:</span>
            <span className={tracking.faceDetected ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
              {tracking.faceDetected ? 'DETECTED' : 'NONE'}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50/70 p-2">
            <span className="text-slate-500">FPS:</span>
            <span className="text-sky-700 font-bold">{tracking.fps} FPS</span>
          </div>

          <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50/70 p-2">
            <span className="text-slate-500">LEFT EYE:</span>
            <span className={tracking.leftEyeDetected ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
              {tracking.leftEyeDetected ? 'DETECTED' : 'LOST'}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50/70 p-2">
            <span className="text-slate-500">RIGHT EYE:</span>
            <span className={tracking.rightEyeDetected ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
              {tracking.rightEyeDetected ? 'DETECTED' : 'LOST'}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50/70 p-2">
            <span className="text-slate-500">LEFT IRIS:</span>
            <span className={tracking.leftIrisDetected ? 'text-sky-700 font-bold' : 'text-slate-400'}>
              {tracking.leftIrisDetected ? 'DETECTED' : 'LOST'}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50/70 p-2">
            <span className="text-slate-500">RIGHT IRIS:</span>
            <span className={tracking.rightIrisDetected ? 'text-sky-700 font-bold' : 'text-slate-400'}>
              {tracking.rightIrisDetected ? 'DETECTED' : 'LOST'}
            </span>
          </div>
        </div>
      </div>

      {/* Hardware & Pipeline Diagnostics Card */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm text-xs">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-sky-600" />
            <span className="font-mono text-xs font-semibold tracking-wider text-slate-900 uppercase">
              System Diagnostics
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-mono text-emerald-700 font-semibold">
            <Activity className="h-3 w-3" />
            <span>GPU PIPELINE</span>
          </div>
        </div>

        <div className="mt-3 space-y-2 font-mono">
          <div className="flex items-center justify-between text-slate-700">
            <span className="text-slate-500">MEDIAPIPE VISION:</span>
            <span className={`font-semibold ${
              modelStatus === 'ready'
                ? 'text-emerald-700'
                : modelStatus === 'error'
                ? 'text-rose-700'
                : 'text-amber-700'
            }`}>
              {modelStatus.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-700">
            <span className="text-slate-500">INPUT RESOLUTION:</span>
            <span className="text-slate-800 font-medium">
              {cameraState.resolution.width > 0
                ? `${cameraState.resolution.width} × ${cameraState.resolution.height}`
                : 'Awaiting feed'}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-700">
            <span className="text-slate-500">CAMERA STATUS:</span>
            <span className="text-sky-700 uppercase font-semibold">{cameraState.status}</span>
          </div>
        </div>

        {/* Neural Shadow Intelligence Layer Diagnostics */}
        <div className="mt-3 border-t border-slate-200 pt-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-purple-800">
              <Brain className="h-3.5 w-3.5 text-purple-600" />
              <span>NEURAL SHADOW ML</span>
            </div>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
              neuralModelStatus === 'ready'
                ? 'bg-purple-50 border border-purple-200 text-purple-700'
                : neuralModelStatus === 'loading'
                ? 'bg-amber-50 border border-amber-200 text-amber-700'
                : 'bg-slate-100 border border-slate-200 text-slate-500'
            }`}>
              {neuralModelStatus === 'ready' ? `READY (${neuralProvider.toUpperCase()})` : neuralModelStatus.toUpperCase()}
            </span>
          </div>

          {neuralModelStatus === 'ready' && (
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-700 mt-2">
              <div className="flex items-center justify-between rounded border border-slate-200 bg-slate-50/70 p-1.5">
                <span className="text-slate-500">INFERENCE:</span>
                <span className="text-purple-700 font-bold">
                  {neuralTelemetry?.averageInferenceMs ? `${neuralTelemetry.averageInferenceMs} ms` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded border border-slate-200 bg-slate-50/70 p-1.5">
                <span className="text-slate-500">ML RATE:</span>
                <span className="text-purple-700 font-bold">
                  {neuralTelemetry?.mlFps ? `${neuralTelemetry.mlFps} FPS` : '—'}
                </span>
              </div>
              {neuralTelemetry && neuralTelemetry.leftDiameterDeltaPx !== null && (
                <div className="col-span-2 flex items-center justify-between rounded border border-slate-200 bg-slate-50/70 p-1.5 text-[10px]">
                  <span className="text-slate-500">CV vs ML DELTA (L / R):</span>
                  <span className="text-slate-800 font-medium">
                    ΔL: {neuralTelemetry.leftDiameterDeltaPx > 0 ? '+' : ''}{neuralTelemetry.leftDiameterDeltaPx}px | ΔR: {neuralTelemetry.rightDiameterDeltaPx !== null ? `${neuralTelemetry.rightDiameterDeltaPx > 0 ? '+' : ''}${neuralTelemetry.rightDiameterDeltaPx}px` : '—'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Camera Selector if multiple devices found */}
        {cameraState.availableDevices.length > 1 && (
          <div className="mt-3 border-t border-slate-200 pt-3">
            <label className="block text-[11px] font-mono text-slate-500 mb-1">
              INPUT CAMERA:
            </label>
            <select
              value={cameraState.deviceId || ''}
              onChange={(e) => onSwitchCamera?.(e.target.value)}
              className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:border-sky-500 focus:outline-none"
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
          <div className="mt-3 border-t border-slate-200 pt-3">
            <p className="text-[11px] text-rose-700 mb-2">
              {cameraState.errorMessage || modelError}
            </p>
            {onRetryCamera && (
              <button
                onClick={onRetryCamera}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-slate-50 py-1.5 font-medium text-slate-700 hover:bg-slate-100 transition shadow-xs"
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
