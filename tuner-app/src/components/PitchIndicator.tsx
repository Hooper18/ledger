import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { centsBetween } from '../audio/noteUtils';
import type { PitchData } from '../types/tuner';

interface TargetNote {
  noteName: string;
  octave: number;
  frequency: number;
}

interface Props {
  pitch: PitchData | null;
  /** When set, the display is locked to this note (manual mode). */
  target: TargetNote | null;
  tuningLabel: string;
  onTuningClick: () => void;
  onSettingsClick: () => void;
}

const VIEW_W = 320;
const VIEW_H = 180;
const CX = VIEW_W / 2;
const CY = 160;
const R = 130;

const TICKS: { cents: number; major: boolean }[] = [
  { cents: -50, major: true },
  { cents: -40, major: false },
  { cents: -30, major: false },
  { cents: -25, major: true },
  { cents: -20, major: false },
  { cents: -10, major: false },
  { cents: -5, major: false },
  { cents: 0, major: true },
  { cents: 5, major: false },
  { cents: 10, major: false },
  { cents: 20, major: false },
  { cents: 25, major: true },
  { cents: 30, major: false },
  { cents: 40, major: false },
  { cents: 50, major: true },
];

function centsToArcPoint(cents: number, radius: number): { x: number; y: number } {
  const clamped = Math.max(-50, Math.min(50, cents));
  const t = (clamped + 50) / 100;
  const angle = Math.PI * (1 - t);
  return {
    x: CX + radius * Math.cos(angle),
    y: CY - radius * Math.sin(angle),
  };
}

export function PitchIndicator({
  pitch,
  target,
  tuningLabel,
  onTuningClick,
  onSettingsClick,
}: Props) {
  const { t } = useTranslation();

  let displayNote = '—';
  let displayOctave: number | null = null;
  let displayFreq: number | null = null;
  let displayCents = 0;
  let hasSignal = false;

  if (target) {
    displayNote = target.noteName;
    displayOctave = target.octave;
    if (pitch) {
      displayFreq = pitch.frequency;
      displayCents = centsBetween(pitch.frequency, target.frequency);
      hasSignal = true;
    }
  } else if (pitch) {
    displayNote = pitch.noteName;
    displayOctave = pitch.octave;
    displayFreq = pitch.frequency;
    displayCents = pitch.cents;
    hasSignal = true;
  }

  const isInTune = hasSignal && Math.abs(displayCents) <= 5;
  const isTight = hasSignal && Math.abs(displayCents) <= 2;

  // Vibrate once on entering tight in-tune state
  const wasTightRef = useRef(false);
  useEffect(() => {
    if (isTight && !wasTightRef.current) {
      try {
        navigator.vibrate?.(40);
      } catch {
        // unsupported
      }
    }
    wasTightRef.current = isTight;
  }, [isTight]);

  const dot = centsToArcPoint(hasSignal ? displayCents : 0, R);

  const noteColorClass = !hasSignal
    ? 'text-fg-dim'
    : isInTune
    ? 'text-accent'
    : 'text-fg';

  const dotFillClass = !hasSignal
    ? 'fill-fg-dim'
    : isInTune
    ? 'fill-accent'
    : 'fill-fg-mute';

  return (
    <div className="flex h-full w-full flex-col">
      <header className="flex shrink-0 items-center justify-between px-4 py-3">
        <button
          onClick={onTuningClick}
          className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] text-fg-mute transition-colors hover:bg-elev active:bg-elev-2"
        >
          <span className="text-fg-dim">{t('tuner.tuningLabel')}</span>
          <span className="font-medium text-fg">{tuningLabel}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" className="text-fg-dim">
            <path
              d="M2 4l3 3 3-3"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <button
          onClick={onSettingsClick}
          aria-label={t('settings.title')}
          className="flex h-9 w-9 items-center justify-center rounded-full text-fg-mute transition-colors hover:bg-elev active:bg-elev-2"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>

      <div className="relative flex flex-1 flex-col items-center justify-center px-6 min-h-0 overflow-hidden">
        <div className="relative w-full max-w-md" style={{ maxHeight: '55%' }}>
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            preserveAspectRatio="xMidYMid meet"
            className="w-full"
            style={{ maxHeight: '100%' }}
          >
            {/* Base arc */}
            <path
              d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
              stroke="var(--color-dial)"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
            />

            {/* Tick marks */}
            {TICKS.map(({ cents, major }) => {
              const inner = centsToArcPoint(cents, R - 3);
              const outer = centsToArcPoint(cents, R + (major ? 11 : 6));
              return (
                <line
                  key={cents}
                  x1={inner.x}
                  y1={inner.y}
                  x2={outer.x}
                  y2={outer.y}
                  stroke="var(--color-dial)"
                  strokeWidth={major ? 2.2 : 1.4}
                  strokeLinecap="round"
                />
              );
            })}

            {/* Center marker (0 cents) */}
            <line
              x1={CX}
              y1={CY - R - 14}
              x2={CX}
              y2={CY - R + 4}
              stroke={isInTune ? 'var(--color-accent)' : 'var(--color-fg)'}
              strokeWidth="2.6"
              strokeLinecap="round"
              style={{ transition: 'stroke 120ms linear' }}
            />

            {/* Indicator dot */}
            <circle
              cx={dot.x}
              cy={dot.y}
              r={hasSignal ? 9 : 6}
              className={dotFillClass}
              style={{
                transition:
                  'cx 100ms linear, cy 100ms linear, r 200ms ease-out, fill 150ms linear',
              }}
            />
          </svg>

          <div className="pointer-events-none absolute inset-x-0 top-[55%] flex justify-between px-1 text-2xl font-light text-fg-dim">
            <span>♭</span>
            <span>♯</span>
          </div>
        </div>

        <div className="mt-2 flex shrink-0 flex-col items-center">
          <div
            className={`flex items-baseline gap-1 transition-colors duration-150 ${noteColorClass}`}
          >
            <span className="text-[64px] font-light leading-none tracking-tight">
              {displayNote}
            </span>
            {displayOctave !== null && (
              <span className="self-start mt-0.5 text-lg text-fg-mute">
                {displayOctave}
              </span>
            )}
          </div>

          <div className="mt-2 text-[13px] tabular-nums text-fg-mute">
            {displayFreq !== null
              ? `${displayFreq.toFixed(1)} ${t('tuner.hzUnit')}`
              : t('tuner.playStringHint')}
          </div>

          <div className="mt-1 h-4 text-[12px] tabular-nums text-fg-dim">
            {hasSignal && (
              <span>
                {displayCents > 0 ? '+' : ''}
                {displayCents.toFixed(0)} {t('tuner.centsUnit')}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
