import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rathome.game',
  appName: 'RAT HOME',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#F5EFE4',
    webContentsDebuggingEnabled: false,
  },
};

export default config;
