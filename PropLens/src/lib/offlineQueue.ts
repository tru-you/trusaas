import { QualityReport, PointResult, Property } from '../types';

/** Offline queue — IndexedDB-backed store for saves made with no signal.
 *  Entries survive reloads and are replayed in order by flushQueue() the next
 *  time the app is online. Ordered by auto-increment id, which is also the
 *  insertion order, so property creation always replays before the photos
 *  taken against it. */

const DB_NAME = 'proplens-offline';
const DB_VERSION = 1;
const STORE = 'queue';

export interface PhotoUploadPayload {
  propertyId: string;
  slotId: string;
  base64Image: string;
  qualityReport: QualityReport;
  assessment?: PointResult;
  closeups?: string[];
}

interface OfflineEntryBase {
  id?: number;
  queuedAt: string;
}

export interface PhotoQueueEntry extends OfflineEntryBase {
  type: 'photo';
  payload: PhotoUploadPayload;
}

export interface PropertyQueueEntry extends OfflineEntryBase {
  type: 'property';
  payload: Property;
}

export type OfflineEntry = PhotoQueueEntry | PropertyQueueEntry;

export type NewOfflineEntry = Omit<OfflineEntry, 'id'>;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

export async function enqueue(entry: NewOfflineEntry): Promise<number> {
  const db = await openDB();
  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).add(entry);
    req.onsuccess = () => resolve(Number(req.result));
    req.onerror = () => reject(req.error);
  });
}

/** All queued entries in insertion order (IDB getAll returns key order, and
 *  auto-increment ids are assigned in insertion order). */
export async function peekAll(): Promise<OfflineEntry[]> {
  const db = await openDB();
  return new Promise<OfflineEntry[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as OfflineEntry[]) || []);
    req.onerror = () => reject(req.error);
  });
}

export async function remove(id: number): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function count(): Promise<number> {
  const db = await openDB();
  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Replay the queue in order. Each entry is removed as soon as it succeeds;
 *  the first failure stops the flush so nothing behind it is lost or replayed
 *  out of order. */
export async function flushQueue(
  apiCall: (entry: OfflineEntry) => Promise<void>,
): Promise<{ flushed: number; failed: number }> {
  const entries = await peekAll();
  let flushed = 0;
  for (const entry of entries) {
    try {
      await apiCall(entry);
      if (entry.id != null) await remove(entry.id);
      flushed++;
    } catch (e) {
      console.error('Offline queue flush stopped:', e);
      return { flushed, failed: entries.length - flushed };
    }
  }
  return { flushed, failed: 0 };
}
