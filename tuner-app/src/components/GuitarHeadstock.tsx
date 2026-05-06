import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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
const TUNED_SUSTAIN_MS = 1500;

// Flat geometric headstock. Same topology as before — V-notch top, 3 pegs per side,
// strings fanning to a narrow nut at the bottom — so the string-to-button mapping
// still maps to physical guitar layout. No gradients, no wood grain.
const VIEW_W = 160;
const VIEW_H = 360;
const BODY_LEFT = 28;
const BODY_RIGHT = 132;
const NUT_Y = 305;
const PEG_TOP_Y = 80;
const PEG_MID_Y = 160;
const PEG_BOT_Y = 240;

const LEFT_PEGS: { y: number; idx: number }[] = [
  { y: PEG_TOP_Y, idx: 2 }, // D3
  { y: PEG_MID_Y, idx: 1 }, // A2
  { y: PEG_BOT_Y, idx: 0 }, // E2
];
const RIGHT_PEGS: { y: number; idx: number }[] = [
  { y: PEG_TOP_Y, idx: 3 }, // G3
  { y: PEG_MID_Y, idx: 4 }, // B3
  { y: PEG_BOT_Y, idx: 5 }, // E4
];

const STRING_WIDTHS: Record<number, number> = {
  0: 1.0,
  1: 0.9,
  2: 0.8,
  3: 0.7,
  4: 0.6,
  5: 0.5,
};

const NUT_X: Record<number, number> = {
  0: 70,
  1: 74,
  2: 78,
  3: 82,
  4: 86,
  5: 90,
};

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
  const segment = (active: boolean, label: string) => (
    <span
      className={`rounded-full px-4 py-1.5 transition-colors ${
        active ? 'bg-fg font-medium text-deep' : 'text-fg-mute'
      }`}
    >
      {label}
    </span>
  );
  return (
    <button
      onClick={onToggle}
      className="flex items-center rounded-full border border-line-strong bg-transparent p-0.5 text-[13px]"
    >
      {segment(autoMode, autoLabel)}
      {segment(!autoMode, manualLabel)}
    </button>
  );
}

