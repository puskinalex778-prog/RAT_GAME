import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const DB_NAME = 'RatHomeDB';
const STORE_NAME = 'saveStore';
const SAVE_KEY = 'rat_home_state_v1';
const LS_FALLBACK_KEY = 'rat_home_state_ls_v1';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function savePersistedData(data: unknown): Promise<void> {
  const json = JSON.stringify(data);
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(json, SAVE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Fallback to localStorage
    try {
      localStorage.setItem(LS_FALLBACK_KEY, json);
    } catch {
      // storage full
    }
  }
}

export async function loadPersistedData<T>(): Promise<T | null> {
  try {
    const db = await openDB();
    const raw = await new Promise<string | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(SAVE_KEY);
      req.onsuccess = () => resolve(req.result as string | undefined);
      req.onerror = () => reject(req.error);
    });
    if (raw) {
      return JSON.parse(raw) as T;
    }
  } catch {
    // ignore and try localStorage
  }

  try {
    const raw = localStorage.getItem(LS_FALLBACK_KEY);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    // ignore
  }
  return null;
}

export async function clearPersistedData(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(SAVE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
  try {
    localStorage.removeItem(LS_FALLBACK_KEY);
  } catch {
    // ignore
  }
}

export async function triggerHaptic(enabled: boolean, style: 'light' | 'medium' = 'light') {
  if (!enabled) return;
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({
        style: style === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light,
      });
    } else if (navigator.vibrate) {
      navigator.vibrate(style === 'medium' ? 18 : 10);
    }
  } catch {
    // ignore
  }
}

export async function exportPhotoToDevice(dataUrl: string, filename: string): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    try {
      const base64 = dataUrl.split(',')[1] ?? '';
      const written = await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Cache,
      });
      await Share.share({
        title: 'RAT HOME — фото питомца',
        text: 'Посмотри на мою крыску в RAT HOME!',
        url: written.uri,
        dialogTitle: 'Сохранить или поделиться фото',
      });
      return 'Фото готово к сохранению / отправке!';
    } catch {
      return 'Не удалось открыть системное окно отправки.';
    }
  } else {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return 'Фото сохранено на устройство!';
  }
}
