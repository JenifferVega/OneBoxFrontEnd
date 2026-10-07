import { useState, useEffect, useMemo } from 'react'
import { useAuth } from 'react-oidc-context'
import { useTranslation } from 'react-i18next'
import { api } from '../services/api'
import PlanningChat from './PlanningChat'
import {
  Zap, CheckCircle2, Eye, X, AlertTriangle, Clock,
  MessageCircle, Mail, Users, Hash, TrendingUp, Phone, ListTree, Workflow
} from 'lucide-react'

interface ActionTag {
  label: string; icon?: string; color: string;
}
interface IAAction {
  id: string; projectName: string; type: string;
  badge: string; badgeColor: string; icon: string; iconColor: string;
  detected: string; action: string; actionType: string; actionColor: string;
  tags: ActionTag[]; time: string; status: string; requiresReview: boolean;
  category: 'observation' | 'action'; chipColor: string; createdAt: string;
}

const ChannelIcon = ({ type, className = 'w-3.5 h-3.5' }: { type: string; className?: string }) => {
  switch (type) {
    case 'whatsapp': return <MessageCircle className={`${className} text-green-400`} />
    case 'email': return <Mail className={`${className} text-blue-400`} />
    case 'sms': return <Phone className={`${className} text-sky-400`} />
    case 'slack': return <Hash className={`${className} text-cyan-400`} />
    case 'partners': return <Users className={`${className} text-purple-400`} />
    default: return <MessageCircle className={`${className} text-white/40`} />
  }
}

