import { useEffect } from 'react';

/**
 * Holds a screen wake lock while `enabled` is true. Re-acquires automatically
 * after the page returns to foreground, since browsers release wake locks when
 * the page becomes hidden. Silently no-ops on unsupported platforms (Safari).
 */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      try {
        const wl = await navigator.wakeLock.request('screen');
        if (cancelled) {
          wl.release().catch(() => {});
          return;
        }
        sentinel = wl;
        wl.addEventListener('release', () => {
          sentinel = null;
        });
      } catch {
        // page hidden / permission denied — non-fatal
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !sentinel) {
        void request();
      }
    };

    void request();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      if (sentinel) {
        sentinel.release().catch(() => {});
        sentinel = null;
      }
    };
  }, [enabled]);
}
