// Донастройка сгенерированного Capacitor-проекта Android:
// ориентация экрана, полноэкранный режим, иконки, права, номер версии.
// Запускается после `npx cap sync android` (локально и в GitHub Actions).
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const app = path.join(root, 'android', 'app');
if (!fs.existsSync(app)) {
  console.error('Папка android/ не найдена. Сначала выполните: npx cap add android');
  process.exit(1);
}

function patch(file, fn) {
  if (!fs.existsSync(file)) {
    console.warn('нет файла', file);
    return;
  }
  const before = fs.readFileSync(file, 'utf8');
  const after = fn(before);
  if (after !== before) {
    fs.writeFileSync(file, after);
    console.log('✔ обновлён', path.relative(root, file));
  }
}

// 1. AndroidManifest: ориентация, вырезы экрана, права для сохранения фото на старых Android
patch(path.join(app, 'src/main/AndroidManifest.xml'), (s) => {
  if (!s.includes('android:screenOrientation')) {
    s = s.replace(/<activity\b/, '<activity\n            android:screenOrientation="sensorLandscape"');
  }
  if (!s.includes('android.permission.WRITE_EXTERNAL_STORAGE')) {
    s = s.replace(
      '</manifest>',
      '    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29" />\n    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />\n    <uses-permission android:name="android.permission.VIBRATE" />\n</manifest>',
    );
  }
  if (!s.includes('requestLegacyExternalStorage')) {
    s = s.replace(/<application\b/, '<application\n        android:requestLegacyExternalStorage="true"');
  }
  return s;
});

// 2. Полноэкранная тема
patch(path.join(app, 'src/main/res/values/styles.xml'), (s) => {
  if (s.includes('windowFullscreen')) return s;
  return s.replace(
    /(<style name="AppTheme\.NoActionBar"[^>]*>)/,
    '$1\n        <item name="android:windowFullscreen">true</item>',
  );
});

// 3. Иконки приложения
const iconSrc = path.join(root, 'resources', 'android');
if (fs.existsSync(iconSrc)) {
  for (const dir of fs.readdirSync(iconSrc)) {
    const dst = path.join(app, 'src/main/res', dir);
    fs.mkdirSync(dst, { recursive: true });
    for (const f of fs.readdirSync(path.join(iconSrc, dir))) {
      fs.copyFileSync(path.join(iconSrc, dir, f), path.join(dst, f));
    }
  }
  const bg = path.join(app, 'src/main/res/values/ic_launcher_background.xml');
  fs.mkdirSync(path.dirname(bg), { recursive: true });
  fs.writeFileSync(bg, '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#F6E2C4</color>\n</resources>\n');
  console.log('✔ иконки скопированы');
}

// 4. Номер версии из номера сборки GitHub Actions
const run = Number(process.env.GITHUB_RUN_NUMBER || 1);
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
patch(path.join(app, 'build.gradle'), (s) =>
  s.replace(/versionCode\s+\d+/, `versionCode ${run}`).replace(/versionName\s+"[^"]*"/, `versionName "${pkg.version}.${run}"`),
);

console.log('Android-проект подготовлен.');
