/**
 * OptoPupil - Deterministic Red-Flag Safety & Clinical Triage Types
 * 
 * Defines standard data contracts for patient injury context, clinical symptoms,
 * deterministic red-flag rules, and triage urgency levels.
 */

/**
 * Standardized neurological and concussion symptom identifiers.
 */
export type SymptomId =
  | 'LOSS_OF_CONSCIOUSNESS'
  | 'REPEATED_VOMITING'
  | 'SEVERE_WORSENING_HEADACHE'
  | 'SEIZURE_CONVULSION'
  | 'CONFUSION_AMNESIA'
  | 'FOCAL_NEURO_DEFICIT'
  | 'NECK_PAIN_SPINAL_TENDERNESS'
  | 'DIZZINESS_VERTIGO'
  | 'PHOTOPHOBIA_SENSITIVITY'
  | 'UNEQUAL_PUPIL_SENSATION';

export interface SymptomDefinition {
  id: SymptomId;
  label: string;
  category: 'CRITICAL_RED_FLAG' | 'MODERATE_NEURO' | 'GENERAL_CONCUSSION';
  description: string;
  isRedFlag: boolean;
}

export const SYMPTOM_DEFINITIONS: SymptomDefinition[] = [
  {
    id: 'LOSS_OF_CONSCIOUSNESS',
    label: 'Loss of Consciousness (LOC)',
    category: 'CRITICAL_RED_FLAG',
    description: 'Witnessed or reported transient or prolonged unconsciousness following impact.',
    isRedFlag: true,
  },
  {
    id: 'REPEATED_VOMITING',
    label: 'Repeated Vomiting (≥ 2 episodes)',
    category: 'CRITICAL_RED_FLAG',
    description: 'Two or more vomiting episodes, indicating elevated intracranial pressure (ICP).',
    isRedFlag: true,
  },
  {
    id: 'SEVERE_WORSENING_HEADACHE',
    label: 'Progressively Worsening Headache',
    category: 'CRITICAL_RED_FLAG',
    description: 'Severe, escalating headache unresponsive to mild analgesics.',
    isRedFlag: true,
  },
  {
    id: 'SEIZURE_CONVULSION',
    label: 'Seizure or Post-Impact Convulsion',
    category: 'CRITICAL_RED_FLAG',
    description: 'Any tonic-clonic posturing, twitching, or witnessed seizure activity.',
    isRedFlag: true,
  },
  {
    id: 'FOCAL_NEURO_DEFICIT',
    label: 'Focal Neurological Deficit / Weakness',
    category: 'CRITICAL_RED_FLAG',
    description: 'Unilateral limb weakness, facial droop, numbness, or slurred speech.',
    isRedFlag: true,
  },
  {
    id: 'NECK_PAIN_SPINAL_TENDERNESS',
    label: 'Cervical Spine Pain / Midline Tenderness',
    category: 'CRITICAL_RED_FLAG',
    description: 'Pain along the cervical spine, tingling in extremities, or numbness.',
    isRedFlag: true,
  },
  {
    id: 'CONFUSION_AMNESIA',
    label: 'Disorientation / Post-Traumatic Amnesia',
    category: 'MODERATE_NEURO',
    description: 'Inability to recall events immediately before/after injury, repetitive questioning.',
    isRedFlag: false,
  },
  {
    id: 'DIZZINESS_VERTIGO',
    label: 'Dizziness or Balance Imbalance',
    category: 'GENERAL_CONCUSSION',
    description: 'Loss of balance, feeling lightheaded or unsteady on feet.',
    isRedFlag: false,
  },
  {
    id: 'PHOTOPHOBIA_SENSITIVITY',
    label: 'Photophobia / Light Sensitivity',
    category: 'GENERAL_CONCUSSION',
    description: 'Pain or discomfort in bright lighting, blurred vision.',
    isRedFlag: false,
  },
  {
    id: 'UNEQUAL_PUPIL_SENSATION',
    label: 'Visual Distortion / Unequal Pupil Blur',
    category: 'MODERATE_NEURO',
    description: 'Subjective report of asymmetric vision or blurry field in one eye.',
    isRedFlag: false,
  },
];

/**
 * Trauma / injury mechanism categories.
 */
export type InjuryMechanism =
  | 'SPORTS_COLLISION'
  | 'FALL_ELEVATION'
  | 'MOTOR_VEHICLE_ACCIDENT'
  | 'BLAST_PRESSURE_WAVE'
  | 'BLUNT_ASSAULT'
  | 'ROUTINE_BASELINE_SCREEN'
  | 'OTHER_UNKNOWN';

/**
 * Time elapsed since initial impact / trauma event.
 */
export type TimeSinceInjury =
  | 'LESS_THAN_30_MIN'
  | 'THIRTY_TO_120_MIN'
  | 'TWO_TO_SIX_HOURS'
  | 'SIX_TO_24_HOURS'
  | 'GREATER_THAN_24_HOURS'
  | 'NOT_APPLICABLE';

/**
 * Patient context payload submitted alongside quantitative PLR screening.
 */
export interface PatientContext {
  patientId: string;
  ageYears?: number;
  mechanism: InjuryMechanism;
  timeElapsed: TimeSinceInjury;
  symptoms: SymptomId[];
  notes?: string;
  hasMydriaticOrOphthalmicDrops?: boolean;
  hasKnownPreExistingAnisocoria?: boolean;
}

/**
 * Four-tier standardized clinical triage urgency status.
 */
export type TriageUrgency =
  | 'EMERGENCY_RED'     // Acute Neurological Red Flag -> Immediate ED / EMS transfer
  | 'OBSERVE_AMBER'     // Reduced Dynamics / Sluggish / Significant Symptoms -> Clinical Observation
  | 'NORMAL_GREEN'      // Normal Reactive Symmetric PLR & No Critical Symptoms
  | 'INCONCLUSIVE_GRAY'; // Signal degraded / low confidence -> Recalibrate & Re-test

/**
 * Triggered red-flag or observation rule item.
 */
export interface RedFlagTrigger {
  id: string;
  title: string;
  category: 'PUPILLOMETRY' | 'SYMPTOM' | 'COMBINED';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  description: string;
  clinicalRationale: string;
}

/**
 * Comprehensive, immutable clinical triage assessment produced by the deterministic engine.
 */
export interface TriageAssessment {
  urgency: TriageUrgency;
  headline: string;
  summary: string;
  triggers: RedFlagTrigger[];
  actionDirectives: string[];
  requiresEmergencyTransport: boolean;
  requiresPlaySuspension: boolean;
  timestamp: string;
  evaluatedAtMs: number;
  deterministicOverride: boolean;
  pupillometrySummary: {
    leftPattern: string;
    rightPattern: string;
    anisocoriaMm: number;
    maxConstrictionVelocityLeft: number;
    maxConstrictionVelocityRight: number;
    latencyLeftMs: number;
    latencyRightMs: number;
  } | null;
}
