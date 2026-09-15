import { useState, useEffect, useRef, useCallback } from 'react';
import type { BilateralPupilData } from '../types/vision';
import { rawMeasurementRepository } from '../db/rawMeasurementRepository';
import { finalMeasurementRepository } from '../db/finalMeasurementRepository';
import type { RawPupilMeasurementRecord, FinalScreeningRecord } from '../db/types';
import type { StimulusTiming } from '../stimulus/types';
import {
  STABILITY_WINDOW_SIZE,
  STABILITY_TOLERANCE_PX,
  STIMULUS_DURATION_MS,
} from '../stimulus/config';

export type ScreeningWorkflowState =
  | 'IDLE'
  | 'COLLECTING_RAW_BASELINE'
  | 'BASELINE_STABLE'
  | 'STIMULUS_ACTIVE'
  | 'FINALIZED';

// Controlled sampling interval for Database 1 (10 Hz rate to prevent DB overhead at 60 FPS)
export const RAW_SAMPLING_INTERVAL_MS = 100;

export function generateSessionId(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `OP-${dateStr}-${randStr}`;
}

interface UseMeasurementPersistenceProps {
  pupilData: BilateralPupilData;
  isActive: boolean;
  startStimulus: (durationMs?: number, onComplete?: (timing: StimulusTiming) => void) => void;
}

export interface UseMeasurementPersistenceReturn {
  /** Active screening session identifier */
  currentSessionId: string;
  /** The most recently finalized screening record from Database 2 */
  latestFinalRecord: FinalScreeningRecord | null;
  /** List of all finalized screening records from Database 2 (newest first) */
  allFinalRecords: FinalScreeningRecord[];
  /** Total count of finalized screening records in Database 2 */
  finalCount: number;
  /** Total count of raw measurement samples in Database 1 */
  rawCount: number;
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
  /** Delete a specific finalized record from Database 2 */
  deleteFinalRecord: (id: number) => Promise<void>;
  /** Clear all raw samples from Database 1 */
  clearRawDb: () => Promise<void>;
  /** Clear all finalized screening records from Database 2 */
  clearFinalDb: () => Promise<void>;
  /** Start a new screening session with a fresh session_id */
  startNewSession: () => void;
  /** Manual refresh trigger */
  refresh: () => Promise<void>;
}

interface PupilSample {
  left: number;
  right: number;
}

