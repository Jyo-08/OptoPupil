/**
 * OptoPupil - Hospital-Grade Clinical Pupillometry Report & PDF Export
 * 
 * Generates an auditable, print-optimized clinical neurological pupillometry report:
 * - Institutional header, Patient Demographics & Injury Context
 * - Deterministic Triage Classification & Action Directives
 * - Tabulated Bilateral Quantitative Kinetics (OS vs OD) with Reference Ranges
 * - Embedded SVG Dual-Eye PLR Waveform & Velocity Curve
 * - One-click PDF Generation / Browser Print
 * - Machine-readable JSON Export & Clipboard Paramedic Handoff
 */

import React, { useRef } from 'react';
import type { BilateralPLRReport } from '../../plr/types';
import type { PatientContext, TriageAssessment } from '../../safety/types';
import { Printer, Download, Copy, Check, X, Shield, Activity } from 'lucide-react';

interface ClinicalReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: BilateralPLRReport | null;
  patientContext: PatientContext;
  triageAssessment: TriageAssessment;
}

export const ClinicalReportModal: React.FC<ClinicalReportModalProps> = ({
  isOpen,
  onClose,
  report,
  patientContext,
  triageAssessment,
}) => {
  const [copied, setCopied] = React.useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !report) return null;

  const { leftEye, rightEye, bilateralAsymmetry, isReliable, overallQualityScore, timeSeries } = report;

  // Handle PDF / Print Action
  const handlePrint = () => {
    window.print();
  };

  // Handle JSON Download
  const handleDownloadJSON = () => {
    const payload = {
      meta: {
        application: 'OptoPupil Quantitative Pupillometry System',
        standard: 'Corneal Iris-Ratio Calibrated (11.7mm human iris reference)',
        generatedAt: new Date().toISOString(),
        version: '1.0.0-clinical',
      },
      patient: patientContext,
      triage: triageAssessment,
      plrReport: report,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OptoPupil_Report_${patientContext.patientId || 'Session'}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle Clipboard Copy for Paramedic Handoff
  const handleCopySummary = () => {
    const handoffText = `
=== OPTO PUPIL CLINICAL PUPILLOMETRY REPORT ===
Patient ID: ${patientContext.patientId || 'N/A'} (Age: ${patientContext.ageYears || 'N/A'})
Mechanism: ${patientContext.mechanism} | Time: ${patientContext.timeElapsed}
Triage Status: ${triageAssessment.headline} (${triageAssessment.urgency})

[BILATERAL PLR KINETICS]
- Baseline (D_base): OS (Left) ${leftEye.baselineDiameterMm.toFixed(2)} mm | OD (Right) ${rightEye.baselineDiameterMm.toFixed(2)} mm
- Constriction Nadir: OS ${leftEye.minDiameterMm.toFixed(2)} mm | OD ${rightEye.minDiameterMm.toFixed(2)} mm
- Amplitude: OS ${leftEye.constrictionAmplitudeMm.toFixed(2)} mm (${leftEye.constrictionPercentage.toFixed(1)}%) | OD ${rightEye.constrictionAmplitudeMm.toFixed(2)} mm (${rightEye.constrictionPercentage.toFixed(1)}%)
- Latency: OS ${Math.round(leftEye.latencyMs)} ms | OD ${Math.round(rightEye.latencyMs)} ms (Δ ${Math.round(bilateralAsymmetry.latencyDifferenceMs)} ms)
- Max Constriction Velocity (MCV): OS ${leftEye.mcvMmS.toFixed(2)} mm/s | OD ${rightEye.mcvMmS.toFixed(2)} mm/s
- Baseline Anisocoria: ${bilateralAsymmetry.baselineAnisocoriaMm.toFixed(2)} mm (${bilateralAsymmetry.asymmetrySeverity})

[TRIAGE DIRECTIVES]
${triageAssessment.actionDirectives.map((d) => `* ${d}`).join('\n')}

*OptoPupil Zero-Hardware Pupillometry Decision Support*
`.trim();

    navigator.clipboard.writeText(handoffText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Generate SVG path for waveform preview
  const generateSvgPoints = (times: number[], values: number[], width = 600, height = 140) => {
    if (!times || times.length === 0 || !values || values.length === 0) return '';
    const minT = times[0];
    const maxT = times[times.length - 1] || 5000;
    const minV = 1.0;
    const maxV = 7.0;

    return times
      .map((t, i) => {
        const x = ((t - minT) / (maxT - minT || 1)) * (width - 40) + 20;
        const v = values[i] ?? 4.0;
        const y = height - ((v - minV) / (maxV - minV)) * (height - 30) - 15;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const leftSvgPath = generateSvgPoints(timeSeries.leftEye.timeMs, timeSeries.leftEye.cleanMm);
  const rightSvgPath = generateSvgPoints(timeSeries.rightEye.timeMs, timeSeries.rightEye.cleanMm);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static animate-fade-in">
      
      {/* Modal Container */}
      <div className="relative w-full max-w-4xl rounded-2xl border border-slate-700 bg-[#0a0f1d] text-slate-100 shadow-2xl flex flex-col max-h-[92vh] print:max-h-none print:border-none print:bg-white print:text-black print:shadow-none">
        
        {/* Top Modal Controls (Hidden in Print) */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-[#0d1424] px-6 py-3.5 print:hidden">
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-bold">
              📄
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide uppercase font-mono">
                Clinical Pupillometry Examination Summary
              </h2>
              <p className="text-[11px] text-slate-400">
                Hospital Medical Record &amp; Field Decision-Support Document
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 font-mono">
            <button
              onClick={handleCopySummary}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 transition"
              title="Copy text summary for EMS handoff notes"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-cyan-400" />}
              <span>{copied ? 'Copied' : 'Copy Handoff'}</span>
            </button>

            <button
              onClick={handleDownloadJSON}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 transition"
            >
              <Download className="h-3.5 w-3.5 text-cyan-400" />
              <span>JSON</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:from-cyan-400 hover:to-blue-500 transition shadow-md shadow-cyan-500/20"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print / Save PDF</span>
            </button>

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition ml-2"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Report Body */}
        <div ref={printAreaRef} className="flex-1 overflow-y-auto p-6 space-y-5 print:p-0 print:overflow-visible custom-scrollbar">
          
          {/* 1. Official Header & Institutional Metadata */}
          <div className="border-b border-slate-800 pb-4 print:border-black flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="text-cyan-400 font-extrabold text-xl tracking-tight print:text-black">
                  OPTO PUPIL
                </div>
                <span className="rounded bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 text-[10px] font-mono text-cyan-300 print:border-black print:text-black print:bg-gray-100">
                  CLINICAL REPORT
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 print:text-gray-600">
                Zero-Hardware Quantitative Pupillary Light Reflex (PLR) Screening System
              </p>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5 print:text-gray-500">
                Iris Ratio Calibration: 11.70 mm corneal iris standard | 30 FPS Sub-pixel Mesh
              </p>
            </div>

            <div className="text-right text-xs font-mono space-y-0.5 print:text-black">
              <div><strong className="text-slate-300 print:text-black">Session ID:</strong> {report.sessionId}</div>
              <div><strong className="text-slate-300 print:text-black">Date &amp; Time:</strong> {new Date(report.timestamp).toLocaleString()}</div>
              <div><strong className="text-slate-300 print:text-black">Quality Score:</strong> {overallQualityScore}% ({isReliable ? 'Valid' : 'Inconclusive'})</div>
            </div>
          </div>

          {/* 2. Patient Demographics & Trauma Context */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl border border-slate-800 bg-[#0d1424] text-xs font-mono print:bg-gray-50 print:border-gray-300 print:text-black">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Patient Identifier</span>
              <span className="font-bold text-slate-200 text-sm print:text-black">{patientContext.patientId || 'Anonymous / Unset'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Age</span>
              <span className="font-bold text-slate-200 text-sm print:text-black">{patientContext.ageYears ? `${patientContext.ageYears} yrs` : 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Injury Mechanism</span>
              <span className="font-bold text-slate-200 print:text-black">{patientContext.mechanism.replace(/_/g, ' ')}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Time Since Event</span>
              <span className="font-bold text-slate-200 print:text-black">{patientContext.timeElapsed.replace(/_/g, ' ')}</span>
            </div>
          </div>

          {/* 3. Triage Assessment Banner */}
          <div
            className={`p-4 rounded-xl border text-xs ${
              triageAssessment.urgency === 'EMERGENCY_RED'
                ? 'border-red-500/60 bg-red-950/40 text-red-200 print:border-red-600 print:bg-red-50 print:text-black'
                : triageAssessment.urgency === 'OBSERVE_AMBER'
                ? 'border-amber-500/60 bg-amber-950/40 text-amber-200 print:border-amber-600 print:bg-amber-50 print:text-black'
                : 'border-emerald-500/60 bg-emerald-950/40 text-emerald-200 print:border-emerald-600 print:bg-emerald-50 print:text-black'
            }`}
          >
            <div className="flex items-center justify-between font-bold text-sm mb-1">
              <span className="flex items-center gap-1.5">
                <Shield className="h-4 w-4" />
                {triageAssessment.headline}
              </span>
              <span className="rounded px-2 py-0.5 text-[10px] font-mono uppercase bg-black/40 text-white print:bg-gray-200 print:text-black">
                {triageAssessment.urgency}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed mb-2 opacity-90">
              {triageAssessment.summary}
            </p>
            {triageAssessment.actionDirectives.length > 0 && (
              <div className="pt-2 border-t border-slate-800/80 print:border-gray-300">
                <strong className="block text-[11px] uppercase tracking-wider mb-1">Immediate Directives:</strong>
                <ul className="space-y-0.5 text-[11px]">
                  {triageAssessment.actionDirectives.map((d, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span>•</span>
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* 4. Tabulated Bilateral Quantitative Kinetics Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono print:text-black flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-cyan-400" />
                Bilateral Quantitative Kinetic Telemetry
              </h3>
              <span className="text-[10px] font-mono text-slate-500 print:text-gray-500">
                OS = Left Eye | OD = Right Eye
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0d1424] print:border-gray-300 print:bg-white">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/80 text-[11px] text-slate-400 print:border-gray-300 print:bg-gray-100 print:text-black">
                    <th className="py-2.5 px-3">Kinetic Parameter</th>
                    <th className="py-2.5 px-3 text-cyan-400 print:text-black">Left Eye (OS)</th>
                    <th className="py-2.5 px-3 text-purple-400 print:text-black">Right Eye (OD)</th>
                    <th className="py-2.5 px-3 text-slate-300 print:text-black">Bilateral Delta (Δ)</th>
                    <th className="py-2.5 px-3 text-slate-400 print:text-gray-600">Reference Norm</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 print:divide-gray-200">
                  <tr>
                    <td className="py-2 px-3 text-slate-300 font-medium print:text-black">Baseline Diameter ($D_{'{'}base{'}'}$)</td>
                    <td className="py-2 px-3 font-bold text-white print:text-black">{leftEye.baselineDiameterMm.toFixed(2)} mm</td>
                    <td className="py-2 px-3 font-bold text-white print:text-black">{rightEye.baselineDiameterMm.toFixed(2)} mm</td>
                    <td className="py-2 px-3 font-bold text-cyan-300 print:text-black">{bilateralAsymmetry.baselineAnisocoriaMm.toFixed(2)} mm (Anisocoria)</td>
                    <td className="py-2 px-3 text-slate-400 print:text-gray-600">2.50 – 5.50 mm (&lt; 0.40 mm Δ)</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-slate-300 font-medium print:text-black">Constriction Nadir ($D_{'{'}min{'}'}$)</td>
                    <td className="py-2 px-3 font-bold text-white print:text-black">{leftEye.minDiameterMm.toFixed(2)} mm</td>
                    <td className="py-2 px-3 font-bold text-white print:text-black">{rightEye.minDiameterMm.toFixed(2)} mm</td>
                    <td className="py-2 px-3 font-bold text-slate-300 print:text-black">{bilateralAsymmetry.minAnisocoriaMm.toFixed(2)} mm</td>
                    <td className="py-2 px-3 text-slate-400 print:text-gray-600">1.50 – 3.80 mm</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-slate-300 font-medium print:text-black">Constriction Amplitude</td>
                    <td className="py-2 px-3 font-bold text-white print:text-black">{leftEye.constrictionAmplitudeMm.toFixed(2)} mm ({leftEye.constrictionPercentage.toFixed(1)}%)</td>
                    <td className="py-2 px-3 font-bold text-white print:text-black">{rightEye.constrictionAmplitudeMm.toFixed(2)} mm ({rightEye.constrictionPercentage.toFixed(1)}%)</td>
                    <td className="py-2 px-3 font-bold text-slate-300 print:text-black">{bilateralAsymmetry.constrictionPercentageDiff.toFixed(1)}% Δ</td>
                    <td className="py-2 px-3 text-slate-400 print:text-gray-600">≥ 15.0% (&gt; 0.80 mm)</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-slate-300 font-medium print:text-black">Constriction Latency ($t_{'{'}onset{'}'}$)</td>
                    <td className="py-2 px-3 font-bold text-white print:text-black">{Math.round(leftEye.latencyMs)} ms</td>
                    <td className="py-2 px-3 font-bold text-white print:text-black">{Math.round(rightEye.latencyMs)} ms</td>
                    <td className="py-2 px-3 font-bold text-slate-300 print:text-black">{Math.round(bilateralAsymmetry.latencyDifferenceMs)} ms Δ</td>
                    <td className="py-2 px-3 text-slate-400 print:text-gray-600">200 – 300 ms (&lt; 50 ms Δ)</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-slate-300 font-medium print:text-black">Max Constriction Velocity (MCV)</td>
                    <td className="py-2 px-3 font-bold text-white print:text-black">{leftEye.mcvMmS.toFixed(2)} mm/s</td>
                    <td className="py-2 px-3 font-bold text-white print:text-black">{rightEye.mcvMmS.toFixed(2)} mm/s</td>
                    <td className="py-2 px-3 font-bold text-slate-300 print:text-black">{bilateralAsymmetry.mcvDifferenceMmS.toFixed(2)} mm/s Δ</td>
                    <td className="py-2 px-3 text-slate-400 print:text-gray-600">≥ 1.80 mm/s</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-slate-300 font-medium print:text-black">Response Classification</td>
                    <td className="py-2 px-3 font-bold text-emerald-400 print:text-black">{leftEye.responsePattern}</td>
                    <td className="py-2 px-3 font-bold text-emerald-400 print:text-black">{rightEye.responsePattern}</td>
                    <td className="py-2 px-3 font-bold text-slate-300 print:text-black">{bilateralAsymmetry.asymmetrySeverity}</td>
                    <td className="py-2 px-3 text-slate-400 print:text-gray-600">NORMAL REACTIVE</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 5. Embedded SVG Waveform Representation */}
          <div>
            <div className="flex items-center justify-between mb-1.5 font-mono text-xs">
              <span className="font-bold text-slate-300 uppercase print:text-black">
                Bilateral Pupillometry Waveform (5.2s Trajectory)
              </span>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1 text-cyan-400 print:text-black font-bold">
                  <span className="h-2 w-2 rounded-full bg-cyan-400"></span> Left Eye (OS)
                </span>
                <span className="flex items-center gap-1 text-purple-400 print:text-black font-bold">
                  <span className="h-2 w-2 rounded-full bg-purple-400"></span> Right Eye (OD)
                </span>
                <span className="flex items-center gap-1 text-amber-300 print:text-gray-700">
                  <span className="h-2 w-2 bg-amber-400/40 border border-amber-400"></span> 200ms Flash
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#070c18] p-3 print:bg-white print:border-gray-400">
              <svg viewBox="0 0 600 140" className="w-full h-32 overflow-visible">
                {/* Grid Lines */}
                <line x1="20" y1="20" x2="580" y2="20" stroke="#1e293b" strokeDasharray="3 3" />
                <line x1="20" y1="65" x2="580" y2="65" stroke="#1e293b" strokeDasharray="3 3" />
                <line x1="20" y1="110" x2="580" y2="110" stroke="#1e293b" strokeDasharray="3 3" />
                
                {/* Stimulus Flash Band (t = 1500ms to 1700ms) */}
                <rect x="180" y="10" width="24" height="120" fill="rgba(251, 191, 36, 0.15)" stroke="rgba(251, 191, 36, 0.4)" strokeWidth="1" />
                <text x="192" y="138" fill="#fbbf24" fontSize="8" textAnchor="middle" fontFamily="monospace">FLASH</text>

                {/* Left Eye Trajectory (Cyan) */}
                {leftSvgPath && (
                  <path d={leftSvgPath} fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" />
                )}

                {/* Right Eye Trajectory (Purple) */}
                {rightSvgPath && (
                  <path d={rightSvgPath} fill="none" stroke="#c084fc" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="2 0" />
                )}

                {/* Axis Labels */}
                <text x="20" y="136" fill="#64748b" fontSize="8" fontFamily="monospace">0.0s Baseline</text>
                <text x="350" y="136" fill="#64748b" fontSize="8" fontFamily="monospace">Constriction &amp; Recovery</text>
                <text x="560" y="136" fill="#64748b" fontSize="8" fontFamily="monospace">5.2s</text>
              </svg>
            </div>
          </div>

          {/* 6. Medical Disclaimer & Institutional Seal */}
          <div className="border-t border-slate-800 pt-3 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-500 font-mono gap-2 print:border-gray-400 print:text-gray-600">
            <div>
              <strong>CLINICAL DECISION SUPPORT DISCLAIMER:</strong> OptoPupil is an automated quantitative screening aid. It does not constitute a standalone medical diagnosis. All findings must be correlated with clinical examination by a qualified practitioner.
            </div>
            <div className="whitespace-nowrap font-bold text-slate-400 print:text-black">
              OPTO PUPIL BIO × ENGINEERING
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
