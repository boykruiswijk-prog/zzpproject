import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import nl from './locales/nl.json';
import en from './locales/en.json';
import de from './locales/de.json';
import fr from './locales/fr.json';

export const supportedLanguages = ['nl', 'en', 'de', 'fr'] as const;
export type SupportedLanguage = typeof supportedLanguages[number];

export const languageNames: Record<SupportedLanguage, string> = {
  nl: 'Nederlands',
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
};

export const languageFlags: Record<SupportedLanguage, string> = {
  nl: '🇳🇱',
  en: '🇬🇧',
  de: '🇩🇪',
  fr: '🇫🇷',
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      nl: { translation: nl },
      en: { translation: en },
      de: { translation: de },
      fr: { translation: fr },
    },
    fallbackLng: 'nl',
    supportedLngs: supportedLanguages as unknown as string[],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['path', 'localStorage'],
      lookupFromPathIndex: 0,
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },
  });

export default i18n;
