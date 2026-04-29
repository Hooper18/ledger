import { useCallback, useEffect, useState } from 'react';
import i18n from '../i18n';
import { A4_DEFAULT, A4_MAX, A4_MIN } from '../audio/noteUtils';
import { DEFAULT_TUNING_ID } from '../data/tunings';
import type { Language, TunerSettings } from '../types/tuner';

const STORAGE_KEY = 'tuner.settings';

const DEFAULTS: TunerSettings = {
  a4: A4_DEFAULT,
  language: 'en',
  selectedTuningId: DEFAULT_TUNING_ID,
  autoMode: true,
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function detectInitialLang(): Language {
  const nav = (typeof navigator !== 'undefined' ? navigator.language : 'en').toLowerCase();
  return nav.startsWith('zh') ? 'zh' : 'en';
}

function loadSettings(): TunerSettings {
  const fallback: TunerSettings = { ...DEFAULTS, language: detectInitialLang() };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<TunerSettings>;
    return {
      a4:
        typeof parsed.a4 === 'number' && Number.isFinite(parsed.a4)
          ? clamp(Math.round(parsed.a4), A4_MIN, A4_MAX)
          : fallback.a4,
      language:
        parsed.language === 'zh' || parsed.language === 'en'
          ? parsed.language
          : fallback.language,
      selectedTuningId:
        typeof parsed.selectedTuningId === 'string' && parsed.selectedTuningId.length > 0
          ? parsed.selectedTuningId
          : fallback.selectedTuningId,
      autoMode:
        typeof parsed.autoMode === 'boolean' ? parsed.autoMode : fallback.autoMode,
    };
  } catch {
    return fallback;
  }
}

function saveSettings(s: TunerSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // private mode / quota — ignore silently
  }
}

export interface UseSettingsResult {
  settings: TunerSettings;
  update: (patch: Partial<TunerSettings>) => void;
}

export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<TunerSettings>(loadSettings);

  // i18n follows settings
  useEffect(() => {
    if (i18n.language !== settings.language) {
      void i18n.changeLanguage(settings.language);
    }
  }, [settings.language]);

  // persistence
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const update = useCallback((patch: Partial<TunerSettings>) => {
    setSettings((prev) => {
      const next: TunerSettings = { ...prev, ...patch };
      if (typeof patch.a4 === 'number') {
        next.a4 = clamp(Math.round(patch.a4), A4_MIN, A4_MAX);
      }
      return next;
    });
  }, []);

  return { settings, update };
}
