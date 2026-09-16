import { useState, useRef, useEffect, useCallback, Fragment } from 'react'
import { useAuth } from 'react-oidc-context'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  Loader2,
  Bot,
  User,
  Minimize2,
  Mail,
  Paperclip,
  AlertCircle,
  RotateCcw
} from 'lucide-react'
import { getUserId, getUserEmail } from '../services/api'

const AGENT_API = import.meta.env.VITE_AGENT_API || 'https://TU-LAMBDA-URL.lambda-url.us-east-1.on.aws/'

interface Message {
  id: string
  type: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  isLoading?: boolean
  toolsUsed?: string[]
}

interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

// ============================================================================
// CHAT PERSISTENCE IN localStorage
// ----------------------------------------------------------------------------
// Both the history (what gets sent to the backend) and the messages (what the
// user sees) are stored locally so they survive a page refresh. The key is
// scoped by uid, so if you log in as someone else in the same browser you see
// a separate chat and don't contaminate anyone else's.
//
// Hard limit: the last MAX_PERSIST entries. Beyond that, the chat rotates
// (only the most recent entries are kept) so we don't blow out localStorage
// (~5MB). Each Message + HistoryMessage is small; 50 entries are typically
// around 30-50KB.
// ============================================================================
const MAX_PERSIST = 50

function storageKey(uid: string, suffix: string): string {
  return `onebox_chat_${suffix}_${uid || 'anon'}`
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function saveToStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* localStorage full or disabled (private mode). Failing silently is OK:
       the chat continues to work in memory, it just won't be persisted. */
  }
}

// Messages are serialized with timestamp as a Date, but going through JSON
// turns it into an ISO string. We have to convert it back or the UI blows up
// when calling .toLocaleTimeString(). This function revives messages loaded
// from storage.
function reviveMessages(arr: any[]): Message[] {
  if (!Array.isArray(arr)) return []
  return arr.map(m => ({
    ...m,
    timestamp: m?.timestamp ? new Date(m.timestamp) : new Date(),
  }))
}

// Are two dates the same day (ignoring time)?
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

