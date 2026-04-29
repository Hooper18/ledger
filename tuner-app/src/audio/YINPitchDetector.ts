/**
 * YIN pitch detection algorithm — de Cheveigné & Kawahara (2002).
 *
 * Steps:
 *   1. Difference function:        d(τ) = Σ_{j=0..W-1} (x[j] − x[j+τ])²
 *   2. Cumulative mean normalized: d'(τ) = d(τ) · τ / Σ_{j=1..τ} d(j)
 *   3. Absolute threshold:         find first τ where d'(τ) < threshold,
 *                                  then walk down to the local minimum
 *   4. Parabolic interpolation:    refine τ to sub-sample precision
 *   5. Frequency:                  f = sampleRate / τ̃
 *
 * The cumulative mean normalization (step 2) is what distinguishes YIN from
 * naive autocorrelation: it suppresses the "first dip" issue and reduces
 * octave errors significantly. We also constrain τ to the guitar-relevant
 * range [60Hz, 1500Hz] to avoid wasted computation and spurious matches.
 */
export interface YINOptions {
  sampleRate: number;
  bufferSize: number;
  threshold?: number;
  minFrequency?: number;
  maxFrequency?: number;
}

export class YINPitchDetector {
  private readonly sampleRate: number;
  private readonly bufferSize: number;
  private readonly threshold: number;
  private readonly halfBufferSize: number;
  private readonly minTau: number;
  private readonly maxTau: number;
  private readonly yinBuffer: Float32Array;

  constructor(options: YINOptions) {
    const {
      sampleRate,
      bufferSize,
      threshold = 0.15,
      minFrequency = 60,
      maxFrequency = 1500,
    } = options;

    this.sampleRate = sampleRate;
    this.bufferSize = bufferSize;
    this.threshold = threshold;
    this.halfBufferSize = bufferSize >> 1;
    this.minTau = Math.max(2, Math.floor(sampleRate / maxFrequency));
    this.maxTau = Math.min(this.halfBufferSize - 1, Math.ceil(sampleRate / minFrequency));
    this.yinBuffer = new Float32Array(this.maxTau + 2);
  }

  /**
   * Detects the fundamental frequency present in `buffer` (time-domain samples
   * in [-1, 1]). Returns null if no clear pitch is found below the threshold.
   */
  detect(buffer: Float32Array): number | null {
    if (buffer.length < this.bufferSize) return null;

    const W = this.halfBufferSize;
    const yin = this.yinBuffer;
    const maxTau = this.maxTau;

    // Steps 1 + 2: difference function with cumulative mean normalization.
    // We fold both into one pass with a running sum.
    yin[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau <= maxTau; tau++) {
      let sum = 0;
      for (let j = 0; j < W; j++) {
        const delta = buffer[j] - buffer[j + tau];
        sum += delta * delta;
      }
      runningSum += sum;
      // d'(τ) = d(τ) · τ / Σ d(j)
      yin[tau] = runningSum > 0 ? (sum * tau) / runningSum : 1;
    }

    // Step 3: absolute threshold + descent to local minimum.
    let tauEstimate = -1;
    for (let tau = this.minTau; tau <= maxTau; tau++) {
      if (yin[tau] < this.threshold) {
        // Descend to the local minimum past the threshold crossing.
        while (tau + 1 <= maxTau && yin[tau + 1] < yin[tau]) {
          tau++;
        }
        tauEstimate = tau;
        break;
      }
    }
    if (tauEstimate === -1) return null;

    // Step 4: parabolic interpolation around the chosen lag.
    const refinedTau = this.parabolicInterpolation(tauEstimate);

    // Step 5: convert to frequency.
    return this.sampleRate / refinedTau;
  }

  /**
   * Quadratic refinement using the three samples (τ-1, τ, τ+1) around the
   * local minimum. The vertex of the fitted parabola is at:
   *   τ̃ = τ + (y₀ − y₂) / [2 · (y₀ − 2y₁ + y₂)]
   * where y₀, y₁, y₂ are d'(τ-1), d'(τ), d'(τ+1).
   */
  private parabolicInterpolation(tau: number): number {
    if (tau <= 0 || tau >= this.maxTau) return tau;
    const yin = this.yinBuffer;
    const y0 = yin[tau - 1];
    const y1 = yin[tau];
    const y2 = yin[tau + 1];
    const denom = 2 * (y0 - 2 * y1 + y2);
    if (Math.abs(denom) < 1e-9) return tau;
    return tau + (y0 - y2) / denom;
  }
}
