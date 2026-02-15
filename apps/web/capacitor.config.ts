import type { CapacitorConfig } from '@capacitor/cli';

const devServer = process.env.CAPACITOR_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'app.otter.money',
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
    backgroundColor: '#F9FAFB',
  },
  android: {
    backgroundColor: '#F9FAFB',
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
