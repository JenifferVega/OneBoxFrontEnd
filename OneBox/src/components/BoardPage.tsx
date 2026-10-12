// ============================================================================
// BoardPage.tsx — one board with the tasks of all your projects, as cards in
// status columns (pending / in progress / blocked / done), with a week viewer.
// Drag a card to another column to change its status (same rules as the
// project page: a member must say why, "blocked" asks for the reason).
// Data: GET /api/projects (tasks come inside each project); PUT /api/tasks/{id}.
// ============================================================================
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { useTranslation } from 'react-i18next'
import { KanbanSquare, Loader2, RefreshCw, ChevronLeft, ChevronRight, AlertTriangle, CalendarDays, Ban } from 'lucide-react'
import { api } from '../services/api'

type Status = 'pending' | 'in_progress' | 'blocked' | 'done'
const COLUMNS: Status[] = ['pending', 'in_progress', 'blocked', 'done']
const COLUMN_STYLE: Record<Status, string> = {
  pending: 'border-white/10',
  in_progress: 'border-sky-500/30',
  blocked: 'border-red-500/30',
  done: 'border-emerald-500/30',
}
const DOT: Record<Status, string> = {
  pending: 'bg-white/40', in_progress: 'bg-sky-400', blocked: 'bg-red-400', done: 'bg-emerald-400',
}
const PROJECT_COLORS = ['bg-violet-500/20 text-violet-200', 'bg-sky-500/20 text-sky-200', 'bg-amber-500/20 text-amber-200',
  'bg-emerald-500/20 text-emerald-200', 'bg-pink-500/20 text-pink-200', 'bg-teal-500/20 text-teal-200', 'bg-orange-500/20 text-orange-200']

interface BoardTask {
  id: string; text: string; status: Status; rawStatus: string; dueDate: string; blockedReason: string
  assignee: string; initials: string; projectId: string; projectName: string; isOwner: boolean
  parentTaskId: string; subtasksCount: number; subtasksDone: number
}

const norm = (s: string): Status =>
  s === 'done' || s === 'completed' ? 'done' : s === 'in_progress' ? 'in_progress' : s === 'blocked' ? 'blocked' : 'pending'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
function mondayOf(offsetWeeks: number): Date {
  const d = new Date(); d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offsetWeeks * 7)
  return d
}

