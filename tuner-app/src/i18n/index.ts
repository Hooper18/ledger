import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import zh from './zh.json';
import type { Language } from '../types/tuner';

const STORAGE_KEY = 'tuner.settings';

function detectInitialLang(): Language {
  // Prefer the language saved in our own settings store (single source of truth).
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed === 'object' &&
        'language' in parsed &&
        (parsed.language === 'zh' || parsed.language === 'en')
      ) {
        return parsed.language;
      }
    }
  } catch {
    // ignore parse / quota errors
  }
  const nav = (typeof navigator !== 'undefined' ? navigator.language : 'en').toLowerCase();
  return nav.startsWith('zh') ? 'zh' : 'en';
}

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      zh: { translation: zh },
      en: { translation: en },
    },
    lng: detectInitialLang(),
    fallbackLng: 'en',
    supportedLngs: ['zh', 'en'],
    interpolation: { escapeValue: false },
    returnNull: false,
  });

export default i18n;
