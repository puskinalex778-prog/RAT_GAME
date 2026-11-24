import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { getGame } from '../store/gameStore';

export const isNative = Capacitor.isNativePlatform();

let lastHaptic = 0;
/** Лёгкая вибрация (Capacitor Haptics, в браузере — navigator.vibrate) */
export function haptic(kind: 'light' | 'medium' | 'heavy' = 'light') {
  if (!getGame().settings.haptics) return;
  const now = performance.now();
  if (now - lastHaptic < 60) return;
  lastHaptic = now;
  if (isNative) {
    const style = kind === 'light' ? ImpactStyle.Light : kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Heavy;
    Haptics.impact({ style }).catch(() => undefined);
  } else if ('vibrate' in navigator) {
    try {
      navigator.vibrate(kind === 'light' ? 12 : kind === 'medium' ? 25 : 40);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Экспорт фото на устройство: на Android — сохраняем в Documents/KryskiDoma и открываем «Поделиться»
 * (оттуда можно сохранить в Галерею), в браузере — скачивание файла.
 */
export async function exportPhoto(dataUrl: string, name: string): Promise<string> {
  const fileName = `${name}.jpg`;
  if (isNative) {
    const base64 = dataUrl.split(',')[1];
    try {
      const res = await Filesystem.writeFile({
        path: `KryskiDoma/${fileName}`,
        data: base64,
        directory: Directory.Documents,
        recursive: true,
      });
      try {
        await Share.share({ title: 'Крыски дома', text: 'Мои крыски 🐀💕', url: res.uri, dialogTitle: 'Сохранить или отправить фото' });
      } catch {
        /* пользователь закрыл окно */
      }
      return 'Фото сохранено в «Документы/KryskiDoma»';
    } catch {
      // запасной путь: кэш + поделиться
      const res = await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
      await Share.share({ title: 'Крыски дома', url: res.uri, dialogTitle: 'Сохранить или отправить фото' });
      return 'Фото готово к отправке';
    }
  }
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return 'Фото скачано';
}
