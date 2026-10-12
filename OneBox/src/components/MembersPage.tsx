// ============================================================================
// MembersPage.tsx — every person in the projects you own, with the follow-up
// state the system acts on (late, due, waiting on you, paused, no account…),
// and their recent updates in a window. GET /api/team/status, /api/team/updates.
// Same rules as the follow-up itself (backend api/services/team.py).
// ============================================================================
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { useTranslation } from 'react-i18next'
import {
  Users, Loader2, RefreshCw, X, MessageSquareText, BellOff, BellRing, Workflow, AlertTriangle, ChevronDown, ChevronRight,
} from 'lucide-react'
import { api, TeamRow, TeamState, TeamUpdates } from '../services/api'
import { openPlanning } from '../planningPanel'

const STATE_STYLE: Record<TeamState, string> = {
  late: 'bg-red-500/15 text-red-300 border-red-500/30',
  due: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  waiting_you: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  ok: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
  paused: 'bg-white/5 text-white/50 border-white/10',
  no_account: 'bg-white/5 text-white/50 border-white/10',
  no_tasks: 'bg-white/5 text-white/35 border-white/10',
  owner: 'bg-sky-500/10 text-sky-300 border-sky-500/25',
}
const STATE_ORDER: TeamState[] = ['late', 'due', 'waiting_you', 'ok', 'no_account', 'paused', 'no_tasks', 'owner']
const FILTERS: (TeamState | 'all')[] = ['all', 'late', 'due', 'waiting_you', 'no_account', 'paused']

function since(iso: string, t: (k: string, o?: any) => string): string {
  if (!iso) return t('members.never', 'never')
  const days = Math.floor((Date.now() - new Date(iso.endsWith('Z') ? iso : iso + 'Z').getTime()) / 86_400_000)
  if (days <= 0) return t('members.today', 'today')
  if (days === 1) return t('members.yesterday', 'yesterday')
  return t('members.daysAgo', { count: days, defaultValue: `${days} days ago` })
}

