import type { CapacitorConfig } from '@capacitor/cli';

const devServer = process.env.CAPACITOR_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'money.otter.app',
  appName: 'Otter Money',
  webDir: 'dist',
  server: devServer
    ? {
        url: devServer,
        cleartext: true,
      }
    : {},
  ios: {
    contentInset: 'never',
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
