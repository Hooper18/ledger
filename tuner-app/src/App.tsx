import { PermissionRequest } from './components/PermissionRequest';
import { TunerScreen } from './components/TunerScreen';
import { useWakeLock } from './hooks/useWakeLock';
import { usePitchDetection } from './hooks/usePitchDetection';
import { useSettings } from './state/settings';

export default function App() {
  const { settings, update } = useSettings();
  const { pitch, permission, start, playReferenceTone } = usePitchDetection(settings.a4);

  useWakeLock(permission === 'granted');

  if (permission !== 'granted') {
    return <PermissionRequest permission={permission} onGrant={start} />;
  }

  return (
    <TunerScreen
      pitch={pitch}
      settings={settings}
      update={update}
      playReferenceTone={playReferenceTone}
    />
  );
}
