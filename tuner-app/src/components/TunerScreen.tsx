import { useEffect, useState } from 'react';
import {
  midiToFrequency,
  midiToNoteName,
  midiToOctave,
  noteStringToMidi,
} from '../audio/noteUtils';
import { getTuningById } from '../data/tunings';
import type { PitchData, TunerSettings } from '../types/tuner';
import { GuitarHeadstock } from './GuitarHeadstock';
import { PitchIndicator } from './PitchIndicator';
import { SettingsPanel } from './SettingsPanel';
import { TuningSelector } from './TuningSelector';

interface TargetNote {
  noteName: string;
  octave: number;
  frequency: number;
}

interface Props {
  pitch: PitchData | null;
  settings: TunerSettings;
  update: (patch: Partial<TunerSettings>) => void;
  playReferenceTone: (frequency: number, durationSec?: number) => void;
}

export function TunerScreen({ pitch, settings, update, playReferenceTone }: Props) {
  const { language, a4, selectedTuningId, autoMode } = settings;
  const tuning = getTuningById(selectedTuningId);
  const isChromatic = tuning.notes.length === 0;

  const [tuningOpen, setTuningOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedStringIndex, setSelectedStringIndex] = useState<number | null>(null);

  // Reset string selection when tuning preset changes
  useEffect(() => {
    setSelectedStringIndex(null);
  }, [selectedTuningId]);

  // Reset string selection when leaving manual mode
  useEffect(() => {
    if (autoMode) setSelectedStringIndex(null);
  }, [autoMode]);

  let target: TargetNote | null = null;
  if (!isChromatic && !autoMode && selectedStringIndex !== null) {
    const noteStr = tuning.notes[selectedStringIndex];
    if (noteStr) {
      const midi = noteStringToMidi(noteStr);
      target = {
        noteName: midiToNoteName(midi),
        octave: midiToOctave(midi),
        frequency: midiToFrequency(midi, a4),
      };
    }
  }

  const handleStringTap = (index: number, t: TargetNote) => {
    if (!autoMode) {
      setSelectedStringIndex(index);
    }
    playReferenceTone(t.frequency);
  };

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-[58%] flex-col">
        <PitchIndicator
          pitch={pitch}
          target={target}
          tuningLabel={tuning.name[language]}
          onTuningClick={() => setTuningOpen(true)}
          onSettingsClick={() => setSettingsOpen(true)}
        />
      </div>

      <div className="flex flex-1 flex-col border-t border-line bg-deep">
        <GuitarHeadstock
          pitch={pitch}
          tuningNotes={tuning.notes}
          autoMode={autoMode}
          selectedStringIndex={selectedStringIndex}
          a4={a4}
          onModeToggle={() => update({ autoMode: !autoMode })}
          onStringTap={handleStringTap}
        />
      </div>

      <TuningSelector
        open={tuningOpen}
        selectedId={selectedTuningId}
        language={language}
        onSelect={(id) => update({ selectedTuningId: id })}
        onClose={() => setTuningOpen(false)}
      />

      <SettingsPanel
        open={settingsOpen}
        a4={a4}
        language={language}
        onA4Change={(next) => update({ a4: next })}
        onLanguageChange={(lang) => update({ language: lang })}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
