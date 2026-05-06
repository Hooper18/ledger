// 拉 https://tuchenguang.com/apps-manifest.json 比当前 APK 的 versionCode；
// 远端有新版本就返回，UI 决定是否提示。
// 浏览器版（Capacitor.isNativePlatform=false）直接 no-op。
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

const MANIFEST_URL = 'https://tuchenguang.com/apps-manifest.json';
const APP_SLUG = 'tuner';
const DISMISS_KEY = 'tuner.update.dismissed';

export interface AvailableUpdate {
  versionName: string;
  versionCode: number;
  downloadUrl: string;
}

export function useUpdateCheck(): {
  update: AvailableUpdate | null;
  dismiss: () => void;
} {
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;

    void (async () => {
      try {
        const info = await App.getInfo();
        const localBuild = Number(info.build);
        if (!Number.isFinite(localBuild)) return;

        const resp = await fetch(MANIFEST_URL, { cache: 'no-store' });
        if (!resp.ok) return;
        const manifest = (await resp.json()) as Record<
          string,
          { versionCode: number; versionName: string; downloadUrl: string }
        >;
        const remote = manifest[APP_SLUG];
        if (!remote) return;
        if (remote.versionCode <= localBuild) return;

        const dismissed = localStorage.getItem(DISMISS_KEY);
        if (dismissed && Number(dismissed) >= remote.versionCode) return;

        if (!cancelled) {
          setUpdate({
            versionName: remote.versionName,
            versionCode: remote.versionCode,
            downloadUrl: remote.downloadUrl,
          });
        }
      } catch {
        // 静默失败
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = () => {
    if (update) {
      localStorage.setItem(DISMISS_KEY, String(update.versionCode));
    }
    setUpdate(null);
  };

  return { update, dismiss };
}
