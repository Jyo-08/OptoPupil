import React from 'react';
import type { BilateralPupilData } from '../../types/vision';
import { StatusBadge } from '../common/StatusBadge';
import { CircleDot } from 'lucide-react';

interface BilateralPupilMetricsCardProps {
  pupilData: BilateralPupilData;
}

export const BilateralPupilMetricsCard: React.FC<BilateralPupilMetricsCardProps> = ({ pupilData }) => {
  const leftPupil = pupilData.leftPupil;
  const rightPupil = pupilData.rightPupil;

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <CircleDot className="h-4 w-4 text-purple-400" />
          <span className="font-mono text-xs font-semibold tracking-wider text-slate-200 uppercase">
            Bilateral Pupil Metrics
          </span>
        </div>
        <span className="rounded bg-purple-950/60 border border-purple-800/40 px-2 py-0.5 font-mono text-[10px] text-purple-300">
          REAL-TIME CV
        </span>
      </div>

      {/* Left & Right Pupil Cards */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Left Pupil */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-slate-300">LEFT PUPIL</span>
            <StatusBadge status={leftPupil.status} size="sm" />
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="text-[11px] font-mono text-slate-400">DIAMETER:</span>
            <span className="font-mono text-base font-bold text-purple-300">
              {leftPupil.diameterPx ? `${leftPupil.diameterPx.toFixed(1)} px` : '—'}
            </span>
          </div>
          {leftPupil.majorAxisPx && leftPupil.minorAxisPx && (
            <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>AXES:</span>
              <span>{leftPupil.majorAxisPx.toFixed(1)} × {leftPupil.minorAxisPx.toFixed(1)} px</span>
            </div>
          )}
          {leftPupil.stability && (
            <div className="mt-2 border-t border-slate-800/80 pt-1.5 flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>CV: {leftPupil.stability.cvPercent.toFixed(1)}%</span>
              <span>&plusmn;{leftPupil.stability.stdDevPx.toFixed(2)} px</span>
            </div>
          )}
        </div>

        {/* Right Pupil */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-slate-300">RIGHT PUPIL</span>
            <StatusBadge status={rightPupil.status} size="sm" />
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="text-[11px] font-mono text-slate-400">DIAMETER:</span>
            <span className="font-mono text-base font-bold text-purple-300">
              {rightPupil.diameterPx ? `${rightPupil.diameterPx.toFixed(1)} px` : '—'}
            </span>
          </div>
          {rightPupil.majorAxisPx && rightPupil.minorAxisPx && (
            <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>AXES:</span>
              <span>{rightPupil.majorAxisPx.toFixed(1)} × {rightPupil.minorAxisPx.toFixed(1)} px</span>
            </div>
          )}
          {rightPupil.stability && (
            <div className="mt-2 border-t border-slate-800/80 pt-1.5 flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>CV: {rightPupil.stability.cvPercent.toFixed(1)}%</span>
              <span>&plusmn;{rightPupil.stability.stdDevPx.toFixed(2)} px</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
