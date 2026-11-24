import type { GameState } from './types';

const KEY = 'krysky-doma-save-v1';
const BACKUP_KEY = 'krysky-doma-save-v1-backup';

export function loadState(): GameState | null {
  for (const k of [KEY, BACKUP_KEY]) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const s = JSON.parse(raw) as GameState;
      if (s && typeof s === 'object' && Array.isArray(s.rats)) return s;
    } catch (e) {
      console.warn('save parse failed', k, e);
    }
  }
  return null;
}

let lastBackup = 0;
export function saveState(s: GameState): void {
  try {
    const raw = JSON.stringify(s);
    localStorage.setItem(KEY, raw);
    const now = Date.now();
    if (now - lastBackup > 5 * 60_000) {
      localStorage.setItem(BACKUP_KEY, raw);
      lastBackup = now;
    }
  } catch (e) {
    console.warn('save failed', e);
  }
}

export function wipeSave(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(BACKUP_KEY);
  } catch {
    /* ignore */
  }
}

// ---------------- IndexedDB для фотоальбома ----------------

const DB_NAME = 'krysky-doma';
const STORE = 'photos';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const memoryFallback = new Map<string, string>();

export async function putPhoto(id: string, dataUrl: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(dataUrl, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    memoryFallback.set(id, dataUrl);
  }
}

export async function getPhoto(id: string): Promise<string | null> {
  if (memoryFallback.has(id)) return memoryFallback.get(id)!;
  try {
    const db = await openDb();
    return await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve((req.result as string) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function deletePhoto(id: string): Promise<void> {
  memoryFallback.delete(id);
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* ignore */
  }
}

export async function clearPhotos(): Promise<void> {
  memoryFallback.clear();
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* ignore */
  }
}
