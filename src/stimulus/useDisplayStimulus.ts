import { useState, useRef, useCallback, useEffect } from 'react';
import { STIMULUS_DURATION_MS } from './config';
import type { StimulusController, StimulusTiming } from './types';

/**
 * useDisplayStimulus
 * Standalone React hook controller for triggering controlled browser display light stimuli.
 * 
 * Captures high-precision onset and offset timestamps via performance.now()
 * and computes the actual physical measured duration for downstream PLR systems.
 */
export function useDisplayStimulus(initialDurationMs: number = STIMULUS_DURATION_MS): StimulusController {
  const [isStimulusActive, setIsStimulusActive] = useState<boolean>(false);
  const [lastTiming, setLastTiming] = useState<StimulusTiming | null>(null);

  const isStimulusActiveRef = useRef<boolean>(false);
  const timerRef = useRef<number | null>(null);
  const onsetTimeRef = useRef<number | null>(null);
  const targetDurationRef = useRef<number>(initialDurationMs);
  const onCompleteCallbackRef = useRef<((timing: StimulusTiming) => void) | null>(null);

  // Stop active stimulus and record offset timestamp
  const stopStimulus = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (isStimulusActiveRef.current) {
      const offsetTime = performance.now();
      const onsetTime = onsetTimeRef.current ?? offsetTime;
      const configuredDuration = targetDurationRef.current;
      const actualDuration = offsetTime - onsetTime;

      isStimulusActiveRef.current = false;
      setIsStimulusActive(false);

      const timing: StimulusTiming = {
        stimulusOnsetTime: onsetTime,
        stimulusOffsetTime: offsetTime,
        configuredDurationMs: configuredDuration,
        actualDurationMs: actualDuration,
      };

      setLastTiming(timing);
      onsetTimeRef.current = null;

      const callback = onCompleteCallbackRef.current;
      onCompleteCallbackRef.current = null;
      if (callback) {
        callback(timing);
      }
    }
  }, []);

  // Start stimulus for specified or default duration
  const startStimulus = useCallback(
    (durationMs: number = STIMULUS_DURATION_MS, onComplete?: (timing: StimulusTiming) => void) => {
      // Guard: prevent multiple simultaneous triggers
      if (isStimulusActiveRef.current) {
        return;
      }

      onCompleteCallbackRef.current = onComplete || null;

      // Record high-precision onset timestamp
      const onsetTime = performance.now();
      onsetTimeRef.current = onsetTime;
      targetDurationRef.current = durationMs;
      isStimulusActiveRef.current = true;
      setIsStimulusActive(true);

      // Schedule stimulus deactivation
      timerRef.current = window.setTimeout(() => {
        stopStimulus();
      }, durationMs);
    },
    [stopStimulus]
  );

  // Clean up timers on unmount to prevent lingering background timers
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      isStimulusActiveRef.current = false;
      onCompleteCallbackRef.current = null;
    };
  }, []);

  return {
    isStimulusActive,
    startStimulus,
    stopStimulus,
    lastTiming,
    defaultDurationMs: STIMULUS_DURATION_MS,
  };
}
