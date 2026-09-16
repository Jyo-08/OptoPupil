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
          container: 'border-rose-300 bg-rose-50/90 shadow-sm text-slate-900 ring-1 ring-rose-200',
          badge: 'bg-rose-600 text-white shadow-xs animate-pulse',
          badgeLabel: 'EMERGENCY RED FLAG',
          icon: '🚨',
          textColor: 'text-rose-950',
          actionBg: 'bg-white border-rose-200 text-rose-900 shadow-xs',
        };
      case 'OBSERVE_AMBER':
        return {
          container: 'border-amber-300 bg-amber-50/80 shadow-sm text-slate-900 ring-1 ring-amber-200',
          badge: 'bg-amber-600 text-white font-bold shadow-xs',
          badgeLabel: 'OBSERVE / SUSPEND',
          icon: '⚠️',
          textColor: 'text-amber-950',
          actionBg: 'bg-white border-amber-200 text-amber-900 shadow-xs',
        };
      case 'INCONCLUSIVE_GRAY':
        return {
          container: 'border-slate-200 bg-slate-50 shadow-sm text-slate-900',
          badge: 'bg-slate-600 text-white font-bold',
          badgeLabel: 'INCONCLUSIVE',
          icon: '🔄',
          textColor: 'text-slate-800',
          actionBg: 'bg-white border-slate-200 text-slate-700 shadow-xs',
        };
      case 'NORMAL_GREEN':
      default:
        return {
          container: 'border-emerald-200 bg-emerald-50/70 shadow-sm text-slate-900 ring-1 ring-emerald-100',
          badge: 'bg-emerald-600 text-white font-bold shadow-xs',
          badgeLabel: 'NORMAL REACTIVE',
          icon: '🛡️',
          textColor: 'text-emerald-950',
          actionBg: 'bg-white border-emerald-200 text-emerald-900 shadow-xs',
        };
    }
  };

  const styles = getUrgencyStyles();

  return (
    <div className={`rounded-2xl border p-5 transition-all text-slate-900 ${styles.container}`}>
      {/* Top Bar: Urgency Badge, Headline, and Context Trigger */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start space-x-3">
          <span className="text-2xl pt-0.5">{styles.icon}</span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-0.5 text-xs tracking-wider uppercase font-bold ${styles.badge}`}>
                {styles.badgeLabel}
              </span>
              <span className="text-xs font-medium text-slate-600">
                Patient: <strong className="text-slate-900">{patientContext.patientId || 'Unspecified'}</strong>
              </span>
              {assessment.requiresEmergencyTransport && (
                <span className="rounded-full bg-rose-600 px-2.5 py-0.5 text-[11px] font-bold text-white uppercase tracking-wider animate-bounce">
                  EMS Transfer
                </span>
              )}
              {assessment.requiresPlaySuspension && (
                <span className="rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900">
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
            className="flex items-center space-x-1.5 rounded-xl border border-sky-300 bg-white px-3 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-50 transition-colors shadow-xs"
          >
            <span>📋</span>
            <span>Edit Patient Context</span>
            {patientContext.symptoms.length > 0 && (
              <span className="rounded-full bg-sky-100 px-1.5 py-0.2 text-[10px] text-sky-800 font-bold">
                {patientContext.symptoms.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          >
            {isExpanded ? '▲ Hide Details' : '▼ View Triage'}
          </button>
        </div>
      </div>

      {/* Summary Paragraph */}
      <p className="mt-3 text-xs sm:text-sm text-slate-700 leading-relaxed font-sans">
        {assessment.summary}
      </p>

      {/* Collapsible Clinical Findings & Action Directives */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-slate-200/80 space-y-4 animate-fade-in font-sans">
          
          {/* Active Red Flags & Clinical Findings */}
          {assessment.triggers.length > 0 && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 font-mono">
                Triggered Clinical Criteria ({assessment.triggers.length})
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {assessment.triggers.map((trigger) => (
                  <div
                    key={trigger.id}
                    className={`rounded-xl border p-3 text-xs ${
                      trigger.severity === 'CRITICAL'
                        ? 'border-rose-200 bg-white text-rose-950 shadow-xs'
                        : 'border-amber-200 bg-white text-amber-950 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1.5">
                        <span>{trigger.severity === 'CRITICAL' ? '🔴' : '🟡'}</span>
                        {trigger.title}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 border border-slate-200">
                        {trigger.category}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-700 text-[11px] leading-snug">
                      {trigger.description}
                    </p>
                    <div className="mt-1.5 pt-1.5 border-t border-slate-100 text-[10px] text-slate-500 italic">
                      <strong>Rationale:</strong> {trigger.clinicalRationale}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Directives / Field Guidance */}
          <div className={`rounded-xl border p-3.5 ${styles.actionBg}`}>
            <div className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2 font-mono">
              <span>📌</span> Immediate Action Directives &amp; Field Protocols
            </div>
            <ul className="space-y-1.5 text-xs">
              {assessment.actionDirectives.map((directive, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-sky-600 font-bold mt-0.5">›</span>
                  <span>{directive}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal / Medical Safety Guardrail */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-200/80 pt-2.5 font-mono">
            <span className="flex items-center gap-1.5">
              <span className="text-emerald-700 font-bold">🔒 Deterministic Engine:</span> Pure mathematical &amp; clinical thresholds. Not generative AI.
            </span>
            <span className="text-slate-500">
              Evaluated: {new Date(assessment.timestamp).toLocaleTimeString()}
            </span>
          </div>

        </div>
      )}
    </div>
  );
};
