// ============================================================================
// i18n.ts — Internationalization configuration (react-i18next).
// ----------------------------------------------------------------------------
// PHASE 0 (plumbing): the infrastructure is ready but NO translations
// are applied yet. All visible strings are still hardcoded in JSX.
// Changing the language from the dropdown does not show anything different
// until we start replacing strings with t('key') in later phases.
//
// How the fallback works (safety for "don't break anything"):
//   - Initial language: read from localStorage ('onebox_locale') or 'en' by default.
//   - If a key does not exist in the current language dictionary → returns the
//     default value passed to t() (e.g. t('foo', 'Fallback text')).
//   - If t() is called without a default → returns the literal key, but since
//     in Phase 0 nobody calls t(), this does not apply.
//   - If i18n fails to start → components keep rendering the hardcoded JSX
//     (no visible change).
// ============================================================================
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import es from './locales/es.json'
import en from './locales/en.json'

export type AppLocale = 'es' | 'en'

const STORAGE_KEY = 'onebox_locale'

function getInitialLocale(): AppLocale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'es' || saved === 'en') return saved
  } catch {
    /* SSR / private mode */
  }
  return 'en'
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
    },
    lng: getInitialLocale(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes by default
    },
    // Return the literal key when there is no translation. Useful in dev to
    // detect untranslated strings; in Phase 0 it does not apply because nobody
    // uses t() yet, everything is hardcoded in JSX.
    returnEmptyString: false,
  })

export function setAppLocale(lang: AppLocale) {
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    /* no-op */
  }
  i18n.changeLanguage(lang)
}

export function getAppLocale(): AppLocale {
  const cur = i18n.language
  return cur === 'es' ? 'es' : 'en'
}

export default i18n
