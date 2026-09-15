import React, { useState } from 'react';
import type { FinalScreeningRecord } from '../../db/types';
import type { ScreeningWorkflowState } from '../../hooks/useMeasurementPersistence';
import { STABILITY_WINDOW_SIZE, STABILITY_TOLERANCE_PX } from '../../stimulus/config';
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
  Activity,
  Layers,
  FileCheck,
  PlusCircle,
} from 'lucide-react';

interface LatestMeasurementCardProps {
  currentSessionId: string;
  latestFinalRecord: FinalScreeningRecord | null;
  allFinalRecords?: FinalScreeningRecord[];
  finalCount: number;
  rawCount: number;
  isSaving: boolean;
  persistenceError: string | null;
  screeningState?: ScreeningWorkflowState;
  windowSamplesCount?: number;
  leftDeltaPx?: number;
  rightDeltaPx?: number;
  isBaselineStable?: boolean;
  onRefresh?: () => void;
  onClearRawDb?: () => Promise<void>;
  onClearFinalDb?: () => Promise<void>;
  onDeleteFinalRecord?: (id: number) => Promise<void>;
  onStartNewSession?: () => void;
}

export const LatestMeasurementCard: React.FC<LatestMeasurementCardProps> = ({
  currentSessionId,
  latestFinalRecord,
  allFinalRecords = [],
  finalCount,
  rawCount,
  isSaving,
  persistenceError,
  screeningState = 'IDLE',
  windowSamplesCount = 0,
  leftDeltaPx = 0,
  rightDeltaPx = 0,
  isBaselineStable = false,
  onRefresh,
  onClearRawDb,
  onClearFinalDb,
  onDeleteFinalRecord,
  onStartNewSession,
}) => {
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [showClearRawModal, setShowClearRawModal] = useState<boolean>(false);
  const [showClearFinalModal, setShowClearFinalModal] = useState<boolean>(false);
  const [recordToDelete, setRecordToDelete] = useState<FinalScreeningRecord | null>(null);

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

  const handleConfirmClearRaw = async () => {
    setShowClearRawModal(false);
    if (onClearRawDb) {
      await onClearRawDb();
    }
  };

  const handleConfirmClearFinal = async () => {
    setShowClearFinalModal(false);
    if (onClearFinalDb) {
      await onClearFinalDb();
    }
  };

  const handleConfirmDeleteRecord = async () => {
    if (recordToDelete?.id && onDeleteFinalRecord) {
      await onDeleteFinalRecord(recordToDelete.id);
    }
    setRecordToDelete(null);
  };

  return (
    <div className="relative rounded-xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg text-xs font-mono">
      {/* 1. Clear Raw DB Modal */}
      {showClearRawModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-raw-db-title"
            className="w-full max-w-sm rounded-xl border border-amber-900/60 bg-[#0d1322] p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-950/80 border border-amber-800/60 text-amber-400">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <h3 id="clear-raw-db-title" className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                  Clear Raw Database (DB 1)?
                </h3>
                <p className="mt-1.5 text-xs text-slate-400 font-sans leading-relaxed">
                  This will permanently delete all raw fluctuating measurement samples. Finalized screening records in Database 2 will remain completely untouched.
                </p>
                <p className="mt-2 text-[11px] text-amber-400 font-mono font-bold">
                  {rawCount} raw sample{rawCount === 1 ? '' : 's'} will be deleted.
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                id="cancel-clear-raw-db-btn"
                onClick={() => setShowClearRawModal(false)}
                className="rounded-lg border border-slate-700 bg-slate-800/90 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                id="confirm-clear-raw-db-btn"
                onClick={handleConfirmClearRaw}
                className="rounded-lg border border-amber-600/80 bg-amber-600 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-500 shadow-lg shadow-amber-900/40 transition"
              >
                Clear Raw DB
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Clear Final DB Modal */}
      {showClearFinalModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-final-db-title"
            className="w-full max-w-sm rounded-xl border border-rose-900/60 bg-[#0d1322] p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-rose-950/80 border border-rose-800/60 text-rose-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 id="clear-final-db-title" className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                  Clear Final Database (DB 2)?
                </h3>
                <p className="mt-1.5 text-xs text-slate-400 font-sans leading-relaxed">
                  This will permanently delete all finalized screening measurement records. Raw measurements in Database 1 will remain untouched.
                </p>
                <p className="mt-2 text-[11px] text-rose-400 font-mono font-bold">
                  {finalCount} finalized record{finalCount === 1 ? '' : 's'} will be deleted.
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                id="cancel-clear-final-db-btn"
                onClick={() => setShowClearFinalModal(false)}
                className="rounded-lg border border-slate-700 bg-slate-800/90 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                id="confirm-clear-final-db-btn"
                onClick={handleConfirmClearFinal}
                className="rounded-lg border border-rose-600/80 bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-500 shadow-lg shadow-rose-900/40 transition"
              >
                Delete All Final
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Delete Specific Final Record Modal ("Delete Previous") */}
      {recordToDelete && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-record-title"
            className="w-full max-w-md rounded-xl border border-rose-900/60 bg-[#0d1322] p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-rose-950/80 border border-rose-800/60 text-rose-400">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 id="delete-record-title" className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                  Delete Final Record #{recordToDelete.id}?
                </h3>
                <p className="mt-1 text-xs text-slate-400 font-sans">
                  Please review the record details before deleting:
                </p>

                {/* Exact Record Data Details */}
                <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3 space-y-1.5 text-[11px] font-mono">
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-500">Record ID:</span>
                    <span className="font-bold text-slate-200">#{recordToDelete.id}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-500">Session ID:</span>
                    <span className="font-mono text-cyan-300">{recordToDelete.session_id}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-500">Timestamp:</span>
                    <span className="text-slate-300">{formatTime(recordToDelete.timestamp)} ({recordToDelete.timestamp})</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-500">Baseline (L / R):</span>
                    <span className="text-purple-300 font-semibold">
                      {recordToDelete.baseline_left_pupil_px.toFixed(1)} px / {recordToDelete.baseline_right_pupil_px.toFixed(1)} px
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-500">Stimulus Capture:</span>
                    <span className="text-purple-300 font-semibold">
                      {recordToDelete.stimulus_left_pupil_px.toFixed(1)} px / {recordToDelete.stimulus_right_pupil_px.toFixed(1)} px
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-500">Status:</span>
                    <span className="text-emerald-400 font-bold">{recordToDelete.status}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                id="cancel-delete-record-btn"
                onClick={() => setRecordToDelete(null)}
                className="rounded-lg border border-slate-700 bg-slate-800/90 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-record-btn"
                onClick={handleConfirmDeleteRecord}
                className="rounded-lg border border-rose-600/80 bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-500 shadow-lg shadow-rose-900/40 transition"
              >
                Delete Record
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
            Baseline Persisted DB
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          {isSaving ? (
            <span className="rounded bg-cyan-950/80 border border-cyan-700/60 px-2 py-0.5 text-cyan-300 animate-pulse flex items-center gap-1">
              <RefreshCw className="h-2.5 w-2.5 animate-spin" />
              SAVING...
            </span>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="rounded bg-slate-900 border border-slate-800 px-2 py-0.5 text-slate-400 flex items-center gap-1">
                <Layers className="h-2.5 w-2.5 text-amber-400" />
                <span>RAW: {rawCount}</span>
              </span>
              <span className="rounded bg-slate-900 border border-slate-800 px-2 py-0.5 text-slate-400 flex items-center gap-1">
                <HardDrive className="h-2.5 w-2.5 text-cyan-400" />
                <span>FINAL: {finalCount}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Session ID & Baseline Stability Workflow */}
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between text-[11px] bg-slate-900/50 border border-slate-800/80 rounded-lg px-2.5 py-1.5">
          <span className="text-slate-400">ACTIVE SESSION:</span>
          <span className="font-bold text-cyan-300">{currentSessionId}</span>
        </div>

        {screeningState === 'COLLECTING_RAW_BASELINE' && (
          <div className="rounded-lg border border-cyan-600/40 bg-cyan-950/30 p-2.5">
            <div className="flex items-center justify-between text-[11px] text-cyan-300 font-bold mb-1">
              <span className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
                EVALUATING BASELINE STABILITY...
              </span>
              <span>{windowSamplesCount}/{STABILITY_WINDOW_SIZE} SAMPLES</span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>L: Δ{leftDeltaPx.toFixed(2)}px | R: Δ{rightDeltaPx.toFixed(2)}px</span>
              <span className={isBaselineStable ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                {isBaselineStable ? 'BASELINE STABLE' : `TOL: ≤${STABILITY_TOLERANCE_PX}px`}
              </span>
            </div>
          </div>
        )}

        {screeningState === 'STIMULUS_ACTIVE' && (
          <div className="rounded-lg border border-amber-500/50 bg-amber-950/40 p-2.5 text-center text-amber-300 font-bold flex items-center justify-center gap-2 animate-pulse">
            <Zap className="h-4 w-4 text-amber-400" />
            <span>STIMULUS TRIGGERED — CAPTURING ONSET MEASUREMENT</span>
          </div>
        )}

        {screeningState === 'FINALIZED' && (
          <div className="space-y-2">
            <div className="rounded-lg border border-emerald-600/40 bg-emerald-950/30 p-2 text-center text-emerald-300 font-semibold flex items-center justify-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>SCREENING FINALIZED — RECORD STORED IN DATABASE 2</span>
            </div>
            {onStartNewSession && (
              <button
                id="start-new-screening-btn"
                onClick={onStartNewSession}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-950/50 hover:bg-cyan-900/60 text-cyan-300 py-1.5 font-mono text-[11px] font-bold uppercase transition"
              >
                <PlusCircle className="h-3.5 w-3.5 text-cyan-400" />
                <span>START NEW SCREENING SESSION</span>
              </button>
            )}
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

      {/* DATABASE 2: Finalized Screening Measurement Result */}
      {latestFinalRecord ? (
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
              <FileCheck className="h-3.5 w-3.5 text-cyan-400" />
              Final Screening Result
            </span>
            <span className="text-[10px] text-slate-400">Session: {latestFinalRecord.session_id}</span>
          </div>

          {/* Baseline vs Stimulus Metrics */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Baseline */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
              <div className="text-[10px] text-slate-400 font-semibold">STABLE BASELINE</div>
              <div className="mt-1 space-y-0.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">L:</span>
                  <span className="font-bold text-purple-300">{latestFinalRecord.baseline_left_pupil_px.toFixed(1)} px</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">R:</span>
                  <span className="font-bold text-purple-300">{latestFinalRecord.baseline_right_pupil_px.toFixed(1)} px</span>
                </div>
              </div>
            </div>

            {/* Stimulus Capture */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
              <div className="text-[10px] text-slate-400 font-semibold">STIMULUS CAPTURE</div>
              <div className="mt-1 space-y-0.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">L:</span>
                  <span className="font-bold text-cyan-300">{latestFinalRecord.stimulus_left_pupil_px.toFixed(1)} px</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">R:</span>
                  <span className="font-bold text-cyan-300">{latestFinalRecord.stimulus_right_pupil_px.toFixed(1)} px</span>
                </div>
              </div>
            </div>
          </div>

          {/* Metadata Row: Stimulus Time, Status & ID */}
          <div className="space-y-2 rounded-lg border border-slate-800/80 bg-slate-900/40 p-2.5">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-cyan-400" />
                STIMULUS TIME:
              </span>
              <span className="font-bold text-cyan-300" title={latestFinalRecord.stimulus_onset_timestamp}>
                {formatTime(latestFinalRecord.stimulus_onset_timestamp)}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">STATUS:</span>
              <StatusBadge status={latestFinalRecord.status} size="sm" />
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-800/60 pt-1.5">
              <span>RECORD ID: #{latestFinalRecord.id}</span>
              <button
                id="delete-latest-final-record-btn"
                onClick={() => setRecordToDelete(latestFinalRecord)}
                className="flex items-center gap-1 text-slate-500 hover:text-rose-400 transition"
                title="Delete this finalized record"
              >
                <Trash2 className="h-2.5 w-2.5" />
                <span>Delete Previous</span>
              </button>
            </div>
          </div>

          {/* Expandable Historical Log of Database 2 Final Records */}
          {allFinalRecords.length > 1 && (
            <div className="border-t border-slate-800/60 pt-2">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex w-full items-center justify-between text-[11px] text-slate-400 hover:text-cyan-300 transition py-1"
              >
                <span className="flex items-center gap-1.5 font-semibold">
                  <History className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Finalized Records ({allFinalRecords.length})</span>
                </span>
                {showHistory ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>

              {showHistory && (
                <div className="mt-2 max-h-48 overflow-y-auto rounded border border-slate-800 bg-slate-950/60 p-1.5 space-y-1 text-[10px]">
                  {allFinalRecords.map((rec) => (
                    <div
                      key={rec.id || rec.session_id}
                      className={`flex items-center justify-between p-1.5 rounded ${
                        rec.id === latestFinalRecord.id
                          ? 'bg-cyan-950/40 border border-cyan-800/40 text-cyan-200'
                          : 'bg-slate-900/50 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-400">#{rec.id}</span>
                        <span className="text-[9px] text-slate-500">{rec.session_id}</span>
                        <span>Base: {rec.baseline_left_pupil_px.toFixed(1)}/{rec.baseline_right_pupil_px.toFixed(1)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">{formatTime(rec.timestamp)}</span>
                        <button
                          onClick={() => setRecordToDelete(rec)}
                          className="text-slate-500 hover:text-rose-400 p-0.5"
                          title="Delete record"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-slate-800/60 bg-slate-900/30 p-4 text-center text-slate-500">
          <Database className="mx-auto h-5 w-5 opacity-40 mb-1.5" />
          <p className="text-[11px]">Awaiting stable bilateral baseline...</p>
          <p className="text-[10px] text-slate-600 mt-0.5">
            Observes 6 valid bilateral samples stable within ±0.5 px to trigger stimulus &amp; record final screening in DB 2.
          </p>
        </div>
      )}

      {/* Database Management Actions Bar */}
      <div className="flex flex-wrap items-center justify-between border-t border-slate-800/60 mt-3 pt-2 text-[11px] gap-2">
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="flex items-center gap-1 text-slate-400 hover:text-cyan-300 transition"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Refresh</span>
          </button>
        )}

        <div className="flex items-center gap-3">
          {onClearRawDb && rawCount > 0 && (
            <button
              id="open-clear-raw-db-modal-btn"
              onClick={() => setShowClearRawModal(true)}
              className="flex items-center gap-1 text-slate-500 hover:text-amber-400 transition"
              title="Clear Raw Database (DB 1)"
            >
              <Trash2 className="h-3 w-3" />
              <span>Clear Raw DB</span>
            </button>
          )}

          {onClearFinalDb && finalCount > 0 && (
            <button
              id="open-clear-final-db-modal-btn"
              onClick={() => setShowClearFinalModal(true)}
              className="flex items-center gap-1 text-slate-500 hover:text-rose-400 transition"
              title="Clear Final Database (DB 2)"
            >
              <Trash2 className="h-3 w-3" />
              <span>Clear Final DB</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
