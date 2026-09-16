/**
 * OptoPupil - Quantitative PLR Kinetic Metrics Panel
 * Presents clinical parameters: Latency, Amplitude, MCV, Baseline, Nadir,
 * and Bilateral Asymmetry Indices formatted for clinical decision support.
 */

import React from 'react';
import type { BilateralPLRReport } from '../../plr/types';
import { Timer, Gauge, ArrowRightLeft, ShieldAlert, CheckCircle, AlertTriangle, FileText } from 'lucide-react';

interface PLRMetricsCardProps {
  report: BilateralPLRReport | null;
  onExportReport?: () => void;
}

export const PLRMetricsCard: React.FC<PLRMetricsCardProps> = ({ report, onExportReport }) => {
  if (!report) {
    return (
      <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-4 shadow-lg">
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
          <Gauge className="h-4 w-4 text-cyan-400" />
          <span className="font-mono text-xs font-bold tracking-wider text-slate-200 uppercase">
            Quantitative PLR Kinetics
          </span>
        </div>
        <div className="py-8 text-center font-mono text-xs text-slate-500">
          Awaiting screening completion to display quantitative kinetics.
        </div>
      </div>
    );
  }

  const { leftEye, rightEye, bilateralAsymmetry, isReliable, overallQualityScore, notes } = report;

  const getPatternBadge = (pattern: string) => {
    switch (pattern) {
      case 'NORMAL_REACTIVE':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
            <CheckCircle className="h-3 w-3" /> NORMAL REACTIVE
          </span>
        );
      case 'SLUGGISH_REDUCED':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-amber-950/60 border border-amber-800/50 px-2 py-0.5 font-mono text-[10px] text-amber-300">
            <AlertTriangle className="h-3 w-3" /> SLUGGISH / REDUCED
          </span>
        );
      case 'NON_REACTIVE_FIXED':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-rose-950/60 border border-rose-800/50 px-2 py-0.5 font-mono text-[10px] text-rose-300">
            <ShieldAlert className="h-3 w-3" /> NON-REACTIVE / FIXED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded bg-slate-900 border border-slate-700 px-2 py-0.5 font-mono text-[10px] text-slate-400">
            INCONCLUSIVE
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Primary Kinetic Telemetry Card */}
      <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between border-b border-slate-800/80 pb-3 gap-2">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-cyan-400" />
            <span className="font-mono text-xs font-bold tracking-wider text-slate-200 uppercase">
              PLR Kinetic Parameters
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px]">
            {onExportReport && (
              <button
                onClick={onExportReport}
                className="flex items-center gap-1 rounded-md border border-cyan-500/40 bg-cyan-950/40 px-2.5 py-1 font-bold text-cyan-300 hover:bg-cyan-900/60 transition shadow-sm"
              >
                <FileText className="h-3 w-3" />
                <span>PDF REPORT</span>
              </button>
            )}
            <span
              className={`rounded px-2 py-0.5 font-bold ${
                isReliable
                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50'
                  : 'bg-rose-950/60 text-rose-300 border border-rose-800/50'
              }`}
            >
              {isReliable ? 'RELIABLE' : 'INCONCLUSIVE'}
            </span>
            <span className="text-slate-400">QUALITY:</span>
            <span
              className={`font-bold ${
                overallQualityScore >= 80
                  ? 'text-emerald-400'
                  : overallQualityScore >= 60
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {overallQualityScore}%
            </span>
          </div>
        </div>

        {/* Bilateral Comparison Columns */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Left Eye Metrics */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <div className="flex items-center justify-between border-b border-slate-800/70 pb-2">
              <span className="font-mono text-xs font-bold text-cyan-300">LEFT EYE (OS)</span>
              {getPatternBadge(leftEye.responsePattern)}
            </div>

            <div className="mt-2.5 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">LATENCY:</span>
                <span className="font-bold text-slate-100 flex items-center gap-1">
                  <Timer className="h-3 w-3 text-cyan-400" />
                  {leftEye.latencyMs} ms
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">CONSTRICTION AMP:</span>
                <span className="font-bold text-cyan-300">
                  {leftEye.constrictionAmplitudeMm} mm ({leftEye.constrictionPercentage}%)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">MAX VELOCITY (MCV):</span>
                <span className="font-bold text-purple-300">{leftEye.mcvMmS} mm/s</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                <span>BASELINE: {leftEye.baselineDiameterMm} mm</span>
                <span>MIN: {leftEye.minDiameterMm} mm</span>
              </div>
            </div>
          </div>

          {/* Right Eye Metrics */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
            <div className="flex items-center justify-between border-b border-slate-800/70 pb-2">
              <span className="font-mono text-xs font-bold text-purple-300">RIGHT EYE (OD)</span>
              {getPatternBadge(rightEye.responsePattern)}
            </div>

            <div className="mt-2.5 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">LATENCY:</span>
                <span className="font-bold text-slate-100 flex items-center gap-1">
                  <Timer className="h-3 w-3 text-purple-400" />
                  {rightEye.latencyMs} ms
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">CONSTRICTION AMP:</span>
                <span className="font-bold text-purple-300">
                  {rightEye.constrictionAmplitudeMm} mm ({rightEye.constrictionPercentage}%)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">MAX VELOCITY (MCV):</span>
                <span className="font-bold text-purple-300">{rightEye.mcvMmS} mm/s</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                <span>BASELINE: {rightEye.baselineDiameterMm} mm</span>
                <span>MIN: {rightEye.minDiameterMm} mm</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bilateral Asymmetry & Anisocoria Analysis Card */}
      <div className="rounded-xl border border-slate-800 bg-[#0d1322] p-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-amber-400" />
            <span className="font-mono text-xs font-bold tracking-wider text-slate-200 uppercase">
              Bilateral Asymmetry Analysis
            </span>
          </div>
          <span
            className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold ${
              bilateralAsymmetry.asymmetrySeverity === 'SYMMETRIC'
                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50'
                : bilateralAsymmetry.asymmetrySeverity === 'MILD_ASYMMETRY'
                ? 'bg-amber-950/60 text-amber-300 border border-amber-800/50'
                : 'bg-rose-950/60 text-rose-300 border border-rose-800/50'
            }`}
          >
            {bilateralAsymmetry.asymmetrySeverity.replace('_', ' ')}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
          <div className="rounded-md border border-slate-800 bg-slate-900/40 p-2.5">
            <span className="text-[10px] text-slate-400 block">ANISOCORIA (BASE)</span>
            <span className="font-bold text-slate-100 text-sm mt-0.5 block">
              {bilateralAsymmetry.baselineAnisocoriaMm} mm
            </span>
          </div>
          <div className="rounded-md border border-slate-800 bg-slate-900/40 p-2.5">
            <span className="text-[10px] text-slate-400 block">Δ CONSTRICTION %</span>
            <span className="font-bold text-slate-100 text-sm mt-0.5 block">
              {bilateralAsymmetry.constrictionPercentageDiff}%
            </span>
          </div>
          <div className="rounded-md border border-slate-800 bg-slate-900/40 p-2.5">
            <span className="text-[10px] text-slate-400 block">Δ LATENCY</span>
            <span className="font-bold text-slate-100 text-sm mt-0.5 block">
              {bilateralAsymmetry.latencyDifferenceMs} ms
            </span>
          </div>
          <div className="rounded-md border border-slate-800 bg-slate-900/40 p-2.5">
            <span className="text-[10px] text-slate-400 block">Δ MCV</span>
            <span className="font-bold text-slate-100 text-sm mt-0.5 block">
              {bilateralAsymmetry.mcvDifferenceMmS} mm/s
            </span>
          </div>
        </div>

        {/* Clinical / Diagnostic Notes */}
        {notes.length > 0 && (
          <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs font-mono space-y-1">
            {notes.map((note, idx) => (
              <p key={idx} className="text-amber-300/90 flex items-start gap-1.5">
                <span className="text-amber-400">•</span>
                <span>{note}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
