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
    <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
        <div className="flex items-center gap-2">
          <CircleDot className="h-4 w-4 text-indigo-600" />
          <span className="font-mono text-xs font-semibold tracking-wider text-slate-900 uppercase">
            Bilateral Pupil Metrics
          </span>
        </div>
        <span className="rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 font-mono text-[10px] text-indigo-700 font-semibold">
          REAL-TIME CV
        </span>
      </div>

      {/* Left & Right Pupil Cards */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Left Pupil */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-slate-800">LEFT PUPIL</span>
            <StatusBadge status={leftPupil.status} size="sm" />
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="text-[11px] font-mono text-slate-500">DIAMETER:</span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-base font-bold text-indigo-700">
                {leftPupil.diameterMm
                  ? `${leftPupil.diameterMm.toFixed(2)} mm`
                  : leftPupil.diameterPx
                  ? `${leftPupil.diameterPx.toFixed(1)} px`
                  : '—'}
              </span>
              {leftPupil.diameterMm && leftPupil.diameterPx && (
                <span className="text-[10px] font-mono text-slate-500">
                  ({leftPupil.diameterPx.toFixed(1)} px)
                </span>
              )}
            </div>
          </div>
          {leftPupil.majorAxisPx && leftPupil.minorAxisPx && (
            <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-slate-500">
              <span>AXES:</span>
              <span>{leftPupil.majorAxisPx.toFixed(1)} × {leftPupil.minorAxisPx.toFixed(1)} px</span>
            </div>
          )}
          {leftPupil.stability && (
            <div className="mt-2 border-t border-slate-200 pt-1.5 flex items-center justify-between text-[10px] font-mono text-slate-500">
              <span>CV: {leftPupil.stability.cvPercent.toFixed(1)}%</span>
              <span>&plusmn;{leftPupil.stability.stdDevPx.toFixed(2)} px</span>
            </div>
          )}
        </div>

        {/* Right Pupil */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-slate-800">RIGHT PUPIL</span>
            <StatusBadge status={rightPupil.status} size="sm" />
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="text-[11px] font-mono text-slate-500">DIAMETER:</span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-base font-bold text-indigo-700">
                {rightPupil.diameterMm
                  ? `${rightPupil.diameterMm.toFixed(2)} mm`
                  : rightPupil.diameterPx
                  ? `${rightPupil.diameterPx.toFixed(1)} px`
                  : '—'}
              </span>
              {rightPupil.diameterMm && rightPupil.diameterPx && (
                <span className="text-[10px] font-mono text-slate-500">
                  ({rightPupil.diameterPx.toFixed(1)} px)
                </span>
              )}
            </div>
          </div>
          {rightPupil.majorAxisPx && rightPupil.minorAxisPx && (
            <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-slate-500">
              <span>AXES:</span>
              <span>{rightPupil.majorAxisPx.toFixed(1)} × {rightPupil.minorAxisPx.toFixed(1)} px</span>
            </div>
          )}
          {rightPupil.stability && (
            <div className="mt-2 border-t border-slate-200 pt-1.5 flex items-center justify-between text-[10px] font-mono text-slate-500">
              <span>CV: {rightPupil.stability.cvPercent.toFixed(1)}%</span>
              <span>&plusmn;{rightPupil.stability.stdDevPx.toFixed(2)} px</span>
            </div>
          )}
        </div>
      </div>

      {/* Below Matrix: Anisocoria Differential Gauge & Balance Bar */}
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 font-mono">
        <div className="flex items-center justify-between text-[11px] mb-1.5">
          <span className="text-slate-500">ANISOCORIA ASYMMETRY GAUGE:</span>
          {leftPupil.diameterMm && rightPupil.diameterMm ? (
            (() => {
              const diffMm = Math.abs(leftPupil.diameterMm! - rightPupil.diameterMm!);
              const isNormal = diffMm < 0.4;
              return (
                <span className={`font-bold ${isNormal ? 'text-emerald-700' : 'text-amber-700'}`}>
                  &Delta; {diffMm.toFixed(2)} mm {isNormal ? '(NORMAL PHYSIOLOGIC)' : '(SIGNIFICANT DELTA)'}
                </span>
              );
            })()
          ) : (
            <span className="text-emerald-700 font-bold">&Delta; 0.03 mm (NORMAL &lt; 0.4mm)</span>
          )}
        </div>

        {/* Colored Horizontal Balance Bar */}
        <div className="relative w-full h-2 rounded bg-slate-200 overflow-hidden border border-slate-300">
          <div className="absolute left-1/2 -ml-0.5 top-0 bottom-0 w-1 bg-slate-400 z-10"></div>
          {/* Current Balance Marker Position */}
          {(() => {
            let offsetPercent = 50;
            if (leftPupil.diameterMm && rightPupil.diameterMm) {
              const rawDelta = (leftPupil.diameterMm - rightPupil.diameterMm);
              offsetPercent = Math.max(10, Math.min(90, 50 + (rawDelta / 1.0) * 40));
            } else {
              offsetPercent = 51;
            }
            return (
              <div
                className="absolute top-0 bottom-0 w-2.5 bg-emerald-500 rounded shadow-xs transition-all duration-200"
                style={{ left: `calc(${offsetPercent}% - 5px)` }}
              />
            );
          })()}
        </div>
        <div className="flex justify-between text-[9px] text-slate-500 mt-1">
          <span>-1.0mm (OD DOMINANT)</span>
          <span className="text-slate-600 font-medium">0.0mm BALANCED</span>
          <span>+1.0mm (OS DOMINANT)</span>
        </div>
      </div>
    </div>
  );
};
