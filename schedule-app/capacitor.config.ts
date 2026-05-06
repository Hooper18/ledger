import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tuchenguang.schedule',
  appName: '课程日历',
  webDir: 'dist',
  // 远程加载已部署的 PWA — web 改完用户秒升级，无需重发 APK。
  // Service Worker 在 WebView 内继续工作，离线缓存照常生效。
  server: {
    url: 'https://calendar.tuchenguang.com',
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
