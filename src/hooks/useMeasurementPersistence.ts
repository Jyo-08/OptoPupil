import { useState, useEffect, useRef, useCallback } from 'react';
import type { BilateralPupilData } from '../types/vision';
import { pupilDatabase } from '../db/pupilDatabase';
import type { PupilMeasurementRecord } from '../db/types';

interface UseMeasurementPersistenceProps {
  pupilData: BilateralPupilData;
  isActive: boolean;
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
  /** Manual refresh trigger for database records */
  refresh: () => Promise<void>;
  /** Clear all persisted records */
  clearHistory: () => Promise<void>;
}

// Minimum consecutive lost frames required to officially close an active measurement session (prevents micro-flicker duplication)
const LOST_FRAMES_COOLDOWN = 10;

export function useMeasurementPersistence({
  pupilData,
  isActive,
}: UseMeasurementPersistenceProps): UseMeasurementPersistenceReturn {
  const [latestMeasurement, setLatestMeasurement] = useState<PupilMeasurementRecord | null>(null);
  const [recentRecords, setRecentRecords] = useState<PupilMeasurementRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);

  // Tracks whether a discrete measurement session/event is currently active
  const isSessionActiveRef = useRef<boolean>(false);
  // Tracks consecutive frames without valid bilateral detection before ending session
  const lostFramesCountRef = useRef<number>(0);
  // Mutex lock preventing concurrent async writes
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
      isSessionActiveRef.current = false;
      lostFramesCountRef.current = 0;
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

  // Session-based measurement capture loop
  useEffect(() => {
    // If camera feed is stopped or inactive, end active session immediately
    if (!isActive) {
      isSessionActiveRef.current = false;
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
      // Reset lost counter since tracking is active
      lostFramesCountRef.current = 0;

      // If no session is active, this is the start of a NEW measurement event
      if (!isSessionActiveRef.current && !isWritingRef.current) {
        isSessionActiveRef.current = true;
        isWritingRef.current = true;
        setIsSaving(true);

        const leftPx = Number(left.diameterPx!.toFixed(2));
        const rightPx = Number(right.diameterPx!.toFixed(2));
        const timestamp = new Date().toISOString();

        const record: Omit<PupilMeasurementRecord, 'id'> = {
          timestamp,
          left_pupil_px: leftPx,
          right_pupil_px: rightPx,
          status: 'DETECTED',
          perf_timestamp_ms: performance.now(),
        };

        // Asynchronous non-blocking database insertion
        pupilDatabase
          .savePupilMeasurement(record)
          .then(() => {
            setPersistenceError(null);
          })
          .catch((err) => {
            console.error('OptoPupil DB: Failed to persist measurement:', err);
            setPersistenceError(err?.message || 'Failed to save measurement');
          })
          .finally(() => {
            isWritingRef.current = false;
            setIsSaving(false);
          });
      }
      // If isSessionActiveRef.current is ALREADY true: do NOT create/update records on continuous frames!
    } else {
      // Detection is lost or degraded
      if (isSessionActiveRef.current) {
        lostFramesCountRef.current += 1;
        // Require sustained loss across multiple frames to officially close the session (debounce flicker)
        if (lostFramesCountRef.current >= LOST_FRAMES_COOLDOWN) {
          isSessionActiveRef.current = false;
          lostFramesCountRef.current = 0;
        }
      }
    }
  }, [pupilData, isActive]);

  return {
    latestMeasurement,
    recentRecords,
    totalCount,
    isSaving,
    persistenceError,
    refresh,
    clearHistory,
  };
}
