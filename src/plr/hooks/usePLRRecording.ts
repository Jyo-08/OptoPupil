/**
 * OptoPupil - usePLRRecording Hook
 * Orchestrates the automated screening protocol:
 * Baseline (~1.5s) -> Flash Stimulus (~200ms) -> Constriction/Recovery (~3.5s) -> Signal Processing -> Metrics.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { VisionFrameOutput } from '../../types/vision';
import type { StimulusController, StimulusTiming } from '../../stimulus/types';
import type { RecordingPhase, BilateralPLRReport, PLRSample } from '../types';
import { TimeSeriesRecorder } from '../recording/TimeSeriesRecorder';
import { SignalProcessor } from '../signal/SignalProcessor';
import { PLRFeatureExtractor } from '../analytics/PLRFeatureExtractor';
import { finalMeasurementRepository } from '../../db';

interface UsePLRRecordingProps {
  stimulus: StimulusController;
  onFrameCapture?: (sample: PLRSample) => void;
}

export interface PLRRecordingState {
  phase: RecordingPhase;
  progressPercent: number;
  report: BilateralPLRReport | null;
  statusMessage: string;
  isRecording: boolean;
  canStart: boolean;
  startScreening: () => void;
  cancelScreening: () => void;
  resetScreening: () => void;
  handleFrame: (frame: VisionFrameOutput) => void;
}

const BASELINE_DURATION_MS = 1500;
const STIMULUS_DURATION_MS = 200;
const RECOVERY_DURATION_MS = 3500;
const TOTAL_SCREENING_DURATION_MS = BASELINE_DURATION_MS + STIMULUS_DURATION_MS + RECOVERY_DURATION_MS;

export function usePLRRecording({ stimulus, onFrameCapture }: UsePLRRecordingProps): PLRRecordingState {
  const [phase, setPhase] = useState<RecordingPhase>('IDLE');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [report, setReport] = useState<BilateralPLRReport | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Ready to initiate quantitative PLR screening.');

  const recorderRef = useRef<TimeSeriesRecorder>(new TimeSeriesRecorder());
  const phaseTimerRef = useRef<number | null>(null);
  const progressAnimRef = useRef<number | null>(null);
  const sessionStartTimeRef = useRef<number>(0);
  const stimulusOnsetTimeRef = useRef<number>(0);
  const baselineLeftPxRef = useRef<number>(0);
  const baselineRightPxRef = useRef<number>(0);

  // Clear all pending timeouts / animations
  const clearTimers = useCallback(() => {
    if (phaseTimerRef.current !== null) {
      window.clearTimeout(phaseTimerRef.current);
      phaseTimerRef.current = null;
    }
    if (progressAnimRef.current !== null) {
      window.cancelAnimationFrame(progressAnimRef.current);
      progressAnimRef.current = null;
    }
  }, []);

  // Update animated progress bar
  const updateProgress = useCallback(() => {
    if (sessionStartTimeRef.current > 0) {
      const elapsed = performance.now() - sessionStartTimeRef.current;
      const pct = Math.min(100, Math.round((elapsed / TOTAL_SCREENING_DURATION_MS) * 100));
      setProgressPercent(pct);
    }
    progressAnimRef.current = window.requestAnimationFrame(updateProgress);
  }, []);

  // Reset screening state
  const resetScreening = useCallback(() => {
    clearTimers();
    stimulus.stopStimulus();
    recorderRef.current.reset();
    sessionStartTimeRef.current = 0;
    stimulusOnsetTimeRef.current = 0;
    setPhase('IDLE');
    setProgressPercent(0);
    setReport(null);
    setStatusMessage('Ready to initiate quantitative PLR screening.');
  }, [clearTimers, stimulus]);

  // Cancel in-progress screening
  const cancelScreening = useCallback(() => {
    clearTimers();
    stimulus.stopStimulus();
    recorderRef.current.reset();
    sessionStartTimeRef.current = 0;
    stimulusOnsetTimeRef.current = 0;
    setPhase('IDLE');
    setProgressPercent(0);
    setStatusMessage('Screening cancelled by user.');
  }, [clearTimers, stimulus]);

  // Execute signal processing and feature extraction
  const finalizeScreening = useCallback(
    async (samples: PLRSample[], stimulusTiming: StimulusTiming) => {
      setPhase('PROCESSING');
      setStatusMessage('Applying Savitzky-Golay signal filtering & extracting PLR kinetics...');

      try {
        // 1. Process Signal (Blink repair, Savitzky-Golay smoothing, velocity differentiation)
        const processedSeries = SignalProcessor.processSession(samples, stimulusTiming);

        // 2. Extract Quantitative PLR Features (Latency, MCV, Amplitude, Asymmetry)
        const finalReport = PLRFeatureExtractor.extractReport(
          processedSeries,
          baselineLeftPxRef.current || undefined,
          baselineRightPxRef.current || undefined
        );

        // 3. Persist to local database (IndexedDB)
        if (finalReport.isReliable) {
          try {
            await finalMeasurementRepository.saveFinalMeasurement({
              session_id: finalReport.sessionId,
              timestamp: new Date().toISOString(),
              baseline_left_px: finalReport.leftEye.baselineDiameterPx,
              baseline_right_px: finalReport.rightEye.baselineDiameterPx,
              left_min_px: finalReport.leftEye.minDiameterPx,
              right_min_px: finalReport.rightEye.minDiameterPx,
              left_delta_px: finalReport.leftEye.constrictionAmplitudeMm * 20,
              right_delta_px: finalReport.rightEye.constrictionAmplitudeMm * 20,
              stimulus_duration_ms: stimulusTiming.actualDurationMs,
              status: 'COMPLETED',
            });
          } catch {
            // DB persistence is auxiliary
          }
        }

        setReport(finalReport);
        setPhase('COMPLETE');
        setProgressPercent(100);
        setStatusMessage('PLR screening & kinetic feature extraction complete.');
      } catch (err) {
        console.error('Error during PLR processing:', err);
        setPhase('FAILED_INCONCLUSIVE');
        setStatusMessage('Screening error during signal processing. Please retry.');
      }
    },
    []
  );

  // Start the automated protocol sequence
  const startScreening = useCallback(() => {
    resetScreening();

    // Begin Recording
    recorderRef.current.start();
    const sessionStart = performance.now();
    sessionStartTimeRef.current = sessionStart;

    setPhase('BASELINE');
    setStatusMessage('1/3: Recording pre-stimulus baseline pupil diameter...');
    progressAnimRef.current = window.requestAnimationFrame(updateProgress);

    // Stage 1: Pre-stimulus Baseline Duration
    phaseTimerRef.current = window.setTimeout(() => {
      // Stage 2: Trigger Stimulus Flash
      setPhase('STIMULUS');
      setStatusMessage('2/3: Light stimulus active! Keep eyes centered...');

      const stimOnset = performance.now();
      stimulusOnsetTimeRef.current = stimOnset;
      stimulus.startStimulus(STIMULUS_DURATION_MS);

      // Stage 3: Constriction & Recovery Post-Stimulus
      phaseTimerRef.current = window.setTimeout(() => {
        setPhase('CONSTRICTION_RECOVERY');
        setStatusMessage('3/3: Recording constriction kinetics & recovery response...');

        // Stage 4: Finish Recording and Run Analytics
        phaseTimerRef.current = window.setTimeout(() => {
          clearTimers();
          const samples = recorderRef.current.stop();
          const stimOffset = stimOnset + STIMULUS_DURATION_MS;

          const timing: StimulusTiming = {
            stimulusOnsetTime: stimOnset,
            stimulusOffsetTime: stimOffset,
            configuredDurationMs: STIMULUS_DURATION_MS,
            actualDurationMs: STIMULUS_DURATION_MS,
          };

          finalizeScreening(samples, timing);
        }, RECOVERY_DURATION_MS);
      }, STIMULUS_DURATION_MS);
    }, BASELINE_DURATION_MS);
  }, [resetScreening, updateProgress, stimulus, clearTimers, finalizeScreening]);

  // Feed frame data from useVisionPipeline
  const handleFrame = useCallback(
    (frame: VisionFrameOutput) => {
      if (recorderRef.current.isActive()) {
        const sample = recorderRef.current.recordFrame(
          frame,
          stimulus.isStimulusActive,
          stimulusOnsetTimeRef.current || undefined
        );

        if (sample) {
          // Track baseline diameter reference
          if (phase === 'BASELINE') {
            if (sample.leftDiameterPx) baselineLeftPxRef.current = sample.leftDiameterPx;
            if (sample.rightDiameterPx) baselineRightPxRef.current = sample.rightDiameterPx;
          }
          onFrameCapture?.(sample);
        }
      }
    },
    [stimulus.isStimulusActive, phase, onFrameCapture]
  );

  // Clean up on unmount
  useEffect(() => {
    return () => {
      clearTimers();
      recorderRef.current.reset();
    };
  }, [clearTimers]);

  const isRecording =
    phase === 'BASELINE' || phase === 'STIMULUS' || phase === 'CONSTRICTION_RECOVERY' || phase === 'PROCESSING';

  return {
    phase,
    progressPercent,
    report,
    statusMessage,
    isRecording,
    canStart: phase === 'IDLE' || phase === 'COMPLETE' || phase === 'FAILED_INCONCLUSIVE',
    startScreening,
    cancelScreening,
    resetScreening,
    handleFrame,
  };
}
