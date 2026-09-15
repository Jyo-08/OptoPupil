import type { PupilMeasurementRecord, MeasurementListener } from './types';

const DB_NAME = 'optopupil_db';
const DB_VERSION = 1;
const STORE_NAME = 'pupil_measurements';
const LOCAL_STORAGE_KEY = 'optopupil_pupil_measurements_fallback';

class PupilDatabase {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private listeners: Set<MeasurementListener> = new Set();

  constructor() {
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      this.initDB();
    }
  }

  /**
   * Initializes and opens the IndexedDB database instance.
   */
  private initDB(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !('indexedDB' in window)) {
        reject(new Error('IndexedDB is not supported in this environment.'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.warn('OptoPupil DB: Failed to open IndexedDB. Using fallback storage.', request.error);
        reject(request.error || new Error('Failed to open database.'));
      };
    });

    return this.dbPromise;
  }

  /**
   * Persists a bilateral pupil measurement record to IndexedDB (with LocalStorage fallback).
   */
  async savePupilMeasurement(
    record: Omit<PupilMeasurementRecord, 'id'>
  ): Promise<PupilMeasurementRecord> {
    try {
      const db = await this.initDB();
      return new Promise<PupilMeasurementRecord>((resolve) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(record);

        request.onsuccess = () => {
          const savedRecord: PupilMeasurementRecord = {
            ...record,
            id: request.result as number,
          };
          this.notifyListeners(savedRecord);
          resolve(savedRecord);
        };

        request.onerror = () => {
          console.warn('OptoPupil DB: Error inserting record into IndexedDB. Falling back.', request.error);
          const fallback = this.saveToLocalStorageFallback(record);
          this.notifyListeners(fallback);
          resolve(fallback);
        };
      });
    } catch (err) {
      console.warn('OptoPupil DB: IndexedDB unavailable. Using LocalStorage fallback.', err);
      const fallback = this.saveToLocalStorageFallback(record);
      this.notifyListeners(fallback);
      return fallback;
    }
  }

  /**
   * Retrieves the latest persisted pupil measurement record.
   */
  async getLatestPupilMeasurement(): Promise<PupilMeasurementRecord | null> {
    try {
      const db = await this.initDB();
      return new Promise<PupilMeasurementRecord | null>((resolve) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.openCursor(null, 'prev'); // Reverse cursor for latest record

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            resolve(cursor.value as PupilMeasurementRecord);
          } else {
            resolve(null);
          }
        };

        request.onerror = () => {
          resolve(this.getLatestFromLocalStorageFallback());
        };
      });
    } catch {
      return this.getLatestFromLocalStorageFallback();
    }
  }

  /**
   * Retrieves all persisted pupil measurements up to the specified limit.
   */
  async getAllPupilMeasurements(limit: number = 50): Promise<PupilMeasurementRecord[]> {
    try {
      const db = await this.initDB();
      return new Promise<PupilMeasurementRecord[]>((resolve) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.openCursor(null, 'prev');
        const results: PupilMeasurementRecord[] = [];

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor && results.length < limit) {
            results.push(cursor.value as PupilMeasurementRecord);
            cursor.continue();
          } else {
            resolve(results);
          }
        };

        request.onerror = () => {
          resolve(this.getAllFromLocalStorageFallback(limit));
        };
      });
    } catch {
      return this.getAllFromLocalStorageFallback(limit);
    }
  }

  /**
   * Returns the total count of persisted measurement records.
   */
  async getMeasurementCount(): Promise<number> {
    try {
      const db = await this.initDB();
      return new Promise<number>((resolve) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.count();

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = () => {
          resolve(this.getAllFromLocalStorageFallback().length);
        };
      });
    } catch {
      return this.getAllFromLocalStorageFallback().length;
    }
  }

  /**
   * Clears all persisted pupil measurements.
   */
  async clearPupilMeasurements(): Promise<void> {
    try {
      const db = await this.initDB();
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {
      // Ignore
    } finally {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    }
  }

  /**
   * Subscribes a listener to receive newly persisted measurement events.
   */
  subscribeToMeasurements(listener: MeasurementListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(record: PupilMeasurementRecord) {
    this.listeners.forEach((listener) => {
      try {
        listener(record);
      } catch (err) {
        console.error('OptoPupil DB: Error in measurement listener:', err);
      }
    });
  }

  // --- LocalStorage Fallback Methods ---

  private saveToLocalStorageFallback(
    record: Omit<PupilMeasurementRecord, 'id'>
  ): PupilMeasurementRecord {
    try {
      const existing = this.getAllFromLocalStorageFallback();
      const newId = existing.length > 0 ? (existing[0].id ?? 0) + 1 : 1;
      const savedRecord: PupilMeasurementRecord = { ...record, id: newId };
      const updated = [savedRecord, ...existing].slice(0, 100);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
      return savedRecord;
    } catch (e) {
      console.warn('OptoPupil DB: LocalStorage fallback failed.', e);
      return { ...record, id: Date.now() };
    }
  }

  private getLatestFromLocalStorageFallback(): PupilMeasurementRecord | null {
    const list = this.getAllFromLocalStorageFallback(1);
    return list.length > 0 ? list[0] : null;
  }

  private getAllFromLocalStorageFallback(limit: number = 50): PupilMeasurementRecord[] {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) return [];
      const parsed: PupilMeasurementRecord[] = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(0, limit) : [];
    } catch {
      return [];
    }
  }
}

// Export singleton database repository instance
export const pupilDatabase = new PupilDatabase();
