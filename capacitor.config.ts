import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cropbook.app',
  appName: 'CROPBOOK',
  webDir: 'www',
  android: {
    path: 'android'
  },
  server: {
    androidScheme: 'https'
  }
};

export default config;
