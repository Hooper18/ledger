import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tuchenguang.ledger',
  appName: '口袋记账',
  webDir: 'dist',
  // 远程加载已部署的 PWA — web 改完用户秒升级，无需重发 APK。
  // Service Worker 在 WebView 内继续工作，离线缓存照常生效。
  server: {
    url: 'https://ledger.tuchenguang.com',
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    // 不要打开 captureInput —— Capacitor 的"替代 InputConnection"会吞掉 IME
    // 组合事件（中文拼音 / 日文假名等），导致中文备注永远录不进控件的 onChange，
    // 表现为"备注写了保存后是空的"。详情：
    // https://github.com/ionic-team/capacitor/issues/8193
    webContentsDebuggingEnabled: false,
  },
};

export default config;
