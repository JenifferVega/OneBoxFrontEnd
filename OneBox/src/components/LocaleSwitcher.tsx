// ============================================================================
// LocaleSwitcher.tsx — Minimal language dropdown (ES/EN).
// ----------------------------------------------------------------------------
// Used from Layout (post-login) and also from LandingPage (pre-login).
// Persists the choice in localStorage via setAppLocale defined in
// src/i18n.ts, so the language is preserved across sessions.
//
// Variant `light`: for light backgrounds (LandingPage). Adjusts colors to
// stay legible on white/light gray. `dark` is the default (used inside
// the dark dashboard).
// ============================================================================
import { useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { useTranslation } from 'react-i18next'
import { api } from '../services/api'
import { Globe } from 'lucide-react'
import { setAppLocale, getAppLocale, AppLocale } from '../i18n'

interface Props {
  variant?: 'dark' | 'light'
}

export default function LocaleSwitcher({ variant = 'dark' }: Props) {
  const { t } = useTranslation()
  const auth = useAuth()
  const [locale, setLocale] = useState<AppLocale>(() => getAppLocale())
  const [open, setOpen] = useState(false)
  const label = locale === 'en' ? 'EN' : 'ES'

  const change = (next: AppLocale) => {
    setAppLocale(next)
    setLocale(next)
    setOpen(false)
    // Logged in: remember it in the profile too, so it follows the user to
    // other devices. Before login (landing page) it stays in this browser.
    const token = auth.user?.access_token
    if (token) api.updateUserSettings({ language: next }, token).catch(() => {})
  }

  const buttonClass = variant === 'light'
    ? 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors text-xs font-semibold'
    : 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white/60 hover:text-white/90 hover:bg-white/5 transition-colors text-xs font-semibold'

  const menuClass = variant === 'light'
    ? 'absolute right-0 top-full mt-1 min-w-[140px] bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50'
    : 'absolute right-0 top-full mt-1 min-w-[140px] bg-[#12121E] border border-white/10 rounded-xl shadow-2xl py-1 z-50'

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        title={t('common.language', 'Language')}
        className={buttonClass}
      >
        <Globe className="w-4 h-4" />
        {label}
      </button>
      {open && (
        <div className={menuClass}>
          <LocaleOption variant={variant} active={locale === 'es'} label="Español" onClick={() => change('es')} />
          <LocaleOption variant={variant} active={locale === 'en'} label="English" onClick={() => change('en')} />
        </div>
      )}
    </div>
  )
}

function LocaleOption({
  variant, active, label, onClick,
}: { variant: 'dark' | 'light'; active: boolean; label: string; onClick: () => void }) {
  const base = 'w-full text-left px-3 py-1.5 text-sm transition-colors'
  const cls = variant === 'light'
    ? active
      ? `${base} text-slate-900 bg-slate-100`
      : `${base} text-slate-600 hover:text-slate-900 hover:bg-slate-50`
    : active
      ? `${base} text-white bg-white/5`
      : `${base} text-white/60 hover:text-white/90 hover:bg-white/5`
  return (
    <button onMouseDown={onClick} className={cls}>
      {label}
    </button>
  )
}
