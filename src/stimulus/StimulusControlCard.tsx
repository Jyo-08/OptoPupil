import React from 'react';
import type { StimulusTiming } from './types';
import { Sun, Zap, CheckCircle2, Clock } from 'lucide-react';

interface StimulusControlCardProps {
  isStimulusActive: boolean;
  onStartStimulus: () => void;
  lastTiming: StimulusTiming | null;
  defaultDurationMs: number;
}

export const StimulusControlCard: React.FC<StimulusControlCardProps> = ({
  isStimulusActive,
  onStartStimulus,
  lastTiming,
  defaultDurationMs,
}) => {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm text-xs">
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
        <div className="flex items-center gap-2">
          <Sun className="h-4 w-4 text-amber-600" />
          <span className="font-mono text-xs font-semibold tracking-wider text-slate-900 uppercase">
            Light Stimulus Controller
          </span>
        </div>
        <span
          className={`rounded border px-2 py-0.5 font-mono text-[10px] font-medium ${
            isStimulusActive
              ? 'border-amber-300 bg-amber-50 text-amber-900 animate-pulse'
              : 'border-slate-200 bg-slate-100 text-slate-600'
          }`}
        >
          {isStimulusActive ? 'STIMULUS ACTIVE' : 'STANDBY'}
        </span>
      </div>

      {/* Trigger Button */}
      <div className="mt-3">
        <button
          id="start-stimulus-btn"
          onClick={onStartStimulus}
          disabled={isStimulusActive}
          className={`w-full flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 font-mono text-xs font-bold uppercase transition ${
            isStimulusActive
              ? 'cursor-not-allowed border-amber-300 bg-amber-100/60 text-amber-800'
              : 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 hover:border-amber-400 active:scale-[0.99] shadow-xs'
          }`}
        >
          <Zap className="h-4 w-4 text-amber-600" />
          <span>START LIGHT STIMULUS</span>
        </button>
      </div>

      {/* Timing Telemetry Display */}
      <div className="mt-3 space-y-2 border-t border-slate-200/80 pt-3 font-mono">
        <div className="flex items-center justify-between text-slate-700">
          <span className="text-slate-500">CONFIGURED DURATION:</span>
          <span className="text-slate-900 font-semibold">{defaultDurationMs} ms</span>
        </div>

        {lastTiming ? (
          <>
            <div className="flex items-center justify-between text-slate-700">
              <span className="text-slate-500">ONSET TIMESTAMP:</span>
              <span className="text-sky-700 font-semibold">{lastTiming.stimulusOnsetTime.toFixed(2)} ms</span>
            </div>

            <div className="flex items-center justify-between text-slate-700">
              <span className="text-slate-500">OFFSET TIMESTAMP:</span>
              <span className="text-sky-700 font-semibold">{lastTiming.stimulusOffsetTime.toFixed(2)} ms</span>
            </div>

            <div className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 p-2 text-slate-800">
              <span className="text-amber-800 font-bold flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-600" />
                ACTUAL DURATION:
              </span>
              <span className="font-mono text-sm font-bold text-amber-950">
                {lastTiming.actualDurationMs.toFixed(2)} ms
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 font-medium pt-0.5">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              <span>Timestamp recorded for PLR latency reference</span>
            </div>
          </>
        ) : (
          <div className="rounded-md border border-slate-200 bg-slate-50/70 p-2 text-center text-[11px] text-slate-500">
            Awaiting stimulus trigger
          </div>
        )}
      </div>
    </div>
  );
};
