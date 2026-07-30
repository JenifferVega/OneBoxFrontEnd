// ============================================================================
// i18n.ts — Configuración de internacionalización (react-i18next).
// ----------------------------------------------------------------------------
// FASE 0 (plumbing): la infraestructura está lista pero NINGUNA traducción
// se aplica todavía. Todos los strings visibles siguen hardcoded en JSX.
// Cambiar el idioma desde el dropdown no muestra nada distinto hasta que
// empecemos a reemplazar strings por t('key') en fases siguientes.
//
// Cómo funciona el fallback (seguridad para "no romper nada"):
//   - Idioma inicial: se lee de localStorage ('onebox_locale') o 'es' por defecto.
//   - Si una key no existe en el diccionario del idioma actual → retorna el
//     valor por defecto que se pase a t() (ej: t('foo', 'Texto fallback')).
//   - Si t() se llama sin default → retorna la key literal, pero como en
//     Fase 0 nadie llama t(), esto no aplica.
//   - Si i18n falla al iniciar → los componentes siguen renderizando el JSX
//     hardcoded en español (ningún cambio visible).
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
  return 'es'
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
    },
    lng: getInitialLocale(),
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false, // React ya escapa por defecto
    },
    // Devolver la key literal cuando no hay traducción. Útil en dev para
    // detectar strings no traducidos; en Fase 0 no aplica porque nadie
    // usa t() aún, todo está hardcoded en JSX.
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
  return cur === 'en' ? 'en' : 'es'
}

export default i18n
