import React from 'react';
import type { PupilMeasurementRecord } from '../../db/types';
import { StatusBadge } from '../common/StatusBadge';
import { Database, Clock, HardDrive, CheckCircle2, AlertCircle, Trash2, RefreshCw } from 'lucide-react';

interface LatestMeasurementCardProps {
  latestMeasurement: PupilMeasurementRecord | null;
  totalCount: number;
  isSaving: boolean;
  persistenceError: string | null;
  onRefresh?: () => void;
  onClear?: () => void;
}

export const LatestMeasurementCard: React.FC<LatestMeasurementCardProps> = ({
  latestMeasurement,
  totalCount,
  isSaving,
  persistenceError,
  onRefresh,
  onClear,
}) => {
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

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg text-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-cyan-400" />
          <span className="font-mono text-xs font-semibold tracking-wider text-slate-200 uppercase">
            Persisted Measurement
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px]">
          {isSaving ? (
            <span className="rounded bg-cyan-950/80 border border-cyan-700/60 px-2 py-0.5 text-cyan-300 animate-pulse flex items-center gap-1">
              <RefreshCw className="h-2.5 w-2.5 animate-spin" />
              WRITING...
            </span>
          ) : (
            <span className="rounded bg-slate-900 border border-slate-800 px-2 py-0.5 text-slate-400 flex items-center gap-1">
              <HardDrive className="h-2.5 w-2.5 text-cyan-400" />
              <span>{totalCount} RECORDS</span>
            </span>
          )}
        </div>
      </div>

      {/* Persistence Error Banner if any */}
      {persistenceError && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-600/30 bg-rose-950/30 p-2.5 text-rose-300">
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-400 mt-0.5" />
          <div>
            <p className="font-mono text-[11px] font-bold">Persistence Error</p>
            <p className="text-[10px] text-rose-400/90">{persistenceError}</p>
          </div>
        </div>
      )}

      {/* Main Measurement Content */}
      {latestMeasurement ? (
        <div className="mt-3 space-y-3 font-mono">
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

            {latestMeasurement.id && (
              <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-800/60 pt-1.5">
                <span>RECORD ID: #{latestMeasurement.id}</span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  SYNCED TO DB
                </span>
              </div>
            )}
          </div>

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
                onClick={onClear}
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
        <div className="mt-3 rounded-lg border border-slate-800/60 bg-slate-900/30 p-4 text-center font-mono text-slate-500">
          <Database className="mx-auto h-5 w-5 opacity-40 mb-1.5" />
          <p className="text-[11px]">Awaiting bilateral detection transition...</p>
          <p className="text-[10px] text-slate-600 mt-0.5">
            Auto-persists to IndexedDB when both pupils are detected
          </p>
        </div>
      )}
    </div>
  );
};
