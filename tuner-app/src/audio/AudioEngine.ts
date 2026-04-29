declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

export interface AudioEngineOptions {
  fftSize?: number;
}

export class AudioEngine {
  private readonly fftSize: number;
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private timeBuffer: Float32Array<ArrayBuffer> | null = null;

  constructor(options: AudioEngineOptions = {}) {
    this.fftSize = options.fftSize ?? 4096;
  }

  /**
   * Must be called from a user-gesture handler on iOS Safari, otherwise the
   * AudioContext stays suspended and getFloatTimeDomainData returns silence.
   */
  async start(): Promise<void> {
    if (this.context) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('getUserMedia not supported');
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
      },
    });

    const Ctor: typeof AudioContext = window.AudioContext ?? window.webkitAudioContext!;
    this.context = new Ctor();
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }

    this.source = this.context.createMediaStreamSource(this.stream);
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.analyser.smoothingTimeConstant = 0;
    this.source.connect(this.analyser);

    this.timeBuffer = new Float32Array(this.fftSize);
  }

  stop(): void {
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
    }
    if (this.context) {
      this.context.close().catch(() => {});
      this.context = null;
    }
    this.timeBuffer = null;
  }

  isRunning(): boolean {
    return this.context !== null && this.analyser !== null;
  }

  getSampleRate(): number {
    return this.context?.sampleRate ?? 44100;
  }

  /**
   * Pulls the latest time-domain frame into the internal buffer and returns it.
   * The returned Float32Array is reused — caller should not retain a reference.
   */
  getTimeData(): Float32Array | null {
    if (!this.analyser || !this.timeBuffer) return null;
    this.analyser.getFloatTimeDomainData(this.timeBuffer);
    return this.timeBuffer;
  }

  /**
   * Root-mean-square of the most recently fetched time frame. Caller must have
   * invoked getTimeData() first this tick.
   */
  getRMS(): number {
    const buf = this.timeBuffer;
    if (!buf) return 0;
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const x = buf[i];
      sum += x * x;
    }
    return Math.sqrt(sum / buf.length);
  }

  /**
   * Plays a short sine reference tone — used by the headstock UI when the user
   * taps a string in manual mode. Falls back to a no-op if the engine isn't
   * initialized.
   */
  playReferenceTone(frequency: number, durationSec = 1.2): void {
    const ctx = this.context;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;

    const t = ctx.currentTime;
    const peak = 0.18;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.04);
    gain.gain.setValueAtTime(peak, t + durationSec - 0.15);
    gain.gain.linearRampToValueAtTime(0, t + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + durationSec + 0.05);
  }
}