export default function Intelligence() {
  const auth = useAuth()
  const { t } = useTranslation()
  const token = auth.user?.access_token || ''
  const [actions, setActions] = useState<IAAction[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('all')
  const [filterProject, setFilterProject] = useState<string | null>(null)
  // No channel filter: insights carry no channel field, so the old one was a
  // set of buttons that changed nothing.
  const [filterTime, setFilterTime] = useState<'hoy' | '48h' | 'semana' | 'mes' | 'todo'>('todo')

  const userId = auth.user?.profile?.sub || ''
  // Two tabs: the log of what the AI did, and the planning chat that moves a
  // whole project. The tab lives in the URL so Back and reload keep it.
  const [tab, setTab] = useState<'log' | 'replan'>(() => {
    try { return new URLSearchParams(window.location.search).get('tab') === 'replan' ? 'replan' : 'log' } catch { return 'log' }
  })
  const switchTab = (next: 'log' | 'replan') => {
    setTab(next)
    try {
      const url = new URL(window.location.href)
      if (next === 'replan') url.searchParams.set('tab', 'replan'); else { url.searchParams.delete('tab'); url.searchParams.delete('planProject') }
      window.history.replaceState(window.history.state, '', url.toString())
    } catch { /* ignore */ }
  }
  useEffect(() => {
    if (!token || !userId) return
    const fetchInsights = async () => {
      try {
        setLoading(true)
        const data = await api.getInsights(token)
        if (Array.isArray(data)) {
          setActions(data)
        }
      } catch (err) {
        console.warn('[Intelligence] Error loading insights from API:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchInsights()
  }, [token, userId])

  const projectsList = useMemo(() => {
    const names = new Set(actions.map(a => a.projectName).filter(Boolean))
    return Array.from(names).sort()
  }, [actions])

  // The time filter used to be decorative: it held state and nothing read it.
  const cutoffMs = useMemo(() => {
    const H = 3600_000
    switch (filterTime) {
      case 'hoy':    return Date.now() - 24 * H
      case '48h':    return Date.now() - 48 * H
      case 'semana': return Date.now() - 7 * 24 * H
      case 'mes':    return Date.now() - 30 * 24 * H
      default:       return 0
    }
  }, [filterTime])

  const filtered = useMemo(() => {
    let result = actions
    if (filterType === 'observations') result = result.filter(a => a.category === 'observation')
    if (filterType === 'actions')      result = result.filter(a => a.category === 'action')
    if (filterType === 'review')       result = result.filter(a => a.status === 'review')
    if (filterType === 'errors')       result = result.filter(a => a.status === 'error')
    if (filterProject) result = result.filter(a => a.projectName === filterProject)
    if (cutoffMs > 0) {
      result = result.filter(a => {
        const ts = Date.parse(a.createdAt || '')
        return Number.isNaN(ts) ? true : ts >= cutoffMs
      })
    }
    return result
  }, [filterType, filterProject, cutoffMs, actions])

  // No "accuracy" metric here. The old one was executed/total, and since the
  // backend marked everything executed it always read 100% -- it measured
  // nothing. Measuring whether the AI was RIGHT needs human feedback that
  // this system does not collect yet, so the tiles report plain counts.
  const stats = useMemo(() => ({
    total: actions.length,
    observations: actions.filter(a => a.category === 'observation').length,
    actionsCount: actions.filter(a => a.category === 'action').length,
    review: actions.filter(a => a.status === 'review').length,
    unclassified: actions.filter(a => a.status === 'error').length,
    projects: new Set(actions.map(a => a.projectName).filter(Boolean)).size,
  }), [actions])

  const actionsByType = useMemo(() => {
    const colorMap: Record<string, string> = {
      'task_created':  'bg-violet-500',
      'decision':      'bg-blue-500',
      'followup':      'bg-indigo-500',
      'blocker':       'bg-red-500',
      'risk':          'bg-orange-500',
      'sla':           'bg-red-500',
      'notification':  'bg-sky-500',
      'classification':'bg-teal-500',
      'summary':       'bg-purple-500',
    }
    const counts: Record<string, number> = {}
    actions.forEach(a => { counts[a.type] = (counts[a.type] || 0) + 1 })
    return Object.entries(counts)
      .map(([type, count]) => ({
        label: t(`intelligence.typeLabels.${type}`, type),
        count,
        color: colorMap[type] || 'bg-white/20',
      }))
      .sort((a, b) => b.count - a.count)
  }, [actions, t])

  // Real counts per day. This used to be a hardcoded array, so the chart drew
  // the same bars whether you had zero insights or five hundred.
  const activityDays = useMemo(() => {
    const LETTERS = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
    const days: { day: string; count: number }[] = []
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      days.push({ day: LETTERS[d.getDay()], count: 0 })
    }
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0)
    actions.forEach(a => {
      const ts = Date.parse(a.createdAt || '')
      if (Number.isNaN(ts)) return
      const diff = Math.floor((startOfToday.getTime() - ts) / 86_400_000)
      const idx = 6 - diff
      if (idx >= 0 && idx <= 6) days[idx].count++
    })
    const max = Math.max(1, ...days.map(d => d.count))
    return days.map(d => ({ ...d, value: Math.round((d.count / max) * 100) }))
  }, [actions])

  const tabs = (
    <div className="flex items-center gap-1 px-4 border-b border-white/5 bg-[#0E0E1A] flex-shrink-0">
      {([
        { id: 'log', label: t('intelligence.tabs.log', 'Log'), icon: ListTree },
        { id: 'replan', label: t('intelligence.tabs.replan', 'Replanning'), icon: Workflow },
      ] as const).map(tb => {
        const Icon = tb.icon
        return (
          <button key={tb.id} onClick={() => switchTab(tb.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 -mb-px transition-all ${
                    tab === tb.id ? 'border-violet-500 text-white' : 'border-transparent text-white/50 hover:text-white/80'}`}>
            <Icon className="w-4 h-4" />{tb.label}
          </button>
        )
      })}
    </div>
  )

  if (tab === 'replan') {
    return (
      <div className="flex flex-col h-[calc(100vh-80px)]">
        {tabs}
        <div className="flex-1 min-h-0"><PlanningChat token={token} /></div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
    {tabs}
    <div className="flex flex-1 min-h-0">
      <aside className="w-56 border-r border-white/5 bg-[#0E0E1A] flex-shrink-0 overflow-y-auto">
        <div className="p-4 space-y-6">
          <div>
            <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">{t('intelligence.filters.typeHeader')}</h3>
            {[
              { id: 'all',          label: t('intelligence.filters.typeAll', 'All'),                    count: stats.total,        icon: Zap,          color: 'text-yellow-400' },
              { id: 'observations', label: t('intelligence.filters.typeObservations', 'Observations'),  count: stats.observations, icon: Eye,          color: 'text-sky-300' },
              { id: 'actions',      label: t('intelligence.filters.typeActions', 'Actions'),            count: stats.actionsCount, icon: CheckCircle2, color: 'text-emerald-400' },
              { id: 'review',       label: t('intelligence.filters.typeNeedsReview', 'Needs review'),   count: stats.review,       icon: Eye,          color: 'text-amber-400' },
              { id: 'errors',       label: t('intelligence.filters.typeErrors', 'Failed'),              count: stats.unclassified, icon: X,            color: 'text-red-400' },
            ].map(f => {
              const Icon = f.icon
              return (
                <button
                  key={f.id}
                  onClick={() => setFilterType(f.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                    filterType === f.id ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/70 hover:bg-white/5'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon className={`w-3.5 h-3.5 ${f.color}`} />
                    {f.label}
                  </span>
                  <span className="text-xs text-white/30">{f.count}</span>
                </button>
              )
            })}
          </div>

          <div>
            <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">{t('intelligence.filters.projectHeader')}</h3>
            {projectsList.map(name => (
              <button
                key={name}
                onClick={() => setFilterProject(filterProject === name ? null : name)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                  filterProject === name ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/70 hover:bg-white/5'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${
                  name.includes('WordPress') ? 'bg-emerald-400' :
                  name.includes('ADS') ? 'bg-red-400' :
                  name.includes('AWS') ? 'bg-orange-400' :
                  name.includes('Recruiting') ? 'bg-blue-400' :
                  name.includes('Support') ? 'bg-cyan-400' : 'bg-purple-400'
                }`} />
                <span className="truncate">{name}</span>
              </button>
            ))}
          </div>

        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">{t('intelligence.title')}</h1>
            <p className="text-sm text-white/40 mt-1">
              {loading ? t('intelligence.loading') : t('intelligence.subtitle', { count: actions.length })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {([
              { id: 'todo',   labelKey: 'all' },
              { id: 'hoy',    labelKey: 'today' },
              { id: '48h',    labelKey: 'last48h' },
              { id: 'semana', labelKey: 'thisWeek' },
              { id: 'mes',    labelKey: 'thisMonth' },
            ] as const).map(pill => (
              <button
                key={pill.id}
                onClick={() => setFilterTime(pill.id as typeof filterTime)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  filterTime === pill.id
                    ? 'bg-white/10 text-white border-white/20'
                    : 'text-white/40 border-white/5 hover:border-white/10'
                }`}
              >
                {t(`intelligence.period.${pill.labelKey}`, pill.labelKey === 'all' ? 'All' : pill.labelKey)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4 mb-6">
          {[
            { icon: Zap,         value: stats.total,        label: t('intelligence.metrics.processed', 'Insights'),        color: 'text-white/60' },
            { icon: Eye,         value: stats.observations, label: t('intelligence.metrics.observations', 'Observations'), color: 'text-sky-300' },
            { icon: CheckCircle2, value: stats.actionsCount, label: t('intelligence.metrics.actions', 'Actions'),           color: 'text-emerald-400' },
            { icon: TrendingUp,  value: stats.projects,     label: t('intelligence.metrics.projects', 'Projects'),         color: 'text-violet-400' },
            { icon: X,           value: stats.review + stats.unclassified, label: t('intelligence.metrics.needsAttention', 'Need attention'), color: 'text-amber-400' },
          ].map((stat, i) => {
            const Icon = stat.icon
            return (
              <div key={i} className="bg-[#161625] rounded-xl p-4 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                  <span className={`text-2xl font-bold ${stat.color}`}>{stat.value}</span>
                </div>
                <p className="text-[11px] text-white/30">{stat.label}</p>
              </div>
            )
          })}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-white/40">{t('intelligence.loading')}</p>
            </div>
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <Zap className="w-12 h-12 text-white/10" />
              <p className="text-sm text-white/40">{t('intelligence.empty')}</p>
            </div>
          </div>
        )}
        <div className="space-y-4">
          {filtered.map(action => (
            <div key={action.id} className="bg-[#161625] rounded-xl border border-white/5 p-5 hover:border-white/10 transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${action.iconColor}`}>
                    {action.icon}
                  </div>
                  <span className="text-sm font-bold text-violet-400">{action.projectName}</span>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${action.badgeColor}`}>
                    {action.badge}
                  </span>
                </div>
                {action.requiresReview && (
                  <button className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg text-xs font-bold hover:bg-amber-500/30 transition-all">
                    <Eye className="w-3.5 h-3.5" /> {t('intelligence.reviewBtn')}
                  </button>
                )}
                {action.status === 'error' && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs font-bold">
                    <X className="w-3.5 h-3.5" /> {t('intelligence.unclassified')}
                  </span>
                )}
              </div>

              <div className="flex items-start gap-2 mb-2">
                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0">{t('intelligence.actionCard.detected')}</span>
                <p className="text-sm text-white/80">{action.detected}</p>
              </div>

              <div className="flex items-start gap-2 mb-3 pl-4 border-l-2 border-white/10 ml-1">
                {/* Full class strings, never interpolated. Tailwind scans the
                    source as text at build time, so `bg-${x}-500/10` produces
                    no CSS at all -- the badge silently lost its background. */}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0 ${action.chipColor}`}>
                  {action.actionType}
                </span>
                <p className="text-sm text-white/50">{action.action}</p>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  {action.tags.map((tag, i) => (
                    <span key={i} className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium ${tag.color}`}>
                      {tag.icon && <ChannelIcon type={tag.icon} className="w-3 h-3" />}
                      {tag.label}
                    </span>
                  ))}
                </div>
                <span className="text-[11px] text-white/30">{action.time}</span>
              </div>
            </div>
          ))}
        </div>
      </main>

      <aside className="w-72 border-l border-white/5 bg-[#0E0E1A] flex-shrink-0 overflow-y-auto p-4 space-y-6">
        {/* This used to be a big "accuracy" percentage. It was executed/total,
            and since every insight was marked executed it always read 100%.
            A number that cannot go down is not a measurement. Until the
            product collects human feedback on whether the AI was right, the
            honest thing to show is the split it actually knows. */}
        <div className="text-center">
          <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">
            {t('intelligence.rightPanel.breakdownTitle', 'What the AI produced')}
          </h3>
          <div className="text-6xl font-black text-white">{stats.total}</div>
          <p className="text-xs text-white/40 mt-2">
            {t('intelligence.rightPanel.breakdownDetail', 'insights across {{projects}} project(s)', { projects: stats.projects })}
          </p>
          <div className="flex items-center justify-center gap-3 mt-3 text-xs">
            <span className="text-sky-300">{stats.observations} {t('intelligence.metrics.observations', 'observations')}</span>
            <span className="text-white/20">|</span>
            <span className="text-emerald-400">{stats.actionsCount} {t('intelligence.metrics.actions', 'actions')}</span>
          </div>
        </div>

        <div>
          <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">{t('intelligence.rightPanel.actionsByType')}</h3>
          <div className="space-y-2.5">
            {actionsByType.map((a, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-sm ${a.color} flex-shrink-0`} />
                <span className="text-xs text-white/60 flex-1">{a.label}</span>
                <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${a.color}`} style={{ width: `${(a.count / Math.max(...actionsByType.map(x => x.count), 1)) * 100}%` }} />
                </div>
                <span className="text-xs font-bold text-white/50 w-6 text-right">{a.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">{t('intelligence.rightPanel.activity7days')}</h3>
          <div className="flex items-end gap-1.5 h-16">
            {activityDays.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  title={`${d.count}`}
                  className={`w-full rounded-sm transition-all ${i === activityDays.length - 1 ? 'bg-violet-500' : 'bg-white/10'}`}
                  style={{ height: `${Math.max(2, (d.value / 100) * 48)}px` }}
                />
                <span className="text-[9px] text-white/30">{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">{t('intelligence.rightPanel.activeProjects')}</h3>
          <div className="space-y-3">
            {projectsList.length > 0 ? projectsList.map((name, i) => {
              const count = actions.filter(a => a.projectName === name).length
              return (
                <button
                  key={i}
                  onClick={() => setFilterProject(filterProject === name ? null : name)}
                  className={`w-full bg-white/5 rounded-lg p-3 text-left hover:bg-white/10 transition-all ${
                    filterProject === name ? 'ring-1 ring-violet-500/50' : ''
                  }`}
                >
                  <p className="text-xs text-white/70 font-medium">{name}</p>
                  <p className="text-[10px] text-white/30 mt-1">{t('intelligence.rightPanel.registeredActions', { count })}</p>
                </button>
              )
            }) : (
              <p className="text-xs text-white/30">{t('intelligence.noAiActivity')}</p>
            )}
          </div>
        </div>
      </aside>
    </div>
    </div>
  )
}
