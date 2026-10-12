// ============================================================================
// SystemDetails.tsx — Settings > System details: which model each part of the
// agent uses right now, where that came from (NODE_LLM_*, routing table,
// fallback) and which API keys are present. Never shows a secret: keys come
// as present / missing. GET /api/system/info (403 = section hidden).
// ============================================================================
import { useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { useTranslation } from 'react-i18next'
import { Cpu, ChevronDown, ChevronRight, Loader2, AlertTriangle, RefreshCw, PlayCircle, CheckCircle2, XCircle } from 'lucide-react'
import { api, SystemInfo, ModelCheck } from '../services/api'

export default function SystemDetails() {
  const auth = useAuth()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [info, setInfo] = useState<SystemInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hidden, setHidden] = useState(false)
  const [showEnv, setShowEnv] = useState(false)
  const [checks, setChecks] = useState<Record<string, ModelCheck>>({})
  const [checking, setChecking] = useState(false)
  const [checkedAt, setCheckedAt] = useState('')
  const [checkError, setCheckError] = useState('')

  const testModels = async () => {
    const token = auth.user?.access_token
    if (!token) return
    setChecking(true); setCheckError(''); setChecks({})
    try {
      const r = await api.checkModels(token)
      setChecks(Object.fromEntries(r.results.map(c => [c.node, c])))
      setCheckedAt(r.checkedAt)
    } catch (e: any) {
      setCheckError(String(e?.message || e).slice(0, 200))
    } finally {
      setChecking(false)
    }
  }

  const load = async () => {
    const token = auth.user?.access_token
    if (!token) return
    setLoading(true); setError('')
    try {
      setInfo(await api.getSystemInfo(token))
    } catch (e: any) {
      const msg = String(e?.message || e)
      if (msg.includes('403') || msg.includes('Not allowed')) setHidden(true)
      else setError(msg.slice(0, 200))
    } finally {
      setLoading(false)
    }
  }
  const toggle = () => { const next = !open; setOpen(next); if (next && !info) load() }

  if (hidden) return null
  const warnings = (info?.nodes || []).filter(n => n.warning || n.error).length

  return (
    <section className="mt-8 bg-[#12121E] border border-white/10 rounded-2xl p-5">
      <button onClick={toggle} className="w-full flex items-center gap-2 text-left">
        {open ? <ChevronDown className="w-4 h-4 text-white/50" /> : <ChevronRight className="w-4 h-4 text-white/50" />}
        <Cpu className="w-4 h-4 text-violet-400" />
        <h2 className="text-sm font-semibold text-white">{t('settings.system.title', 'System details')}</h2>
        <span className="text-xs text-white/40">{t('settings.system.subtitle', 'Models used by the assistant')}</span>
        {warnings > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5" />{warnings}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {loading && <p className="text-xs text-white/40 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />{t('settings.system.loading', 'Loading…')}</p>}
          {error && <p className="text-xs text-red-400">{error}</p>}
          {info && (
            <>
              <div className="flex items-center gap-3 text-[11px] text-white/40 flex-wrap">
                {info.environment && <span>env: <span className="text-white/70">{info.environment}</span></span>}
                <span>{t('settings.system.started', 'Server started')}: <span className="text-white/70">{info.startedAt.replace('T', ' ')}</span></span>
                <span>Python {info.python}</span>
                <div className="ml-auto flex items-center gap-3">
                <button onClick={testModels} disabled={checking}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-violet-500/20 border border-violet-500/40 text-violet-200 hover:bg-violet-500/30 disabled:opacity-50">
                  {checking ? <Loader2 className="w-3 h-3 animate-spin" /> : <PlayCircle className="w-3 h-3" />}
                  {checking ? t('settings.system.testing', 'Testing…') : t('settings.system.test', 'Test models')}
                </button>
                <button onClick={load} className="flex items-center gap-1 hover:text-white">
                  <RefreshCw className="w-3 h-3" />{t('settings.system.refresh', 'Refresh')}
                </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-white/40 text-left">
                      <th className="py-1.5 pr-3 font-medium">{t('settings.system.part', 'Part')}</th>
                      <th className="py-1.5 pr-3 font-medium">{t('settings.system.model', 'Model')}</th>
                      <th className="py-1.5 pr-3 font-medium">{t('settings.system.source', 'Set by')}</th>
                      <th className="py-1.5 font-medium">{t('settings.system.fallbacks', 'Fallbacks')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {info.nodes.map(n => (
                      <tr key={n.node} className="border-t border-white/5 align-top">
                        <td className="py-2 pr-3">
                          <div className="text-white/85 font-medium">{n.node}</div>
                          <div className="text-white/35 text-[11px]">{t(`settings.system.what.${n.node}`, n.what)}</div>
                        </td>
                        <td className="py-2 pr-3">
                          {n.error ? <span className="text-red-400">{n.error}</span> : (
                            <>
                              <span className="text-violet-300">{n.provider}</span>
                              <span className="text-white/80"> · {n.model}</span>
                              {checks[n.node] ? (checks[n.node].ok ? (
                                <div className="mt-1 flex items-center gap-1 text-emerald-300 whitespace-nowrap" title={checks[n.node].detail}>
                                  <CheckCircle2 className="w-3 h-3 shrink-0" />{t('settings.system.works', 'Works')} · {(checks[n.node].ms / 1000).toFixed(1)} s
                                </div>
                              ) : (
                                <div className="mt-1 text-red-300">
                                  <span className="flex items-center gap-1"><XCircle className="w-3 h-3 shrink-0" />{t('settings.system.fails', 'Fails')}</span>
                                  <div className="text-[11px] text-red-300/70 break-words">{checks[n.node].error}{checks[n.node].detail ? ` · ${checks[n.node].detail}` : ''}</div>
                                </div>
                              )) : checking ? (
                                <div className="mt-1 flex items-center gap-1 text-white/35"><Loader2 className="w-3 h-3 animate-spin" />{t('settings.system.testing', 'Testing…')}</div>
                              ) : null}
                              {n.warning && <div className="mt-1 text-amber-300 flex items-start gap-1"><AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                                {n.warningCode ? t(`settings.system.warn.${n.warningCode}`, { provider: n.provider, wanted: n.wanted, defaultValue: n.warning }) : n.warning}</div>}
                            </>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-white/50">{n.source}</td>
                        <td className="py-2 text-white/50">{n.fallbacks?.length ? n.fallbacks.join(', ') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {(checkedAt || checkError) && (
                <p className={`text-[11px] ${checkError ? 'text-red-400' : 'text-white/40'}`}>
                  {checkError || t('settings.system.testedAt', { time: new Date(checkedAt).toLocaleTimeString(), defaultValue: `Tested at ${new Date(checkedAt).toLocaleTimeString()} with a tiny real call per model (fallbacks off).` })}
                </p>
              )}

              <div>
                <p className="text-[11px] text-white/40 mb-1.5">{t('settings.system.keys', 'API keys (values are never shown)')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(info.keys).map(([k, ok]) => (
                    <span key={k} className={`text-[11px] px-2 py-0.5 rounded-full border ${ok ? 'border-emerald-500/30 text-emerald-300' : 'border-red-500/30 text-red-300'}`}>
                      {ok ? '✓' : '✗'} {k}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <button onClick={() => setShowEnv(v => !v)} className="text-[11px] text-white/50 hover:text-white flex items-center gap-1">
                  {showEnv ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  {t('settings.system.env', 'Model variables in the environment')} ({Object.keys(info.env).length})
                </button>
                {showEnv && (
                  <pre className="mt-2 bg-[#0E0E1A] border border-white/10 rounded-lg p-3 text-[11px] text-white/70 overflow-x-auto">
                    {Object.entries(info.env).map(([k, v]) => `${k}=${v}`).join('\n') || t('settings.system.noEnv', '(none: everything comes from the routing table in the code)')}
                  </pre>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  )
}
