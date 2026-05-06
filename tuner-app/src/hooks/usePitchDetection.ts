import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioEngine } from '../audio/AudioEngine';
import { YINPitchDetector } from '../audio/YINPitchDetector';
import { centsBetween, frequencyToPitchData } from '../audio/noteUtils';
import type { PermissionStatus, PitchData } from '../types/tuner';

const FFT_SIZE = 4096;
const RMS_GATE = 0.01;
const MEDIAN_WINDOW = 5;
const FRAME_SKIP = 3; // run YIN every 3rd rAF frame ≈ 20fps

// Attack-onset suppression — pluck transients usually return a low-octave artefact
// for the first frame or two. We gate output for ATTACK_GATE_MS after detecting an
// RMS jump > ATTACK_RMS_RATIO×, keeping the previously-displayed pitch in place.
const ATTACK_RMS_RATIO = 3;
const ATTACK_GATE_MS = 150;

// Octave-jump filter — a YIN result more than half an octave away from the
// current stable estimate must be confirmed by STABILITY_FRAMES consecutive
// detections within STABILITY_CENTS of each other before we switch displays.
// Single-frame jumps (typical of attack-tail glitches) are dropped.
const OCTAVE_JUMP_HI = 1.4;
const OCTAVE_JUMP_LO = 0.7;
const STABILITY_FRAMES = 3;
const STABILITY_CENTS = 30;

export interface UsePitchDetectionResult {
  pitch: PitchData | null;
  rms: number;
  permission: PermissionStatus;
  error: string | null;
  start: () => Promise<void>;
  /**
   * Silent permission check — only starts the engine if the browser already
   * has microphone permission. Resolves to true on auto-start, false if a UI
   * prompt is required. Never triggers a permission dialog itself.
   */
  tryAutoStart: () => Promise<boolean>;
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

  // Onset / jump-filter state
  const prevRmsRef = useRef(0);
  const onsetTimeRef = useRef(Number.NEGATIVE_INFINITY);
  const stableFreqRef = useRef<number | null>(null);
  const candidateFreqRef = useRef<number | null>(null);
  const candidateCountRef = useRef(0);

  // Keep a4 fresh so the loop reads the latest value without restarting.
  useEffect(() => {
    a4Ref.current = a4;
  }, [a4]);

  const resetTracking = () => {
    historyRef.current = [];
    stableFreqRef.current = null;
    candidateFreqRef.current = null;
    candidateCountRef.current = 0;
  };

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    engineRef.current?.stop();
    engineRef.current = null;
    detectorRef.current = null;
    resetTracking();
    prevRmsRef.current = 0;
    onsetTimeRef.current = Number.NEGATIVE_INFINITY;
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

          // Onset detection: large RMS rise = string just got plucked
          if (
            prevRmsRef.current > 0 &&
            r > prevRmsRef.current * ATTACK_RMS_RATIO
          ) {
            onsetTimeRef.current = performance.now();
          }
          prevRmsRef.current = r;
          const inAttackGate =
            performance.now() - onsetTimeRef.current < ATTACK_GATE_MS;

          if (r < RMS_GATE) {
            // signal lost — clear everything
            resetTracking();
            setPitch(null);
          } else if (inAttackGate) {
            // Attack transient — suppress detection output.
            // setPitch is intentionally not called so React keeps the
            // previously-displayed value (or null if there wasn't one).
          } else {
            const freq = det.detect(buf);
            if (freq === null) {
              resetTracking();
              setPitch(null);
            } else {
              const stable = stableFreqRef.current;
              if (stable === null) {
                // Bootstrap — first valid detection after silence/onset.
                const hist = historyRef.current;
                hist.push(freq);
                if (hist.length > MEDIAN_WINDOW) hist.shift();
                const med = median(hist);
                stableFreqRef.current = med;
                candidateFreqRef.current = null;
                candidateCountRef.current = 0;
                setPitch(frequencyToPitchData(med, a4Ref.current));
              } else {
                const ratio = freq / stable;
                const isJump =
                  ratio < OCTAVE_JUMP_LO || ratio > OCTAVE_JUMP_HI;
                if (isJump) {
                  // Possible new pitch — confirm over consecutive frames.
                  const cand = candidateFreqRef.current;
                  if (
                    cand !== null &&
                    Math.abs(centsBetween(freq, cand)) <= STABILITY_CENTS
                  ) {
                    candidateCountRef.current += 1;
                  } else {
                    candidateFreqRef.current = freq;
                    candidateCountRef.current = 1;
                  }
                  if (candidateCountRef.current >= STABILITY_FRAMES) {
                    // Confirmed — switch over.
                    const accepted = candidateFreqRef.current ?? freq;
                    historyRef.current = [accepted];
                    stableFreqRef.current = accepted;
                    candidateFreqRef.current = null;
                    candidateCountRef.current = 0;
                    setPitch(frequencyToPitchData(accepted, a4Ref.current));
                  }
                  // else: drop this frame — keep displaying the existing stable pitch
                } else {
                  // Normal flow — feed median, update stable, emit.
                  candidateFreqRef.current = null;
                  candidateCountRef.current = 0;
                  const hist = historyRef.current;
                  hist.push(freq);
                  if (hist.length > MEDIAN_WINDOW) hist.shift();
                  const med = median(hist);
                  stableFreqRef.current = med;
                  setPitch(frequencyToPitchData(med, a4Ref.current));
                }
              }
            }
          }
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const tryAutoStart = useCallback(async (): Promise<boolean> => {
    if (engineRef.current) return true;
    if (!navigator.mediaDevices?.getUserMedia) return false;

    let alreadyGranted = false;

    try {
      // Modern path: ask the Permissions API directly. No UI is shown.
      const result = await navigator.permissions?.query({
        name: 'microphone' as PermissionName,
      });
      if (result?.state === 'granted') {
        alreadyGranted = true;
      } else if (result) {
        // 'prompt' or 'denied' — defer to user gesture.
        return false;
      } else {
        throw new Error('permissions.query unsupported');
      }
    } catch {
      // Safari fallback: probe getUserMedia. If the browser silently grants
      // (because permission was previously given), we have access; otherwise
      // it rejects (often NotAllowedError without a gesture) and we bail to
      // the explicit-permission UI.
      try {
        const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
        for (const track of probe.getTracks()) track.stop();
        alreadyGranted = true;
      } catch {
        return false;
      }
    }

    if (!alreadyGranted) return false;
    await start();
    return true;
  }, [start]);

  const playReferenceTone = useCallback((frequency: number, durationSec?: number) => {
    engineRef.current?.playReferenceTone(frequency, durationSec);
  }, []);

  // Release mic when the consumer unmounts.
  useEffect(() => () => stop(), [stop]);

  return {
    pitch,
    rms,
    permission,
    error,
    start,
    tryAutoStart,
    stop,
    playReferenceTone,
  };
}
