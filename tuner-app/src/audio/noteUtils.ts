import type { PitchData } from '../types/tuner';

export const A4_DEFAULT = 440;
export const A4_MIN = 430;
export const A4_MAX = 450;

export const NOTE_NAMES = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
] as const;

export const FLAT_TO_SHARP: Record<string, string> = {
  Db: 'C#',
  Eb: 'D#',
  Gb: 'F#',
  Ab: 'G#',
  Bb: 'A#',
};

export function frequencyToMidi(freq: number, a4 = A4_DEFAULT): number {
  return 69 + 12 * Math.log2(freq / a4);
}

export function midiToFrequency(midi: number, a4 = A4_DEFAULT): number {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

export function midiToNoteName(midi: number): string {
  const idx = ((Math.round(midi) % 12) + 12) % 12;
  return NOTE_NAMES[idx];
}

export function midiToOctave(midi: number): number {
  return Math.floor(Math.round(midi) / 12) - 1;
}

export function noteStringToMidi(note: string): number {
  // Accepts "E2", "C#3", "Eb4", etc.
  const m = /^([A-G])([#b]?)(-?\d+)$/.exec(note.trim());
  if (!m) throw new Error(`Invalid note: ${note}`);
  const [, letter, accidental, octStr] = m;
  let semitone = NOTE_NAMES.indexOf(letter as typeof NOTE_NAMES[number]);
  if (semitone === -1) {
    // Try alternate naming via flat/sharp lookup
    const flatKey = `${letter}b`;
    if (accidental === 'b' && FLAT_TO_SHARP[flatKey]) {
      semitone = NOTE_NAMES.indexOf(FLAT_TO_SHARP[flatKey] as typeof NOTE_NAMES[number]);
    }
  } else {
    if (accidental === '#') semitone += 1;
    else if (accidental === 'b') semitone -= 1;
  }
  const octave = parseInt(octStr, 10);
  return (octave + 1) * 12 + semitone;
}

export function noteStringToFrequency(note: string, a4 = A4_DEFAULT): number {
  return midiToFrequency(noteStringToMidi(note), a4);
}

/**
 * Convert detected frequency to PitchData. The note name and octave correspond
 * to the nearest equal-tempered pitch; cents is the signed deviation from that
 * pitch in [-50, +50). Positive cents = sharp, negative = flat.
 */
export function frequencyToPitchData(freq: number, a4 = A4_DEFAULT): PitchData | null {
  if (!Number.isFinite(freq) || freq <= 0) return null;
  const midiFloat = frequencyToMidi(freq, a4);
  const midiNote = Math.round(midiFloat);
  const cents = (midiFloat - midiNote) * 100;
  const noteName = midiToNoteName(midiNote);
  const octave = midiToOctave(midiNote);
  return {
    frequency: freq,
    noteName,
    octave,
    cents,
    noteWithOctave: `${noteName}${octave}`,
    midiNote,
  };
}

/**
 * Distance in cents from one frequency to another (positive when freq > target).
 */
export function centsBetween(freq: number, targetFreq: number): number {
  return 1200 * Math.log2(freq / targetFreq);
}
