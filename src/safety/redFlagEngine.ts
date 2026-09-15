/**
 * OptoPupil - Deterministic Red-Flag Safety & Clinical Triage Engine
 * 
 * Medical Rule Enforcement Engine:
 * Implements CDC Acute TBI, SCAT5, and neurocritical pupillometry triage rules.
 * 
 * PRINCIPLE:
 * Deterministic medical logic takes absolute precedence. No generative AI or heuristic
 * model is ever allowed to downgrade or suppress a deterministic red-flag alert.
 */

import type { BilateralPLRReport } from '../plr/types';
import type { PatientContext, TriageAssessment, RedFlagTrigger, TriageUrgency } from './types';
import { SYMPTOM_DEFINITIONS } from './types';

export class RedFlagEngine {
  /**
   * Evaluates complete bilateral PLR telemetry alongside patient trauma context.
   * Produces an immutable, auditable clinical triage assessment.
   */
  public static evaluate(
    report: BilateralPLRReport | null,
    patientContext: PatientContext
  ): TriageAssessment {
    const triggers: RedFlagTrigger[] = [];
    const actionDirectives: string[] = [];

    // --- STEP 1: Evaluate Patient Symptoms & Clinical Red Flags ---
    const activeSymptoms = new Set(patientContext.symptoms || []);
    
    // Check for Critical Symptom Red Flags
    for (const symDef of SYMPTOM_DEFINITIONS) {
      if (activeSymptoms.has(symDef.id) && symDef.isRedFlag) {
        triggers.push({
          id: `SYM_${symDef.id}`,
          title: `Red Flag Symptom: ${symDef.label}`,
          category: 'SYMPTOM',
          severity: 'CRITICAL',
          description: symDef.description,
          clinicalRationale: 'Associated with elevated intracranial pressure, acute structural lesion, or severe neurological trauma.',
        });
      }
    }

    // Cervical spine precaution trigger
    if (activeSymptoms.has('NECK_PAIN_SPINAL_TENDERNESS')) {
      actionDirectives.push('CRITICAL: Maintain rigid in-line cervical spine immobilization. Do NOT move the patient without spinal precautions.');
    }

    // --- STEP 2: Evaluate Pupillometric Metrics (If Report Available) ---
    let pupillometrySummary: TriageAssessment['pupillometrySummary'] = null;

    if (report) {
      const { leftEye, rightEye, bilateralAsymmetry } = report;
      pupillometrySummary = {
        leftPattern: leftEye.responsePattern,
        rightPattern: rightEye.responsePattern,
        anisocoriaMm: Number(bilateralAsymmetry.baselineAnisocoriaMm.toFixed(2)),
        maxConstrictionVelocityLeft: Number(leftEye.mcvMmS.toFixed(2)),
        maxConstrictionVelocityRight: Number(rightEye.mcvMmS.toFixed(2)),
        latencyLeftMs: Math.round(leftEye.latencyMs),
        latencyRightMs: Math.round(rightEye.latencyMs),
      };

      // Check for Inconclusive / Low Quality
      if (!report.isReliable || leftEye.qualityScore < 40 || rightEye.qualityScore < 40) {
        triggers.push({
          id: 'PLR_LOW_QUALITY',
          title: 'Degraded Signal / Low Tracking Quality',
          category: 'PUPILLOMETRY',
          severity: 'WARNING',
          description: `Tracking reliability score (L: ${Math.round(leftEye.qualityScore)}%, R: ${Math.round(rightEye.qualityScore)}%) is below acceptable clinical threshold.`,
          clinicalRationale: 'Signal artifacts, excessive blinking, or head movement may invalidate automated latency and amplitude extraction.',
        });
      }

      // 1. Severe Anisocoria (>= 1.0mm)
      if (bilateralAsymmetry.baselineAnisocoriaMm >= 1.0) {
        triggers.push({
          id: 'PLR_SEVERE_ANISOCORIA',
          title: `Severe Baseline Anisocoria (Δ ${bilateralAsymmetry.baselineAnisocoriaMm.toFixed(2)} mm)`,
          category: 'PUPILLOMETRY',
          severity: 'CRITICAL',
          description: `Inter-eye baseline diameter difference of ${bilateralAsymmetry.baselineAnisocoriaMm.toFixed(2)} mm exceeds the 1.0 mm acute emergency threshold.`,
          clinicalRationale: 'Marked anisocoria in the context of acute trauma indicates potential oculomotor nerve (CN III) compression or impending uncal herniation.',
        });
      }
      // 2. Mild-to-Moderate Anisocoria (0.4mm - 0.99mm)
      else if (bilateralAsymmetry.baselineAnisocoriaMm >= 0.4 && !patientContext.hasKnownPreExistingAnisocoria) {
        triggers.push({
          id: 'PLR_MODERATE_ANISOCORIA',
          title: `Physiological/Moderate Anisocoria (Δ ${bilateralAsymmetry.baselineAnisocoriaMm.toFixed(2)} mm)`,
          category: 'PUPILLOMETRY',
          severity: 'WARNING',
          description: `Baseline pupil asymmetry of ${bilateralAsymmetry.baselineAnisocoriaMm.toFixed(2)} mm is clinically noteworthy.`,
          clinicalRationale: 'May indicate mild autonomic asymmetry, early cranial nerve irritation, or physiological variation.',
        });
      }

      // 3. Bilateral Non-Reactive / Fixed Pupils
      const leftFixed = leftEye.responsePattern === 'NON_REACTIVE_FIXED' || leftEye.constrictionPercentage < 5.0;
      const rightFixed = rightEye.responsePattern === 'NON_REACTIVE_FIXED' || rightEye.constrictionPercentage < 5.0;

      if (leftFixed && rightFixed) {
        triggers.push({
          id: 'PLR_BILATERAL_FIXED',
          title: 'Bilateral Fixed / Non-Reactive Pupils',
          category: 'PUPILLOMETRY',
          severity: 'CRITICAL',
          description: `Both left (${leftEye.constrictionPercentage.toFixed(1)}%) and right (${rightEye.constrictionPercentage.toFixed(1)}%) pupils demonstrate negligible constriction to light stimulus.`,
          clinicalRationale: 'Severe bilateral midbrain or brainstem dysfunction, extensive bilateral oculomotor pathway compromise, or severe global cerebral ischemia.',
        });
      }
      // 4. Unilateral Fixed Dilated Pupil (Asymmetric Fixed)
      else if (leftFixed || rightFixed) {
        const fixedEye = leftFixed ? 'Left' : 'Right';
        const activeEye = leftFixed ? 'Right' : 'Left';
        triggers.push({
          id: 'PLR_UNILATERAL_FIXED',
          title: `Unilateral Fixed Non-Reactive Pupil (${fixedEye} Eye)`,
          category: 'PUPILLOMETRY',
          severity: 'CRITICAL',
          description: `${fixedEye} pupil is non-reactive (<5% constriction) while ${activeEye} eye retains reactivity.`,
          clinicalRationale: 'Classic sign of ipsilateral uncal herniation, third nerve palsy, or acute traumatic mydriasis.',
        });
      }

      // 5. Sluggish Bilateral Response
      const leftSluggish = leftEye.responsePattern === 'SLUGGISH_REDUCED' || (leftEye.mcvMmS < 1.5 && leftEye.mcvMmS > 0);
      const rightSluggish = rightEye.responsePattern === 'SLUGGISH_REDUCED' || (rightEye.mcvMmS < 1.5 && rightEye.mcvMmS > 0);

      if ((leftSluggish || rightSluggish) && !leftFixed && !rightFixed) {
        triggers.push({
          id: 'PLR_SLUGGISH_RESPONSE',
          title: 'Sluggish Pupillary Constriction Dynamics',
          category: 'PUPILLOMETRY',
          severity: 'WARNING',
          description: `Constriction velocity (L: ${leftEye.mcvMmS.toFixed(2)} mm/s, R: ${rightEye.mcvMmS.toFixed(2)} mm/s) or amplitude is significantly reduced.`,
          clinicalRationale: 'Reduced velocity and amplitude are sensitive markers of mild traumatic brain injury (mTBI), elevated intracranial pressure, or drug effects.',
        });
      }

      // 6. Significant Constriction Latency Delay (> 320ms)
      if (leftEye.latencyMs > 320 || rightEye.latencyMs > 320) {
        triggers.push({
          id: 'PLR_DELAYED_LATENCY',
          title: `Delayed Pupillary Latency (L: ${Math.round(leftEye.latencyMs)} ms, R: ${Math.round(rightEye.latencyMs)} ms)`,
          category: 'PUPILLOMETRY',
          severity: 'WARNING',
          description: 'Reflex latency exceeds standard clinical threshold (normal range: 200–300 ms).',
          clinicalRationale: 'Afferent pupillary defect (optic nerve dysfunction) or efferent parasympathetic conduction delay.',
        });
      }

      // 7. Significant Dynamic Asymmetry (Velocity or Latency)
      if (bilateralAsymmetry.isSignificantAsymmetry && bilateralAsymmetry.asymmetrySeverity === 'MARKED_ASYMMETRY') {
        triggers.push({
          id: 'PLR_MARKED_ASYMMETRY',
          title: 'Marked Dynamic Bilateral Asymmetry',
          category: 'PUPILLOMETRY',
          severity: 'WARNING',
          description: `Latency difference is ${Math.round(bilateralAsymmetry.latencyDifferenceMs)} ms; MCV difference is ${bilateralAsymmetry.mcvDifferenceMmS.toFixed(2)} mm/s.`,
          clinicalRationale: 'Disproportionate kinetic response between eyes warrants closer neurological and ophthalmological investigation.',
        });
      }
    }

    // --- STEP 3: Synthesize Triage Urgency Level & Directives ---
    const criticalTriggers = triggers.filter(t => t.severity === 'CRITICAL');
    const warningTriggers = triggers.filter(t => t.severity === 'WARNING');
    const isQualityDegraded = triggers.some(t => t.id === 'PLR_LOW_QUALITY');

    let urgency: TriageUrgency = 'NORMAL_GREEN';
    let headline = 'Normal Bilateral Pupillary Light Reflex';
    let summary = 'Pupillary dynamics (constriction amplitude, velocity, latency, and symmetry) fall within normal physiological limits. No acute neurological red flags detected.';
    let requiresEmergencyTransport = false;
    let requiresPlaySuspension = false;

    if (criticalTriggers.length > 0) {
      urgency = 'EMERGENCY_RED';
      headline = '🔴 ACUTE NEUROLOGICAL RED FLAG — IMMEDIATE MEDICAL ATTENTION';
      summary = `Urgent clinical alerts triggered (${criticalTriggers.length} critical finding${criticalTriggers.length > 1 ? 's' : ''}). High risk of acute traumatic brain injury or elevated intracranial pressure.`;
      requiresEmergencyTransport = true;
      requiresPlaySuspension = true;

      actionDirectives.push('1. Call Emergency Medical Services (EMS / 911) or initiate immediate transport to an emergency department with neurosurgical capabilities.');
      actionDirectives.push('2. Do NOT permit the patient to return to physical activity, sports, or driving.');
      actionDirectives.push('3. Keep patient calm, elevate head 30 degrees if no spinal trauma is suspected, and avoid sudden movements.');
      actionDirectives.push('4. Perform continuous Glasgow Coma Scale (GCS) and vital signs monitoring every 5 minutes.');
    } else if (warningTriggers.length > 0 && !isQualityDegraded) {
      urgency = 'OBSERVE_AMBER';
      headline = '🟡 SLUGGISH / ASYMMETRIC DYNAMICS — CLINICAL OBSERVATION REQUIRED';
      summary = `Sluggish constriction velocity, latency prolongation, or moderate symptom markers observed (${warningTriggers.length} warning findings). Concussion / mTBI protocol recommended.`;
      requiresEmergencyTransport = false;
      requiresPlaySuspension = true;

      actionDirectives.push('1. Remove athlete/patient from play or strenuous activity immediately (No Same-Day Return to Play).');
      actionDirectives.push('2. Conduct a comprehensive SCAT5 / neurological clinical exam.');
      actionDirectives.push('3. Re-screen pupil kinetics in 15–30 minutes to detect progressive deterioration or delayed onset anisocoria.');
      actionDirectives.push('4. Advise patient and caregivers on 24-hour red-flag signs (vomiting, worsening headache, confusion).');
    } else if (isQualityDegraded) {
      urgency = 'INCONCLUSIVE_GRAY';
      headline = '⚪ INCONCLUSIVE SCREENING — RECALIBRATION & RETEST RECOMMENDED';
      summary = 'Video tracking quality was suboptimal due to excessive head motion, blinking, or extreme lighting conditions. Numerical metrics may be incomplete.';
      requiresEmergencyTransport = false;
      requiresPlaySuspension = false;

      actionDirectives.push('1. Instruct patient to keep eyes wide open and look steadily at the screen crosshairs.');
      actionDirectives.push('2. Adjust ambient lighting to avoid direct glare and ensure face is evenly illuminated.');
      actionDirectives.push('3. Re-run the automated 5.2s screening protocol.');
    } else {
      // Normal Green
      actionDirectives.push('1. Bilateral pupillary kinetics within standard physiological baseline.');
      actionDirectives.push('2. Continue routine clinical monitoring if patient experienced a significant impact.');
      actionDirectives.push('3. Note: OptoPupil is a screening decision-support aid, not a definitive diagnostic device. Clinical evaluation takes precedence.');
    }

    return {
      urgency,
      headline,
      summary,
      triggers,
      actionDirectives,
      requiresEmergencyTransport,
      requiresPlaySuspension,
      timestamp: new Date().toISOString(),
      evaluatedAtMs: typeof performance !== 'undefined' ? performance.now() : Date.now(),
      deterministicOverride: true,
      pupillometrySummary,
    };
  }
}
