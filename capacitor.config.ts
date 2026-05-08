import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.agrimanager.app',
  appName: 'AgriManager',
  webDir: 'www',
  android: {
    path: 'android'
  },
  server: {
    androidScheme: 'https'
  }
};

export default config;
