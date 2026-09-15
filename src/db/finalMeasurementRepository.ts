import type { FinalScreeningRecord, FinalScreeningListener } from './types';

const DB_NAME = 'optopupil_db';
const DB_VERSION = 2;
const FINAL_STORE_NAME = 'final_screening_measurements';
const RAW_STORE_NAME = 'raw_pupil_measurements';
const LOCAL_STORAGE_FINAL_KEY = 'optopupil_final_screenings_fallback';

class FinalMeasurementRepository {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private listeners: Set<FinalScreeningListener> = new Set();

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
        console.warn('Final DB: Failed to open IndexedDB. Using fallback storage.', request.error);
        reject(request.error || new Error('Failed to open database.'));
      };
    });

    return this.dbPromise;
  }

  /**
   * Persists an immutable finalized screening record to Database 2.
   */
  async createFinalRecord(
    record: Omit<FinalScreeningRecord, 'id'>
  ): Promise<FinalScreeningRecord> {
    try {
      const db = await this.initDB();
      return new Promise<FinalScreeningRecord>((resolve) => {
        const transaction = db.transaction([FINAL_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(FINAL_STORE_NAME);
        const request = store.add(record);

        request.onsuccess = () => {
          const saved: FinalScreeningRecord = {
            ...record,
            id: request.result as number,
          };
          this.notifyListeners(saved);
          resolve(saved);
        };

        request.onerror = () => {
          const fallback = this.saveToLocalStorageFallback(record);
          this.notifyListeners(fallback);
          resolve(fallback);
        };
      });
    } catch {
      const fallback = this.saveToLocalStorageFallback(record);
      this.notifyListeners(fallback);
      return fallback;
    }
  }

  /**
   * Retrieves the most recently finalized screening record.
   */
  async getLatestFinalRecord(): Promise<FinalScreeningRecord | null> {
    try {
      const db = await this.initDB();
      return new Promise<FinalScreeningRecord | null>((resolve) => {
        const transaction = db.transaction([FINAL_STORE_NAME], 'readonly');
        const store = transaction.objectStore(FINAL_STORE_NAME);
        const request = store.openCursor(null, 'prev');

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            resolve(cursor.value as FinalScreeningRecord);
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
   * Retrieves a finalized screening record by its unique session_id.
   */
  async getFinalRecordBySessionId(sessionId: string): Promise<FinalScreeningRecord | null> {
    try {
      const db = await this.initDB();
      return new Promise<FinalScreeningRecord | null>((resolve) => {
        const transaction = db.transaction([FINAL_STORE_NAME], 'readonly');
        const store = transaction.objectStore(FINAL_STORE_NAME);
        const index = store.index('session_id');
        const request = index.get(sessionId);

        request.onsuccess = () => {
          resolve(request.result || null);
        };

        request.onerror = () => {
          resolve(this.getAllFromLocalStorageFallback().find((r) => r.session_id === sessionId) || null);
        };
      });
    } catch {
      return this.getAllFromLocalStorageFallback().find((r) => r.session_id === sessionId) || null;
    }
  }

  /**
   * Retrieves all finalized screening records (newest first).
   */
  async getAllFinalRecords(limit: number = 50): Promise<FinalScreeningRecord[]> {
    try {
      const db = await this.initDB();
      return new Promise<FinalScreeningRecord[]>((resolve) => {
        const transaction = db.transaction([FINAL_STORE_NAME], 'readonly');
        const store = transaction.objectStore(FINAL_STORE_NAME);
        const request = store.openCursor(null, 'prev');
        const results: FinalScreeningRecord[] = [];

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor && results.length < limit) {
            results.push(cursor.value as FinalScreeningRecord);
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
   * Returns total count of finalized screening records in Database 2.
   */
  async getFinalCount(): Promise<number> {
    try {
      const db = await this.initDB();
      return new Promise<number>((resolve) => {
        const transaction = db.transaction([FINAL_STORE_NAME], 'readonly');
        const store = transaction.objectStore(FINAL_STORE_NAME);
        const request = store.count();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(this.getAllFromLocalStorageFallback().length);
      });
    } catch {
      return this.getAllFromLocalStorageFallback().length;
    }
  }

  /**
   * Deletes a single specific finalized record by its primary key ID.
   */
  async deleteFinalRecordById(id: number): Promise<void> {
    try {
      const db = await this.initDB();
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([FINAL_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(FINAL_STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {
      // Fallback
    } finally {
      if (typeof window !== 'undefined' && window.localStorage) {
        const list = this.getAllFromLocalStorageFallback();
        const updated = list.filter((r) => r.id !== id);
        localStorage.setItem(LOCAL_STORAGE_FINAL_KEY, JSON.stringify(updated));
      }
    }
  }

  /**
   * Wipes ONLY Database 2 (Finalized Screenings Store), leaving Raw data untouched.
   */
  async clearFinalDatabase(): Promise<void> {
    try {
      const db = await this.initDB();
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([FINAL_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(FINAL_STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {
      // Fallback
    } finally {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(LOCAL_STORAGE_FINAL_KEY);
      }
    }
  }

  /**
   * Subscribes a listener to receive new finalized screening record events.
   */
  subscribeToFinalRecords(listener: FinalScreeningListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(record: FinalScreeningRecord) {
    this.listeners.forEach((listener) => {
      try {
        listener(record);
      } catch (err) {
        console.error('Final DB: Error in record listener:', err);
      }
    });
  }

  // --- LocalStorage Fallback ---
  private saveToLocalStorageFallback(
    record: Omit<FinalScreeningRecord, 'id'>
  ): FinalScreeningRecord {
    try {
      const existing = this.getAllFromLocalStorageFallback();
      const newId = existing.length > 0 ? (existing[0].id ?? 0) + 1 : 1;
      const saved: FinalScreeningRecord = { ...record, id: newId };
      const updated = [saved, ...existing].slice(0, 100);
      localStorage.setItem(LOCAL_STORAGE_FINAL_KEY, JSON.stringify(updated));
      return saved;
    } catch {
      return { ...record, id: Date.now() };
    }
  }

  private getLatestFromLocalStorageFallback(): FinalScreeningRecord | null {
    const list = this.getAllFromLocalStorageFallback(1);
    return list.length > 0 ? list[0] : null;
  }

  private getAllFromLocalStorageFallback(limit: number = 100): FinalScreeningRecord[] {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_FINAL_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(0, limit) : [];
    } catch {
      return [];
    }
  }
}

export const finalMeasurementRepository = new FinalMeasurementRepository();
