import { useState, useEffect, useRef, useCallback } from 'react';
import type { BilateralPupilData } from '../types/vision';
import { pupilDatabase } from '../db/pupilDatabase';
import type { PupilMeasurementRecord } from '../db/types';
import type { StimulusTiming } from '../stimulus/types';
import {
  STABILITY_WINDOW_SIZE,
  STABILITY_TOLERANCE_PX,
  STIMULUS_DURATION_MS,
} from '../stimulus/config';

export type ScreeningWorkflowState =
  | 'IDLE'
  | 'COLLECTING_BASELINE'
  | 'BASELINE_STABLE'
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
  /** Current state of the automated screening workflow */
  screeningState: ScreeningWorkflowState;
  /** Number of valid samples in the current rolling window (0 to STABILITY_WINDOW_SIZE) */
  windowSamplesCount: number;
  /** Current fluctuation delta (max - min) in pixels for left eye */
  leftDeltaPx: number;
  /** Current fluctuation delta (max - min) in pixels for right eye */
  rightDeltaPx: number;
  /** Whether current bilateral baseline satisfies the stability tolerance (<= 0.5 px) */
  isBaselineStable: boolean;
  /** Manual refresh trigger for database records */
  refresh: () => Promise<void>;
  /** Clear all persisted records */
  clearHistory: () => Promise<void>;
}

// Minimum consecutive lost frames required to officially reset the completed screening session
const LOST_FRAMES_COOLDOWN = 10;

interface PupilSample {
  left: number;
  right: number;
}

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
  const [windowSamplesCount, setWindowSamplesCount] = useState<number>(0);
  const [leftDeltaPx, setLeftDeltaPx] = useState<number>(0);
  const [rightDeltaPx, setRightDeltaPx] = useState<number>(0);
  const [isBaselineStable, setIsBaselineStable] = useState<boolean>(false);

  // In-memory rolling window of recent valid bilateral measurements
  const rollingWindowRef = useRef<PupilSample[]>([]);
  // Session lock to ensure exactly ONE stimulus trigger and ONE database record per screening event
  const hasTriggeredForSessionRef = useRef<boolean>(false);
  const lostFramesCountRef = useRef<number>(0);
  const isWritingRef = useRef<boolean>(false);

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
      hasTriggeredForSessionRef.current = false;
      rollingWindowRef.current = [];
      lostFramesCountRef.current = 0;
      setScreeningState('IDLE');
      setWindowSamplesCount(0);
      setLeftDeltaPx(0);
      setRightDeltaPx(0);
      setIsBaselineStable(false);
    } catch (err: any) {
      console.error('OptoPupil DB: Failed to clear measurements:', err);
      setPersistenceError(err?.message || 'Database clear error');
    }
  }, []);

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

  // Rolling Baseline Stability & Stimulus Trigger Loop
  useEffect(() => {
    // If camera feed is stopped or inactive, reset workflow immediately
    if (!isActive) {
      hasTriggeredForSessionRef.current = false;
      rollingWindowRef.current = [];
      lostFramesCountRef.current = 0;
      setScreeningState('IDLE');
      setWindowSamplesCount(0);
      setLeftDeltaPx(0);
      setRightDeltaPx(0);
      setIsBaselineStable(false);
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

      const currentLeftPx = left.diameterPx!;
      const currentRightPx = right.diameterPx!;

      // If a stimulus has already been triggered for this continuous session, do not re-trigger
      if (hasTriggeredForSessionRef.current) {
        setScreeningState('PERSISTED');
        return;
      }

      // Add valid bilateral measurement to rolling window
      const window = rollingWindowRef.current;
      window.push({ left: currentLeftPx, right: currentRightPx });
      if (window.length > STABILITY_WINDOW_SIZE) {
        window.shift();
      }

      setWindowSamplesCount(window.length);

      // Check stability if rolling window has enough samples
      if (window.length >= STABILITY_WINDOW_SIZE) {
        const leftVals = window.map((s) => s.left);
        const rightVals = window.map((s) => s.right);

        const leftRange = Math.max(...leftVals) - Math.min(...leftVals);
        const rightRange = Math.max(...rightVals) - Math.min(...rightVals);

        setLeftDeltaPx(Number(leftRange.toFixed(2)));
        setRightDeltaPx(Number(rightRange.toFixed(2)));

        const isLeftStable = leftRange <= STABILITY_TOLERANCE_PX;
        const isRightStable = rightRange <= STABILITY_TOLERANCE_PX;
        const stable = isLeftStable && isRightStable;

        setIsBaselineStable(stable);

        if (stable && !isWritingRef.current) {
          // --- STABLE BASELINE REACHED: TRIGGER STIMULUS & CAPTURE AT ONSET ---
          hasTriggeredForSessionRef.current = true;
          setScreeningState('STIMULUS_ACTIVE');

          const onsetTime = performance.now();
          const captureTimestamp = new Date().toISOString();
          const captureLeftPx = Number(currentLeftPx.toFixed(2));
          const captureRightPx = Number(currentRightPx.toFixed(2));

          // 1. Immediately trigger the existing display light stimulus
          startStimulus(STIMULUS_DURATION_MS, () => {
            setScreeningState('PERSISTED');
          });

          // 2. Immediately capture the current bilateral measurement at stimulus onset and persist
          isWritingRef.current = true;
          setIsSaving(true);

          const record: Omit<PupilMeasurementRecord, 'id'> = {
            timestamp: captureTimestamp,
            left_pupil_px: captureLeftPx,
            right_pupil_px: captureRightPx,
            status: 'DETECTED',
            stimulus_onset: true,
            stimulus_onset_ms: onsetTime,
            perf_timestamp_ms: onsetTime,
          };

          pupilDatabase
            .savePupilMeasurement(record)
            .then(() => {
              setPersistenceError(null);
            })
            .catch((err) => {
              console.error('OptoPupil DB: Failed to persist stimulus measurement record:', err);
              setPersistenceError(err?.message || 'Failed to save measurement');
            })
            .finally(() => {
              isWritingRef.current = false;
              setIsSaving(false);
            });
        } else {
          setScreeningState('COLLECTING_BASELINE');
        }
      } else {
        setScreeningState('COLLECTING_BASELINE');
        setIsBaselineStable(false);
      }
    } else {
      // Detection is lost or degraded
      // Reset rolling window immediately on lost/invalid frame so bad frames do not pollute stability
      if (!hasTriggeredForSessionRef.current) {
        rollingWindowRef.current = [];
        setWindowSamplesCount(0);
        setLeftDeltaPx(0);
        setRightDeltaPx(0);
        setIsBaselineStable(false);
        setScreeningState('IDLE');
      } else {
        // Session was completed: debounce lost frames before resetting to IDLE for next screening
        lostFramesCountRef.current += 1;
        if (lostFramesCountRef.current >= LOST_FRAMES_COOLDOWN) {
          hasTriggeredForSessionRef.current = false;
          rollingWindowRef.current = [];
          lostFramesCountRef.current = 0;
          setScreeningState('IDLE');
          setWindowSamplesCount(0);
          setLeftDeltaPx(0);
          setRightDeltaPx(0);
          setIsBaselineStable(false);
        }
      }
    }
  }, [pupilData, isActive, startStimulus]);

  return {
    latestMeasurement,
    recentRecords,
    totalCount,
    isSaving,
    persistenceError,
    screeningState,
    windowSamplesCount,
    leftDeltaPx,
    rightDeltaPx,
    isBaselineStable,
    refresh,
    clearHistory,
  };
}
