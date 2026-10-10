// ============================================================================
// SettingsPage.tsx — The user's own preferences: timezone and language.
// ----------------------------------------------------------------------------
// Stored in the backend (table onebox-users, GET/PUT /api/user/settings), not
// in localStorage: the agent needs the timezone on turns that have no browser
// at all -- WhatsApp messages and scheduled/recurring sends.
//
// The timezone decides what the assistant means by "today", "tomorrow at 9"
// or "every Monday". App.tsx fills it in from the browser on first login, so
// most users never need to open this page.
// ============================================================================
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { useTranslation } from 'react-i18next'
import { Clock, Globe, Check, Loader2, Search, LocateFixed } from 'lucide-react'
import { api } from '../services/api'
import { AppLocale, getAppLocale, setAppLocale } from '../i18n'
import SystemDetails from './SystemDetails'

/** Every IANA zone the browser knows, with a short list if it knows none. */
function allTimezones(): string[] {
  try {
    const list = (Intl as any).supportedValuesOf?.('timeZone') as string[] | undefined
    if (list && list.length) return list
  } catch { /* old browser */ }
  return [
    'America/Bogota', 'America/Tegucigalpa', 'America/Mexico_City', 'America/Lima',
    'America/Santiago', 'America/Argentina/Buenos_Aires', 'America/Caracas',
    'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/Madrid',
    'Europe/London', 'UTC',
  ]
}

export function browserTimezone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || '' } catch { return '' }
}

/** "UTC−05:00" for a zone, right now (so daylight saving is reflected). */
function utcOffset(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
      .formatToParts(new Date())
    const name = parts.find(p => p.type === 'timeZoneName')?.value || ''
    return name === 'GMT' ? 'UTC+00:00' : name.replace('GMT', 'UTC').replace('-', '−')
  } catch {
    return ''
  }
}

function localTime(tz: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: tz, hour: '2-digit', minute: '2-digit', weekday: 'short',
    }).format(new Date())
  } catch {
    return ''
  }
}

const label = (tz: string) => tz.replace(/_/g, ' ')

export default function SettingsPage() {
  const auth = useAuth()
  const { t } = useTranslation()
  const token = auth.user?.access_token || ''

  const zones = useMemo(allTimezones, [])
  const detected = useMemo(browserTimezone, [])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(0)
  const [error, setError] = useState('')

  const [timezone, setTimezone] = useState('')
  const [savedTimezone, setSavedTimezone] = useState('')
  const [language, setLanguage] = useState<AppLocale>(getAppLocale())
  const [savedLanguage, setSavedLanguage] = useState<AppLocale>(getAppLocale())
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!token) return
    let cancelled = false
    api.getUserSettings(token)
      .then(s => {
        if (cancelled) return
        const tz = s.timezone || detected || s.defaults?.timezone || ''
        setTimezone(tz)
        setSavedTimezone(s.timezone || '')
        const lang: AppLocale = s.language === 'es' || s.language === 'en' ? s.language : getAppLocale()
        setLanguage(lang)
        setSavedLanguage(lang)
      })
      .catch(() => {
        if (!cancelled) setError(t('settings.loadError', 'Could not load your settings.'))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token, detected, t])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, '_')
    const list = q ? zones.filter(z => z.toLowerCase().includes(q)) : zones
    return list.slice(0, 80)
  }, [zones, query])

  const dirty = timezone !== savedTimezone || language !== savedLanguage

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const s = await api.updateUserSettings({ timezone, language }, token)
      setSavedTimezone(s.timezone || timezone)
      setSavedLanguage(language)
      setAppLocale(language)
      setSavedAt(Date.now())
    } catch (e: any) {
      setError(t('settings.saveError', 'Could not save. Please try again.'))
      console.error('[settings] save failed', e)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="h-[calc(100vh-56px)] flex items-center justify-center bg-[#0E0E1A]">
        <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-56px)] overflow-y-auto bg-[#0E0E1A]">
      <div className="max-w-xl mx-auto px-4 md:px-8 py-8">
        <h1 className="text-2xl font-bold text-white">{t('settings.title', 'Settings')}</h1>
        <p className="text-sm text-white/40 mt-1">
          {t('settings.subtitle', 'Your preferences. They apply in the app, the chat and WhatsApp.')}
        </p>

        {/* ── Timezone ─────────────────────────────────────────────── */}
        <section className="mt-8 bg-[#12121E] border border-white/10 rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-white">{t('settings.timezone', 'Timezone')}</h2>
          </div>
          <p className="text-xs text-white/40 mt-1.5 leading-relaxed">
            {t('settings.timezoneHint',
               'Used by the assistant for "today", due dates and scheduled messages ("tomorrow at 9", "every Monday").')}
          </p>

          <div className="mt-4 flex items-center justify-between gap-3 bg-white/5 rounded-xl px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-white truncate">{label(timezone)}</div>
              <div className="text-xs text-white/40">{utcOffset(timezone)} · {localTime(timezone)}</div>
            </div>
            {detected && detected !== timezone && (
              <button
                onClick={() => setTimezone(detected)}
                className="flex-shrink-0 flex items-center gap-1.5 text-xs text-violet-300 hover:text-violet-200"
              >
                <LocateFixed className="w-3.5 h-3.5" />
                {t('settings.useDetected', 'Use {{tz}}', { tz: label(detected) })}
              </button>
            )}
          </div>

          <div className="mt-3 relative">
            <Search className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('settings.searchTimezone', 'Search a city or region (e.g. Bogota, Madrid)')}
              className="w-full bg-[#0E0E1A] border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500/50"
            />
          </div>
          <ul className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-white/5 divide-y divide-white/5">
            {matches.map(z => (
              <li key={z}>
                <button
                  onClick={() => setTimezone(z)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                    z === timezone ? 'bg-violet-500/15 text-white' : 'text-white/70 hover:bg-white/5'
                  }`}
                >
                  <span className="truncate">{label(z)}</span>
                  <span className="flex items-center gap-2 flex-shrink-0 text-xs text-white/40">
                    {utcOffset(z)}
                    {z === timezone && <Check className="w-3.5 h-3.5 text-violet-300" />}
                  </span>
                </button>
              </li>
            ))}
            {matches.length === 0 && (
              <li className="px-3 py-3 text-xs text-white/40">
                {t('settings.noTimezone', 'No timezone matches that search.')}
              </li>
            )}
          </ul>
        </section>

        {/* ── Language ─────────────────────────────────────────────── */}
        <section className="mt-4 bg-[#12121E] border border-white/10 rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-white">{t('settings.language', 'Language')}</h2>
          </div>
          <select
            value={language}
            onChange={e => setLanguage(e.target.value as AppLocale)}
            className="mt-3 w-full bg-[#0E0E1A] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50"
          >
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </section>

        {/* ── Save ─────────────────────────────────────────────────── */}
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={save}
            disabled={!dirty || saving || !timezone}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:hover:bg-violet-600 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('settings.save', 'Save')}
          </button>
          {!dirty && savedAt > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <Check className="w-3.5 h-3.5" /> {t('settings.saved', 'Saved')}
            </span>
          )}
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>

        <SystemDetails />
      </div>
    </div>
  )
}
