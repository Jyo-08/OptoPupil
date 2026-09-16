/**
 * OptoPupil - Patient Injury Context & Clinical Symptom Modal
 * 
 * Allows clinicians, athletic trainers, and emergency responders to document:
 * - Patient Identifier & Age
 * - Injury Mechanism (Sports Collision, Fall, MVA, Blast, etc.)
 * - Time Elapsed Since Impact
 * - SCAT5 / CDC Neurological Red-Flag Symptom Checklist
 * - Ophthalmic modifiers (Mydriatics, known baseline anisocoria)
 */

import React, { useState } from 'react';
import type { PatientContext, InjuryMechanism, TimeSinceInjury, SymptomId } from '../../safety/types';
import { SYMPTOM_DEFINITIONS } from '../../safety/types';

interface PatientContextModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: PatientContext;
  onSave: (updatedContext: PatientContext) => void;
}

const MECHANISM_OPTIONS: { value: InjuryMechanism; label: string; icon: string }[] = [
  { value: 'ROUTINE_BASELINE_SCREEN', label: 'Routine / Pre-Season Baseline', icon: '📊' },
  { value: 'SPORTS_COLLISION', label: 'Sports Impact / Concussion', icon: '🏈' },
  { value: 'FALL_ELEVATION', label: 'Fall / Ground Impact', icon: '🪜' },
  { value: 'MOTOR_VEHICLE_ACCIDENT', label: 'Motor Vehicle Collision', icon: '🚗' },
  { value: 'BLAST_PRESSURE_WAVE', label: 'Blast / Overpressure Event', icon: '💥' },
  { value: 'BLUNT_ASSAULT', label: 'Direct Head Trauma / Assault', icon: '🛡️' },
  { value: 'OTHER_UNKNOWN', label: 'Other / Unobserved Trauma', icon: '❓' },
];

const TIME_OPTIONS: { value: TimeSinceInjury; label: string }[] = [
  { value: 'NOT_APPLICABLE', label: 'N/A (Routine Baseline)' },
  { value: 'LESS_THAN_30_MIN', label: '< 30 Minutes (Acute)' },
  { value: 'THIRTY_TO_120_MIN', label: '30 – 120 Minutes' },
  { value: 'TWO_TO_SIX_HOURS', label: '2 – 6 Hours' },
  { value: 'SIX_TO_24_HOURS', label: '6 – 24 Hours' },
  { value: 'GREATER_THAN_24_HOURS', label: '> 24 Hours' },
];

