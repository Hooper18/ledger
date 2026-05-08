import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tuchenguang.tuner',
  appName: 'Tuner',
  webDir: 'dist',
  // 资源全部打包，完全离线启动；麦克风权限在用户首次点 start 时由
  // Capacitor 内置 WebChromeClient 拉起原生对话框。
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