export function useMeasurementPersistence({
  pupilData,
  isActive,
  startStimulus,
}: UseMeasurementPersistenceProps): UseMeasurementPersistenceReturn {
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => generateSessionId());
  const [latestFinalRecord, setLatestFinalRecord] = useState<FinalScreeningRecord | null>(null);
  const [allFinalRecords, setAllFinalRecords] = useState<FinalScreeningRecord[]>([]);
  const [finalCount, setFinalCount] = useState<number>(0);
  const [rawCount, setRawCount] = useState<number>(0);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);

  const [screeningState, setScreeningState] = useState<ScreeningWorkflowState>('IDLE');
  const [windowSamplesCount, setWindowSamplesCount] = useState<number>(0);
  const [leftDeltaPx, setLeftDeltaPx] = useState<number>(0);
  const [rightDeltaPx, setRightDeltaPx] = useState<number>(0);
  const [isBaselineStable, setIsBaselineStable] = useState<boolean>(false);

  // Active Session ID ref
  const currentSessionIdRef = useRef<string>(currentSessionId);
  currentSessionIdRef.current = currentSessionId;

  // In-memory rolling window of recent valid bilateral measurements
  const rollingWindowRef = useRef<PupilSample[]>([]);
  // Timestamp of last raw sample write to Database 1
  const lastRawSampleTimeRef = useRef<number>(0);
  // Session lock ensuring exactly ONE stimulus trigger and ONE final DB record per session
  const hasTriggeredForSessionRef = useRef<boolean>(false);
  const isWritingFinalRef = useRef<boolean>(false);

  // Start a fresh screening session with a new unique session_id
  const startNewSession = useCallback(() => {
    const nextSession = generateSessionId();
    setCurrentSessionId(nextSession);
    currentSessionIdRef.current = nextSession;

    hasTriggeredForSessionRef.current = false;
    isWritingFinalRef.current = false;
    rollingWindowRef.current = [];
    setScreeningState('IDLE');
    setWindowSamplesCount(0);
    setLeftDeltaPx(0);
    setRightDeltaPx(0);
    setIsBaselineStable(false);
  }, []);

  // Fetch all historical database records from both stores
  const refresh = useCallback(async () => {
    try {
      const [finalList, finalTotal, rawTotal] = await Promise.all([
        finalMeasurementRepository.getAllFinalRecords(50),
        finalMeasurementRepository.getFinalCount(),
        rawMeasurementRepository.getRawCount(),
      ]);
      setAllFinalRecords(finalList);
      setLatestFinalRecord(finalList.length > 0 ? finalList[0] : null);
      setFinalCount(finalTotal);
      setRawCount(rawTotal);
      setPersistenceError(null);
    } catch (err: any) {
      console.error('OptoPupil DB: Failed to fetch records:', err);
      setPersistenceError(err?.message || 'Database read error');
    }
  }, []);

  // Delete a specific finalized record from Database 2
  const deleteFinalRecord = useCallback(async (id: number) => {
    try {
      await finalMeasurementRepository.deleteFinalRecordById(id);
      await refresh();
    } catch (err: any) {
      console.error('OptoPupil DB: Failed to delete final record:', err);
      setPersistenceError(err?.message || 'Delete error');
    }
  }, [refresh]);

  // Wipes only Database 1 (Raw measurements)
  const clearRawDb = useCallback(async () => {
    try {
      await rawMeasurementRepository.clearRawDatabase();
      setRawCount(0);
    } catch (err: any) {
      console.error('OptoPupil DB: Failed to clear raw DB:', err);
      setPersistenceError(err?.message || 'Clear raw DB error');
    }
  }, []);

  // Wipes only Database 2 (Finalized records)
  const clearFinalDb = useCallback(async () => {
    try {
      await finalMeasurementRepository.clearFinalDatabase();
      setLatestFinalRecord(null);
      setAllFinalRecords([]);
      setFinalCount(0);
      hasTriggeredForSessionRef.current = false;
      isWritingFinalRef.current = false;
      rollingWindowRef.current = [];
      setScreeningState('IDLE');
      setWindowSamplesCount(0);
      setLeftDeltaPx(0);
      setRightDeltaPx(0);
      setIsBaselineStable(false);
    } catch (err: any) {
      console.error('OptoPupil DB: Failed to clear final DB:', err);
      setPersistenceError(err?.message || 'Clear final DB error');
    }
  }, []);

  // Subscribe to database change events
  useEffect(() => {
    refresh();

    const unsubFinal = finalMeasurementRepository.subscribeToFinalRecords((newRecord) => {
      setLatestFinalRecord(newRecord);
      setAllFinalRecords((prev) => {
        const filtered = prev.filter((r) => r.id !== newRecord.id);
        return [newRecord, ...filtered].slice(0, 50);
      });
      setFinalCount((prev) => prev + 1);
    });

    const unsubRaw = rawMeasurementRepository.subscribeToRawSamples(() => {
      setRawCount((prev) => prev + 1);
    });

    return () => {
      unsubFinal();
      unsubRaw();
    };
  }, [refresh]);

  // Main Live Vision Frame Processing Loop
  useEffect(() => {
    // If camera feed is stopped or inactive, reset in-memory baseline state
    if (!isActive) {
      hasTriggeredForSessionRef.current = false;
      isWritingFinalRef.current = false;
      rollingWindowRef.current = [];
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
      const currentLeftPx = left.diameterPx!;
      const currentRightPx = right.diameterPx!;
      const now = performance.now();

      // 1. Controlled Sampling for DATABASE 1 (Raw Measurements Store)
      if (now - lastRawSampleTimeRef.current >= RAW_SAMPLING_INTERVAL_MS) {
        lastRawSampleTimeRef.current = now;

        const rawSample: Omit<RawPupilMeasurementRecord, 'id'> = {
          session_id: currentSessionIdRef.current,
          timestamp: new Date().toISOString(),
          left_pupil_px: Number(currentLeftPx.toFixed(2)),
          right_pupil_px: Number(currentRightPx.toFixed(2)),
          left_status: left.status,
          right_status: right.status,
          perf_timestamp_ms: now,
        };

        // Asynchronous non-blocking insert into Database 1
        rawMeasurementRepository.saveRawSample(rawSample).catch((err) => {
          console.warn('OptoPupil DB: Raw sample persistence error:', err);
        });
      }

      // If screening has already triggered/finalized for this session, do not trigger again
      if (hasTriggeredForSessionRef.current) {
        return;
      }

      // 2. In-Memory Rolling Window for Baseline Stability Analysis
      const window = rollingWindowRef.current;
      window.push({ left: currentLeftPx, right: currentRightPx });
      if (window.length > STABILITY_WINDOW_SIZE) {
        window.shift();
      }

      setWindowSamplesCount(window.length);

      // Check baseline stability once window is full (6 samples)
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

        if (stable && !isWritingFinalRef.current) {
          // --- STABLE BASELINE DETECTED: TRIGGER STIMULUS & CREATE FINAL RECORD IN DATABASE 2 ---
          hasTriggeredForSessionRef.current = true;
          setScreeningState('STIMULUS_ACTIVE');

          const onsetTime = performance.now();
          const captureTimestamp = new Date().toISOString();
          const captureLeftPx = Number(currentLeftPx.toFixed(2));
          const captureRightPx = Number(currentRightPx.toFixed(2));

          const baselineLeftMean = Number((leftVals.reduce((a, b) => a + b, 0) / leftVals.length).toFixed(2));
          const baselineRightMean = Number((rightVals.reduce((a, b) => a + b, 0) / rightVals.length).toFixed(2));

          // 1. Immediately trigger the existing controlled display light stimulus
          startStimulus(STIMULUS_DURATION_MS, () => {
            setScreeningState('FINALIZED');
          });

          // 2. Persist finalized record into DATABASE 2 (Final Screening Store)
          isWritingFinalRef.current = true;
          setIsSaving(true);

          const finalRecord: Omit<FinalScreeningRecord, 'id'> = {
            session_id: currentSessionIdRef.current,
            timestamp: captureTimestamp,
            baseline_left_pupil_px: baselineLeftMean,
            baseline_right_pupil_px: baselineRightMean,
            stimulus_onset_timestamp: captureTimestamp,
            stimulus_onset_ms: onsetTime,
            stimulus_left_pupil_px: captureLeftPx,
            stimulus_right_pupil_px: captureRightPx,
            stimulus_duration_ms: STIMULUS_DURATION_MS,
            status: 'FINALIZED',
          };

          finalMeasurementRepository
            .createFinalRecord(finalRecord)
            .then(() => {
              setPersistenceError(null);
            })
            .catch((err) => {
              console.error('OptoPupil DB: Failed to persist finalized screening record:', err);
              setPersistenceError(err?.message || 'Failed to save final record');
            })
            .finally(() => {
              isWritingFinalRef.current = false;
              setIsSaving(false);
            });
        } else {
          setScreeningState('COLLECTING_RAW_BASELINE');
        }
      } else {
        setScreeningState('COLLECTING_RAW_BASELINE');
        setIsBaselineStable(false);
      }
    } else {
      // Detection is lost or degraded
      if (!hasTriggeredForSessionRef.current) {
        rollingWindowRef.current = [];
        setWindowSamplesCount(0);
        setLeftDeltaPx(0);
        setRightDeltaPx(0);
        setIsBaselineStable(false);
        setScreeningState('IDLE');
      }
    }
  }, [pupilData, isActive, startStimulus]);

  return {
    currentSessionId,
    latestFinalRecord,
    allFinalRecords,
    finalCount,
    rawCount,
    isSaving,
    persistenceError,
    screeningState,
    windowSamplesCount,
    leftDeltaPx,
    rightDeltaPx,
    isBaselineStable,
    deleteFinalRecord,
    clearRawDb,
    clearFinalDb,
    startNewSession,
    refresh,
  };
}
