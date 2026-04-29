import type { TuningPreset } from '../types/tuner';

export const GUITAR_TUNINGS: TuningPreset[] = [
  {
    id: 'standard',
    name: { zh: '标准', en: 'Standard' },
    notes: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
  },
  {
    id: 'drop_d',
    name: { zh: 'Drop D', en: 'Drop D' },
    notes: ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'],
  },
  {
    id: 'drop_c',
    name: { zh: 'Drop C', en: 'Drop C' },
    notes: ['C2', 'G2', 'C3', 'F3', 'A3', 'D4'],
  },
  {
    id: 'half_step_down',
    name: { zh: '降半音', en: 'Half Step Down' },
    notes: ['Eb2', 'Ab2', 'Db3', 'Gb3', 'Bb3', 'Eb4'],
  },
  {
    id: 'full_step_down',
    name: { zh: '降全音', en: 'Full Step Down' },
    notes: ['D2', 'G2', 'C3', 'F3', 'A3', 'D4'],
  },
  {
    id: 'open_g',
    name: { zh: 'Open G', en: 'Open G' },
    notes: ['D2', 'G2', 'D3', 'G3', 'B3', 'D4'],
  },
  {
    id: 'open_d',
    name: { zh: 'Open D', en: 'Open D' },
    notes: ['D2', 'A2', 'D3', 'F#3', 'A3', 'D4'],
  },
  {
    id: 'dadgad',
    name: { zh: 'DADGAD', en: 'DADGAD' },
    notes: ['D2', 'A2', 'D3', 'G3', 'A3', 'D4'],
  },
  {
    id: 'chromatic',
    name: { zh: '半音', en: 'Chromatic' },
    notes: [],
  },
];

export const DEFAULT_TUNING_ID = 'standard';

export function getTuningById(id: string): TuningPreset {
  return GUITAR_TUNINGS.find((t) => t.id === id) ?? GUITAR_TUNINGS[0];
}
