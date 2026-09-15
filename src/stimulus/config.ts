/**
 * OptoPupil - Display Light Stimulus & Screening Baseline Configuration
 * Centralized constants for the controlled visual stimulus and pupil baseline stability.
 */

/**
 * Default stimulus duration in milliseconds.
 * Initial prototype baseline: 500 ms full-screen white stimulus.
 */
export const STIMULUS_DURATION_MS = 500;

/**
 * Required continuous stable bilateral pupil detection duration before triggering stimulus (legacy fallback).
 */
export const STABLE_DETECTION_MS = 1000;

/**
 * Rolling window size of valid bilateral measurements required to assess baseline stability.
 * Default: 6 consecutive valid bilateral frames.
 */
export const STABILITY_WINDOW_SIZE = 6;

/**
 * Maximum allowable diameter fluctuation range (max - min) in pixels across the rolling window.
 * Default: 0.5 px (±0.25 to ±0.5 px tolerance).
 */
export const STABILITY_TOLERANCE_PX = 0.5;
