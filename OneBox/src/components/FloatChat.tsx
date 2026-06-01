import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from 'react-oidc-context'
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

interface Mensaje {
  id: string
  tipo: 'usuario' | 'asistente' | 'sistema'
  contenido: string
  timestamp: Date
  isLoading?: boolean
  toolsUsed?: string[]
}

interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export default function ChatFloat() {
  // Auth: el chatbot DEBE enviar credenciales para que el backend aísle datos
  // por usuario. Sin esto el endpoint /chat devuelve 401 (fix de seguridad
  // crítico — antes el agente usaba un USER_ID global y filtraba datos de
  // otros usuarios).
  const auth = useAuth()
  const [abierto, setAbierto] = useState(false)
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    {
      id: '1',
      tipo: 'asistente',
      contenido: '¡Hola! Soy el asistente inteligente de OneBox. Puedo buscar tus correos, analizar contenido y sugerirte acciones.\n\nPrueba preguntándome:\n• "Muéstrame mis correos recientes"\n• "¿Tengo correos con adjuntos?"\n• "Busca correos de Santiago"',
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [estadoAgente, setEstadoAgente] = useState<string>('Conectado')
  const [history, setHistory] = useState<HistoryMessage[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [mensajes])

  useEffect(() => {
    if (abierto && inputRef.current) {
      inputRef.current.focus()
    }
  }, [abierto])

  const formatText = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>
      }
      return <span key={i}>{part}</span>
    })
  }

  const enviarMensaje = useCallback(async () => {
    if (!input.trim() || procesando) return

    const textoUsuario = input.trim()
    setInput('')

    const msgUsuario: Mensaje = {
      id: crypto.randomUUID(),
      tipo: 'usuario',
      contenido: textoUsuario,
      timestamp: new Date()
    }
    setMensajes(prev => [...prev, msgUsuario])

    const loadingId = crypto.randomUUID()
    setMensajes(prev => [...prev, {
      id: loadingId,
      tipo: 'asistente',
      contenido: '',
      timestamp: new Date(),
      isLoading: true
    }])

    setProcesando(true)
    setEstadoAgente('Pensando...')

    try {
      // SEGURIDAD: mandar identidad del usuario para que el agente filtre
      // datos por su uid (NO por un USER_ID global). Sin headers válidos el
      // backend responde 401.
      const token = auth.user?.access_token || ''
      const userId = getUserId()
      const userEmail = getUserEmail()
      if (!userId || !token) {
        throw new Error('Sesión no iniciada — inicia sesión para usar el chatbot.')
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
          message: textoUsuario,
          history: history
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }))
        throw new Error(errorData.error || `Error ${response.status}`)
      }

      const data = await response.json()

      setHistory(prev => [
        ...prev,
        { role: 'user', content: textoUsuario },
        { role: 'assistant', content: data.response }
      ])

      setMensajes(prev => prev.map(m =>
        m.id === loadingId
          ? {
              ...m,
              contenido: data.response,
              isLoading: false,
              toolsUsed: data.toolsUsed
            }
          : m
      ))

      setEstadoAgente('Conectado')

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido'

      let userErrorMsg = 'Hubo un error al procesar tu consulta.'
      if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
        userErrorMsg = '⚠️ No se pudo conectar con el agente. Verifica que la URL del backend sea correcta en VITE_AGENT_API.'
      }

      setMensajes(prev => prev.map(m =>
        m.id === loadingId
          ? {
              ...m,
              contenido: `${userErrorMsg}\n\n_${errorMsg}_`,
              isLoading: false,
              tipo: 'sistema' as const
            }
          : m
      ))

      setEstadoAgente('Error de conexión')
    } finally {
      setProcesando(false)
    }
  }, [input, procesando, history])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviarMensaje()
    }
  }

  const limpiarChat = () => {
    setMensajes([{
      id: crypto.randomUUID(),
      tipo: 'asistente',
      contenido: 'Chat reiniciado. ¿En qué puedo ayudarte?',
      timestamp: new Date()
    }])
    setHistory([])
    setEstadoAgente('Conectado')
  }

  const usarSugerencia = (texto: string) => {
    setInput(texto)
    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus()
    }, 50)
  }

  return (
    <>
      <AnimatePresence>
        {!abierto && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setAbierto(true)}
            className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-50 w-14 h-14 bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full shadow-lg shadow-cyan-500/25 flex items-center justify-center text-white"
          >
            <MessageSquare className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-slate-950 animate-pulse" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {abierto && (
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
                    estadoAgente === 'Error de conexión' ? 'bg-red-400' :
                    procesando ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
                  }`} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">OneBox Agent</h3>
                  <p className="text-xs text-slate-400">{estadoAgente}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={limpiarChat}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
                  title="Reiniciar chat"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setAbierto(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setAbierto(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {mensajes.map((mensaje) => (
                <motion.div
                  key={mensaje.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2.5 ${
                    mensaje.tipo === 'usuario' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {mensaje.tipo !== 'usuario' && (
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      mensaje.tipo === 'sistema'
                        ? 'bg-red-500/20'
                        : 'bg-gradient-to-br from-cyan-400 to-violet-500'
                    }`}>
                      {mensaje.tipo === 'sistema'
                        ? <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                        : <Bot className="w-3.5 h-3.5 text-white" />
                      }
                    </div>
                  )}

                  <div className="max-w-[85%]">
                    <div className={`rounded-2xl px-3.5 py-2.5 ${
                      mensaje.tipo === 'usuario'
                        ? 'bg-gradient-to-r from-cyan-500 to-violet-500 text-white'
                        : mensaje.tipo === 'sistema'
                        ? 'bg-red-500/10 border border-red-500/20 text-red-300'
                        : 'bg-slate-800 text-slate-300'
                    }`}>
                      {mensaje.isLoading ? (
                        <div className="flex items-center gap-2 py-1">
                          <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                          <span className="text-sm text-slate-400">Analizando tu consulta...</span>
                        </div>
                      ) : (
                        <div className="text-sm leading-relaxed whitespace-pre-wrap">
                          {mensaje.contenido.split('\n').map((line, i) => (
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

                    {mensaje.toolsUsed && mensaje.toolsUsed.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5 px-1">
                        {[...new Set(mensaje.toolsUsed)].map((tool, i) => (
                          <span key={i} className="text-[10px] text-slate-600 bg-slate-800/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                            {tool === 'listar_correos' && <Mail className="w-2.5 h-2.5" />}
                            {tool === 'inspeccionar_correo' && <Paperclip className="w-2.5 h-2.5" />}
                            {tool === 'listar_correos' ? 'Gmail API' : 'Inspección S3'}
                          </span>
                        ))}
                      </div>
                    )}

                    {!mensaje.isLoading && (
                      <p className={`text-[10px] mt-1 px-1 ${
                        mensaje.tipo === 'usuario' ? 'text-right text-white/50' : 'text-slate-600'
                      }`}>
                        {mensaje.timestamp.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>

                  {mensaje.tipo === 'usuario' && (
                    <div className="w-7 h-7 bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5 text-slate-300" />
                    </div>
                  )}
                </motion.div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {mensajes.length <= 2 && !procesando && (
              <div className="px-4 pb-2">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Mis correos recientes',
                    'Correos con adjuntos',
                    'Correos de OneBox'
                  ].map((sug) => (
                    <button
                      key={sug}
                      onClick={() => usarSugerencia(sug)}
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
                  placeholder={procesando ? 'Esperando respuesta...' : 'Pregúntame sobre tus correos...'}
                  disabled={procesando}
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
                  onClick={enviarMensaje}
                  disabled={!input.trim() || procesando}
                  className="p-2.5 bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 text-white rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                >
                  {procesando ? (
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