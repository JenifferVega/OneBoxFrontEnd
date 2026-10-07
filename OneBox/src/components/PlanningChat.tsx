import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Send, Paperclip, FileText, Trello, RefreshCw, CheckCircle2, XCircle, Undo2,
  Loader2, ChevronDown, ChevronRight, AlertTriangle, StickyNote, HelpCircle, Inbox,
} from 'lucide-react'
import {
  api, PlanningState, PlanningProposal, PlanningMessage, PlanningOperation, PlanningJob,
} from '../services/api'

/**
 * Intelligence > Replanificación: the planning chat of one project.
 *
 * The owner asks ONE thing here: replan the project with new context (a
 * message, pasted text, a document, the Trello board). Every run ends in a
 * PROPOSAL that the owner approves (all or a part) with the buttons, rejects,
 * and can revert. The daily digest of the members' updates lands here too,
 * with its own proposal ("Consolidate updates" runs it now).
 * Runs take minutes: the page polls the job and shows the step it is on.
 */

interface Props { token: string }
interface ProjectLite { projectId: string; name: string; trelloBoardId?: string }

const OP_ORDER: PlanningOperation['op'][] = ['create', 'update', 'close', 'block', 'reopen', 'delete', 'link']
const OP_STYLE: Record<string, string> = {
  create: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  update: 'text-sky-300 bg-sky-500/10 border-sky-500/20',
  close: 'text-violet-300 bg-violet-500/10 border-violet-500/20',
  block: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  reopen: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  delete: 'text-red-300 bg-red-500/10 border-red-500/20',
  link: 'text-white/60 bg-white/5 border-white/10',
}
const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-300',
  applied: 'bg-emerald-500/15 text-emerald-300',
  partially_applied: 'bg-emerald-500/15 text-emerald-300',
  rejected: 'bg-white/10 text-white/50',
  reverted: 'bg-white/10 text-white/50',
  stale: 'bg-red-500/15 text-red-300',
  superseded: 'bg-white/10 text-white/40',
}

