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
      <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3">
          <Gauge className="h-4 w-4 text-sky-600" />
          <span className="font-mono text-xs font-bold tracking-wider text-slate-900 uppercase">
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
          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 font-mono text-[10px] text-emerald-800 font-semibold">
            <CheckCircle className="h-3 w-3" /> NORMAL REACTIVE
          </span>
        );
      case 'SLUGGISH_REDUCED':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-200 px-2 py-0.5 font-mono text-[10px] text-amber-800 font-semibold">
            <AlertTriangle className="h-3 w-3" /> SLUGGISH / REDUCED
          </span>
        );
      case 'NON_REACTIVE_FIXED':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-rose-50 border border-rose-200 px-2 py-0.5 font-mono text-[10px] text-rose-800 font-semibold">
            <ShieldAlert className="h-3 w-3" /> NON-REACTIVE / FIXED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded bg-slate-100 border border-slate-200 px-2 py-0.5 font-mono text-[10px] text-slate-600">
            INCONCLUSIVE
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Primary Kinetic Telemetry Card */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between border-b border-slate-200/80 pb-3 gap-2">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-sky-600" />
            <span className="font-mono text-xs font-bold tracking-wider text-slate-900 uppercase">
              PLR Kinetic Parameters
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px]">
            {onExportReport && (
              <button
                onClick={onExportReport}
                className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 font-bold text-sky-700 hover:bg-sky-50 transition shadow-xs"
              >
                <FileText className="h-3 w-3" />
                <span>PDF REPORT</span>
              </button>
            )}
            <span
              className={`rounded px-2 py-0.5 font-bold ${
                isReliable
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {isReliable ? 'RELIABLE' : 'INCONCLUSIVE'}
            </span>
            <span className="text-slate-500">QUALITY:</span>
            <span
              className={`font-bold ${
                overallQualityScore >= 80
                  ? 'text-emerald-700'
                  : overallQualityScore >= 60
                  ? 'text-amber-700'
                  : 'text-rose-700'
              }`}
            >
              {overallQualityScore}%
            </span>
          </div>
        </div>

        {/* Bilateral Comparison Columns */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Left Eye Metrics */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="font-mono text-xs font-bold text-sky-800">LEFT EYE (OS)</span>
              {getPatternBadge(leftEye.responsePattern)}
            </div>

            <div className="mt-2.5 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">LATENCY:</span>
                <span className="font-bold text-slate-900 flex items-center gap-1">
                  <Timer className="h-3 w-3 text-sky-600" />
                  {leftEye.latencyMs} ms
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">CONSTRICTION AMP:</span>
                <span className="font-bold text-sky-700">
                  {leftEye.constrictionAmplitudeMm} mm ({leftEye.constrictionPercentage}%)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">MAX VELOCITY (MCV):</span>
                <span className="font-bold text-indigo-700">{leftEye.mcvMmS} mm/s</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                <span>BASELINE: {leftEye.baselineDiameterMm} mm</span>
                <span>MIN: {leftEye.minDiameterMm} mm</span>
              </div>
            </div>
          </div>

          {/* Right Eye Metrics */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="font-mono text-xs font-bold text-purple-800">RIGHT EYE (OD)</span>
              {getPatternBadge(rightEye.responsePattern)}
            </div>

            <div className="mt-2.5 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">LATENCY:</span>
                <span className="font-bold text-slate-900 flex items-center gap-1">
                  <Timer className="h-3 w-3 text-purple-600" />
                  {rightEye.latencyMs} ms
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">CONSTRICTION AMP:</span>
                <span className="font-bold text-purple-700">
                  {rightEye.constrictionAmplitudeMm} mm ({rightEye.constrictionPercentage}%)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">MAX VELOCITY (MCV):</span>
                <span className="font-bold text-purple-700">{rightEye.mcvMmS} mm/s</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                <span>BASELINE: {rightEye.baselineDiameterMm} mm</span>
                <span>MIN: {rightEye.minDiameterMm} mm</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bilateral Asymmetry & Anisocoria Analysis Card */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-amber-600" />
            <span className="font-mono text-xs font-bold tracking-wider text-slate-900 uppercase">
              Bilateral Asymmetry Analysis
            </span>
          </div>
          <span
            className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold ${
              bilateralAsymmetry.asymmetrySeverity === 'SYMMETRIC'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : bilateralAsymmetry.asymmetrySeverity === 'MILD_ASYMMETRY'
                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {bilateralAsymmetry.asymmetrySeverity.replace('_', ' ')}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <span className="text-[10px] text-slate-500 block">ANISOCORIA (BASE)</span>
            <span className="font-bold text-slate-900 text-sm mt-0.5 block">
              {bilateralAsymmetry.baselineAnisocoriaMm} mm
            </span>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <span className="text-[10px] text-slate-500 block">Δ CONSTRICTION %</span>
            <span className="font-bold text-slate-900 text-sm mt-0.5 block">
              {bilateralAsymmetry.constrictionPercentageDiff}%
            </span>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <span className="text-[10px] text-slate-500 block">Δ LATENCY</span>
            <span className="font-bold text-slate-900 text-sm mt-0.5 block">
              {bilateralAsymmetry.latencyDifferenceMs} ms
            </span>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <span className="text-[10px] text-slate-500 block">Δ MCV</span>
            <span className="font-bold text-slate-900 text-sm mt-0.5 block">
              {bilateralAsymmetry.mcvDifferenceMmS} mm/s
            </span>
          </div>
        </div>

        {/* Clinical / Diagnostic Notes */}
        {notes.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs font-mono space-y-1">
            {notes.map((note, idx) => (
              <p key={idx} className="text-amber-900 flex items-start gap-1.5">
                <span className="text-amber-600">•</span>
                <span>{note}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