function StringButton({
  noteName,
  isActive,
  isTuned,
  onClick,
}: {
  noteName: string;
  isActive: boolean;
  isTuned: boolean;
  onClick: () => void;
}) {
  const state = isTuned
    ? 'border-accent text-accent bg-elev'
    : isActive
    ? 'border-fg text-fg bg-elev-2'
    : 'border-fg-dim text-fg bg-elev';

  return (
    <button
      onClick={onClick}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 active:scale-95 ${state}`}
    >
      <span className="text-[15px] font-medium leading-none">{noteName}</span>
    </button>
  );
}

function HeadstockSVG() {
  // Flat headstock: subtle elevated fill + hairline border. No gradients, no grain.
  const bodyPath =
    `M 80 22 ` +
    `L 75 10 ` +
    `L 38 10 ` +
    `Q ${BODY_LEFT} 10 ${BODY_LEFT} 22 ` +
    `L ${BODY_LEFT} 285 ` +
    `Q ${BODY_LEFT} ${NUT_Y} 50 ${NUT_Y} ` +
    `L 110 ${NUT_Y} ` +
    `Q ${BODY_RIGHT} ${NUT_Y} ${BODY_RIGHT} 285 ` +
    `L ${BODY_RIGHT} 22 ` +
    `Q ${BODY_RIGHT} 10 122 10 ` +
    `L 85 10 ` +
    `Z`;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full"
      style={{ overflow: 'visible' }}
      aria-hidden
    >
      {/* Neck stub behind/below the body */}
      <rect
        x="62"
        y={NUT_Y - 4}
        width="36"
        height="80"
        fill="#2a2a2c"
      />

      {/* Body — solid fill at #2a2a2a per spec, with a clearly visible 1px outline */}
      <path
        d={bodyPath}
        fill="#2a2a2c"
        stroke="#4a4a4d"
        strokeWidth="1"
      />

      {/* Tuning pegs — flat dark dots with a thin ring. */}
      {LEFT_PEGS.map((p) => (
        <g key={`peg-l-${p.y}`}>
          <line
            x1={BODY_LEFT}
            y1={p.y}
            x2="22"
            y2={p.y}
            stroke="#5a5a5d"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle
            cx="14"
            cy={p.y}
            r="8"
            fill="#3a3a3d"
            stroke="#5a5a5d"
            strokeWidth="1"
          />
        </g>
      ))}
      {RIGHT_PEGS.map((p) => (
        <g key={`peg-r-${p.y}`}>
          <line
            x1={BODY_RIGHT}
            y1={p.y}
            x2="138"
            y2={p.y}
            stroke="#5a5a5d"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle
            cx="146"
            cy={p.y}
            r="8"
            fill="#3a3a3d"
            stroke="#5a5a5d"
            strokeWidth="1"
          />
        </g>
      ))}

      {/* Strings — fan from nut to each peg */}
      <g stroke="#9a9aa1" strokeLinecap="round" opacity="0.85">
        {LEFT_PEGS.map((p) => (
          <line
            key={`str-l-${p.idx}`}
            x1={BODY_LEFT}
            y1={p.y}
            x2={NUT_X[p.idx]}
            y2={NUT_Y - 2}
            strokeWidth={STRING_WIDTHS[p.idx]}
          />
        ))}
        {RIGHT_PEGS.map((p) => (
          <line
            key={`str-r-${p.idx}`}
            x1={BODY_RIGHT}
            y1={p.y}
            x2={NUT_X[p.idx]}
            y2={NUT_Y - 2}
            strokeWidth={STRING_WIDTHS[p.idx]}
          />
        ))}
      </g>

      {/* Nut */}
      <line
        x1="66"
        y1={NUT_Y - 2}
        x2="94"
        y2={NUT_Y - 2}
        stroke="#bdbdc4"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChromaticRing({ pitch }: { pitch: PitchData | null }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-6">
      <div className="grid w-full max-w-md grid-cols-6 gap-2">
        {NOTE_NAMES.map((note) => {
          const isActive = pitch?.noteName === note;
          const inTune =
            isActive && pitch !== null && Math.abs(pitch.cents) <= IN_TUNE_CENTS;
          return (
            <div
              key={note}
              className={`flex h-11 items-center justify-center rounded-full border text-[14px] font-medium transition-colors duration-150 ${
                inTune
                  ? 'border-accent bg-accent text-deep'
                  : isActive
                  ? 'border-fg bg-elev text-fg'
                  : 'border-line text-fg-mute'
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

  const strings: StringInfo[] = useMemo(
    () =>
      tuningNotes.map((noteStr, index) => {
        const midi = noteStringToMidi(noteStr);
        return {
          index,
          midi,
          noteName: midiToNoteName(midi),
          octave: midiToOctave(midi),
          frequency: midiToFrequency(midi, a4),
        };
      }),
    [tuningNotes, a4],
  );

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

  const [tuned, setTuned] = useState<boolean[]>(() =>
    Array(strings.length).fill(false),
  );
  const inTuneSinceRef = useRef<(number | null)[]>(
    Array(strings.length).fill(null),
  );

  useEffect(() => {
    setTuned(Array(strings.length).fill(false));
    inTuneSinceRef.current = Array(strings.length).fill(null);
  }, [autoMode, tuningNotes, strings.length]);

  useEffect(() => {
    if (activeIdx === null) {
      inTuneSinceRef.current = Array(strings.length).fill(null);
      return;
    }
    inTuneSinceRef.current = inTuneSinceRef.current.map((v, i) =>
      i === activeIdx ? v : null,
    );
    if (activeInTune) {
      const since = inTuneSinceRef.current[activeIdx];
      if (since === null) {
        inTuneSinceRef.current[activeIdx] = performance.now();
      } else if (
        !tuned[activeIdx] &&
        performance.now() - since >= TUNED_SUSTAIN_MS
      ) {
        setTuned((prev) => {
          if (prev[activeIdx!]) return prev;
          const next = [...prev];
          next[activeIdx!] = true;
          return next;
        });
      }
    } else {
      inTuneSinceRef.current[activeIdx] = null;
    }
  }, [pitch, activeIdx, activeInTune, tuned, strings.length]);

  if (tuningNotes.length === 0) {
    return <ChromaticRing pitch={pitch} />;
  }

  const renderButton = (peg: { y: number; idx: number }, side: 'left' | 'right') => {
    const s = strings[peg.idx];
    const topPercent = (peg.y / VIEW_H) * 100;
    const wrapperStyle: CSSProperties =
      side === 'left'
        ? {
            top: `${topPercent}%`,
            right: '100%',
            marginRight: '0.5rem',
            transform: 'translateY(-50%)',
          }
        : {
            top: `${topPercent}%`,
            left: '100%',
            marginLeft: '0.5rem',
            transform: 'translateY(-50%)',
          };
    return (
      <div key={peg.idx} className="absolute" style={wrapperStyle}>
        <StringButton
          noteName={s.noteName}
          isActive={activeIdx === peg.idx}
          isTuned={tuned[peg.idx]}
          onClick={() =>
            onStringTap(peg.idx, {
              noteName: s.noteName,
              octave: s.octave,
              frequency: s.frequency,
            })
          }
        />
      </div>
    );
  };

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex shrink-0 items-center justify-end px-4 pt-3 pb-1">
        <ModeToggle
          autoMode={autoMode}
          onToggle={onModeToggle}
          autoLabel={t('tuner.auto')}
          manualLabel={t('tuner.manual')}
        />
      </div>

      <div className="flex flex-1 items-center justify-center px-2 pb-4 min-h-0">
        <div
          className="relative h-full"
          style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}`, maxWidth: '36vw' }}
        >
          <HeadstockSVG />
          {LEFT_PEGS.map((p) => renderButton(p, 'left'))}
          {RIGHT_PEGS.map((p) => renderButton(p, 'right'))}
        </div>
      </div>
    </div>
  );
}
