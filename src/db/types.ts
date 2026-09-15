/**
 * OptoPupil - Database & Measurement Persistence Types
 * Defines the schema and contracts for persisting bilateral pupil measurements.
 */

export interface PupilMeasurementRecord {
  /** Auto-incrementing database ID (optional before insert) */
  id?: number;
  /** ISO 8601 string timestamp when the measurement transition occurred */
  timestamp: string;
  /** Left pupil diameter in pixels */
  left_pupil_px: number;
  /** Right pupil diameter in pixels */
  right_pupil_px: number;
  /** Valid bilateral detection status */
  status: 'DETECTED';
  /** Flag indicating measurement was captured at stimulus onset */
  stimulus_onset?: boolean;
  /** Optional high-resolution performance timestamp in milliseconds */
  perf_timestamp_ms?: number;
  /** Optional stimulus onset timestamp from performance.now() */
  stimulus_onset_ms?: number;
  /** Optional stimulus offset timestamp from performance.now() */
  stimulus_offset_ms?: number;
  /** Optional actual measured stimulus duration in milliseconds */
  stimulus_duration_ms?: number;
}

export type MeasurementListener = (record: PupilMeasurementRecord) => void;
