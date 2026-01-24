import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'money.otter.app',
  appName: 'Otter Money',
  webDir: 'dist',
  server: {
    // For development with live reload
    // url: 'http://YOUR_LOCAL_IP:3000',
    // cleartext: true,
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#9F6FBA',
  },
  android: {
    backgroundColor: '#9F6FBA',
  },
  plugins: {
    StatusBar: {
      backgroundColor: '#9F6FBA',
      style: 'LIGHT',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
