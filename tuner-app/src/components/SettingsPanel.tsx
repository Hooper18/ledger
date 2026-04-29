import { useTranslation } from 'react-i18next';
import { A4_DEFAULT, A4_MAX, A4_MIN } from '../audio/noteUtils';
import type { Language } from '../types/tuner';
import { BottomSheet } from './BottomSheet';

interface Props {
  open: boolean;
  a4: number;
  language: Language;
  onA4Change: (a4: number) => void;
  onLanguageChange: (lang: Language) => void;
  onClose: () => void;
}

function StepperButton({
  label,
  onClick,
  ariaLabel,
}: {
  label: string;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-elev-2 text-xl text-fg active:scale-95"
    >
      {label}
    </button>
  );
}

export function SettingsPanel({
  open,
  a4,
  language,
  onA4Change,
  onLanguageChange,
  onClose,
}: Props) {
  const { t } = useTranslation();

  const langButton = (lang: Language, label: string) => (
    <button
      onClick={() => onLanguageChange(lang)}
      className={`flex-1 rounded-xl border-2 py-3 text-base transition-colors ${
        language === lang
          ? 'border-accent bg-accent/10 font-medium text-accent'
          : 'border-line bg-elev-2 text-fg-mute'
      }`}
    >
      {label}
    </button>
  );

  return (
    <BottomSheet open={open} onClose={onClose}>
      <header className="flex items-center justify-between px-5 pt-3 pb-2">
        <h2 className="text-lg font-medium text-fg">{t('settings.title')}</h2>
        <button
          onClick={onClose}
          aria-label={t('settings.close')}
          className="flex h-9 w-9 items-center justify-center rounded-full text-fg-mute active:bg-elev-2"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className="space-y-7 px-5 pt-2 pb-6">
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <label className="text-sm font-medium text-fg" htmlFor="a4-slider">
              {t('settings.a4Label')}
            </label>
            <span className="font-mono text-base tabular-nums text-fg">
              {a4} <span className="text-xs text-fg-mute">Hz</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <StepperButton
              label="−"
              ariaLabel="-1 Hz"
              onClick={() => onA4Change(a4 - 1)}
            />
            <input
              id="a4-slider"
              type="range"
              min={A4_MIN}
              max={A4_MAX}
              step={1}
              value={a4}
              onChange={(e) => onA4Change(Number(e.target.value))}
              className="flex-1 accent-accent"
            />
            <StepperButton
              label="+"
              ariaLabel="+1 Hz"
              onClick={() => onA4Change(a4 + 1)}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-fg-dim">
            <span>{t('settings.a4Hint')}</span>
            {a4 !== A4_DEFAULT && (
              <button
                onClick={() => onA4Change(A4_DEFAULT)}
                className="text-fg-mute underline-offset-2 active:underline"
              >
                {A4_DEFAULT}
              </button>
            )}
          </div>
        </section>

        <section>
          <span className="mb-2 block text-sm font-medium text-fg">
            {t('settings.language')}
          </span>
          <div className="flex gap-3">
            {langButton('zh', t('settings.languageZh'))}
            {langButton('en', t('settings.languageEn'))}
          </div>
        </section>

        <section className="border-t border-line pt-4">
          <span className="mb-1 block text-xs uppercase tracking-wide text-fg-dim">
            {t('settings.about')}
          </span>
          <p className="text-xs leading-relaxed text-fg-mute">
            {t('settings.aboutText')}
          </p>
        </section>
      </div>
    </BottomSheet>
  );
}
