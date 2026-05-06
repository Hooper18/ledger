import { useTranslation } from 'react-i18next';
import { GUITAR_TUNINGS } from '../data/tunings';
import type { Language } from '../types/tuner';
import { BottomSheet } from './BottomSheet';

interface Props {
  open: boolean;
  selectedId: string;
  language: Language;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function TuningSelector({ open, selectedId, language, onSelect, onClose }: Props) {
  const { t } = useTranslation();

  return (
    <BottomSheet open={open} onClose={onClose}>
      <header className="flex items-center justify-between px-5 pt-4 pb-3">
        <h2 className="text-[18px] font-medium text-fg">{t('tunings.selectTitle')}</h2>
        <button
          onClick={onClose}
          aria-label={t('tunings.close')}
          className="flex h-9 w-9 items-center justify-center rounded-full text-fg-mute transition-colors hover:bg-elev-2 active:bg-elev-2"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      <ul className="px-2 pb-4">
        {GUITAR_TUNINGS.map((tuning) => {
          const isSelected = tuning.id === selectedId;
          const noteSummary = tuning.notes.length > 0 ? tuning.notes.join(' · ') : '—';
          return (
            <li key={tuning.id}>
              <button
                onClick={() => {
                  onSelect(tuning.id);
                  onClose();
                }}
                className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-colors ${
                  isSelected
                    ? 'bg-elev-2'
                    : 'hover:bg-elev-2 active:bg-elev-2'
                }`}
              >
                <div className="flex min-w-0 flex-col">
                  <span className="text-[14px] font-medium text-fg">
                    {tuning.name[language]}
                  </span>
                  <span className="mt-0.5 truncate font-mono text-[12px] text-fg-mute">
                    {noteSummary}
                  </span>
                </div>
                {isSelected && (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="shrink-0"
                  >
                    <path
                      d="M5 12.5l4.5 4.5L19 7.5"
                      stroke="var(--color-accent)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}