export const PatientContextModal: React.FC<PatientContextModalProps> = ({
  isOpen,
  onClose,
  context,
  onSave,
}) => {
  const [formData, setFormData] = useState<PatientContext>({ ...context });

  if (!isOpen) return null;

  const toggleSymptom = (symId: SymptomId) => {
    const current = new Set(formData.symptoms || []);
    if (current.has(symId)) {
      current.delete(symId);
    } else {
      current.add(symId);
    }
    setFormData({ ...formData, symptoms: Array.from(current) });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const criticalSymptoms = SYMPTOM_DEFINITIONS.filter(s => s.category === 'CRITICAL_RED_FLAG');
  const generalSymptoms = SYMPTOM_DEFINITIONS.filter(s => s.category !== 'CRITICAL_RED_FLAG');
  const activeRedFlagCount = (formData.symptoms || []).filter(id =>
    SYMPTOM_DEFINITIONS.find(s => s.id === id)?.isRedFlag
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl text-slate-900 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 border border-sky-200 text-sky-600 font-bold">
              📋
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-wide text-slate-900">
                Patient Trauma Context &amp; Symptom Matrix
              </h2>
              <p className="text-xs text-slate-500">
                SCAT5 &amp; CDC Grounded Clinical Concussion Screening
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto py-4 space-y-6 pr-2 custom-scrollbar">
          
          {/* Section 1: Patient Details & Timing */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-sky-800 mb-1">
                Patient / Athlete ID
              </label>
              <input
                type="text"
                value={formData.patientId}
                onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                placeholder="e.g. PT-2026-001 or Athlete Name"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-sky-800 mb-1">
                Age (Years)
              </label>
              <input
                type="number"
                min={1}
                max={120}
                value={formData.ageYears || ''}
                onChange={(e) => setFormData({ ...formData, ageYears: Number(e.target.value) || undefined })}
                placeholder="e.g. 24"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Section 2: Mechanism of Injury & Time Elapsed */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Mechanism of Injury
              </label>
              <select
                value={formData.mechanism}
                onChange={(e) => setFormData({ ...formData, mechanism: e.target.value as InjuryMechanism })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none"
              >
                {MECHANISM_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.icon} {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Time Since Event
              </label>
              <select
                value={formData.timeElapsed}
                onChange={(e) => setFormData({ ...formData, timeElapsed: e.target.value as TimeSinceInjury })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none"
              >
                {TIME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    ⏱️ {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 3: Critical Red-Flag Symptoms (Urgent) */}
          <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-rose-600 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-rose-800">
                  Critical Neurological Red Flags (CDC / SCAT5)
                </span>
              </div>
              {activeRedFlagCount > 0 && (
                <span className="rounded-full bg-rose-100 border border-rose-300 px-2 py-0.5 text-xs font-bold text-rose-800">
                  {activeRedFlagCount} Active Red Flag{activeRedFlagCount > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {criticalSymptoms.map((sym) => {
                const isSelected = (formData.symptoms || []).includes(sym.id);
                return (
                  <button
                    type="button"
                    key={sym.id}
                    onClick={() => toggleSymptom(sym.id)}
                    className={`flex items-start text-left p-2.5 rounded-lg border transition-all text-xs ${
                      isSelected
                        ? 'border-rose-400 bg-rose-100 text-rose-950 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span className={`mr-2 font-bold ${isSelected ? 'text-rose-700' : 'text-slate-400'}`}>
                      {isSelected ? '☒' : '☐'}
                    </span>
                    <div>
                      <div className="font-semibold text-slate-900">{sym.label}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 leading-tight">{sym.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 4: General Concussion & Visual Symptoms */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
              Concussion &amp; Sensory Symptoms
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {generalSymptoms.map((sym) => {
                const isSelected = (formData.symptoms || []).includes(sym.id);
                return (
                  <button
                    type="button"
                    key={sym.id}
                    onClick={() => toggleSymptom(sym.id)}
                    className={`flex items-start text-left p-2.5 rounded-lg border transition-all text-xs ${
                      isSelected
                        ? 'border-amber-400 bg-amber-50 text-amber-950 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span className={`mr-2 font-bold ${isSelected ? 'text-amber-700' : 'text-slate-400'}`}>
                      {isSelected ? '☒' : '☐'}
                    </span>
                    <div>
                      <div className="font-semibold text-slate-800">{sym.label}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 leading-tight">{sym.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 5: Physiological Modifiers */}
          <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-200 text-xs text-slate-700">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!formData.hasMydriaticOrOphthalmicDrops}
                onChange={(e) => setFormData({ ...formData, hasMydriaticOrOphthalmicDrops: e.target.checked })}
                className="rounded border-slate-300 bg-white text-sky-600 focus:ring-sky-500"
              />
              <span>Recent Dilating / Constricting Eye Drops</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!formData.hasKnownPreExistingAnisocoria}
                onChange={(e) => setFormData({ ...formData, hasKnownPreExistingAnisocoria: e.target.checked })}
                className="rounded border-slate-300 bg-white text-sky-600 focus:ring-sky-500"
              />
              <span>Known Pre-existing Baseline Anisocoria</span>
            </label>
          </div>

        </form>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-200 pt-4 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-xl bg-sky-600 px-6 py-2 text-xs font-bold text-white hover:bg-sky-700 shadow-xs transition-all"
          >
            Apply Context &amp; Run Triage Engine
          </button>
        </div>

      </div>
    </div>
  );
};