// WhatsApp-style day label: "Today", "Yesterday", or "Monday 2 Jun" if it's
// within this week, or "2 Jun 2026" if it's older. Used in the separator
// that appears between messages from different days in the chat.
function getDateLabel(date: Date): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const weekAgo = new Date(today)
  weekAgo.setDate(today.getDate() - 6)

  if (isSameDay(date, today)) return 'Today'
  if (isSameDay(date, yesterday)) return 'Yesterday'
  if (date >= weekAgo) {
    // Within the last week: capitalized weekday name, e.g. "Monday 2 Jun"
    const day = date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' })
    return day.charAt(0).toUpperCase() + day.slice(1)
  }
  // Older: short date
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ChatFloat() {
  // Auth: the chatbot MUST send credentials so the backend isolates data per
  // user. Without this the /chat endpoint returns 401 (critical security fix;
  // before, the agent used a global USER_ID and leaked other users' data).
  const auth = useAuth()
  const { t } = useTranslation()
  // Current logged-in user's uid — used to key localStorage per person, so
  // two accounts on the same browser don't clobber each other's chat. While
  // Cognito is loading it's undefined: during that time we don't read or
  // write storage (waiting for a real uid avoids corrupting data or loading
  // the wrong chat).
  const uid = auth.user?.profile?.sub || ''
  const isReady = !!uid

  const WELCOME_MESSAGE: Message = {
    id: '1',
    type: 'assistant',
    content: t('chat.welcome'),
    timestamp: new Date()
  }

  const [open, setOpen] = useState(false)
  // Initial state without touching localStorage. Once uid is ready, an
  // effect loads what was saved. This way we avoid: (1) reading the 'anon'
  // key by mistake, and (2) the initial render breaking if the stored data
  // has timestamps serialized as strings.
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [processing, setProcessing] = useState(false)
  const [agentStatus, setAgentStatus] = useState<string>(t('chat.statusConnected'))
  const [history, setHistory] = useState<HistoryMessage[]>([])
  // session_id: identifier for this conversation. Kept until the user presses
  // "Reset" (clearChat), where it's rotated. It's sent to the backend on every
  // request (optional field, currently ignored, but we leave it ready for when
  // the backend persists conversations by session).
  const [sessionId, setSessionId] = useState<string>('')
  // hydrated: marks when we've already hydrated from storage. While false,
  // the persistence effects DO NOT write (avoids overwriting stored data
  // with the empty initial state during first render).
  const [hydrated, setHydrated] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Hydration: when uid is available, load the saved chat. Runs once at
  // login and again if the user changes in the same browser (rare, but
  // possible).
  useEffect(() => {
    if (!isReady) return
    const storedMessages = loadFromStorage<any[]>(storageKey(uid, 'messages'), [])
    if (storedMessages.length > 0) {
      setMessages(reviveMessages(storedMessages))
    }
    const storedHistory = loadFromStorage<HistoryMessage[]>(storageKey(uid, 'history'), [])
    setHistory(storedHistory)
    let sid = loadFromStorage<string>(storageKey(uid, 'session_id'), '')
    if (!sid) {
      sid = crypto.randomUUID()
      saveToStorage(storageKey(uid, 'session_id'), sid)
    }
    setSessionId(sid)
    setHydrated(true)
  }, [uid, isReady])

  // Persist on every change (rotate to the last MAX_PERSIST entries so it
  // doesn't grow forever). We only write once we've hydrated: otherwise the
  // empty initial state would overwrite what's on disk during first render.
  useEffect(() => {
    if (!hydrated || !isReady) return
    saveToStorage(storageKey(uid, 'messages'), messages.slice(-MAX_PERSIST))
  }, [messages, uid, hydrated, isReady])

  useEffect(() => {
    if (!hydrated || !isReady) return
    saveToStorage(storageKey(uid, 'history'), history.slice(-MAX_PERSIST))
  }, [history, uid, hydrated, isReady])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  const formatText = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>
      }
      return <span key={i}>{part}</span>
    })
  }

  const sendMessage = useCallback(async () => {
    if (!input.trim() || processing) return

    const userText = input.trim()
    setInput('')

    const userMsg: Message = {
      id: crypto.randomUUID(),
      type: 'user',
      content: userText,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMsg])

    const loadingId = crypto.randomUUID()
    setMessages(prev => [...prev, {
      id: loadingId,
      type: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true
    }])

    setProcessing(true)
    setAgentStatus(t('chat.statusThinking'))

    try {
      // SECURITY: send the user's identity so the agent filters data by
      // their uid (NOT by a global USER_ID). Without valid headers the
      // backend responds with 401.
      const token = auth.user?.access_token || ''
      const userId = getUserId()
      const userEmail = getUserEmail()
      if (!userId || !token) {
        throw new Error(t('chat.errors.notAuthed'))
      }
      const response = await fetch(AGENT_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-user-id': userId,
          'x-user-email': userEmail,
        },
        body: JSON.stringify({
          message: userText,
          history: history,
          // session_id: groups the messages in this conversation. The backend
          // receives it but currently doesn't persist it — ready for when
          // server-side conversation persistence is added.
          session_id: sessionId,
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }))
        throw new Error(errorData.error || `Error ${response.status}`)
      }

      const data = await response.json()

      setHistory(prev => [
        ...prev,
        { role: 'user', content: userText },
        { role: 'assistant', content: data.response }
      ])

      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? {
              ...m,
              content: data.response,
              isLoading: false,
              toolsUsed: data.toolsUsed
            }
          : m
      ))

      setAgentStatus(t('chat.statusConnected'))

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : t('chat.errors.unknown')

      let userErrorMsg = t('chat.errors.generic')
      if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
        userErrorMsg = t('chat.errors.network')
      }

      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? {
              ...m,
              content: `${userErrorMsg}\n\n_${errorMsg}_`,
              isLoading: false,
              type: 'system' as const
            }
          : m
      ))

      setAgentStatus(t('chat.statusError'))
    } finally {
      setProcessing(false)
    }
  }, [input, processing, history, sessionId, uid, auth.user?.access_token])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    setMessages([{
      id: crypto.randomUUID(),
      type: 'assistant',
      content: t('chat.reset'),
      timestamp: new Date()
    }])
    setHistory([])
    setAgentStatus(t('chat.statusConnected'))
    // Generate a new session_id — this is a different conversation.
    // The session_id useEffect fires and persists it on its own.
    const fresh = crypto.randomUUID()
    setSessionId(fresh)
    saveToStorage(storageKey(uid, 'session_id'), fresh)
  }

  const useSuggestion = (text: string) => {
    setInput(text)
    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus()
    }, 50)
  }

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-50 w-14 h-14 bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full shadow-lg shadow-cyan-500/25 flex items-center justify-center text-white"
          >
            <MessageSquare className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-slate-950 animate-pulse" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 w-[calc(100vw-2rem)] md:w-[440px] h-[600px] bg-slate-900 rounded-2xl border border-slate-700/50 shadow-2xl shadow-black/50 flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 bg-slate-800/80 border-b border-slate-700/50">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 bg-gradient-to-br from-cyan-400 to-violet-500 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-800 ${
                    agentStatus === t('chat.statusError') ? 'bg-red-400' :
                    processing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
                  }`} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">OneBox Agent</h3>
                  <p className="text-xs text-slate-400">{agentStatus}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={clearChat}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
                  title={t('chat.resetTooltip')}
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message, idx) => {
                // WhatsApp-style date separator: appears before the first
                // message and every time the day changes from the previous message.
                const prev = idx > 0 ? messages[idx - 1] : null
                const showDateDivider =
                  !prev || !isSameDay(prev.timestamp, message.timestamp)
                return (
                <Fragment key={message.id}>
                  {showDateDivider && (
                    <div className="flex justify-center my-2">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 bg-slate-800/60 px-3 py-1 rounded-full">
                        {getDateLabel(message.timestamp)}
                      </span>
                    </div>
                  )}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2.5 ${
                    message.type === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.type !== 'user' && (
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      message.type === 'system'
                        ? 'bg-red-500/20'
                        : 'bg-gradient-to-br from-cyan-400 to-violet-500'
                    }`}>
                      {message.type === 'system'
                        ? <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                        : <Bot className="w-3.5 h-3.5 text-white" />
                      }
                    </div>
                  )}

                  <div className="max-w-[85%]">
                    <div className={`rounded-2xl px-3.5 py-2.5 ${
                      message.type === 'user'
                        ? 'bg-gradient-to-r from-cyan-500 to-violet-500 text-white'
                        : message.type === 'system'
                        ? 'bg-red-500/10 border border-red-500/20 text-red-300'
                        : 'bg-slate-800 text-slate-300'
                    }`}>
                      {message.isLoading ? (
                        <div className="flex items-center gap-2 py-1">
                          <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                          <span className="text-sm text-slate-400">{t('chat.loading')}</span>
                        </div>
                      ) : (
                        <div className="text-sm leading-relaxed whitespace-pre-wrap">
                          {message.content.split('\n').map((line, i) => (
                            <span key={i}>
                              {i > 0 && <br />}
                              {line.startsWith('• ') || line.startsWith('- ') ? (
                                <span className="flex items-start gap-1.5">
                                  <span className="text-cyan-400 mt-0.5">•</span>
                                  <span>{formatText(line.slice(2))}</span>
                                </span>
                              ) : (
                                formatText(line)
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {message.toolsUsed && message.toolsUsed.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5 px-1">
                        {[...new Set(message.toolsUsed)].map((tool, i) => (
                          <span key={i} className="text-[10px] text-slate-600 bg-slate-800/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                            {tool === 'listar_correos' && <Mail className="w-2.5 h-2.5" />}
                            {tool === 'inspeccionar_correo' && <Paperclip className="w-2.5 h-2.5" />}
                            {tool === 'listar_correos' ? 'Gmail API' : 'S3 Inspection'}
                          </span>
                        ))}
                      </div>
                    )}

                    {!message.isLoading && (
                      <p className={`text-[10px] mt-1 px-1 ${
                        message.type === 'user' ? 'text-right text-white/50' : 'text-slate-600'
                      }`}>
                        {message.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>

                  {message.type === 'user' && (
                    <div className="w-7 h-7 bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5 text-slate-300" />
                    </div>
                  )}
                </motion.div>
                </Fragment>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {messages.length <= 2 && !processing && (
              <div className="px-4 pb-2">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    t('chat.suggestions.recent'),
                    t('chat.suggestions.attachments'),
                    t('chat.suggestions.onebox'),
                  ].map((sug) => (
                    <button
                      key={sug}
                      onClick={() => useSuggestion(sug)}
                      className="text-xs px-3 py-1.5 bg-slate-800/50 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-full border border-slate-700/50 transition-all"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="p-3 border-t border-slate-700/50 bg-slate-800/30">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder={processing ? t('chat.inputWaiting') : t('chat.inputPlaceholder')}
                  disabled={processing}
                  rows={1}
                  className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all resize-none disabled:opacity-50 max-h-24"
                  style={{ minHeight: '40px' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement
                    target.style.height = '40px'
                    target.style.height = `${Math.min(target.scrollHeight, 96)}px`
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || processing}
                  className="p-2.5 bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 text-white rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                >
                  {processing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-[10px] text-slate-600 mt-1.5 text-center">
                OneBox Agent · Gmail + AWS Bedrock
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
