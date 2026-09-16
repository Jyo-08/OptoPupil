import { useState, useEffect, useRef, useCallback } from 'react';
import type { BilateralPupilData } from '../types/vision';
import { rawMeasurementRepository } from '../db/rawMeasurementRepository';
import { finalMeasurementRepository } from '../db/finalMeasurementRepository';
import type { RawPupilMeasurementRecord, FinalScreeningRecord } from '../db/types';
import type { StimulusTiming } from '../stimulus/types';
import {
  STABILITY_WINDOW_SIZE,
  STABILITY_TOLERANCE_PX,
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
  startStimulus?: (durationMs?: number, onComplete?: (timing: StimulusTiming) => void) => void;
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
}: UseMeasurementPersistenceProps): UseMeasurementPersistenceReturn {
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => generateSessionId());
  const [latestFinalRecord, setLatestFinalRecord] = useState<FinalScreeningRecord | null>(null);
  const [allFinalRecords, setAllFinalRecords] = useState<FinalScreeningRecord[]>([]);
  const [finalCount, setFinalCount] = useState<number>(0);
  const [rawCount, setRawCount] = useState<number>(0);
  const [isSaving] = useState<boolean>(false);
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
  const consecutiveDropsRef = useRef<number>(0);

  // Start a fresh screening session with a new unique session_id
  const startNewSession = useCallback(() => {
    const nextSession = generateSessionId();
    setCurrentSessionId(nextSession);
    currentSessionIdRef.current = nextSession;

    consecutiveDropsRef.current = 0;
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

    // Robust validation: pupil is valid if detected/uncertain with finite positive diameter
    const isLeftValid =
      (left.status === 'DETECTED' || left.status === 'UNCERTAIN') &&
      typeof left.diameterPx === 'number' &&
      Number.isFinite(left.diameterPx) &&
      left.diameterPx > 0;

    const isRightValid =
      (right.status === 'DETECTED' || right.status === 'UNCERTAIN') &&
      typeof right.diameterPx === 'number' &&
      Number.isFinite(right.diameterPx) &&
      right.diameterPx > 0;

    const isCurrentlyBilateralDetected = isLeftValid && isRightValid;

    if (isCurrentlyBilateralDetected) {
      consecutiveDropsRef.current = 0;
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
        setScreeningState(stable ? 'BASELINE_STABLE' : 'COLLECTING_RAW_BASELINE');
      } else {
        setScreeningState('COLLECTING_RAW_BASELINE');
        setIsBaselineStable(false);
      }
    } else {
      // Detection is temporarily lost or degraded (tolerate 4 frames of micro-blinks)
      consecutiveDropsRef.current++;
      if (consecutiveDropsRef.current > 4) {
        rollingWindowRef.current = [];
        setWindowSamplesCount(0);
        setLeftDeltaPx(0);
        setRightDeltaPx(0);
        setIsBaselineStable(false);
        setScreeningState('IDLE');
      }
    }
  }, [pupilData, isActive]);

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
