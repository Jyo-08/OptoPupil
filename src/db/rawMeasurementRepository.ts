import type { RawPupilMeasurementRecord, RawMeasurementListener } from './types';

const DB_NAME = 'optopupil_db';
const DB_VERSION = 2;
const RAW_STORE_NAME = 'raw_pupil_measurements';
const FINAL_STORE_NAME = 'final_screening_measurements';
const LOCAL_STORAGE_RAW_KEY = 'optopupil_raw_measurements_fallback';

class RawMeasurementRepository {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private listeners: Set<RawMeasurementListener> = new Set();

  constructor() {
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      this.initDB();
    }
  }

  private initDB(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !('indexedDB' in window)) {
        reject(new Error('IndexedDB is not supported.'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store 1: Raw Live Pupil Measurements
        if (!db.objectStoreNames.contains(RAW_STORE_NAME)) {
          const rawStore = db.createObjectStore(RAW_STORE_NAME, {
            keyPath: 'id',
            autoIncrement: true,
          });
          rawStore.createIndex('session_id', 'session_id', { unique: false });
          rawStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Store 2: Finalized Screening Measurements
        if (!db.objectStoreNames.contains(FINAL_STORE_NAME)) {
          const finalStore = db.createObjectStore(FINAL_STORE_NAME, {
            keyPath: 'id',
            autoIncrement: true,
          });
          finalStore.createIndex('session_id', 'session_id', { unique: true });
          finalStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.warn('Raw DB: Failed to open IndexedDB. Using fallback storage.', request.error);
        reject(request.error || new Error('Failed to open database.'));
      };
    });

    return this.dbPromise;
  }

  /**
   * Persists a raw fluctuating pupil measurement sample to Database 1.
   */
  async saveRawSample(
    sample: Omit<RawPupilMeasurementRecord, 'id'>
  ): Promise<RawPupilMeasurementRecord> {
    try {
      const db = await this.initDB();
      return new Promise<RawPupilMeasurementRecord>((resolve) => {
        const transaction = db.transaction([RAW_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(RAW_STORE_NAME);
        const request = store.add(sample);

        request.onsuccess = () => {
          const saved: RawPupilMeasurementRecord = {
            ...sample,
            id: request.result as number,
          };
          this.notifyListeners(saved);
          resolve(saved);
        };

        request.onerror = () => {
          const fallback = this.saveToLocalStorageFallback(sample);
          this.notifyListeners(fallback);
          resolve(fallback);
        };
      });
    } catch {
      const fallback = this.saveToLocalStorageFallback(sample);
      this.notifyListeners(fallback);
      return fallback;
    }
  }

  /**
   * Retrieves all raw measurement samples belonging to a specific session_id.
   */
  async getRawSamplesBySession(sessionId: string): Promise<RawPupilMeasurementRecord[]> {
    try {
      const db = await this.initDB();
      return new Promise<RawPupilMeasurementRecord[]>((resolve) => {
        const transaction = db.transaction([RAW_STORE_NAME], 'readonly');
        const store = transaction.objectStore(RAW_STORE_NAME);
        const index = store.index('session_id');
        const request = index.getAll(sessionId);

        request.onsuccess = () => {
          resolve(request.result || []);
        };

        request.onerror = () => {
          resolve(this.getAllFromLocalStorageFallback().filter((s) => s.session_id === sessionId));
        };
      });
    } catch {
      return this.getAllFromLocalStorageFallback().filter((s) => s.session_id === sessionId);
    }
  }

  /**
   * Retrieves recent raw measurement samples across all sessions.
   */
  async getRecentRawSamples(limit: number = 50): Promise<RawPupilMeasurementRecord[]> {
    try {
      const db = await this.initDB();
      return new Promise<RawPupilMeasurementRecord[]>((resolve) => {
        const transaction = db.transaction([RAW_STORE_NAME], 'readonly');
        const store = transaction.objectStore(RAW_STORE_NAME);
        const request = store.openCursor(null, 'prev');
        const results: RawPupilMeasurementRecord[] = [];

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor && results.length < limit) {
            results.push(cursor.value as RawPupilMeasurementRecord);
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
   * Returns total count of raw measurement samples in Database 1.
   */
  async getRawCount(): Promise<number> {
    try {
      const db = await this.initDB();
      return new Promise<number>((resolve) => {
        const transaction = db.transaction([RAW_STORE_NAME], 'readonly');
        const store = transaction.objectStore(RAW_STORE_NAME);
        const request = store.count();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(this.getAllFromLocalStorageFallback().length);
      });
    } catch {
      return this.getAllFromLocalStorageFallback().length;
    }
  }

  /**
   * Wipes ONLY Database 1 (Raw Measurements Store), leaving Finalized records untouched.
   */
  async clearRawDatabase(): Promise<void> {
    try {
      const db = await this.initDB();
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([RAW_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(RAW_STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {
      // Fallback
    } finally {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(LOCAL_STORAGE_RAW_KEY);
      }
    }
  }

  /**
   * Subscribes a listener to receive new raw measurement sample events.
   */
  subscribeToRawSamples(listener: RawMeasurementListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(sample: RawPupilMeasurementRecord) {
    this.listeners.forEach((listener) => {
      try {
        listener(sample);
      } catch (err) {
        console.error('Raw DB: Error in sample listener:', err);
      }
    });
  }

  // --- LocalStorage Fallback ---
  private saveToLocalStorageFallback(
    sample: Omit<RawPupilMeasurementRecord, 'id'>
  ): RawPupilMeasurementRecord {
    try {
      const existing = this.getAllFromLocalStorageFallback();
      const newId = existing.length > 0 ? (existing[0].id ?? 0) + 1 : 1;
      const saved: RawPupilMeasurementRecord = { ...sample, id: newId };
      const updated = [saved, ...existing].slice(0, 300);
      localStorage.setItem(LOCAL_STORAGE_RAW_KEY, JSON.stringify(updated));
      return saved;
    } catch {
      return { ...sample, id: Date.now() };
    }
  }

  private getAllFromLocalStorageFallback(limit: number = 300): RawPupilMeasurementRecord[] {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_RAW_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(0, limit) : [];
    } catch {
      return [];
    }
  }
}

export const rawMeasurementRepository = new RawMeasurementRepository();
