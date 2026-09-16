/**
 * OptoPupil - Clinical Triage Alert Banner & Decision Support Display
 * 
 * Displays the deterministic medical evaluation results:
 * - Urgency Level (EMERGENCY_RED | OBSERVE_AMBER | NORMAL_GREEN | INCONCLUSIVE_GRAY)
 * - Triggered Red Flags & Clinical Rationales
 * - Action Directives (EMS, Spinal precautions, Removal from play)
 * - Deterministic safety override notice
 */

import React, { useState } from 'react';
import type { TriageAssessment } from '../../safety/types';
import type { PatientContext } from '../../safety/types';

interface TriageAlertBannerProps {
  assessment: TriageAssessment;
  patientContext: PatientContext;
  onOpenContextModal: () => void;
}

export const TriageAlertBanner: React.FC<TriageAlertBannerProps> = ({
  assessment,
  patientContext,
  onOpenContextModal,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const getUrgencyStyles = () => {
    switch (assessment.urgency) {
      case 'EMERGENCY_RED':
        return {
          container: 'border-red-500/80 bg-gradient-to-r from-red-950/80 via-red-900/40 to-slate-900/90 shadow-2xl shadow-red-950/60 ring-1 ring-red-500/50',
          badge: 'bg-red-500 text-white shadow-lg shadow-red-500/40 animate-pulse',
          badgeLabel: 'EMERGENCY RED FLAG',
          icon: '🚨',
          textColor: 'text-red-300',
          actionBg: 'bg-red-950/50 border-red-500/30 text-red-200',
        };
      case 'OBSERVE_AMBER':
        return {
          container: 'border-amber-500/70 bg-gradient-to-r from-amber-950/70 via-amber-900/30 to-slate-900/90 shadow-xl shadow-amber-950/40 ring-1 ring-amber-500/40',
          badge: 'bg-amber-500 text-slate-950 font-extrabold shadow-lg shadow-amber-500/30',
          badgeLabel: 'OBSERVE / SUSPEND',
          icon: '⚠️',
          textColor: 'text-amber-300',
          actionBg: 'bg-amber-950/40 border-amber-500/30 text-amber-200',
        };
      case 'INCONCLUSIVE_GRAY':
        return {
          container: 'border-slate-600 bg-gradient-to-r from-slate-900/90 via-slate-800/40 to-slate-900/90 shadow-lg shadow-slate-950/40',
          badge: 'bg-slate-700 text-slate-200 font-bold',
          badgeLabel: 'INCONCLUSIVE',
          icon: '🔄',
          textColor: 'text-slate-300',
          actionBg: 'bg-slate-900/60 border-slate-700 text-slate-300',
        };
      case 'NORMAL_GREEN':
      default:
        return {
          container: 'border-emerald-500/50 bg-gradient-to-r from-emerald-950/50 via-emerald-900/20 to-slate-900/90 shadow-xl shadow-emerald-950/30 ring-1 ring-emerald-500/30',
          badge: 'bg-emerald-500 text-slate-950 font-extrabold shadow-md shadow-emerald-500/20',
          badgeLabel: 'NORMAL REACTIVE',
          icon: '🛡️',
          textColor: 'text-emerald-300',
          actionBg: 'bg-emerald-950/30 border-emerald-500/20 text-emerald-200',
        };
    }
  };

  const styles = getUrgencyStyles();

  return (
    <div className={`rounded-2xl border p-5 transition-all text-slate-100 ${styles.container}`}>
      {/* Top Bar: Urgency Badge, Headline, and Context Trigger */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start space-x-3">
          <span className="text-2xl pt-0.5">{styles.icon}</span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-0.5 text-xs tracking-wider uppercase font-bold ${styles.badge}`}>
                {styles.badgeLabel}
              </span>
              <span className="text-xs font-medium text-slate-400">
                Patient: <strong className="text-slate-200">{patientContext.patientId || 'Unspecified'}</strong>
              </span>
              {assessment.requiresEmergencyTransport && (
                <span className="rounded-full bg-red-600/90 px-2.5 py-0.5 text-[11px] font-bold text-white uppercase tracking-wider animate-bounce">
                  EMS Transfer
                </span>
              )}
              {assessment.requiresPlaySuspension && (
                <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                  Suspended From Play
                </span>
              )}
            </div>
            <h3 className={`mt-1.5 text-base sm:text-lg font-bold tracking-tight ${styles.textColor}`}>
              {assessment.headline}
            </h3>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 self-end sm:self-center">
          <button
            onClick={onOpenContextModal}
            className="flex items-center space-x-1.5 rounded-xl border border-cyan-500/40 bg-cyan-950/40 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/60 transition-colors shadow-sm"
          >
            <span>📋</span>
            <span>Edit Patient Context</span>
            {patientContext.symptoms.length > 0 && (
              <span className="rounded-full bg-cyan-500/20 px-1.5 py-0.2 text-[10px] text-cyan-200 font-bold">
                {patientContext.symptoms.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="rounded-xl border border-slate-700 bg-slate-900/80 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
          >
            {isExpanded ? '▲ Hide Details' : '▼ View Triage'}
          </button>
        </div>
      </div>

      {/* Summary Paragraph */}
      <p className="mt-3 text-xs sm:text-sm text-slate-300 leading-relaxed">
        {assessment.summary}
      </p>

      {/* Collapsible Clinical Findings & Action Directives */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-slate-800 space-y-4 animate-fade-in">
          
          {/* Active Red Flags & Clinical Findings */}
          {assessment.triggers.length > 0 && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Triggered Clinical Criteria ({assessment.triggers.length})
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {assessment.triggers.map((trigger) => (
                  <div
                    key={trigger.id}
                    className={`rounded-xl border p-3 text-xs ${
                      trigger.severity === 'CRITICAL'
                        ? 'border-red-500/40 bg-red-950/30 text-red-200'
                        : 'border-amber-500/40 bg-amber-950/30 text-amber-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <span>{trigger.severity === 'CRITICAL' ? '🔴' : '🟡'}</span>
                        {trigger.title}
                      </span>
                      <span className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                        {trigger.category}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-300 text-[11px] leading-snug">
                      {trigger.description}
                    </p>
                    <div className="mt-1.5 pt-1.5 border-t border-slate-800/80 text-[10px] text-slate-400 italic">
                      <strong>Rationale:</strong> {trigger.clinicalRationale}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Directives / Field Guidance */}
          <div className={`rounded-xl border p-3.5 ${styles.actionBg}`}>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-2 flex items-center gap-2">
              <span>📌</span> Immediate Action Directives & Field Protocols
            </div>
            <ul className="space-y-1.5 text-xs text-slate-200">
              {assessment.actionDirectives.map((directive, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold mt-0.5">›</span>
                  <span>{directive}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal / Medical Safety Guardrail */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2.5">
            <span className="flex items-center gap-1.5">
              <span className="text-emerald-400 font-bold">🔒 Deterministic Engine:</span> Pure mathematical & clinical thresholds. Not generative AI.
            </span>
            <span className="text-slate-400">
              Evaluated: {new Date(assessment.timestamp).toLocaleTimeString()}
            </span>
          </div>

        </div>
      )}
    </div>
  );
};
