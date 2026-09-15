/**
 * OptoPupil - Display Light Stimulus Types
 * Standalone timing and state definitions for the controlled display light stimulus.
 */

export interface StimulusTiming {
  /** High-precision onset timestamp from performance.now() */
  stimulusOnsetTime: number;
  /** High-precision offset timestamp from performance.now() */
  stimulusOffsetTime: number;
  /** Configured target duration in milliseconds */
  configuredDurationMs: number;
  /** Actual measured duration in milliseconds (offset - onset) */
  actualDurationMs: number;
}

export interface StimulusController {
  /** Whether the bright display stimulus is currently active */
  isStimulusActive: boolean;
  /** Starts the light stimulus for the configured or specified duration with optional completion callback */
  startStimulus: (durationMs?: number, onComplete?: (timing: StimulusTiming) => void) => void;
  /** Immediately stops the active light stimulus */
  stopStimulus: () => void;
  /** Last recorded stimulus timing event */
  lastTiming: StimulusTiming | null;
  /** Centralized default duration in milliseconds */
  defaultDurationMs: number;
}