export default function MembersPage() {
  const auth = useAuth()
  const token = auth.user?.access_token || ''
  const { t } = useTranslation()
  const [rows, setRows] = useState<TeamRow[]>([])
  const [projects, setProjects] = useState<{ projectId: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [project, setProject] = useState('')
  const [filter, setFilter] = useState<TeamState | 'all'>('all')
  const [viewing, setViewing] = useState<TeamRow | null>(null)
  const [busyKey, setBusyKey] = useState('')

  const load = async () => {
    if (!token) return
    setLoading(true); setError('')
    try {
      const r = await api.getTeamStatus(token)
      setRows(r.rows); setProjects(r.projects)
    } catch (e: any) {
      setError(String(e?.message || e).slice(0, 200))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [token])   // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => rows.filter(r => (!project || r.projectId === project) && r.state !== 'owner'), [rows, project])
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: visible.length }
    visible.forEach(r => { c[r.state] = (c[r.state] || 0) + 1 })
    return c
  }, [visible])

  // One card per person (email, or name for people without email).
  const people = useMemo(() => {
    const g = new Map<string, { name: string; email: string; rows: TeamRow[] }>()
    visible.filter(r => filter === 'all' || r.state === filter).forEach(r => {
      const id = r.email || r.name.toLowerCase()
      if (!g.has(id)) g.set(id, { name: r.name, email: r.email, rows: [] })
      g.get(id)!.rows.push(r)
    })
    const worst = (rs: TeamRow[]) => Math.min(...rs.map(r => STATE_ORDER.indexOf(r.state)))
    return Array.from(g.values())
      .map(p => ({ ...p, rows: p.rows.sort((a, b) => STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state)) }))
      .sort((a, b) => worst(a.rows) - worst(b.rows) || a.name.localeCompare(b.name))
  }, [visible, filter])

  const togglePause = async (r: TeamRow) => {
    setBusyKey(r.projectId + r.key)
    try {
      await api.setFollowUp(r.projectId, { person: r.key, paused: r.state !== 'paused' }, token)
      await load()
    } catch (e: any) {
      setError(String(e?.message || e).slice(0, 200))
    } finally {
      setBusyKey('')
    }
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
          <Users className="w-5 h-5 text-violet-400" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white">{t('members.title', 'Members')}</h1>
          <p className="text-sm text-white/50">{t('members.subtitle', 'How each person is doing with their updates, in the projects you own.')}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select value={project} onChange={e => setProject(e.target.value)}
                  className="bg-[#161625] border border-white/10 rounded-lg px-3 py-2 text-sm text-white max-w-xs">
            <option value="">{t('members.allProjects', 'All projects')}</option>
            {projects.map(p => <option key={p.projectId} value={p.projectId}>{p.name}</option>)}
          </select>
          <button onClick={load} disabled={loading} className="p-2 rounded-lg border border-white/10 text-white/60 hover:text-white disabled:opacity-40"
                  title={t('members.refresh', 'Refresh')}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-all ${filter === f
                    ? 'bg-violet-500/20 border-violet-500/40 text-white' : 'border-white/10 text-white/60 hover:text-white'}`}>
            {t(`members.state.${f}`, f)} <span className="text-white/40">{counts[f] || 0}</span>
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-300 mb-4">{error}</p>}
      {loading && !rows.length && (
        <p className="text-sm text-white/40 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{t('members.loading', 'Loading…')}</p>
      )}
      {!loading && !people.length && !error && (
        <p className="text-sm text-white/40">{t('members.empty', 'Nobody here with this filter.')}</p>
      )}

      <div className="space-y-3">
        {people.map(person => (
          <div key={person.email || person.name} className="bg-[#12121E] border border-white/10 rounded-2xl p-4">
            <div className="flex items-baseline gap-2 mb-2">
              <h2 className="text-sm font-semibold text-white">{person.name}</h2>
              <span className="text-xs text-white/40">{person.email || t('members.noEmail', 'no email')}</span>
            </div>
            <div className="divide-y divide-white/5">
              {person.rows.map(r => (
                <div key={r.projectId} className="py-2.5 flex items-center gap-3 flex-wrap">
                  <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${STATE_STYLE[r.state]}`}>
                    {t(`members.state.${r.state}`, r.state)}
                  </span>
                  <span className="text-sm text-white/85 min-w-[160px] truncate">{r.projectName}</span>
                  <span className="text-xs text-white/50">
                    {t('members.openTasks', { count: r.openTasks, defaultValue: `${r.openTasks} open` })}
                    {r.overdue > 0 && <span className="text-red-300"> · {t('members.overdue', { count: r.overdue, defaultValue: `${r.overdue} overdue` })}</span>}
                  </span>
                  <span className="text-xs text-white/40">
                    {t('members.lastUpdate', 'Last update')}: {since(r.lastUpdateAt, t)}
                    {r.openUpdate && <span className="text-sky-300"> · {t('members.updating', 'updating now')}</span>}
                  </span>
                  {r.state === 'waiting_you' && r.waitingOnYou.length > 0 && (
                    <span className="text-xs text-violet-300 flex items-center gap-1 basis-full md:basis-auto">
                      <AlertTriangle className="w-3 h-3" />
                      {r.waitingOnYou.some(w => w.kind === 'approval')
                        ? t('members.waitingApproval', { count: r.waitingOnYou.filter(w => w.kind === 'approval').length, defaultValue: 'Reported done: waiting for your approval' })
                        : r.waitingOnYou[0].text || t('members.waitingOther', 'Waiting on someone else')}
                    </span>
                  )}
                  {r.state === 'paused' && r.pausedUntil && (
                    <span className="text-xs text-white/40">{t('members.pausedUntil', { date: r.pausedUntil, defaultValue: `until ${r.pausedUntil}` })}</span>
                  )}
                  <div className="ml-auto flex items-center gap-1">
                    <button onClick={() => setViewing(r)} disabled={!r.updates && !r.openUpdate}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-white/70 hover:text-white hover:bg-white/5 disabled:opacity-30"
                            title={t('members.viewUpdates', 'See their updates')}>
                      <MessageSquareText className="w-3.5 h-3.5" />{r.updates}
                    </button>
                    {!r.isOwner && r.state !== 'no_tasks' && (
                      <button onClick={() => togglePause(r)} disabled={busyKey === r.projectId + r.key}
                              className="p-1.5 rounded-lg text-white/50 hover:text-amber-300 hover:bg-white/5 disabled:opacity-30"
                              title={r.state === 'paused' ? t('members.resume', 'Resume follow-up') : t('members.pause', 'Pause follow-up')}>
                        {r.state === 'paused' ? <BellRing className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    <button onClick={() => openPlanning({ projectId: r.projectId, lock: true })}
                            className="p-1.5 rounded-lg text-white/50 hover:text-violet-300 hover:bg-white/5"
                            title={t('members.openPlanning', 'Open the project in Replanning')}>
                      <Workflow className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {viewing && <UpdatesModal row={viewing} token={token} onClose={() => setViewing(null)} />}
    </div>
  )
}

const TYPE_STYLE: Record<string, string> = {
  done: 'text-emerald-300', progress: 'text-sky-300', blocker: 'text-red-300', date_change: 'text-amber-300',
  plan: 'text-violet-300', not_started: 'text-white/50', idea: 'text-white/60', question: 'text-white/60', hearsay: 'text-white/50',
}

function UpdatesModal({ row, token, onClose }: { row: TeamRow; token: string; onClose: () => void }) {
  const { t } = useTranslation()
  const [data, setData] = useState<TeamUpdates | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})

  useEffect(() => {
    api.getTeamUpdates(row.projectId, row.key, token).then(setData).catch(e => setError(String(e?.message || e).slice(0, 200)))
  }, [row, token])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#12121E] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-white/5 flex items-start gap-3">
          <MessageSquareText className="w-5 h-5 text-violet-400 mt-0.5" />
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-white">{t('members.updatesTitle', { name: row.name, defaultValue: `Updates from ${row.name}` })}</h3>
            <p className="text-xs text-white/40">{row.projectName}</p>
          </div>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/5"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!data && !error && <p className="text-sm text-white/40 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{t('members.loading', 'Loading…')}</p>}
          {error && <p className="text-sm text-red-300">{error}</p>}
          {data && !data.updates.length && <p className="text-sm text-white/40">{t('members.noUpdates', 'No updates yet.')}</p>}
          {data?.updates.map(u => (
            <div key={u.sessionId || u.createdAt} className="bg-[#161625] border border-white/5 rounded-xl p-3">
              <div className="flex items-center gap-2 text-xs text-white/40 mb-2">
                <span>{(u.closedAt || u.createdAt).slice(0, 16).replace('T', ' ')}</span>
                {u.status === 'open' && <span className="text-sky-300">{t('members.inProgress', 'in progress')}</span>}
                {u.consolidatedAt && <span>· {t('members.consolidated', 'in a daily summary')}</span>}
              </div>
              {u.items.length > 0 ? (
                <ul className="space-y-1">
                  {u.items.map((i, n) => (
                    <li key={n} className="text-sm text-white/80">
                      <span className={`text-[10px] font-semibold uppercase mr-1.5 ${TYPE_STYLE[i.type] || 'text-white/50'}`}>
                        {t(`members.itemType.${i.type}`, i.type)}
                      </span>
                      {i.text}
                      {(i.task_text || i.due_date || i.owner) && (
                        <span className="text-xs text-white/40">
                          {i.task_text ? ` · «${i.task_text}»` : ''}{i.due_date ? ` · ${i.due_date}` : ''}
                          {i.type === 'blocker' && i.owner ? ` · ${t('members.needs', { who: i.owner, defaultValue: `needs ${i.owner}` })}` : ''}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-xs text-white/40">{t('members.noItems', 'Nothing recorded.')}</p>}
              {u.messages.length > 0 && (
                <button onClick={() => setOpen(o => ({ ...o, [u.sessionId]: !o[u.sessionId] }))}
                        className="mt-2 text-xs text-white/50 hover:text-white flex items-center gap-1">
                  {open[u.sessionId] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  {t('members.conversation', { count: u.messages.length, defaultValue: `Conversation (${u.messages.length})` })}
                </button>
              )}
              {open[u.sessionId] && (
                <div className="mt-2 space-y-1.5">
                  {u.messages.map((m, n) => (
                    <p key={n} className={`text-xs whitespace-pre-wrap rounded-lg px-2.5 py-1.5 ${m.role === 'assistant'
                      ? 'bg-white/5 text-white/70' : 'bg-violet-600/20 text-white/90 ml-6'}`}>{m.content}</p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