export default function PlanningChat({ token }: Props) {
  const { t } = useTranslation()
  const [projects, setProjects] = useState<ProjectLite[]>([])
  const [projectId, setProjectId] = useState<string>(() => {
    try { return new URLSearchParams(window.location.search).get('planProject') || '' } catch { return '' }
  })
  const [state, setState] = useState<PlanningState | null>(null)
  const [job, setJob] = useState<PlanningJob | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [message, setMessage] = useState('')
  const [showContext, setShowContext] = useState(false)
  const [context, setContext] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [includeTrello, setIncludeTrello] = useState(false)
  const [rereadAll, setRereadAll] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!token) return
    api.getProjects(token).then((data: ProjectLite[]) => {
      if (!Array.isArray(data)) return
      setProjects(data)
      setProjectId(prev => prev && data.some(p => p.projectId === prev) ? prev : (data[0]?.projectId || ''))
    }).catch(() => setError(t('intelligence.planning.errors.projects', 'Could not load projects')))
  }, [token, t])

  // Keep the project in the URL so Back / reload land on the same chat.
  useEffect(() => {
    if (!projectId) return
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('planProject', projectId)
      window.history.replaceState(window.history.state, '', url.toString())
    } catch { /* ignore */ }
  }, [projectId])

  const load = useCallback(async () => {
    if (!projectId || !token) return
    try {
      const s = await api.getPlanning(projectId, token)
      setState(s)
      setError('')
      if (s.job) setJob(j => j && j.jobId === s.job!.jobId ? j : { jobId: s.job!.jobId, status: 'running', step: s.job!.step, steps: [], error: '', seconds: 0 })
    } catch (e: any) {
      setError(String(e?.message || e).slice(0, 300))
    }
  }, [projectId, token])

  useEffect(() => { setState(null); setJob(null); load() }, [load])

  // Poll the running job; reload the conversation when it ends.
  useEffect(() => {
    if (!job || job.status !== 'running' || !projectId) return
    const id = window.setInterval(async () => {
      try {
        const j = await api.getPlanningJob(projectId, job.jobId, token)
        setJob(j)
        if (j.status !== 'running') { window.clearInterval(id); load() }
      } catch {
        window.clearInterval(id); setJob(null); load()
      }
    }, 3000)
    return () => window.clearInterval(id)
  }, [job?.jobId, job?.status, projectId, token, load])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [state?.messages.length, job?.step])

  const proposalsById = useMemo(() => {
    const m: Record<string, PlanningProposal> = {}
    state?.proposals.forEach(p => { m[p.proposalId] = p })
    return m
  }, [state])

  const running = job?.status === 'running'
  const project = projects.find(p => p.projectId === projectId)

  const send = async () => {
    if (!projectId || running) return
    if (!message.trim() && !context.trim() && !file && !includeTrello) return
    setBusy(true); setError('')
    try {
      const r = await api.sendPlanningMessage(projectId, { message, context, file, includeTrello, rereadAll }, token)
      setJob({ jobId: r.jobId, status: 'running', step: '', steps: [], error: '', seconds: 0 })
      setMessage(''); setContext(''); setFile(null); setIncludeTrello(false); setRereadAll(false); setShowContext(false)
      if (fileRef.current) fileRef.current.value = ''
      await load()
    } catch (e: any) {
      setError(String(e?.message || e).slice(0, 300))
    } finally {
      setBusy(false)
    }
  }

  const consolidate = async () => {
    if (!projectId) return
    setBusy(true); setError('')
    try {
      const r = await api.consolidateUpdates(projectId, token)
      if (r.status === 'nothing') setError(t('intelligence.planning.noUpdates', 'No new member updates to consolidate.'))
    } catch (e: any) {
      setError(String(e?.message || e).slice(0, 300))
    } finally {
      setBusy(false); load()
    }
  }

  const decide = async (p: PlanningProposal, decision: 'approve_all' | 'approve_some' | 'reject_all', indexes: number[] = []) => {
    setBusy(true); setError('')
    try {
      await api.decidePlanningProposal(projectId, p.proposalId, decision, indexes, token)
    } catch (e: any) {
      setError(String(e?.message || e).slice(0, 300))
    } finally {
      setBusy(false); load()
    }
  }

  const revert = async (p: PlanningProposal) => {
    if (!window.confirm(t('intelligence.planning.revertConfirm', 'Revert this replan? Every task it touched goes back to how it was.'))) return
    setBusy(true); setError('')
    try {
      await api.revertPlanningProposal(projectId, p.proposalId, token)
    } catch (e: any) {
      setError(String(e?.message || e).slice(0, 300))
    } finally {
      setBusy(false); load()
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header: project + what this chat is for */}
      <div className="px-6 py-4 border-b border-white/5 flex items-center gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-white">{t('intelligence.planning.title', 'Replanning')}</h2>
          <p className="text-xs text-white/40">{t('intelligence.planning.subtitle', 'Move the whole project at once: give an instruction and context; review the proposal before anything changes.')}</p>
        </div>
        <button onClick={consolidate} disabled={busy || running || !projectId}
                className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-xs text-white/70 hover:text-white disabled:opacity-40"
                title={t('intelligence.planning.consolidateHint', 'Turn the members\' updates into a summary and a proposal now (it also runs once a day)')}>
          <Inbox className="w-4 h-4" />{t('intelligence.planning.consolidate', 'Consolidate updates')}
        </button>
        <select
          value={projectId}
          onChange={e => setProjectId(e.target.value)}
          className="bg-[#161625] border border-white/10 rounded-lg px-3 py-2 text-sm text-white max-w-xs"
        >
          {projects.map(p => <option key={p.projectId} value={p.projectId}>{p.name}</option>)}
        </select>
      </div>

      {/* Conversation */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
        {!state && !error && <p className="text-sm text-white/40">{t('intelligence.loading', 'Loading…')}</p>}
        {state && state.messages.length === 0 && (
          <div className="bg-[#161625] border border-white/5 rounded-xl p-5 text-sm text-white/60 space-y-2">
            <p className="text-white/80 font-medium">{t('intelligence.planning.emptyTitle', 'What can you ask here?')}</p>
            <p>• {t('intelligence.planning.example1', '"Replan with this context" + paste a chat or attach a document')}</p>
            <p>• {t('intelligence.planning.example2', '"Compare the plan with Trello and update it"')}</p>
            <p>• {t('intelligence.planning.example3', '"Everything about Meta is closed; push design back one week"')}</p>
            <p className="text-white/40 text-xs">{t('intelligence.planning.emptyHint', 'Only replanning with context is done here. Nothing changes until you approve the proposal; the members\' daily updates arrive here as well.')}</p>
          </div>
        )}
        {state?.messages.map(m => (
          <MessageBubble
            key={m.itemId} m={m}
            proposal={m.proposalId ? proposalsById[m.proposalId] : undefined}
            taskTexts={state.taskTexts || {}}
            revertible={state.revertible}
            busy={busy || running}
            onDecide={decide} onRevert={revert}
          />
        ))}
        {running && (
          <div className="flex items-center gap-3 text-sm text-white/60 bg-[#161625] border border-white/5 rounded-xl px-4 py-3 w-fit">
            <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
            <span>{t(`intelligence.planning.steps.${job?.step || 'start'}`, job?.step || t('intelligence.planning.steps.start', 'Starting…'))}</span>
            <span className="text-white/30 text-xs">{job?.seconds ? `${job.seconds}s` : ''}</span>
          </div>
        )}
        {job?.status === 'error' && (
          <p className="text-sm text-red-300 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{job.error}</p>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="px-6 pb-2 text-xs text-red-300 break-words">{error}</p>}

      {/* Composer */}
      <div className="border-t border-white/5 px-6 py-4 space-y-3">
        {showContext && (
          <div className="bg-[#161625] border border-white/5 rounded-xl p-3 space-y-3">
            <textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              rows={5}
              placeholder={t('intelligence.planning.contextPlaceholder', 'Paste context: a chat, an email, meeting notes…')}
              className="w-full bg-transparent border border-white/10 rounded-lg p-2 text-sm text-white placeholder-white/30 resize-y"
            />
            <div className="flex items-center gap-4 flex-wrap text-xs text-white/60">
              <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 hover:text-white">
                <Paperclip className="w-3.5 h-3.5" />{file ? file.name : t('intelligence.planning.attach', 'Attach document')}
              </button>
              <input ref={fileRef} type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
              <label className={`flex items-center gap-1.5 ${state?.trello ? 'cursor-pointer hover:text-white' : 'opacity-40 cursor-not-allowed'}`}
                     title={state?.trello ? '' : t('intelligence.planning.noTrello', 'This project has no Trello board linked')}>
                <input type="checkbox" disabled={!state?.trello} checked={includeTrello} onChange={e => setIncludeTrello(e.target.checked)} />
                <Trello className="w-3.5 h-3.5" />{t('intelligence.planning.includeTrello', 'Include Trello board')}
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer hover:text-white"
                     title={t('intelligence.planning.rereadHint', 'Slower and more expensive: reads every document of the project again')}>
                <input type="checkbox" checked={rereadAll} onChange={e => setRereadAll(e.target.checked)} />
                <RefreshCw className="w-3.5 h-3.5" />{t('intelligence.planning.rereadAll', 'Re-read all project documents')}
              </label>
            </div>
          </div>
        )}
        <div className="flex items-end gap-2">
          <button
            onClick={() => setShowContext(v => !v)}
            className={`p-2.5 rounded-lg border ${showContext || context || file || includeTrello || rereadAll ? 'border-violet-500/40 text-violet-300' : 'border-white/10 text-white/50'} hover:text-white`}
            title={t('intelligence.planning.context', 'Context')}
          >
            <FileText className="w-4 h-4" />
          </button>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send() }}
            rows={2}
            disabled={running || !projectId}
            placeholder={t('intelligence.planning.placeholder', { project: project?.name || '', defaultValue: 'E.g. "Replan the whole project with this context"' })}
            className="flex-1 bg-[#161625] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 resize-none disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={running || busy || !projectId}
            className="p-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40"
            title={t('intelligence.planning.send', 'Send (Ctrl+Enter)')}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ m, proposal, taskTexts, revertible, busy, onDecide, onRevert }: {
  m: PlanningMessage; proposal?: PlanningProposal; taskTexts: Record<string, string>
  revertible: string | null; busy: boolean
  onDecide: (p: PlanningProposal, d: 'approve_all' | 'approve_some' | 'reject_all', idx?: number[]) => void
  onRevert: (p: PlanningProposal) => void
}) {
  const mine = m.role === 'user'
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] space-y-2 ${mine ? 'items-end' : ''}`}>
        <div className={`rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
          mine ? 'bg-violet-600/30 text-white' : m.error ? 'bg-red-500/10 text-red-200'
            : m.kind === 'updates_digest' ? 'bg-[#161625] text-white/85 border border-sky-500/30'
            : 'bg-[#161625] text-white/80 border border-white/5'
        }`}>
          {m.content}
          {m.sources && m.sources.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {m.sources.map(s => <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/60">{s}</span>)}
            </div>
          )}
        </div>
        {proposal && (
          <ProposalCard p={proposal} taskTexts={taskTexts} canRevert={revertible === proposal.proposalId}
                        busy={busy} onDecide={onDecide} onRevert={onRevert} />
        )}
      </div>
    </div>
  )
}

function ProposalCard({ p, taskTexts, canRevert, busy, onDecide, onRevert }: {
  p: PlanningProposal; taskTexts: Record<string, string>; canRevert: boolean; busy: boolean
  onDecide: (p: PlanningProposal, d: 'approve_all' | 'approve_some' | 'reject_all', idx?: number[]) => void
  onRevert: (p: PlanningProposal) => void
}) {
  const { t } = useTranslation()
  const pending = p.status === 'pending'
  // 1-based indexes, as the backend expects.
  const [selected, setSelected] = useState<Set<number>>(() => new Set(p.operations.map((_o, i) => i + 1)))
  const [open, setOpen] = useState<Record<string, boolean>>({ create: true, update: true, close: true, delete: true })
  const [showNotes, setShowNotes] = useState(false)

  const groups = useMemo(() => {
    const g: Record<string, { op: PlanningOperation; idx: number }[]> = {}
    p.operations.forEach((op, i) => { (g[op.op] = g[op.op] || []).push({ op, idx: i + 1 }) })
    return OP_ORDER.filter(k => g[k]?.length).map(k => ({ kind: k, items: g[k] }))
  }, [p.operations])

  const toggle = (i: number) => setSelected(prev => {
    const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n
  })
  const label = (op: PlanningOperation) => op.text || taskTexts[op.task_id] || op.task_id

  return (
    <div className="bg-[#12121F] border border-white/10 rounded-xl p-4 space-y-3 text-sm">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${STATUS_STYLE[p.status] || ''}`}>
          {t(`intelligence.planning.status.${p.status}`, p.status)}
        </span>
        {p.source && p.source !== 'chat' && <span className="text-[10px] text-white/40">{p.source.replace(/^upload:/, '📄 ')}</span>}
        <span className="text-[10px] text-white/30 ml-auto">{(p.createdAt || '').slice(0, 16).replace('T', ' ')}</span>
      </div>
      {p.summary && <p className="text-white/60 text-xs">{p.summary}</p>}

      {groups.map(g => (
        <div key={g.kind}>
          <button onClick={() => setOpen(o => ({ ...o, [g.kind]: !o[g.kind] }))}
                  className="flex items-center gap-1.5 text-xs text-white/70 font-medium mb-1">
            {open[g.kind] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <span className={`px-2 py-0.5 rounded border text-[10px] uppercase ${OP_STYLE[g.kind]}`}>
              {t(`intelligence.planning.ops.${g.kind}`, g.kind)}
            </span>
            <span className="text-white/40">{g.items.length}</span>
          </button>
          {open[g.kind] && (
            <ul className="space-y-1 pl-5">
              {g.items.map(({ op, idx }) => (
                <li key={idx} className="flex items-start gap-2">
                  {pending && <input type="checkbox" className="mt-1" checked={selected.has(idx)} onChange={() => toggle(idx)} />}
                  <div className="min-w-0">
                    <p className="text-white/85">{label(op)}</p>
                    <p className="text-[11px] text-white/40">
                      {[op.assigned_to && `👤 ${op.assigned_to}`,
                        op.due_date && `📅 ${op.due_date}${op.date_status === 'committed' ? '' : ' (est.)'}`,
                        op.duplicate_of && `= ${taskTexts[op.duplicate_of] || op.duplicate_of}`,
                        op.reason].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {p.questions.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 space-y-1">
          <p className="text-xs text-amber-300 flex items-center gap-1.5"><HelpCircle className="w-3.5 h-3.5" />
            {t('intelligence.planning.questions', 'Questions for you — decide when approving, or replan here with the answer as context')}</p>
          {p.questions.map(q => <p key={q.id} className="text-xs text-white/70">• {q.text}</p>)}
        </div>
      )}

      {p.notes.length > 0 && (
        <div>
          <button onClick={() => setShowNotes(v => !v)} className="text-xs text-white/50 flex items-center gap-1.5">
            <StickyNote className="w-3.5 h-3.5" />{t('intelligence.planning.notes', { count: p.notes.length, defaultValue: `${p.notes.length} notes` })}
          </button>
          {showNotes && p.notes.map((n, i) => (
            <p key={i} className="text-[11px] text-white/50 pl-5">[{n.kind}] {n.date ? `${n.date} · ` : ''}{n.text}</p>
          ))}
        </div>
      )}

      {pending && (
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <button disabled={busy || (p.operations.length > 0 && selected.size === 0)}
                  onClick={() => selected.size === p.operations.length ? onDecide(p, 'approve_all') : onDecide(p, 'approve_some', Array.from(selected).sort((a, b) => a - b))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs disabled:opacity-40">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {selected.size === p.operations.length
              ? t('intelligence.planning.approveAll', 'Approve all')
              : t('intelligence.planning.approveSome', { count: selected.size, defaultValue: `Approve ${selected.size}` })}
          </button>
          <button disabled={busy} onClick={() => onDecide(p, 'reject_all')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-white/70 hover:text-white text-xs disabled:opacity-40">
            <XCircle className="w-3.5 h-3.5" />{t('intelligence.planning.reject', 'Reject')}
          </button>
        </div>
      )}
      {canRevert && (
        <button disabled={busy} onClick={() => onRevert(p)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-white/70 hover:text-white text-xs disabled:opacity-40">
          <Undo2 className="w-3.5 h-3.5" />{t('intelligence.planning.revert', 'Revert this replan')}
        </button>
      )}
    </div>
  )
}
