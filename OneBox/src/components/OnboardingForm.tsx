import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle, Mail, ArrowLeft, ArrowRight, Check, Sparkles,
  FileText, Edit3, ClipboardPaste
} from 'lucide-react'
import DocumentUploader from './DocumentUploader'

export interface PendingProject {
  channels: string[]
  name: string
  type: string
  description: string
  whatsappNumbers?: string[]
  emails?: string[]
  /** Documento adjunto serializado (base64) — la IA lo procesará tras el login. */
  documentBase64?: string
  documentName?: string
  documentContentType?: string
  documentSize?: number
  /** Texto pegado pre-login (WhatsApp, Gmail, etc.) — la IA lo procesará tras el login. */
  pastedText?: string
  pastedSource?: 'whatsapp' | 'gmail' | 'paste'
}

interface OnboardingFormProps {
  onBack: () => void
  onSubmit: (data: PendingProject) => void
  onLoginInstead?: () => void
}

const CHANNELS = [
  { id: 'Gmail', label: 'Gmail', icon: Mail, color: 'text-rose-500', bg: 'bg-rose-50', bgActive: 'bg-rose-100 border-rose-300' },
  { id: 'WhatsApp', label: 'WhatsApp', icon: MessageCircle, color: 'text-emerald-500', bg: 'bg-emerald-50', bgActive: 'bg-emerald-100 border-emerald-300' },
]

const PROJECT_TYPES = ['Desarrollo Web', 'Infraestructura', 'Diseño', 'Marketing', 'Ecommerce', 'Consultoría', 'Soporte', 'RRHH', 'Otro']