export default function BoardPage() {
  const auth = useAuth()
  const token = auth.user?.access_token || ''
  const { t, i18n } = useTranslation()
  const [tasks, setTasks] = useState<BoardTask[]>([])
  const [projects, setProjects] = useState<{ projectId: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [project, setProject] = useState('')
  const [person, setPerson] = useState('')
  const [allWeeks, setAllWeeks] = useState(false)
  const [week, setWeek] = useState(0)              // 0 = this week, 1 = next, -1 = last
  const [showNoDate, setShowNoDate] = useState(true)
  const [dragId, setDragId] = useState('')
  const [overCol, setOverCol] = useState<Status | ''>('')
  const [saving, setSaving] = useState('')

  const load = async () => {
    if (!token) return
    setLoading(true); setError('')
    try {
      const data = await api.getProjects(token)
      const list: any[] = Array.isArray(data) ? data : []
      const active = list.filter(p => p.status !== 'closed' && p.status !== 'archived')
      setProjects(active.map(p => ({ projectId: p.projectId, name: p.name })))
      setTasks(active.flatMap(p => (p.tasks || []).map((tk: any): BoardTask => ({
        id: tk.id, text: tk.text || '', status: norm(tk.status), rawStatus: tk.status, dueDate: tk.dueDate || '',
        blockedReason: tk.blockedReason || '', assignee: tk.assignedTo?.name || '', initials: tk.assignedTo?.initials || '',
        projectId: p.projectId, projectName: p.name, isOwner: p.isOwner !== false,
        parentTaskId: tk.parentTaskId || '', subtasksCount: tk.subtasksCount || 0, subtasksDone: tk.subtasksDone || 0,
      }))))
    } catch (e: any) {
      setError(String(e?.message || e).slice(0, 200))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [token])   // eslint-disable-line react-hooks/exhaustive-deps

  const colorOf = useMemo(() => {
    const m: Record<string, string> = {}
    projects.forEach((p, n) => { m[p.projectId] = PROJECT_COLORS[n % PROJECT_COLORS.length] })
    return m
  }, [projects])

  const people = useMemo(() => Array.from(new Set(tasks.map(tk => tk.assignee).filter(Boolean))).sort(), [tasks])

  const start = mondayOf(week)
  const end = new Date(start); end.setDate(end.getDate() + 6)
  const startIso = iso(start), endIso = iso(end), todayIso = iso(new Date())

  const visible = useMemo(() => tasks.filter(tk => {
    if (project && tk.projectId !== project) return false
    if (person === '__none__' ? tk.assignee : person && tk.assignee !== person) return false
    if (allWeeks) return true
    if (!tk.dueDate) return showNoDate
    if (tk.dueDate >= startIso && tk.dueDate <= endIso) return true
    // Overdue and still open: shown in the current week, so nothing late hides.
    return week === 0 && tk.dueDate < startIso && tk.status !== 'done'
  }), [tasks, project, person, allWeeks, showNoDate, startIso, endIso, week])

  const byCol = useMemo(() => {
    const m: Record<Status, BoardTask[]> = { pending: [], in_progress: [], blocked: [], done: [] }
    visible.forEach(tk => m[tk.status].push(tk))
    COLUMNS.forEach(c => m[c].sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999')))
    return m
  }, [visible])

  const move = async (tk: BoardTask, to: Status) => {
    if (tk.status === to) return
    const data: any = { status: to, projectId: tk.projectId }
    if (to === 'blocked') {
      const r = window.prompt(t('board.blockedPrompt', 'Why is it blocked?'))
      if (!r || !r.trim()) return
      data.blocked_reason = r.trim()
    } else if (tk.status === 'blocked') {
      data.blocked_reason = ''
    }
    // A member's status change must say why (the backend requires it).
    if (!tk.isOwner) {
      const c = window.prompt(t('projects.statusCommentPrompt', 'Add a comment: what happened or why is the status changing?'))
      if (!c || c.trim().length < 3) return
      data.comment = c.trim()
    }
    const before = tasks
    setTasks(ts => ts.map(x => x.id === tk.id ? { ...x, status: to, blockedReason: data.blocked_reason ?? x.blockedReason } : x))
    setSaving(tk.id); setError('')
    try {
      await api.updateTask(tk.id, data, token)
    } catch (e: any) {
      setTasks(before)
      setError(t('board.moveFailed', 'Could not change the status') + ': ' + String(e?.message || e).slice(0, 160))
    } finally {
      setSaving('')
    }
  }

  const fmt = (d: Date) => d.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })
  const weekLabel = week === 0 ? t('board.thisWeek', 'This week') : week === 1 ? t('board.nextWeek', 'Next week')
    : week === -1 ? t('board.lastWeek', 'Last week') : `${fmt(start)} – ${fmt(end)}`

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <KanbanSquare className="w-6 h-6 text-violet-300" />
        <h1 className="text-xl font-semibold text-white">{t('board.title', 'Board')}</h1>
        <span className="text-sm text-white/40">{t('board.subtitle', 'Tasks of all your projects')}</span>
        <button onClick={load} className="ml-auto p-2 rounded-lg hover:bg-white/5 text-white/60" title={t('board.refresh', 'Refresh')}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select value={project} onChange={e => setProject(e.target.value)}
          className="bg-[#161625] border border-white/10 rounded-lg px-3 py-1.5 text-white/80">
          <option value="">{t('board.allProjects', 'All projects')}</option>
          {projects.map(p => <option key={p.projectId} value={p.projectId}>{p.name}</option>)}
        </select>
        <select value={person} onChange={e => setPerson(e.target.value)}
          className="bg-[#161625] border border-white/10 rounded-lg px-3 py-1.5 text-white/80">
          <option value="">{t('board.everyone', 'Everyone')}</option>
          <option value="__none__">{t('board.unassigned', 'Unassigned')}</option>
          {people.map(n => <option key={n} value={n}>{n}</option>)}
        </select>

        <div className="flex items-center gap-1 bg-[#161625] border border-white/10 rounded-lg px-1 py-0.5">
          <button disabled={allWeeks} onClick={() => setWeek(w => w - 1)} className="p-1 rounded hover:bg-white/5 text-white/60 disabled:opacity-30"
            title={t('board.prevWeek', 'Previous week')}><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => { setAllWeeks(false); setWeek(0) }}
            className={`px-2 py-1 rounded flex items-center gap-1.5 ${allWeeks ? 'text-white/40' : 'text-white'}`}>
            <CalendarDays className="w-3.5 h-3.5" />{weekLabel}
            {!allWeeks && <span className="text-white/35 text-xs">{fmt(start)} – {fmt(end)}</span>}
          </button>
          <button disabled={allWeeks} onClick={() => setWeek(w => w + 1)} className="p-1 rounded hover:bg-white/5 text-white/60 disabled:opacity-30"
            title={t('board.nextWeekBtn', 'Next week')}><ChevronRight className="w-4 h-4" /></button>
        </div>
        <button onClick={() => setAllWeeks(a => !a)}
          className={`px-3 py-1.5 rounded-lg border ${allWeeks ? 'bg-violet-500/20 border-violet-500/40 text-violet-200' : 'border-white/10 text-white/60 hover:bg-white/5'}`}>
          {t('board.allDates', 'All dates')}
        </button>
        {!allWeeks && (
          <label className="flex items-center gap-1.5 text-white/60 cursor-pointer select-none">
            <input type="checkbox" checked={showNoDate} onChange={e => setShowNoDate(e.target.checked)} />
            {t('board.noDate', 'Include tasks without a date')}
          </label>
        )}
        {!allWeeks && week === 0 && (
          <span className="text-xs text-white/35">{t('board.overdueNote', 'Overdue tasks are shown in this week')}</span>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4" />{error}
        </div>
      )}

      {loading && !tasks.length ? (
        <div className="flex items-center gap-2 text-white/50"><Loader2 className="w-4 h-4 animate-spin" />{t('board.loading', 'Loading tasks…')}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          {COLUMNS.map(col => (
            <div key={col}
              onDragOver={e => { e.preventDefault(); setOverCol(col) }}
              onDragLeave={() => setOverCol(c => c === col ? '' : c)}
              onDrop={e => {
                e.preventDefault(); setOverCol('')
                const tk = tasks.find(x => x.id === (e.dataTransfer.getData('text/plain') || dragId))
                setDragId('')
                if (tk) move(tk, col)
              }}
              className={`rounded-xl border bg-[#0f0f1a] ${COLUMN_STYLE[col]} ${overCol === col ? 'ring-2 ring-violet-500/50' : ''} min-h-[200px]`}>
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/5">
                <span className={`w-2 h-2 rounded-full ${DOT[col]}`} />
                <span className="text-sm font-medium text-white/85">{t(`board.col.${col}`, col)}</span>
                <span className="ml-auto text-xs text-white/40">{byCol[col].length}</span>
              </div>
              <div className="p-2 space-y-2 max-h-[70vh] overflow-y-auto">
                {byCol[col].length === 0 && (
                  <div className="text-xs text-white/25 text-center py-6">{t('board.empty', 'No tasks')}</div>
                )}
                {byCol[col].map(tk => {
                  const overdue = !!tk.dueDate && tk.dueDate < todayIso && tk.status !== 'done'
                  return (
                    <div key={tk.id} draggable
                      onDragStart={e => { e.dataTransfer.setData('text/plain', tk.id); setDragId(tk.id) }}
                      onDragEnd={() => { setDragId(''); setOverCol('') }}
                      className={`rounded-lg border bg-[#161625] p-3 cursor-grab active:cursor-grabbing transition
                        ${overdue ? 'border-red-500/40' : 'border-white/5'} ${dragId === tk.id ? 'opacity-40' : ''} ${saving === tk.id ? 'animate-pulse' : ''}`}>
                      <div className="flex items-start gap-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${colorOf[tk.projectId] || 'bg-white/10 text-white/60'} truncate max-w-[60%]`}>
                          {tk.projectName}
                        </span>
                        {tk.parentTaskId && <span className="text-[10px] text-white/35">{t('board.subtask', 'subtask')}</span>}
                      </div>
                      <div className={`mt-1.5 text-sm ${tk.status === 'done' ? 'text-white/45 line-through' : 'text-white/90'}`}>{tk.text}</div>
                      {tk.status === 'blocked' && tk.blockedReason && (
                        <div className="mt-1.5 text-xs text-red-300/80 flex items-start gap-1"><Ban className="w-3 h-3 mt-0.5 shrink-0" />{tk.blockedReason}</div>
                      )}
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        {tk.assignee ? (
                          <span className="flex items-center gap-1.5 text-white/60">
                            <span className="w-5 h-5 rounded-full bg-white/10 text-[9px] flex items-center justify-center text-white/80">
                              {tk.initials || tk.assignee.slice(0, 2).toUpperCase()}
                            </span>
                            <span className="truncate max-w-[110px]">{tk.assignee}</span>
                          </span>
                        ) : <span className="text-white/30">{t('board.unassigned', 'Unassigned')}</span>}
                        {tk.subtasksCount > 0 && <span className="text-white/40">{tk.subtasksDone}/{tk.subtasksCount}</span>}
                        {tk.dueDate && (
                          <span className={`ml-auto ${overdue ? 'text-red-300 font-medium' : 'text-white/45'}`}>
                            {overdue && <AlertTriangle className="w-3 h-3 inline mr-0.5 -mt-0.5" />}
                            {new Date(tk.dueDate + 'T00:00:00').toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-white/30">{t('board.hint', 'Drag a card to another column to change its status.')}</p>
    </div>
  )
}
