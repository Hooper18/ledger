import { useTranslation } from 'react-i18next';
import {
  NOTE_NAMES,
  centsBetween,
  midiToFrequency,
  midiToNoteName,
  midiToOctave,
  noteStringToMidi,
} from '../audio/noteUtils';
import type { PitchData } from '../types/tuner';

interface StringInfo {
  index: number;
  midi: number;
  noteName: string;
  octave: number;
  frequency: number;
}

interface TargetNote {
  noteName: string;
  octave: number;
  frequency: number;
}

interface Props {
  pitch: PitchData | null;
  tuningNotes: string[];
  autoMode: boolean;
  selectedStringIndex: number | null;
  a4: number;
  onModeToggle: () => void;
  onStringTap: (index: number, target: TargetNote) => void;
}

const IN_TUNE_CENTS = 5;
const MAX_MATCH_SEMITONES = 6;

function pickClosestString(strings: StringInfo[], midiNote: number): number | null {
  if (strings.length === 0) return null;
  let best = 0;
  let bestDelta = Math.abs(strings[0].midi - midiNote);
  for (let i = 1; i < strings.length; i++) {
    const d = Math.abs(strings[i].midi - midiNote);
    if (d < bestDelta) {
      bestDelta = d;
      best = i;
    }
  }
  return bestDelta <= MAX_MATCH_SEMITONES ? best : null;
}

function ModeToggle({
  autoMode,
  onToggle,
  autoLabel,
  manualLabel,
}: {
  autoMode: boolean;
  onToggle: () => void;
  autoLabel: string;
  manualLabel: string;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center rounded-full bg-elev p-0.5 text-sm"
    >
      <span
        className={`rounded-full px-3 py-1 transition-colors ${
          autoMode ? 'bg-elev-2 font-medium text-fg' : 'text-fg-mute'
        }`}
      >
        {autoLabel}
      </span>
      <span
        className={`rounded-full px-3 py-1 transition-colors ${
          !autoMode ? 'bg-elev-2 font-medium text-fg' : 'text-fg-mute'
        }`}
      >
        {manualLabel}
      </span>
    </button>
  );
}

function StringButton({
  noteName,
  octave,
  isActive,
  isInTune,
  onClick,
}: {
  noteName: string;
  octave: number;
  isActive: boolean;
  isInTune: boolean;
  onClick: () => void;
}) {
  const state = isInTune
    ? 'bg-accent border-accent text-base shadow-[0_0_18px_rgba(74,222,128,0.55)]'
    : isActive
    ? 'bg-elev-2 border-accent-warn text-fg'
    : 'bg-elev border-line text-fg-dim';

  return (
    <button
      onClick={onClick}
      className={`flex h-14 w-14 flex-col items-center justify-center rounded-full border-2 transition-all duration-200 active:scale-95 ${state}`}
    >
      <span className="text-lg font-semibold leading-none">{noteName}</span>
      <span className="mt-0.5 text-[10px] leading-none opacity-70">{octave}</span>
    </button>
  );
}