export default function OnboardingForm({ onBack, onSubmit, onLoginInstead }: OnboardingFormProps) {
  const [mode, setMode] = useState<'choose' | 'document' | 'paste' | 'manual'>('choose')
  const [channels, setChannels] = useState<string[]>(['Gmail'])
  const [name, setName] = useState('')
  const [type, setType] = useState('Desarrollo Web')
  const [description, setDescription] = useState('')
  const [whatsappNumbers, setWhatsappNumbers] = useState<string[]>([])
  const [whatsappInput, setWhatsappInput] = useState('')
  const [emails, setEmails] = useState<string[]>([])
  const [emailInput, setEmailInput] = useState('')
  const [emailError, setEmailError] = useState('')

  // Documento adjunto (modo documento)
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [documentError, setDocumentError] = useState('')
  const [documentSubmitting, setDocumentSubmitting] = useState(false)

  // Texto pegado (modo paste)
  const [pastedText, setPastedText] = useState('')
  const [pastedSource, setPastedSource] = useState<'whatsapp' | 'gmail' | 'paste'>('whatsapp')
  const [pasteError, setPasteError] = useState('')
  const [pasteSubmitting, setPasteSubmitting] = useState(false)

  // Convierte un archivo a base64 (sin el prefijo data:)
  const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Quitar prefijo "data:...;base64,"
      const idx = result.indexOf(',')
      resolve(idx >= 0 ? result.substring(idx + 1) : result)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

  const handleDocumentSelected = (file: File) => {
    setDocumentError('')
    // Limitar a 4 MB para que quepa en localStorage tras base64 (~5.3 MB string)
    const MAX_BYTES_FOR_LOCALSTORAGE = 4 * 1024 * 1024
    if (file.size > MAX_BYTES_FOR_LOCALSTORAGE) {
      setDocumentError(`El archivo supera 4 MB. Sube uno más pequeño o usa el formulario manual y adjúntalo después.`)
      return
    }
    setDocumentFile(file)
  }

  const handleSubmitDocument = async () => {
    if (!documentFile) return
    setDocumentError('')
    setDocumentSubmitting(true)
    try {
      const base64 = await fileToBase64(documentFile)
      onSubmit({
        channels: ['Gmail'],
        name: '',
        type: 'Otro',
        description: '',
        documentBase64: base64,
        documentName: documentFile.name,
        documentContentType: documentFile.type || 'application/octet-stream',
        documentSize: documentFile.size,
      })
    } catch (err) {
      console.error('[Onboarding] Error preparando documento:', err)
      setDocumentError('No se pudo leer el documento. Intenta de nuevo o usa el formulario manual.')
      setDocumentSubmitting(false)
    }
  }

  const handleSubmitPasted = () => {
    setPasteError('')
    const text = pastedText.trim()
    if (text.length < 50) {
      setPasteError('Pega al menos una conversación o párrafo (mínimo 50 caracteres).')
      return
    }
    // Limitar a 100k caracteres para no saturar localStorage
    if (text.length > 100000) {
      setPasteError('El texto es demasiado largo. Recorta a menos de 100.000 caracteres.')
      return
    }
    setPasteSubmitting(true)
    onSubmit({
      channels: ['Gmail'],
      name: '',
      type: 'Otro',
      description: '',
      pastedText: text,
      pastedSource: pastedSource,
    })
  }

  const toggleChannel = (id: string) => {
    setChannels(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  const addWhatsappNumber = () => {
    const cleaned = whatsappInput.trim().replace(/\D/g, '')
    if (cleaned && cleaned.length >= 10) {
      const formatted = '+' + cleaned
      if (!whatsappNumbers.includes(formatted)) {
        setWhatsappNumbers([...whatsappNumbers, formatted])
        setWhatsappInput('')
      }
    }
  }

  const removeWhatsappNumber = (number: string) => {
    setWhatsappNumbers(whatsappNumbers.filter(n => n !== number))
  }

  const addEmail = () => {
    const value = emailInput.trim().toLowerCase()
    setEmailError('')
    if (!value) return
    // Validación básica de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(value)) {
      setEmailError('Correo no válido')
      return
    }
    if (emails.includes(value)) {
      setEmailError('Ese correo ya está agregado')
      return
    }
    setEmails([...emails, value])
    setEmailInput('')
  }

  const removeEmail = (email: string) => {
    setEmails(emails.filter(e => e !== email))
  }

  const canSubmit = channels.length > 0 && name.trim() && description.trim()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    onSubmit({
      channels,
      name: name.trim(),
      type,
      description: description.trim(),
      whatsappNumbers: whatsappNumbers.length > 0 ? whatsappNumbers : undefined,
      emails: emails.length > 0 ? emails : undefined,
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-2xl bg-white rounded-3xl shadow-xl border border-slate-100 p-10"
      >
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>
          {onLoginInstead && (
            <button
              onClick={onLoginInstead}
              className="text-sm text-violet-600 hover:text-violet-700 font-medium transition-colors"
            >
              ¿Ya tienes cuenta? Inicia sesión
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 text-violet-700 rounded-full text-xs font-medium w-fit mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          Antes de empezar
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
          Configura tu primer proyecto
        </h1>
        <p className="mt-3 text-slate-600">
          {mode === 'document'
            ? 'Sube un documento (brief, acta, propuesta) y la IA generará el proyecto automáticamente con su nombre, descripción e insights.'
            : mode === 'manual'
              ? 'Cuéntanos qué canales vas a usar y los detalles del proyecto. Después iniciaremos sesión y lo dejaremos listo en tu panel.'
              : '¿Cómo quieres crear tu primer proyecto?'}
        </p>

        {/* Selector de modo: 3 opciones (pegar conversación, subir doc, formulario manual) */}
        {mode === 'choose' && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => setMode('paste')}
              className="group relative text-left p-5 rounded-2xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 to-violet-100/50 hover:border-violet-500 hover:shadow-lg transition-all"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 bg-violet-500 rounded-xl flex items-center justify-center">
                  <ClipboardPaste className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] font-bold text-violet-700 bg-violet-200 px-2 py-0.5 rounded-full uppercase tracking-wider">Más rápido</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">
                Pegar conversación
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Copia un chat de WhatsApp o un hilo de correo y pégalo aquí. La IA detectará tareas, riesgos y decisiones.
              </p>
              <p className="text-xs text-violet-700 mt-3 font-medium">
                Texto pegado → continuar
              </p>
            </button>

            <button
              type="button"
              onClick={() => setMode('document')}
              className="group text-left p-5 rounded-2xl border-2 border-slate-200 bg-white hover:border-slate-400 transition-all"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                  <FileText className="w-5 h-5 text-slate-600" />
                </div>
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                Subir un documento
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Brief, acta, propuesta o PDF. La IA leerá su contenido y creará el proyecto con todo.
              </p>
              <p className="text-xs text-slate-500 mt-3 font-medium">
                PDF, Word, TXT, imagen → continuar
              </p>
            </button>

            <button
              type="button"
              onClick={() => setMode('manual')}
              className="group text-left p-5 rounded-2xl border-2 border-slate-200 bg-white hover:border-slate-400 transition-all"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                  <Edit3 className="w-5 h-5 text-slate-600" />
                </div>
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">
                Llenar formulario
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Completa los campos manualmente: nombre, equipo, canales, fechas.
              </p>
              <p className="text-xs text-slate-500 mt-3 font-medium">
                3 pasos guiados → continuar
              </p>
            </button>
          </div>
        )}

        {/* Modo: subir documento */}
        {mode === 'document' && (
          <div className="mt-8 space-y-4">
            <button
              type="button"
              onClick={() => { setMode('choose'); setDocumentFile(null); setDocumentError('') }}
              className="text-xs text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" /> Cambiar de opción
            </button>

            <DocumentUploader
              variant="light"
              onFileSelected={handleDocumentSelected}
              loading={documentSubmitting}
              loadingText="Preparando documento e iniciando sesión..."
              errorMessage={documentError}
              label="Sube tu documento"
              hint="La IA leerá su contenido y creará el proyecto automáticamente. Después de iniciar sesión verás todo en tu panel."
            />

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-start gap-2">
              <span className="font-bold">📌 Nota:</span>
              <span>Limitado a 4 MB para esta carga inicial. Si tu archivo es más grande, usa el formulario manual y adjunta el documento después desde el dashboard del proyecto.</span>
            </div>

            <button
              type="button"
              onClick={handleSubmitDocument}
              disabled={!documentFile || documentSubmitting}
              className="w-full px-6 py-4 bg-violet-600 text-white font-medium rounded-xl hover:bg-violet-500 transition-all shadow-lg shadow-violet-600/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {documentSubmitting ? 'Preparando...' : 'Continuar e iniciar sesión'}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <p className="text-center text-xs text-slate-500">
              Al continuar, te pediremos iniciar sesión. La IA procesará el documento después.
            </p>
          </div>
        )}

        {/* Modo: pegar conversación */}
        {mode === 'paste' && (
          <div className="mt-8 space-y-4">
            <button
              type="button"
              onClick={() => { setMode('choose'); setPastedText(''); setPasteError('') }}
              className="text-xs text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" /> Cambiar de opción
            </button>

            {/* Selector de fuente */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">¿De dónde es el texto?</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: 'whatsapp' as const, label: 'WhatsApp', icon: MessageCircle, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-300' },
                  { id: 'gmail' as const, label: 'Gmail / Email', icon: Mail, color: 'text-rose-600', bg: 'bg-rose-50 border-rose-300' },
                  { id: 'paste' as const, label: 'Otro texto', icon: ClipboardPaste, color: 'text-violet-600', bg: 'bg-violet-50 border-violet-300' },
                ]).map(opt => {
                  const Icon = opt.icon
                  const active = pastedSource === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPastedSource(opt.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all ${
                        active ? opt.bg : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${active ? opt.color : 'text-slate-400'}`} />
                      <span className={`text-sm font-medium ${active ? 'text-slate-900' : 'text-slate-600'}`}>{opt.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Textarea */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Pega aquí tu conversación o texto
              </label>
              <textarea
                value={pastedText}
                onChange={e => { setPastedText(e.target.value); setPasteError('') }}
                disabled={pasteSubmitting}
                rows={10}
                placeholder={
                  pastedSource === 'whatsapp'
                    ? 'Ejemplo:\n12/11/25, 13:14 - Santi: Nuevo proyecto...\n12/11/25, 13:17 - Belen: Funciona el acceso...'
                    : pastedSource === 'gmail'
                      ? 'Pega el hilo de correo completo aquí...'
                      : 'Pega aquí cualquier texto que describa el proyecto...'
                }
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition resize-none font-mono text-xs leading-relaxed"
              />
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-[11px] text-slate-500">
                  {pastedText.length === 0 ? 'Sin contenido' :
                   pastedText.length < 50 ? `${pastedText.length} caracteres — mínimo 50` :
                   `${pastedText.length.toLocaleString()} caracteres`}
                </p>
                {pastedText.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPastedText('')}
                    className="text-[11px] text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {pasteError && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                {pasteError}
              </div>
            )}

            <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 text-xs text-violet-800 flex items-start gap-2">
              <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Después de iniciar sesión, la IA analizará el texto y verás una pantalla de revisión donde podrás editar nombre, tipo, canales y participantes antes de crear el proyecto.</span>
            </div>

            <button
              type="button"
              onClick={handleSubmitPasted}
              disabled={pastedText.trim().length < 50 || pasteSubmitting}
              className="w-full px-6 py-4 bg-violet-600 text-white font-medium rounded-xl hover:bg-violet-500 transition-all shadow-lg shadow-violet-600/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {pasteSubmitting ? 'Preparando...' : 'Continuar e iniciar sesión'}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <p className="text-center text-xs text-slate-500">
              Al continuar, te pediremos iniciar sesión. La IA analizará el texto después.
            </p>
          </div>
        )}

        {/* Modo: formulario manual */}
        {mode === 'manual' && (
          <button
            type="button"
            onClick={() => setMode('choose')}
            className="text-xs text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1 mt-6"
          >
            <ArrowLeft className="w-3 h-3" /> Cambiar de opción
          </button>
        )}

        {mode === 'manual' && (
        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* Channels */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              ¿Qué canales vas a usar? <span className="text-slate-400 font-normal">(selecciona al menos uno)</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {CHANNELS.map(c => {
                const active = channels.includes(c.id)
                const Icon = c.icon
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleChannel(c.id)}
                    className={`relative flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                      active ? c.bgActive : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-10 h-10 ${c.bg} rounded-lg flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${c.color}`} />
                    </div>
                    <span className="font-medium text-slate-900">{c.label}</span>
                    {active && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-violet-600 rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {channels.includes('Gmail') && (
              <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-xl">
                <label className="block text-sm font-medium text-rose-900 mb-1">
                  Agrega correos del equipo
                </label>
                <p className="text-xs text-rose-700/70 mb-3">
                  Estos correos recibirán notificaciones del proyecto. Tu correo de inicio de sesión se incluye automáticamente.
                </p>
                <div className="flex gap-2 mb-2">
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => { setEmailInput(e.target.value); setEmailError('') }}
                    onKeyPress={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmail() } }}
                    placeholder="nombre@empresa.com"
                    className={`flex-1 px-3 py-2 bg-white border rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 ${
                      emailError ? 'border-red-400' : 'border-rose-200'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={addEmail}
                    className="px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 transition-colors"
                  >
                    Agregar
                  </button>
                </div>
                {emailError && (
                  <p className="text-xs text-red-600 mb-2">{emailError}</p>
                )}

                {emails.length > 0 && (
                  <div className="space-y-2">
                    {emails.map((email) => (
                      <div key={email} className="flex items-center justify-between p-2 bg-white rounded-lg border border-rose-100">
                        <span className="text-sm font-medium text-slate-900 truncate mr-2">{email}</span>
                        <button
                          type="button"
                          onClick={() => removeEmail(email)}
                          className="text-xs text-red-600 hover:text-red-700 font-medium flex-shrink-0"
                        >
                          Quitar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {channels.includes('WhatsApp') && (
              <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <label className="block text-sm font-medium text-emerald-900 mb-1">
                  Agrega números de WhatsApp
                </label>
                <p className="text-xs text-emerald-700/70 mb-3">
                  Formato internacional: prefijo del país + número (sin espacios).
                </p>
                <div className="flex gap-2 mb-3">
                  <input
                    type="tel"
                    value={whatsappInput}
                    onChange={(e) => setWhatsappInput(e.target.value)}
                    onKeyPress={(e) => { if (e.key === 'Enter') { e.preventDefault(); addWhatsappNumber() } }}
                    placeholder="+34 600 000 000"
                    className="flex-1 px-3 py-2 bg-white border border-emerald-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={addWhatsappNumber}
                    className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    Agregar
                  </button>
                </div>

                {whatsappNumbers.length > 0 && (
                  <div className="space-y-2">
                    {whatsappNumbers.map((number) => (
                      <div key={number} className="flex items-center justify-between p-2 bg-white rounded-lg border border-emerald-100">
                        <span className="text-sm font-medium text-slate-900">{number}</span>
                        <button
                          type="button"
                          onClick={() => removeWhatsappNumber(number)}
                          className="text-xs text-red-600 hover:text-red-700 font-medium"
                        >
                          Quitar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>


          {/* Project name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Nombre del proyecto</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Lanzamiento Q2"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
            />
          </div>

          {/* Project type (input libre con sugerencias) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de proyecto</label>
            <input
              type="text"
              list="onboarding-project-types"
              value={type}
              onChange={e => setType(e.target.value)}
              placeholder="Ej: Desarrollo Web, Marketing... o el que necesites"
              maxLength={60}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
            />
            <datalist id="onboarding-project-types">
              {PROJECT_TYPES.map(t => <option key={t} value={t} />)}
            </datalist>
            <p className="text-xs text-slate-500 mt-1">Selecciona una sugerencia o escribe el tipo personalizado.</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Descripción del proyecto</label>
            <textarea
              required
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe brevemente qué es este proyecto y sus objetivos..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition resize-none"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full px-6 py-4 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            Continuar e iniciar sesión
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>

          <p className="text-center text-xs text-slate-500">
            Al continuar, te pediremos iniciar sesión para guardar tu proyecto.
          </p>
        </form>
        )}
      </motion.div>
    </div>
  )
}
