/**
 * OptoPupil - Two-Database Architecture Types
 * Defines the schemas for:
 * Database 1: Raw / Live Pupil Measurements (fluctuating samples)
 * Database 2: Finalized Screening Measurements (immutable downstream records)
 */

/**
 * DATABASE 1: Raw / Live Pupil Measurement Record
 * Stores fluctuating observations sampled during live vision tracking.
 */
export interface RawPupilMeasurementRecord {
  /** Auto-incrementing primary key ID */
  id?: number;
  /** Unique screening/session identifier shared by all raw samples in this session */
  session_id: string;
  /** ISO 8601 string timestamp when sample was recorded */
  timestamp: string;
  /** Left pupil diameter in pixels */
  left_pupil_px: number;
  /** Right pupil diameter in pixels */
  right_pupil_px: number;
  /** Left eye detection status */
  left_status: string;
  /** Right eye detection status */
  right_status: string;
  /** High-resolution performance timestamp in milliseconds */
  perf_timestamp_ms: number;
}

/**
 * DATABASE 2: Finalized Screening Measurement Record
 * Immutable official screening output for dashboard, downstream PLR pipeline, and backend.
 */
export interface FinalScreeningRecord {
  /** Auto-incrementing primary key ID */
  id?: number;
  /** Unique screening/session identifier matching raw samples */
  session_id: string;
  /** ISO 8601 timestamp when the screening was finalized */
  timestamp: string;
  /** Calculated stable baseline diameter for left eye in pixels */
  baseline_left_pupil_px: number;
  /** Calculated stable baseline diameter for right eye in pixels */
  baseline_right_pupil_px: number;
  /** Exact stimulus onset timestamp in ISO 8601 format */
  stimulus_onset_timestamp: string;
  /** High-resolution stimulus onset timestamp in milliseconds */
  stimulus_onset_ms: number;
  /** Left pupil diameter captured at stimulus onset */
  stimulus_left_pupil_px: number;
  /** Right pupil diameter captured at stimulus onset */
  stimulus_right_pupil_px: number;
  /** Configured / measured stimulus duration in milliseconds */
  stimulus_duration_ms?: number;
  /** Finalized screening status */
  status: 'FINALIZED';
}

export type RawMeasurementListener = (sample: RawPupilMeasurementRecord) => void;
export type FinalScreeningListener = (record: FinalScreeningRecord) => void;
