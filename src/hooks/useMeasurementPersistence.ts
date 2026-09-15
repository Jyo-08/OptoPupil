import { useState, useEffect, useRef, useCallback } from 'react';
import type { BilateralPupilData } from '../types/vision';
import { pupilDatabase } from '../db/pupilDatabase';
import type { PupilMeasurementRecord } from '../db/types';
import type { StimulusTiming } from '../stimulus/types';
import { STABLE_DETECTION_MS, STIMULUS_DURATION_MS } from '../stimulus/config';

export type ScreeningWorkflowState =
  | 'IDLE'
  | 'DETECTING'
  | 'STABLE'
  | 'STIMULUS_ACTIVE'
  | 'PERSISTED';

interface UseMeasurementPersistenceProps {
  pupilData: BilateralPupilData;
  isActive: boolean;
  startStimulus: (durationMs?: number, onComplete?: (timing: StimulusTiming) => void) => void;
}

export interface UseMeasurementPersistenceReturn {
  /** The most recently persisted measurement in the database */
  latestMeasurement: PupilMeasurementRecord | null;
  /** List of recent distinct historical measurement records (newest first) */
  recentRecords: PupilMeasurementRecord[];
  /** Total count of distinct measurement records in the database */
  totalCount: number;
  /** Whether a measurement record is currently being persisted */
  isSaving: boolean;
  /** Any error encountered during persistence */
  persistenceError: string | null;
  /** Current state of the automated screening workflow state machine */
  screeningState: ScreeningWorkflowState;
  /** Progress percentage towards stability trigger (0 to 100) */
  stabilityProgress: number;
  /** Manual refresh trigger for database records */
  refresh: () => Promise<void>;
  /** Clear all persisted records */
  clearHistory: () => Promise<void>;
}

// Minimum consecutive lost frames required to officially reset the completed screening session
const LOST_FRAMES_COOLDOWN = 10;

