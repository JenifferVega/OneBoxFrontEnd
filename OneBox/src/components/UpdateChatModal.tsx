import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquareText, Loader2, AlertTriangle, Send, CheckCircle2 } from 'lucide-react'
import { api, CheckinProject } from '../services/api'

/**
 * Mandatory update, as a CHAT. On login, if the person owes an update on a
 * project, this modal blocks the app: they tell how it is going in their own
 * words, the AI asks at most two short questions per turn and closes with a
 * summary. Nothing in the plan changes here: the update is recorded and
 * consolidated for the project owner (daily digest + urgent alerts).
 * The project OWNER (who also has tasks) may postpone it ("Not now");
 * members may not.
 */
interface Props { token: string; userName: string }
type Msg = { role: 'member' | 'assistant'; content: string }

export default function UpdateChatModal({ token, userName }: Props) {
  const { t } = useTranslation()
  const [projects, setProjects] = useState<CheckinProject[]>([])
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [finished, setFinished] = useState(false)
  const [error, setError] = useState('')
  // True while the opening questions are being prepared. The backend may ask
  // the AI to write them on the spot (20-40 s). Until they arrive the input is
  // disabled: the list used to be REPLACED when they came, which erased a
  // message the person had already sent (and the reply then appeared alone).
  const [opening, setOpening] = useState(false)
  const bottom = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLTextAreaElement>(null)
  // A disabled field loses autoFocus: focus it once it can be typed in.
  useEffect(() => { if (!opening) box.current?.focus() }, [opening])

  const load = useCallback(async () => {
    if (!token) return
    try {
      const r = await api.getUpdatesPending(token, userName)
      setProjects(r.projects || [])
    } catch {
      // A failing check never locks anyone out of the app.
      setProjects([])
    }
  }, [token, userName])

  useEffect(() => { load() }, [load])

  const current = projects[0]

  useEffect(() => {
    if (!current) return
    let alive = true
    setMsgs([]); setFinished(false); setError(''); setOpening(true)
    // Never wait forever: after 60 s the person can start anyway with the
    // built-in greeting. If the questions arrive later they are added ABOVE
    // what was already written, never in place of it.
    const giveUp = window.setTimeout(() => { if (alive) setOpening(false) }, 60000)
    api.getUpdateSession(current.projectId, token, userName)
      .then(s => {
        if (!alive) return
        const prepared = (s.messages || []) as Msg[]
        setMsgs(prev => prev.length ? [...prepared, ...prev] : prepared)
      })
      .catch(() => {})
      .finally(() => { if (alive) { window.clearTimeout(giveUp); setOpening(false) } })
    return () => { alive = false; window.clearTimeout(giveUp) }
  }, [current?.projectId, token, userName])

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, sending])

  if (!current) return null

  const send = async () => {
    const text = input.trim()
    if (!text || sending || finished || opening) return
    setInput(''); setError(''); setSending(true)
    setMsgs(m => [...m, { role: 'member', content: text }])
    try {
      const r = await api.sendUpdateMessage(current.projectId, [text], token, userName)
      setMsgs(m => [...m, { role: 'assistant', content: r.reply }])
      if (r.finished) setFinished(true)
    } catch (e: any) {
      setError(String(e?.message || e).slice(0, 300))
      setInput(text)
      setMsgs(m => m.slice(0, -1))
    } finally {
      setSending(false)
    }
  }

  const next = () => setProjects(ps => ps.slice(1))
  const firstName = (current.person || userName || '').split(' ')[0]

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-[#12121E] border border-white/10 rounded-2xl w-full max-w-2xl h-[85vh] flex flex-col">
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center gap-2 text-white">
            <MessageSquareText className="w-5 h-5 text-violet-400" />
            <h2 className="text-lg font-semibold">{t('updates.title', 'How is it going?')}</h2>
            {projects.length > 1 && (
              <span className="ml-auto text-xs text-white/40">{t('checkin.progress', { count: projects.length, defaultValue: `${projects.length} projects left` })}</span>
            )}
            {current.isOwner && !finished && (
              <button onClick={next} className={`${projects.length > 1 ? '' : 'ml-auto '}px-3 py-1 rounded-lg border border-white/10 text-xs text-white/60 hover:text-white`}
                      title={t('updates.laterHint', 'You own this project: you can give your update later')}>
                {t('updates.later', 'Not now')}
              </button>
            )}
          </div>
          <p className="text-sm text-white/50 mt-1">
            <span className="text-white/80 font-medium">{current.projectName}</span> · {t('updates.subtitle', 'Tell it in your own words. Nothing changes in the plan until the project owner approves.')}
          </p>
          {current.urgent && (
            <p className="text-xs text-amber-300 mt-2 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />
              {t('checkin.urgent', 'You have tasks overdue or due in the next days.')}</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {!msgs.length && opening && (
            <div className="flex items-center gap-2 text-sm text-white/50 p-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('updates.preparing', 'Preparing your questions…')}
            </div>
          )}
          {!msgs.length && !opening && (
            <div className="bg-[#161625] border border-white/5 rounded-xl p-4 text-sm text-white/70 space-y-2">
              <p>{t('updates.greeting', { name: firstName, defaultValue: `Hi ${firstName}! How are your things going in this project?` })}</p>
              <ul className="text-xs text-white/40 list-disc pl-5 space-y-0.5">
                {current.tasks.slice(0, 6).map(tk => <li key={tk.taskId}>{tk.text}{tk.dueDate ? ` · ${tk.dueDate}` : ''}</li>)}
                {current.tasks.length > 6 && <li>+{current.tasks.length - 6}</li>}
              </ul>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'member' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                m.role === 'member' ? 'bg-violet-600/80 text-white' : 'bg-[#1C1C2E] border border-white/5 text-white/85'}`}>
                {m.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start"><div className="rounded-2xl px-4 py-2.5 bg-[#1C1C2E] border border-white/5">
              <Loader2 className="w-4 h-4 animate-spin text-white/50" /></div></div>
          )}
          <div ref={bottom} />
        </div>

        <div className="p-4 border-t border-white/5">
          {error && <p className="text-xs text-red-300 mb-2">{error}</p>}
          {finished ? (
            <div className="flex items-center gap-3">
              <p className="text-sm text-emerald-300 flex items-center gap-1.5 flex-1">
                <CheckCircle2 className="w-4 h-4" />{t('updates.done', 'Update recorded. The project owner will review it.')}</p>
              <button onClick={next} className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm">
                {projects.length > 1 ? t('updates.next', 'Next project') : t('updates.close', 'Continue')}
              </button>
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <textarea ref={box} value={input} onChange={e => setInput(e.target.value)} rows={2} autoFocus disabled={opening}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                        placeholder={t('updates.placeholder', 'e.g. "the charts are done, Outlook almost, I need the Azure account"')}
                        className="flex-1 resize-none bg-transparent border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:border-violet-500/50 outline-none" />
              <button onClick={send} disabled={sending || opening || !input.trim()}
                      className="p-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white">
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}
          {!finished && msgs.length > 0 && (
            <p className="text-[11px] text-white/30 mt-2">{t('updates.hint', 'When you are done, say "that\'s all".')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
