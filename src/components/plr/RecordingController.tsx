/**
 * OptoPupil - PLR Protocol Recording Controller
 * Manages screening initiation, progress visualization across protocol phases,
 * and status messaging for the user.
 */

import React from 'react';
import type { PLRRecordingState } from '../../plr/hooks/usePLRRecording';
import type { TrackingQuality } from '../../types/vision';
import { Play, Square, RotateCcw, Activity, ShieldCheck, AlertCircle } from 'lucide-react';

interface RecordingControllerProps {
  recordingState: PLRRecordingState;
  tracking: TrackingQuality;
}

export const RecordingController: React.FC<RecordingControllerProps> = ({
  recordingState,
  tracking,
}) => {
  const {
    phase,
    progressPercent,
    statusMessage,
    isRecording,
    canStart,
    startScreening,
    cancelScreening,
    resetScreening,
  } = recordingState;

  const isTrackingLocked = tracking.status === 'GOOD';

  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-sky-600" />
          <span className="font-mono text-xs font-bold tracking-wider text-slate-900 uppercase">
            Quantitative PLR Screening Protocol
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isTrackingLocked ? (
            <span className="flex items-center gap-1 font-mono text-[11px] text-emerald-600 font-semibold">
              <ShieldCheck className="h-3.5 w-3.5" /> OCULAR LOCK READY
            </span>
          ) : (
            <span className="flex items-center gap-1 font-mono text-[11px] text-amber-700 font-semibold">
              <AlertCircle className="h-3.5 w-3.5" /> POSITION FACE TO START
            </span>
          )}
        </div>
      </div>

      {/* Protocol Step Indicator */}
      <div className="mt-4 grid grid-cols-4 gap-2 font-mono text-[10px]">
        <div
          className={`rounded-lg border p-2 text-center transition ${
            phase === 'BASELINE'
              ? 'border-sky-500 bg-sky-50 text-sky-800 font-bold'
              : phase === 'STIMULUS' || phase === 'CONSTRICTION_RECOVERY' || phase === 'COMPLETE'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 font-medium'
              : 'border-slate-200 bg-slate-50 text-slate-400'
          }`}
        >
          <span className="block text-[9px] text-slate-500">STEP 1</span>
          <span>1.5s Baseline</span>
        </div>

        <div
          className={`rounded-lg border p-2 text-center transition ${
            phase === 'STIMULUS'
              ? 'border-amber-400 bg-amber-50 text-amber-900 font-bold animate-pulse'
              : phase === 'CONSTRICTION_RECOVERY' || phase === 'COMPLETE'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 font-medium'
              : 'border-slate-200 bg-slate-50 text-slate-400'
          }`}
        >
          <span className="block text-[9px] text-slate-500">STEP 2</span>
          <span>Light Flash</span>
        </div>

        <div
          className={`rounded-lg border p-2 text-center transition ${
            phase === 'CONSTRICTION_RECOVERY'
              ? 'border-indigo-400 bg-indigo-50 text-indigo-900 font-bold'
              : phase === 'COMPLETE'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 font-medium'
              : 'border-slate-200 bg-slate-50 text-slate-400'
          }`}
        >
          <span className="block text-[9px] text-slate-500">STEP 3</span>
          <span>3.5s PLR Wave</span>
        </div>

        <div
          className={`rounded-lg border p-2 text-center transition ${
            phase === 'PROCESSING'
              ? 'border-sky-400 bg-sky-50 text-sky-800 font-bold animate-pulse'
              : phase === 'COMPLETE'
              ? 'border-emerald-500 bg-emerald-50 text-emerald-800 font-bold'
              : 'border-slate-200 bg-slate-50 text-slate-400'
          }`}
        >
          <span className="block text-[9px] text-slate-500">STEP 4</span>
          <span>PLR Kinetics</span>
        </div>
      </div>

      {/* Animated Progress Bar */}
      {isRecording && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 mb-1.5">
            <span>SCREENING SEQUENCE PROGRESS</span>
            <span className="font-bold text-sky-700">{progressPercent}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 border border-slate-200">
            <div
              className="h-full bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-500 transition-all duration-100 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Live Status Message */}
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs font-mono text-slate-700 shadow-xs">
        <span className="text-sky-600 font-semibold mr-1.5">&gt;</span>
        <span>{statusMessage}</span>
      </div>

      {/* Action Buttons */}
      <div className="mt-4 flex items-center justify-between gap-3 font-mono">
        <div className="flex items-center gap-2">
          {!isRecording ? (
            <button
              onClick={startScreening}
              disabled={!canStart}
              className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-700 transition disabled:opacity-40 disabled:pointer-events-none shadow-xs"
            >
              <Play className="h-4 w-4" />
              <span>START PLR SCREENING</span>
            </button>
          ) : (
            <button
              onClick={cancelScreening}
              className="flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition shadow-xs"
            >
              <Square className="h-4 w-4" />
              <span>CANCEL</span>
            </button>
          )}

          {phase === 'COMPLETE' && (
            <button
              onClick={resetScreening}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>NEW TEST</span>
            </button>
          )}
        </div>

        <div className="text-[11px] text-slate-500 font-mono hidden sm:block">
          Duration: ~5.2s total | Iris Calibrated
        </div>
      </div>
    </div>
  );
};