function HeadstockOutline() {
  return (
    <svg
      viewBox="0 0 360 360"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <defs>
        <linearGradient id="headstockGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-elev)" />
          <stop offset="100%" stopColor="var(--color-elev-2)" />
        </linearGradient>
      </defs>
      <path
        d="M 70 30 Q 35 30 35 70 L 35 250 Q 35 285 70 285 L 145 285 L 145 320 Q 145 335 160 335 L 200 335 Q 215 335 215 320 L 215 285 L 290 285 Q 325 285 325 250 L 325 70 Q 325 30 290 30 Z"
        fill="url(#headstockGrad)"
        stroke="var(--color-line)"
        strokeWidth="2"
      />
      {/* nut line */}
      <line
        x1="155"
        y1="285"
        x2="205"
        y2="285"
        stroke="var(--color-fg-dim)"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChromaticRing({ pitch }: { pitch: PitchData | null }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-6">
      <div className="grid w-full max-w-md grid-cols-6 gap-2.5">
        {NOTE_NAMES.map((note) => {
          const isActive = pitch?.noteName === note;
          const inTune = isActive && pitch !== null && Math.abs(pitch.cents) <= IN_TUNE_CENTS;
          return (
            <div
              key={note}
              className={`flex h-12 items-center justify-center rounded-full border text-base font-medium transition-colors duration-150 ${
                inTune
                  ? 'border-accent bg-accent text-base'
                  : isActive
                  ? 'border-accent-warn bg-elev-2 text-fg'
                  : 'border-line bg-elev text-fg-dim'
              }`}
            >
              {note}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function GuitarHeadstock({
  pitch,
  tuningNotes,
  autoMode,
  selectedStringIndex,
  a4,
  onModeToggle,
  onStringTap,
}: Props) {
  const { t } = useTranslation();

  if (tuningNotes.length === 0) {
    return <ChromaticRing pitch={pitch} />;
  }

  const strings: StringInfo[] = tuningNotes.map((noteStr, index) => {
    const midi = noteStringToMidi(noteStr);
    return {
      index,
      midi,
      noteName: midiToNoteName(midi),
      octave: midiToOctave(midi),
      frequency: midiToFrequency(midi, a4),
    };
  });

  let activeIdx: number | null = null;
  let activeInTune = false;

  if (autoMode) {
    if (pitch) {
      activeIdx = pickClosestString(strings, pitch.midiNote);
      if (activeIdx !== null) {
        const cents = centsBetween(pitch.frequency, strings[activeIdx].frequency);
        activeInTune = Math.abs(cents) <= IN_TUNE_CENTS;
      }
    }
  } else {
    activeIdx = selectedStringIndex;
    if (activeIdx !== null && pitch) {
      const cents = centsBetween(pitch.frequency, strings[activeIdx].frequency);
      activeInTune = Math.abs(cents) <= IN_TUNE_CENTS;
    }
  }

  // String index → visual position. Index 0 is the lowest-pitched (6th) string.
  // Layout per spec: left bottom→top E A D, right bottom→top G B E.
  const leftCol = [strings[2], strings[1], strings[0]]; // top to bottom
  const rightCol = [strings[5], strings[4], strings[3]];

  return (
    <div className="flex h-full w-full flex-col items-center">
      <div className="flex w-full max-w-md items-center justify-end px-6 py-2">
        <ModeToggle
          autoMode={autoMode}
          onToggle={onModeToggle}
          autoLabel={t('tuner.auto')}
          manualLabel={t('tuner.manual')}
        />
      </div>

      <div className="relative flex w-full max-w-md flex-1 items-center justify-center px-6 pb-3">
        <div className="relative aspect-[360/360] w-full">
          <HeadstockOutline />
          <div className="absolute inset-0 flex items-stretch justify-between px-[10%] py-[10%]">
            <div className="flex flex-col items-center justify-around">
              {leftCol.map((s) => (
                <StringButton
                  key={s.index}
                  noteName={s.noteName}
                  octave={s.octave}
                  isActive={activeIdx === s.index}
                  isInTune={activeIdx === s.index && activeInTune}
                  onClick={() =>
                    onStringTap(s.index, {
                      noteName: s.noteName,
                      octave: s.octave,
                      frequency: s.frequency,
                    })
                  }
                />
              ))}
            </div>
            <div className="flex flex-col items-center justify-around">
              {rightCol.map((s) => (
                <StringButton
                  key={s.index}
                  noteName={s.noteName}
                  octave={s.octave}
                  isActive={activeIdx === s.index}
                  isInTune={activeIdx === s.index && activeInTune}
                  onClick={() =>
                    onStringTap(s.index, {
                      noteName: s.noteName,
                      octave: s.octave,
                      frequency: s.frequency,
                    })
                  }
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
