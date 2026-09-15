import React, { useState } from 'react';
import type { PupilMeasurementRecord } from '../../db/types';
import type { ScreeningWorkflowState } from '../../hooks/useMeasurementPersistence';
import { StatusBadge } from '../common/StatusBadge';
import {
  Database,
  Clock,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Trash2,
  RefreshCw,
  History,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react';

interface LatestMeasurementCardProps {
  latestMeasurement: PupilMeasurementRecord | null;
  recentRecords?: PupilMeasurementRecord[];
  totalCount: number;
  isSaving: boolean;
  persistenceError: string | null;
  screeningState?: ScreeningWorkflowState;
  stabilityProgress?: number;
  onRefresh?: () => void;
  onClear?: () => void;
}

export const LatestMeasurementCard: React.FC<LatestMeasurementCardProps> = ({
  latestMeasurement,
  recentRecords = [],
  totalCount,
  isSaving,
  persistenceError,
  screeningState = 'IDLE',
  stabilityProgress = 0,
  onRefresh,
  onClear,
}) => {
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  // Format captured timestamp to local time HH:MM:SS
  const formatTime = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString(undefined, {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const handleConfirmClear = () => {
    setShowConfirmModal(false);
    onClear?.();
  };

  const handleCancelClear = () => {
    setShowConfirmModal(false);
  };

  return (
    <div className="relative rounded-xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg text-xs font-mono">
      {/* Clear Database Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-db-title"
            className="w-full max-w-sm rounded-xl border border-rose-900/60 bg-[#0d1322] p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-rose-950/80 border border-rose-800/60 text-rose-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 id="clear-db-title" className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                  Clear Database?
                </h3>
                <p className="mt-1.5 text-xs text-slate-400 font-sans leading-relaxed">
                  This will permanently delete all stored pupil measurements. This action cannot be undone.
                </p>
                <p className="mt-1 text-[11px] text-rose-400 font-mono">
                  {totalCount} record{totalCount === 1 ? '' : 's'} will be removed.
                </p>
              </div>
            </div>

            {/* Modal Buttons: Cancel and Delete */}
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                id="cancel-clear-db-btn"
                onClick={handleCancelClear}
                className="rounded-lg border border-slate-700 bg-slate-800/90 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-db-btn"
                onClick={handleConfirmClear}
                className="rounded-lg border border-rose-600/80 bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-500 shadow-lg shadow-rose-900/40 transition"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-cyan-400" />
          <span className="text-xs font-semibold tracking-wider text-slate-200 uppercase">
            Screening &amp; Persisted DB
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          {isSaving ? (
            <span className="rounded bg-cyan-950/80 border border-cyan-700/60 px-2 py-0.5 text-cyan-300 animate-pulse flex items-center gap-1">
              <RefreshCw className="h-2.5 w-2.5 animate-spin" />
              SAVING...
            </span>
          ) : (
            <span className="rounded bg-slate-900 border border-slate-800 px-2 py-0.5 text-slate-400 flex items-center gap-1">
              <HardDrive className="h-2.5 w-2.5 text-cyan-400" />
              <span>{totalCount} {totalCount === 1 ? 'RECORD' : 'RECORDS'}</span>
            </span>
          )}
        </div>
      </div>

      {/* Screening Workflow Status Banner */}
      <div className="mt-3">
        {screeningState === 'DETECTING' && (
          <div className="rounded-lg border border-cyan-600/40 bg-cyan-950/30 p-2.5">
            <div className="flex items-center justify-between text-[11px] text-cyan-300 font-bold mb-1.5">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                STABILIZING BILATERAL DETECTION...
              </span>
              <span>{stabilityProgress}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-cyan-400 transition-all duration-100 ease-out"
                style={{ width: `${stabilityProgress}%` }}
              />
            </div>
          </div>
        )}

        {screeningState === 'STIMULUS_ACTIVE' && (
          <div className="rounded-lg border border-amber-500/50 bg-amber-950/40 p-2 text-center text-amber-300 font-bold flex items-center justify-center gap-2 animate-pulse">
            <Zap className="h-4 w-4 text-amber-400" />
            <span>LIGHT STIMULUS ACTIVE (500 ms)</span>
          </div>
        )}

        {screeningState === 'PERSISTED' && (
          <div className="rounded-lg border border-emerald-600/40 bg-emerald-950/30 p-2 text-center text-emerald-300 font-semibold flex items-center justify-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>SCREENING COMPLETE — RECORD PERSISTED</span>
          </div>
        )}
      </div>

      {/* Persistence Error Banner */}
      {persistenceError && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-600/30 bg-rose-950/30 p-2.5 text-rose-300">
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-400 mt-0.5" />
          <div>
            <p className="text-[11px] font-bold">Persistence Error</p>
            <p className="text-[10px] text-rose-400/90">{persistenceError}</p>
          </div>
        </div>
      )}

      {/* Main Latest Measurement Content */}
      {latestMeasurement ? (
        <div className="mt-3 space-y-3">
          {/* Bilateral Measurement Metrics */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Left Pupil */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
              <div className="text-[10px] text-slate-400">LEFT PUPIL</div>
              <div className="mt-1 text-base font-bold text-purple-300">
                {latestMeasurement.left_pupil_px.toFixed(1)} px
              </div>
            </div>

            {/* Right Pupil */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
              <div className="text-[10px] text-slate-400">RIGHT PUPIL</div>
              <div className="mt-1 text-base font-bold text-purple-300">
                {latestMeasurement.right_pupil_px.toFixed(1)} px
              </div>
            </div>
          </div>

          {/* Metadata Row: Captured Time & Status */}
          <div className="space-y-2 rounded-lg border border-slate-800/80 bg-slate-900/40 p-2.5">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-cyan-400" />
                CAPTURED:
              </span>
              <span className="font-bold text-cyan-300" title={latestMeasurement.timestamp}>
                {formatTime(latestMeasurement.timestamp)}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">STATUS:</span>
              <StatusBadge status={latestMeasurement.status} size="sm" />
            </div>

            {latestMeasurement.stimulus_duration_ms && (
              <div className="flex items-center justify-between text-[10px] text-amber-300/90">
                <span className="text-slate-400">STIMULUS DURATION:</span>
                <span>{latestMeasurement.stimulus_duration_ms.toFixed(1)} ms</span>
              </div>
            )}

            {latestMeasurement.id && (
              <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-800/60 pt-1.5">
                <span>LATEST RECORD ID: #{latestMeasurement.id}</span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  IMMUTABLE
                </span>
              </div>
            )}
          </div>

          {/* Expandable Historical Log */}
          {recentRecords.length > 1 && (
            <div className="border-t border-slate-800/60 pt-2">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex w-full items-center justify-between text-[11px] text-slate-400 hover:text-cyan-300 transition py-1"
              >
                <span className="flex items-center gap-1.5 font-semibold">
                  <History className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Historical Records ({recentRecords.length})</span>
                </span>
                {showHistory ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>

              {showHistory && (
                <div className="mt-2 max-h-40 overflow-y-auto rounded border border-slate-800 bg-slate-950/60 p-1.5 space-y-1 text-[10px]">
                  {recentRecords.map((rec) => (
                    <div
                      key={rec.id || rec.timestamp}
                      className={`flex items-center justify-between p-1.5 rounded ${
                        rec.id === latestMeasurement.id
                          ? 'bg-cyan-950/40 border border-cyan-800/40 text-cyan-200'
                          : 'bg-slate-900/50 text-slate-300'
                      }`}
                    >
                      <span className="font-bold text-slate-400">#{rec.id}</span>
                      <span>L: {rec.left_pupil_px.toFixed(1)}px</span>
                      <span>R: {rec.right_pupil_px.toFixed(1)}px</span>
                      <span className="text-slate-400">{formatTime(rec.timestamp)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Database Actions */}
          <div className="flex items-center justify-between pt-1 text-[11px]">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="flex items-center gap-1 text-slate-400 hover:text-cyan-300 transition"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Refresh</span>
              </button>
            )}
            {onClear && totalCount > 0 && (
              <button
                id="open-clear-db-modal-btn"
                onClick={() => setShowConfirmModal(true)}
                className="flex items-center gap-1 text-slate-500 hover:text-rose-400 transition"
                title="Clear Database Records"
              >
                <Trash2 className="h-3 w-3" />
                <span>Clear DB</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-slate-800/60 bg-slate-900/30 p-4 text-center text-slate-500">
          <Database className="mx-auto h-5 w-5 opacity-40 mb-1.5" />
          <p className="text-[11px]">Awaiting stable bilateral detection...</p>
          <p className="text-[10px] text-slate-600 mt-0.5">
            Hold gaze steady for 1.0s to trigger light stimulus and capture measurement
          </p>
        </div>
      )}
    </div>
  );
};
