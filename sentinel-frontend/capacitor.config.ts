import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.grmtech.sentinel',
  appName: 'Sentinel Guard',
  webDir: 'dist',
  server: {
    url: 'https://sentinel.itckhordhasecurity.workers.dev',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0f172a',
      showSpinner: false,
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#0f172a',
    },
  },
};

export default config;
