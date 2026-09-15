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
  /** Total count of measurement records in the database */
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

export function useMeasurementPersistence({
  pupilData,
  isActive,
}: UseMeasurementPersistenceProps): UseMeasurementPersistenceReturn {
  const [latestMeasurement, setLatestMeasurement] = useState<PupilMeasurementRecord | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);

  // Tracks the continuous detection state to implement rising-edge capture
  const wasDetectedRef = useRef<boolean>(false);
  // Ref to prevent duplicate simultaneous async write tasks
  const isWritingRef = useRef<boolean>(false);

  // Fetch initial database records and subscribe to updates
  const refresh = useCallback(async () => {
    try {
      const [latest, count] = await Promise.all([
        pupilDatabase.getLatestPupilMeasurement(),
        pupilDatabase.getMeasurementCount(),
      ]);
      setLatestMeasurement(latest);
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
      setTotalCount(0);
      setPersistenceError(null);
    } catch (err: any) {
      console.error('OptoPupil DB: Failed to clear measurements:', err);
      setPersistenceError(err?.message || 'Database clear error');
    }
  }, []);

  // Subscribe to database change events
  useEffect(() => {
    refresh();

    const unsubscribe = pupilDatabase.subscribeToMeasurements((record) => {
      setLatestMeasurement(record);
      setTotalCount((prev) => prev + 1);
    });

    return () => {
      unsubscribe();
    };
  }, [refresh]);

  // Rising-edge event-based measurement capture loop
  useEffect(() => {
    if (!isActive) {
      wasDetectedRef.current = false;
      return;
    }

    const left = pupilData.leftPupil;
    const right = pupilData.rightPupil;

    // Strict validation: both left & right must be in DETECTED state with positive finite numbers
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

    // Edge transition: INVALID -> VALID DETECTED
    if (isCurrentlyBilateralDetected) {
      if (!wasDetectedRef.current && !isWritingRef.current) {
        wasDetectedRef.current = true;
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

        // Asynchronous non-blocking database insert
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
    } else {
      // Detection lost or degraded: reset state for subsequent rising edge
      wasDetectedRef.current = false;
    }
  }, [pupilData, isActive]);

  return {
    latestMeasurement,
    totalCount,
    isSaving,
    persistenceError,
    refresh,
    clearHistory,
  };
}
