import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ru.krysky.doma',
  appName: 'Крыски дома',
  webDir: 'dist',
  android: {
    backgroundColor: '#f3e1c4',
    allowMixedContent: false,
  },
};

export default config;