export function useMeasurementPersistence({
  pupilData,
  isActive,
  startStimulus,
}: UseMeasurementPersistenceProps): UseMeasurementPersistenceReturn {
  const [latestMeasurement, setLatestMeasurement] = useState<PupilMeasurementRecord | null>(null);
  const [recentRecords, setRecentRecords] = useState<PupilMeasurementRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const [screeningState, setScreeningState] = useState<ScreeningWorkflowState>('IDLE');
  const [stabilityProgress, setStabilityProgress] = useState<number>(0);

  // Workflow state refs to avoid closure staleness in rapid animation frames
  const stateRef = useRef<ScreeningWorkflowState>('IDLE');
  const detectionStartTimeRef = useRef<number | null>(null);
  const lostFramesCountRef = useRef<number>(0);
  const isWritingRef = useRef<boolean>(false);
  const stabilityTimerRef = useRef<number | null>(null);
  const pupilDataRef = useRef<BilateralPupilData>(pupilData);

  // Keep latest pupil data reference available for stimulus completion callback
  pupilDataRef.current = pupilData;

  const setWorkflowState = useCallback((nextState: ScreeningWorkflowState) => {
    stateRef.current = nextState;
    setScreeningState(nextState);
  }, []);

  // Fetch all historical database records and update state
  const refresh = useCallback(async () => {
    try {
      const [allRecords, count] = await Promise.all([
        pupilDatabase.getAllPupilMeasurements(10),
        pupilDatabase.getMeasurementCount(),
      ]);
      setRecentRecords(allRecords);
      setLatestMeasurement(allRecords.length > 0 ? allRecords[0] : null);
      setTotalCount(count);
      setPersistenceError(null);
    } catch (err: any) {
      console.error('OptoPupil DB: Failed to fetch measurements:', err);
      setPersistenceError(err?.message || 'Database read error');
    }
  }, []);

  const clearHistory = useCallback(async () => {
    try {
      await pupilDatabase.clearPupilMeasurements();
      setLatestMeasurement(null);
      setRecentRecords([]);
      setTotalCount(0);
      setPersistenceError(null);
      setWorkflowState('IDLE');
      setStabilityProgress(0);
      detectionStartTimeRef.current = null;
      lostFramesCountRef.current = 0;
    } catch (err: any) {
      console.error('OptoPupil DB: Failed to clear measurements:', err);
      setPersistenceError(err?.message || 'Database clear error');
    }
  }, [setWorkflowState]);

  // Subscribe to database change events
  useEffect(() => {
    refresh();

    const unsubscribe = pupilDatabase.subscribeToMeasurements((newRecord) => {
      setLatestMeasurement(newRecord);
      setRecentRecords((prev) => {
        const filtered = prev.filter((r) => r.id !== newRecord.id);
        return [newRecord, ...filtered].slice(0, 10);
      });
      setTotalCount((prev) => prev + 1);
    });

    return () => {
      unsubscribe();
    };
  }, [refresh]);

  // Automated Screening Event Workflow State Machine
  useEffect(() => {
    // If camera feed is stopped or inactive, reset workflow immediately
    if (!isActive) {
      if (stabilityTimerRef.current !== null) {
        window.clearTimeout(stabilityTimerRef.current);
        stabilityTimerRef.current = null;
      }
      setWorkflowState('IDLE');
      setStabilityProgress(0);
      detectionStartTimeRef.current = null;
      lostFramesCountRef.current = 0;
      return;
    }

    const left = pupilData.leftPupil;
    const right = pupilData.rightPupil;

    // Strict validation: both left & right must be DETECTED with finite positive numbers
    const isLeftValid =
      left.status === 'DETECTED' &&
      typeof left.diameterPx === 'number' &&
      Number.isFinite(left.diameterPx) &&
      left.diameterPx > 0;

    const isRightValid =
      right.status === 'DETECTED' &&
      typeof right.diameterPx === 'number' &&
      Number.isFinite(right.diameterPx) &&
      right.diameterPx > 0;

    const isCurrentlyBilateralDetected = isLeftValid && isRightValid;

    if (isCurrentlyBilateralDetected) {
      lostFramesCountRef.current = 0;

      // State 1: Transition IDLE -> DETECTING (start stability measurement)
      if (stateRef.current === 'IDLE') {
        const now = performance.now();
        detectionStartTimeRef.current = now;
        setWorkflowState('DETECTING');
        setStabilityProgress(0);

        // Schedule stimulus trigger when STABLE_DETECTION_MS is reached
        if (stabilityTimerRef.current !== null) {
          window.clearTimeout(stabilityTimerRef.current);
        }

        stabilityTimerRef.current = window.setTimeout(() => {
          // Confirm state is still detecting before launching stimulus
          if (stateRef.current === 'DETECTING') {
            setWorkflowState('STABLE');
            setStabilityProgress(100);

            // Transition STABLE -> STIMULUS_ACTIVE
            setWorkflowState('STIMULUS_ACTIVE');

            startStimulus(STIMULUS_DURATION_MS, (stimulusTiming: StimulusTiming) => {
              // On stimulus offset: CAPTURE & PERSIST measurement
              const currentLeft = pupilDataRef.current.leftPupil;
              const currentRight = pupilDataRef.current.rightPupil;

              const canCapture =
                typeof currentLeft.diameterPx === 'number' &&
                Number.isFinite(currentLeft.diameterPx) &&
                currentLeft.diameterPx > 0 &&
                typeof currentRight.diameterPx === 'number' &&
                Number.isFinite(currentRight.diameterPx) &&
                currentRight.diameterPx > 0;

              if (canCapture && !isWritingRef.current) {
                isWritingRef.current = true;
                setIsSaving(true);

                const leftPx = Number(currentLeft.diameterPx!.toFixed(2));
                const rightPx = Number(currentRight.diameterPx!.toFixed(2));
                const timestamp = new Date().toISOString();

                const record: Omit<PupilMeasurementRecord, 'id'> = {
                  timestamp,
                  left_pupil_px: leftPx,
                  right_pupil_px: rightPx,
                  status: 'DETECTED',
                  perf_timestamp_ms: performance.now(),
                  stimulus_onset_ms: stimulusTiming.stimulusOnsetTime,
                  stimulus_offset_ms: stimulusTiming.stimulusOffsetTime,
                  stimulus_duration_ms: stimulusTiming.actualDurationMs,
                };

                pupilDatabase
                  .savePupilMeasurement(record)
                  .then(() => {
                    setPersistenceError(null);
                    setWorkflowState('PERSISTED');
                  })
                  .catch((err) => {
                    console.error('OptoPupil DB: Failed to persist measurement record:', err);
                    setPersistenceError(err?.message || 'Failed to save measurement');
                    setWorkflowState('PERSISTED');
                  })
                  .finally(() => {
                    isWritingRef.current = false;
                    setIsSaving(false);
                  });
              } else {
                setWorkflowState('PERSISTED');
              }
            });
          }
        }, STABLE_DETECTION_MS);
      } else if (stateRef.current === 'DETECTING' && detectionStartTimeRef.current !== null) {
        // Update stability progress percentage
        const elapsed = performance.now() - detectionStartTimeRef.current;
        const progress = Math.min(100, Math.round((elapsed / STABLE_DETECTION_MS) * 100));
        setStabilityProgress(progress);
      }
      // If stateRef.current is 'PERSISTED' or 'STIMULUS_ACTIVE': do not re-trigger!
    } else {
      // Detection is lost or invalid
      if (stateRef.current === 'DETECTING') {
        // Lost detection before 1.0s stability completed -> cancel pending stimulus & reset
        if (stabilityTimerRef.current !== null) {
          window.clearTimeout(stabilityTimerRef.current);
          stabilityTimerRef.current = null;
        }
        detectionStartTimeRef.current = null;
        setWorkflowState('IDLE');
        setStabilityProgress(0);
      } else if (stateRef.current === 'PERSISTED') {
        // In completed screening state: debounce lost frames before resetting to IDLE for next screening
        lostFramesCountRef.current += 1;
        if (lostFramesCountRef.current >= LOST_FRAMES_COOLDOWN) {
          setWorkflowState('IDLE');
          setStabilityProgress(0);
          detectionStartTimeRef.current = null;
          lostFramesCountRef.current = 0;
        }
      }
    }
  }, [pupilData, isActive, startStimulus, setWorkflowState]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (stabilityTimerRef.current !== null) {
        window.clearTimeout(stabilityTimerRef.current);
        stabilityTimerRef.current = null;
      }
    };
  }, []);

  return {
    latestMeasurement,
    recentRecords,
    totalCount,
    isSaving,
    persistenceError,
    screeningState,
    stabilityProgress,
    refresh,
    clearHistory,
  };
}
