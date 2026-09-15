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
    <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-4 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-cyan-400" />
          <span className="font-mono text-xs font-bold tracking-wider text-slate-200 uppercase">
            Quantitative PLR Screening Protocol
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isTrackingLocked ? (
            <span className="flex items-center gap-1 font-mono text-[11px] text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" /> OCULAR LOCK READY
            </span>
          ) : (
            <span className="flex items-center gap-1 font-mono text-[11px] text-amber-400">
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
              ? 'border-cyan-500 bg-cyan-950/40 text-cyan-300 font-bold'
              : phase === 'STIMULUS' || phase === 'CONSTRICTION_RECOVERY' || phase === 'COMPLETE'
              ? 'border-emerald-700/60 bg-emerald-950/20 text-emerald-400'
              : 'border-slate-800 bg-slate-900/40 text-slate-500'
          }`}
        >
          <span className="block text-[9px] text-slate-400">STEP 1</span>
          <span>1.5s Baseline</span>
        </div>

        <div
          className={`rounded-lg border p-2 text-center transition ${
            phase === 'STIMULUS'
              ? 'border-yellow-400 bg-yellow-950/40 text-yellow-300 font-bold animate-pulse'
              : phase === 'CONSTRICTION_RECOVERY' || phase === 'COMPLETE'
              ? 'border-emerald-700/60 bg-emerald-950/20 text-emerald-400'
              : 'border-slate-800 bg-slate-900/40 text-slate-500'
          }`}
        >
          <span className="block text-[9px] text-slate-400">STEP 2</span>
          <span>Light Flash</span>
        </div>

        <div
          className={`rounded-lg border p-2 text-center transition ${
            phase === 'CONSTRICTION_RECOVERY'
              ? 'border-purple-500 bg-purple-950/40 text-purple-300 font-bold'
              : phase === 'COMPLETE'
              ? 'border-emerald-700/60 bg-emerald-950/20 text-emerald-400'
              : 'border-slate-800 bg-slate-900/40 text-slate-500'
          }`}
        >
          <span className="block text-[9px] text-slate-400">STEP 3</span>
          <span>3.5s PLR Wave</span>
        </div>

        <div
          className={`rounded-lg border p-2 text-center transition ${
            phase === 'PROCESSING'
              ? 'border-cyan-400 bg-cyan-950/40 text-cyan-300 font-bold animate-pulse'
              : phase === 'COMPLETE'
              ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300 font-bold'
              : 'border-slate-800 bg-slate-900/40 text-slate-500'
          }`}
        >
          <span className="block text-[9px] text-slate-400">STEP 4</span>
          <span>PLR Kinetics</span>
        </div>
      </div>

      {/* Animated Progress Bar */}
      {isRecording && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1.5">
            <span>SCREENING SEQUENCE PROGRESS</span>
            <span className="font-bold text-cyan-300">{progressPercent}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-900 border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-purple-500 to-emerald-400 transition-all duration-100 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Live Status Message */}
      <div className="mt-3 rounded-lg border border-slate-800/80 bg-slate-900/50 p-2.5 text-xs font-mono text-slate-300">
        <span className="text-cyan-400 font-semibold mr-1.5">&gt;</span>
        <span>{statusMessage}</span>
      </div>

      {/* Action Buttons */}
      <div className="mt-4 flex items-center justify-between gap-3 font-mono">
        <div className="flex items-center gap-2">
          {!isRecording ? (
            <button
              onClick={startScreening}
              disabled={!canStart}
              className="flex items-center gap-2 rounded-lg border border-cyan-500/50 bg-cyan-600/20 px-4 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-600/30 hover:text-cyan-200 transition disabled:opacity-40 disabled:pointer-events-none shadow-lg shadow-cyan-950/40"
            >
              <Play className="h-4 w-4" />
              <span>START PLR SCREENING</span>
            </button>
          ) : (
            <button
              onClick={cancelScreening}
              className="flex items-center gap-2 rounded-lg border border-rose-500/50 bg-rose-600/20 px-4 py-2 text-xs font-bold text-rose-300 hover:bg-rose-600/30 transition"
            >
              <Square className="h-4 w-4" />
              <span>CANCEL</span>
            </button>
          )}

          {phase === 'COMPLETE' && (
            <button
              onClick={resetScreening}
              className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
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
