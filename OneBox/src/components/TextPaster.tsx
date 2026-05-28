import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ClipboardPaste, Sparkles, Loader2, X, AlertCircle, CheckCircle2,
  MessageSquare, Mail, FileText
} from 'lucide-react'

const MIN_LENGTH = 30
const MAX_LENGTH = 50_000

export type PasterVariant = 'light' | 'dark'

interface TextPasterProps {
  variant?: PasterVariant
  loading?: boolean
  loadingText?: string
  successMessage?: string
  errorMessage?: string
  onAnalyze: (text: string, source: 'whatsapp' | 'gmail' | 'paste') => void
  /** Si está embebido (compact), el panel ya está abierto. */
  compact?: boolean
  label?: string
  hint?: string
}

const SOURCE_OPTIONS = [
  { id: 'whatsapp' as const, label: 'WhatsApp', icon: MessageSquare, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { id: 'gmail' as const,    label: 'Correo Gmail', icon: Mail, color: 'text-rose-500', bg: 'bg-rose-500/10' },
  { id: 'paste' as const,    label: 'Otro / nota', icon: FileText, color: 'text-violet-500', bg: 'bg-violet-500/10' },
]

export default function TextPaster({
  variant = 'dark',
  loading = false,
  loadingText = 'Analizando con IA...',
  successMessage,
  errorMessage,
  onAnalyze,
  compact = false,
  label = 'Pega una conversación',
  hint = 'Copia un chat de WhatsApp, hilo de correo o cualquier texto. La IA detectará tareas, riesgos y decisiones.',
}: TextPasterProps) {
  const [text, setText] = useState('')
  const [source, setSource] = useState<'whatsapp' | 'gmail' | 'paste'>('paste')
  const [localError, setLocalError] = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)

  const isLight = variant === 'light'
  const trimmed = text.trim()
  const length = trimmed.length
  const valid = length >= MIN_LENGTH && length <= MAX_LENGTH

  const handlePasteFromClipboard = async () => {
    try {
      const t = await navigator.clipboard.readText()
      if (t) {
        setText(t)
        setLocalError('')
      }
    } catch {
      setLocalError('Tu navegador no permite leer el portapapeles. Pega manualmente con Cmd+V.')
    }
  }

  const handleAnalyze = () => {
    setLocalError('')
    if (length < MIN_LENGTH) {
      setLocalError(`Texto muy corto (mínimo ${MIN_LENGTH} caracteres).`)
      return
    }
    if (length > MAX_LENGTH) {
      setLocalError(`Texto muy largo (máximo ${MAX_LENGTH.toLocaleString()} caracteres).`)
      return
    }
    onAnalyze(trimmed, source)
  }

  const error = localError || errorMessage

  // Estilos por variante
  const containerCls = isLight
    ? 'bg-white border-slate-200'
    : 'bg-[#161625] border-white/10'
  const titleCls = isLight ? 'text-slate-900' : 'text-white'
  const hintCls = isLight ? 'text-slate-500' : 'text-white/50'
  const taCls = isLight
    ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-violet-500'
    : 'bg-[#0E0E1A] border-white/10 text-white placeholder:text-white/30 focus:ring-violet-500'
  const counterCls = isLight ? 'text-slate-400' : 'text-white/40'

  return (
    <div className={`rounded-xl border ${containerCls} ${compact ? 'p-3' : 'p-5'}`}>
      {!compact && (
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className={`text-sm font-bold ${titleCls} flex items-center gap-2`}>
              <ClipboardPaste className="w-4 h-4 text-violet-500" />
              {label}
            </h3>
            <p className={`text-xs ${hintCls} mt-0.5`}>{hint}</p>
          </div>
        </div>
      )}

      {/* Selector de origen */}
      <div className="flex gap-2 mb-3">
        {SOURCE_OPTIONS.map(opt => {
          const Icon = opt.icon
          const active = source === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              disabled={loading}
              onClick={() => setSource(opt.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all disabled:opacity-50 ${
                active
                  ? `${opt.bg} ${opt.color} border-current`
                  : isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                    : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* Textarea */}
      <div className="relative">
        <textarea
          ref={taRef}
          value={text}
          onChange={e => { setText(e.target.value); setLocalError('') }}
          disabled={loading}
          rows={8}
          placeholder={
            source === 'whatsapp'
              ? '[28/04/26, 10:15] Juan: Hola equipo, necesitamos cerrar el lanzamiento esta semana...\n[28/04/26, 10:20] Ana: Falta aprobar los creativos...'
              : source === 'gmail'
                ? 'De: cliente@empresa.com\nAsunto: Avance proyecto\n\nHola, te escribo para revisar el estado del proyecto...'
                : 'Pega aquí cualquier texto: notas de reunión, requerimientos, mensajes...'
          }
          className={`w-full px-3 py-2.5 rounded-lg border text-sm resize-none focus:outline-none focus:ring-2 focus:border-transparent transition disabled:opacity-50 ${taCls}`}
        />
        {!loading && text && (
          <button
            type="button"
            onClick={() => setText('')}
            className={`absolute top-2 right-2 p-1 rounded ${isLight ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100' : 'text-white/40 hover:text-white hover:bg-white/10'} transition-colors`}
            title="Limpiar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Footer: contador + acciones */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-3">
          <span className={`text-xs ${counterCls}`}>
            {length.toLocaleString()} / {MAX_LENGTH.toLocaleString()} chars
            {length > 0 && length < MIN_LENGTH && <span className="text-amber-500 ml-1">· mínimo {MIN_LENGTH}</span>}
          </span>
          <button
            type="button"
            disabled={loading}
            onClick={handlePasteFromClipboard}
            className={`text-xs underline ${isLight ? 'text-violet-600 hover:text-violet-700' : 'text-violet-400 hover:text-violet-300'} disabled:opacity-50`}
          >
            Pegar del portapapeles
          </button>
        </div>
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={!valid || loading}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            isLight
              ? 'bg-violet-600 text-white hover:bg-violet-500 shadow-md shadow-violet-600/20'
              : 'bg-violet-600 text-white hover:bg-violet-500'
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analizando...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Analizar con IA
            </>
          )}
        </button>
      </div>

      {/* Mensajes */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`flex items-start gap-2 mt-3 px-3 py-2 rounded-lg ${isLight ? 'bg-red-50 border border-red-200' : 'bg-red-500/10 border border-red-500/20'}`}
          >
            <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isLight ? 'text-red-600' : 'text-red-400'}`} />
            <p className={`text-xs ${isLight ? 'text-red-700' : 'text-red-300'}`}>{error}</p>
          </motion.div>
        )}
        {successMessage && !error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`flex items-start gap-2 mt-3 px-3 py-2 rounded-lg ${isLight ? 'bg-emerald-50 border border-emerald-200' : 'bg-emerald-500/10 border border-emerald-500/20'}`}
          >
            <CheckCircle2 className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
            <p className={`text-xs ${isLight ? 'text-emerald-700' : 'text-emerald-300'}`}>{successMessage}</p>
          </motion.div>
        )}
        {loading && !error && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className={`flex items-center gap-2 mt-3 px-3 py-2 rounded-lg ${isLight ? 'bg-violet-50' : 'bg-violet-500/10'}`}
          >
            <Sparkles className={`w-3.5 h-3.5 animate-pulse ${isLight ? 'text-violet-600' : 'text-violet-400'}`} />
            <p className={`text-xs ${isLight ? 'text-violet-700' : 'text-violet-300'}`}>{loadingText}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
