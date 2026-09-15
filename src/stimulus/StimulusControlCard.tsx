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
    <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg text-xs">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <Sun className="h-4 w-4 text-amber-400" />
          <span className="font-mono text-xs font-semibold tracking-wider text-slate-200 uppercase">
            Light Stimulus Controller
          </span>
        </div>
        <span
          className={`rounded border px-2 py-0.5 font-mono text-[10px] ${
            isStimulusActive
              ? 'border-amber-400/60 bg-amber-950/80 text-amber-300 animate-pulse'
              : 'border-slate-800 bg-slate-900 text-slate-400'
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
              ? 'cursor-not-allowed border-amber-500/40 bg-amber-500/20 text-amber-300'
              : 'border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 hover:border-amber-400 active:scale-[0.99]'
          }`}
        >
          <Zap className="h-4 w-4 text-amber-400" />
          <span>START LIGHT STIMULUS</span>
        </button>
      </div>

      {/* Timing Telemetry Display */}
      <div className="mt-3 space-y-2 border-t border-slate-800/80 pt-3 font-mono">
        <div className="flex items-center justify-between text-slate-300">
          <span className="text-slate-400">CONFIGURED DURATION:</span>
          <span className="text-slate-200 font-semibold">{defaultDurationMs} ms</span>
        </div>

        {lastTiming ? (
          <>
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">ONSET TIMESTAMP:</span>
              <span className="text-cyan-300">{lastTiming.stimulusOnsetTime.toFixed(2)} ms</span>
            </div>

            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">OFFSET TIMESTAMP:</span>
              <span className="text-cyan-300">{lastTiming.stimulusOffsetTime.toFixed(2)} ms</span>
            </div>

            <div className="flex items-center justify-between rounded-md border border-amber-950/40 bg-amber-950/20 p-2 text-slate-300">
              <span className="text-amber-400 font-bold flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                ACTUAL DURATION:
              </span>
              <span className="font-mono text-sm font-bold text-amber-300">
                {lastTiming.actualDurationMs.toFixed(2)} ms
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 pt-0.5">
              <CheckCircle2 className="h-3 w-3" />
              <span>Timestamp recorded for PLR latency reference</span>
            </div>
          </>
        ) : (
          <div className="rounded-md border border-slate-800/60 bg-slate-900/30 p-2 text-center text-[11px] text-slate-500">
            Awaiting stimulus trigger
          </div>
        )}
      </div>
    </div>
  );
};
