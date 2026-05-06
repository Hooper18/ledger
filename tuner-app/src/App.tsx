import { useEffect, useState } from 'react';
import { PermissionRequest } from './components/PermissionRequest';
import { TunerScreen } from './components/TunerScreen';
import { UpdateBanner } from './components/UpdateBanner';
import { useWakeLock } from './hooks/useWakeLock';
import { usePitchDetection } from './hooks/usePitchDetection';
import { useSettings } from './state/settings';

export default function App() {
  const { settings, update } = useSettings();
  const { pitch, permission, start, tryAutoStart, playReferenceTone } =
    usePitchDetection(settings.a4);
  const [checking, setChecking] = useState(true);

  useWakeLock(permission === 'granted');

  // Probe permission once on mount: if already granted, auto-start so the user
  // doesn't see the permission UI on every reload. Bails silently otherwise.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await tryAutoStart();
      if (!cancelled) setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tryAutoStart]);

  if (checking && permission !== 'granted') {
    return <div className="h-full w-full bg-deep" />;
  }

  if (permission !== 'granted') {
    return (
      <>
        <UpdateBanner />
        <PermissionRequest permission={permission} onGrant={start} />
      </>
    );
  }

  return (
    <>
      <UpdateBanner />
      <TunerScreen
        pitch={pitch}
        settings={settings}
        update={update}
        playReferenceTone={playReferenceTone}
      />
    </>
  );
}
