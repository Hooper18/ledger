export type Language = 'zh' | 'en';

export interface PitchData {
  frequency: number;
  noteName: string;
  octave: number;
  cents: number;
  noteWithOctave: string;
  midiNote: number;
}

export interface TuningPreset {
  id: string;
  name: { zh: string; en: string };
  notes: string[];
}

export type PermissionStatus = 'idle' | 'pending' | 'granted' | 'denied' | 'unsupported';

export interface TunerSettings {
  a4: number;
  language: Language;
  selectedTuningId: string;
  autoMode: boolean;
}
