import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioEngine } from '../audio/AudioEngine';
import { YINPitchDetector } from '../audio/YINPitchDetector';
import { frequencyToPitchData } from '../audio/noteUtils';
import type { PermissionStatus, PitchData } from '../types/tuner';

const FFT_SIZE = 4096;
const RMS_GATE = 0.01;
const MEDIAN_WINDOW = 5;
const FRAME_SKIP = 3; // run YIN every 3rd rAF frame ≈ 20fps

export interface UsePitchDetectionResult {
  pitch: PitchData | null;
  rms: number;
  permission: PermissionStatus;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  playReferenceTone: (frequency: number, durationSec?: number) => void;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function usePitchDetection(a4: number): UsePitchDetectionResult {
  const [pitch, setPitch] = useState<PitchData | null>(null);
  const [rms, setRms] = useState(0);
  const [permission, setPermission] = useState<PermissionStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const engineRef = useRef<AudioEngine | null>(null);
  const detectorRef = useRef<YINPitchDetector | null>(null);
  const rafRef = useRef(0);
  const historyRef = useRef<number[]>([]);
  const frameCountRef = useRef(0);
  const a4Ref = useRef(a4);

  // Keep a4 fresh so the loop reads the latest value without restarting.
  useEffect(() => {
    a4Ref.current = a4;
  }, [a4]);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    engineRef.current?.stop();
    engineRef.current = null;
    detectorRef.current = null;
    historyRef.current = [];
    setPitch(null);
    setRms(0);
  }, []);

  const start = useCallback(async () => {
    if (engineRef.current) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      setPermission('unsupported');
      setError('getUserMedia not supported on this browser');
      return;
    }

    setPermission('pending');
    setError(null);

    const engine = new AudioEngine({ fftSize: FFT_SIZE });
    try {
      await engine.start();
    } catch (e) {
      setPermission('denied');
      setError(e instanceof Error ? e.message : 'permission_denied');
      return;
    }

    const detector = new YINPitchDetector({
      sampleRate: engine.getSampleRate(),
      bufferSize: FFT_SIZE,
    });

    engineRef.current = engine;
    detectorRef.current = detector;
    setPermission('granted');

    const tick = () => {
      const eng = engineRef.current;
      const det = detectorRef.current;
      if (!eng || !det) return;

      frameCountRef.current = (frameCountRef.current + 1) % FRAME_SKIP;
      if (frameCountRef.current === 0) {
        const buf = eng.getTimeData();
        if (buf) {
          const r = eng.getRMS();
          setRms(r);
          if (r < RMS_GATE) {
            if (historyRef.current.length > 0) historyRef.current = [];
            setPitch(null);
          } else {
            const freq = det.detect(buf);
            if (freq !== null) {
              const hist = historyRef.current;
              hist.push(freq);
              if (hist.length > MEDIAN_WINDOW) hist.shift();
              setPitch(frequencyToPitchData(median(hist), a4Ref.current));
            } else {
              if (historyRef.current.length > 0) historyRef.current = [];
              setPitch(null);
            }
          }
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const playReferenceTone = useCallback((frequency: number, durationSec?: number) => {
    engineRef.current?.playReferenceTone(frequency, durationSec);
  }, []);

  // Release mic when the consumer unmounts.
  useEffect(() => () => stop(), [stop]);

  return { pitch, rms, permission, error, start, stop, playReferenceTone };
}
