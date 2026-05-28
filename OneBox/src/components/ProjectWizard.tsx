import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from 'react-oidc-context'
import { api } from '../services/api'
import {
  Check, Search, X, Plus, MessageCircle, Mail,
  Calendar, ArrowLeft, ArrowRight, AlertTriangle, Users, Phone,
  Sparkles, FileText, Edit3, ClipboardPaste
} from 'lucide-react'
import { PageType } from '../App'
import DocumentUploader from './DocumentUploader'
import TextPaster from './TextPaster'

const TEAM_DIRECTORY = [
  { nombre: 'Jeniffer Fúnez', email: 'jeniffer@agencia.com', telefono: '+50494622817', rol: 'PM', iniciales: 'JF', color: 'from-violet-500 to-indigo-600', projectCount: 5 },
  { nombre: 'Andrés López', email: 'andres@agencia.com', telefono: '', rol: 'Dev Frontend', iniciales: 'AL', color: 'from-blue-500 to-cyan-600', projectCount: 3 },
  { nombre: 'Marta Ruiz', email: 'marta@agencia.com', telefono: '', rol: 'UX / Diseño', iniciales: 'MR', color: 'from-pink-500 to-rose-600', projectCount: 2 },
  { nombre: 'Jesús Vega', email: 'jesus@agencia.com', telefono: '', rol: 'Dev Backend', iniciales: 'JS', color: 'from-emerald-500 to-green-600', projectCount: 2 },
  { nombre: 'Santiago López', email: 'santiago@partner.com', telefono: '', rol: 'Partner Externo', iniciales: 'SL', color: 'from-amber-500 to-orange-600', projectCount: 1 },
  { nombre: 'María Blanco', email: 'maria@agencia.com', telefono: '', rol: 'Dev Backend', iniciales: 'MB', color: 'from-teal-500 to-emerald-600', projectCount: 0 },
  { nombre: 'Carlos García', email: 'carlos@agencia.com', telefono: '', rol: 'DevOps', iniciales: 'CG', color: 'from-orange-500 to-red-600', projectCount: 1 },
]

const ROLES = ['PM', 'Dev Frontend', 'Dev Backend', 'DevOps', 'Diseño', 'QA', 'Partner', 'Cliente']
const PROJECT_TYPES = ['Desarrollo Web', 'Infraestructura', 'Diseño', 'Marketing', 'Ecommerce', 'Consultoría', 'Soporte', 'RRHH', 'Otro']
const CHANNELS = [
  { id: 'Gmail', label: 'Gmail', icon: Mail, color: 'text-blue-400', bgActive: 'bg-blue-500/20 border-blue-500/30' },
  { id: 'WhatsApp', label: 'WhatsApp', icon: MessageCircle, color: 'text-green-400', bgActive: 'bg-green-500/20 border-green-500/30' },
]

interface TeamMember {
  nombre: string
  email: string
  telefono: string
  rol: string
  iniciales: string
  color: string
  projectCount: number
  isExternal?: boolean
}

export interface DetectedParticipant {
  name: string
  role_inferred: string
}

export interface InitialDocumentDraft {
  draftId: string
  fileName: string
  fileSize: number
  extractedTextLength: number
  suggestion: {
    name: string
    type: string
    description: string
    extractedNotes: string
    detected_participants?: DetectedParticipant[]
  }
}

interface ProjectsWizardProps {
  onNavigate: (page: PageType) => void
  /** Si se pasa, el wizard arranca en modo "document-review" con este draft. */
  initialDraft?: InitialDocumentDraft | null
  /** Callback cuando el wizard termina (para que App.tsx pueda limpiar el draft). */
  onWizardClose?: () => void
}

export default function ProjectWizard({ onNavigate, initialDraft, onWizardClose }: ProjectsWizardProps) {
  const auth = useAuth()
  const token = auth.user?.access_token || ''

  // Si llega un initialDraft, arrancamos directo en la pantalla de revisión
  const [mode, setMode] = useState<'choose' | 'document' | 'document-review' | 'paste' | 'manual'>(
    initialDraft ? 'document-review' : 'choose'
  )

  // Estado del flujo de documento
  const [docDraft, setDocDraft] = useState<InitialDocumentDraft | null>(initialDraft || null)
  const [docDraftName, setDocDraftName] = useState(initialDraft?.suggestion?.name || '')
  const [docDraftType, setDocDraftType] = useState(initialDraft?.suggestion?.type || 'Otro')
  const [docDraftDescription, setDocDraftDescription] = useState(initialDraft?.suggestion?.description || '')
  const [docDraftChannels, setDocDraftChannels] = useState<string[]>(['Gmail'])
  const [docDraftEmails, setDocDraftEmails] = useState<string[]>([])
  const [docDraftEmailInput, setDocDraftEmailInput] = useState('')
  const [docDraftPhones, setDocDraftPhones] = useState<string[]>([])
  const [docDraftPhoneInput, setDocDraftPhoneInput] = useState('')
  const [docDraftTiming, setDocDraftTiming] = useState('')
  const [docDraftCreating, setDocDraftCreating] = useState(false)
  // Personas extras agregadas manualmente (además de las detectadas por IA)
  const [extraPeople, setExtraPeople] = useState<Array<{
    name: string
    email: string
    phone: string
    role: string
  }>>([])
  const [addingExtra, setAddingExtra] = useState(false)
  const [extraForm, setExtraForm] = useState({ name: '', email: '', phone: '', role: '' })
  const [extraFormError, setExtraFormError] = useState('')

  const submitExtraPerson = () => {
    setExtraFormError('')
    const name = extraForm.name.trim()
    const email = extraForm.email.trim().toLowerCase()
    const phone = extraForm.phone.trim()
    const role = extraForm.role.trim() || 'Participante'
    if (!name && !email && !phone) {
      setExtraFormError('Ingresa al menos el nombre, correo o WhatsApp')
      return
    }
    if (email && !email.includes('@')) {
      setExtraFormError('El correo no es válido')
      return
    }
    setExtraPeople([...extraPeople, {
      name: name || (email ? email.split('@')[0] : phone),
      email: email.includes('@') ? email : '',
      phone: phone,
      role: role,
    }])
    setExtraForm({ name: '', email: '', phone: '', role: '' })
    setAddingExtra(false)
  }

  const cancelExtraForm = () => {
    setExtraForm({ name: '', email: '', phone: '', role: '' })
    setExtraFormError('')
    setAddingExtra(false)
  }

  const removeExtraPerson = (idx: number) => {
    setExtraPeople(extraPeople.filter((_, i) => i !== idx))
  }
  // Personas que la IA detectó en el texto — el usuario puede agregar email/teléfono/rol
  const [detectedParticipants, setDetectedParticipants] = useState<Array<{
    name: string
    roleInferred: string
    email: string
    phone: string
    role: string
    include: boolean
  }>>(
    (initialDraft?.suggestion?.detected_participants || []).map(p => ({
      name: p.name,
      roleInferred: p.role_inferred || 'Participante',
      email: '',
      phone: '',
      role: p.role_inferred || 'Participante',
      include: true,
    }))
  )

  const DOC_PROJECT_TYPES = ['Desarrollo Web', 'Infraestructura', 'Diseño', 'Marketing', 'Ecommerce', 'Consultoría', 'Soporte', 'RRHH', 'Otro']
  const [step, setStep] = useState(1)
  const [creating, setCreating] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')

  const userId = auth.user?.profile?.sub || ''

  // Pegar texto: ahora también pasa por la pantalla de revisión (igual que documento)
  const handlePastedText = async (text: string, source: 'whatsapp' | 'gmail' | 'paste') => {
    setUploadError('')
    setUploadSuccess('')
    setUploadingDoc(true)
    try {
      const result = await api.analyzeTextPreview({ text, source }, token)
      // Reutilizamos el state del draft (el endpoint /from-document-draft acepta cualquier draft)
      setDocDraft({
        draftId: result.draftId,
        fileName: result.fileName,
        fileSize: result.fileSize,
        extractedTextLength: result.extractedTextLength,
        suggestion: result.suggestion,
      })
      setDocDraftName(result.suggestion?.name || '')
      setDocDraftType(result.suggestion?.type || 'Otro')
      setDocDraftDescription(result.suggestion?.description || '')
      setDocDraftChannels(['Gmail'])
      setDocDraftEmails([])
      setDocDraftPhones([])
      // Detectados por IA: el usuario completará email/teléfono
      const detected = (result.suggestion?.detected_participants || []) as DetectedParticipant[]
      setDetectedParticipants(detected.map(p => ({
        name: p.name,
        roleInferred: p.role_inferred || 'Participante',
        email: '',
        phone: '',
        role: p.role_inferred || 'Participante',
        include: true,
      })))
      setMode('document-review')
    } catch (err: any) {
      console.error('[ProjectWizard] analyze text error:', err)
      const msg = err?.message || 'No se pudo procesar el texto.'
      setUploadError(msg.length > 200 ? msg.substring(0, 200) + '...' : msg)
    } finally {
      setUploadingDoc(false)
    }
  }

  // Paso 1: el usuario sube el doc, el backend analiza y devuelve el draft con sugerencia
  const handleDocumentUpload = async (file: File) => {
    setUploadError('')
    setUploadSuccess('')
    setUploadingDoc(true)
    try {
      const result = await api.analyzeDocumentPreview(file, { userId, token })
      setDocDraft({
        draftId: result.draftId,
        fileName: result.fileName,
        fileSize: result.fileSize,
        extractedTextLength: result.extractedTextLength,
        suggestion: result.suggestion,
      })
      // Pre-rellenar campos editables con la sugerencia de la IA
      setDocDraftName(result.suggestion?.name || '')
      setDocDraftType(result.suggestion?.type || 'Otro')
      setDocDraftDescription(result.suggestion?.description || '')
      setDocDraftChannels(['Gmail'])
      setDocDraftEmails([])
      setDocDraftPhones([])
      const detected = (result.suggestion?.detected_participants || []) as DetectedParticipant[]
      setDetectedParticipants(detected.map(p => ({
        name: p.name,
        roleInferred: p.role_inferred || 'Participante',
        email: '',
        phone: '',
        role: p.role_inferred || 'Participante',
        include: true,
      })))
      setMode('document-review')
    } catch (err: any) {
      console.error('[ProjectWizard] doc analyze error:', err)
      const msg = err?.message || 'No se pudo procesar el documento.'
      setUploadError(msg.length > 200 ? msg.substring(0, 200) + '...' : msg)
    } finally {
      setUploadingDoc(false)
    }
  }

  // Paso 2: el usuario confirma → crear proyecto definitivo
  const handleConfirmDraft = async () => {
    if (!docDraft) return
    if (!docDraftName.trim()) { setUploadError('Falta el nombre del proyecto'); return }
    if (docDraftChannels.length === 0) { setUploadError('Selecciona al menos un canal'); return }
    setUploadError('')
    setDocDraftCreating(true)
    try {
      // Preparar participantes detectados con nombre original (Kevin, Mateo...)
      const includedDetected = detectedParticipants
        .filter(p => p.include && (p.name.trim() || p.email.trim() || p.phone.trim()))
        .map(p => {
          const phoneRaw = p.phone.replace(/\D/g, '')
          return {
            name: p.name.trim(),
            email: p.email.trim().toLowerCase(),
            phone: phoneRaw.length >= 9 ? '+' + phoneRaw : '',
            role: p.role || p.roleInferred || 'Participante',
          }
        })

      // Agregar también las personas extra que el usuario añadió manualmente
      const extras = extraPeople.map(p => {
        const phoneRaw = (p.phone || '').replace(/\D/g, '')
        return {
          name: p.name,
          email: p.email,
          phone: phoneRaw.length >= 9 ? '+' + phoneRaw : '',
          role: p.role || 'Participante',
        }
      })

      const allParticipants = [...includedDetected, ...extras]

      const result = await api.createProjectFromDraft({
        draftId: docDraft.draftId,
        name: docDraftName.trim(),
        type: docDraftType,
        description: docDraftDescription.trim(),
        channels: docDraftChannels,
        emails: docDraftEmails,
        phones: docDraftPhones,
        timing: docDraftTiming.trim() || undefined,
        detectedParticipants: allParticipants,
      }, token)
      const count = result?.insightsGenerated?.count || 0
      setUploadSuccess(
        `✓ Proyecto "${result.name}" creado.${count > 0 ? ` ${count} insights generados.` : ''} Redirigiendo...`
      )
      setTimeout(() => {
        onWizardClose?.()
        onNavigate('proyectos')
      }, 1800)
    } catch (err: any) {
      console.error('[ProjectWizard] confirm draft error:', err)
      setUploadError(err?.message?.substring(0, 200) || 'Error al crear el proyecto')
    } finally {
      setDocDraftCreating(false)
    }
  }

  const toggleDocDraftChannel = (id: string) => {
    setDocDraftChannels(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }
  const addDocDraftEmail = () => {
    const e = docDraftEmailInput.trim().toLowerCase()
    if (!e || !e.includes('@')) return
    if (!docDraftEmails.includes(e)) setDocDraftEmails([...docDraftEmails, e])
    setDocDraftEmailInput('')
  }
  const addDocDraftPhone = () => {
    const cleaned = docDraftPhoneInput.replace(/\D/g, '')
    if (cleaned.length < 9) return
    const formatted = '+' + cleaned
    if (!docDraftPhones.includes(formatted)) setDocDraftPhones([...docDraftPhones, formatted])
    setDocDraftPhoneInput('')
  }

  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState('')
  const [descripcion, setDescripcion] = useState('')

  const [teamSearch, setTeamSearch] = useState('')
  const [selectedTeam, setSelectedTeam] = useState<TeamMember[]>([
    { ...TEAM_DIRECTORY[0], rol: 'PM' },
  ])
  const [teamRoles, setTeamRoles] = useState<Record<string, string>>({ 'jeniffer@agencia.com': 'PM' })
  const [teamPhones, setTeamPhones] = useState<Record<string, string>>({ 'jeniffer@agencia.com': '+50494622817' })
  const [externalEmail, setExternalEmail] = useState('')

  const [selectedChannels, setSelectedChannels] = useState<string[]>(['email'])
  const [deliveryDate, setDeliveryDate] = useState('')

  const searchResults = teamSearch.length >= 2
    ? TEAM_DIRECTORY.filter(p =>
        p.nombre.toLowerCase().includes(teamSearch.toLowerCase()) &&
        !selectedTeam.some(s => s.email === p.email)
      )
    : []

  const addTeamMember = (member: TeamMember) => {
    setSelectedTeam([...selectedTeam, member])
    setTeamRoles({ ...teamRoles, [member.email]: member.rol })
    if (member.telefono) setTeamPhones({ ...teamPhones, [member.email]: member.telefono })
    setTeamSearch('')
  }

  const removeTeamMember = (email: string) => {
    if (email === 'jeniffer@agencia.com') return
    setSelectedTeam(selectedTeam.filter(m => m.email !== email))
    const newRoles = { ...teamRoles }
    delete newRoles[email]
    setTeamRoles(newRoles)
    const newPhones = { ...teamPhones }
    delete newPhones[email]
    setTeamPhones(newPhones)
  }

  const updateRole = (email: string, rol: string) => {
    setTeamRoles({ ...teamRoles, [email]: rol })
  }

  const addExternal = () => {
    if (!externalEmail.includes('@')) return
    const name = externalEmail.split('@')[0]
    const initials = name.slice(0, 2).toUpperCase()
    const newMember: TeamMember = {
      nombre: name.charAt(0).toUpperCase() + name.slice(1),
      email: externalEmail,
      telefono: '',
      rol: 'Partner',
      iniciales: initials,
      color: 'from-gray-500 to-gray-600',
      projectCount: 0,
      isExternal: true,
    }
    setSelectedTeam([...selectedTeam, newMember])
    setTeamRoles({ ...teamRoles, [externalEmail]: 'Partner' })
    setExternalEmail('')
  }

  const toggleChannel = (id: string) => {
    setSelectedChannels(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  const canAdvance = () => {
    if (step === 1) return nombre.trim().length > 0 && tipo.length > 0
    if (step === 2) return selectedTeam.length > 0
    return true
  }

  const handleCreate = async () => {
    setCreating(true)
    try {
      await api.createProject({
        name: nombre,
        description: descripcion,
        type: tipo,
        participants: selectedTeam.map(m => ({ nombre: m.nombre, rol: teamRoles[m.email] || m.rol, email: m.email, telefono: teamPhones[m.email] || '' })),
        channels: selectedChannels,
        deliveryDate,
      }, token)
      onNavigate('proyectos')
    } catch (err) {
      console.error('Error creating project:', err)
      onNavigate('proyectos')
    } finally {
      setCreating(false)
    }
  }

  // Pantalla inicial: elegir modo
  if (mode === 'choose') {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-56px)] p-6 bg-[#0B0B14]">
        <div className="w-full max-w-3xl">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-white mb-2">Nuevo proyecto</h1>
            <p className="text-white/50">¿Cómo quieres empezar?</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Opción 1: Pegar texto */}
            <button
              onClick={() => setMode('paste')}
              className="group relative p-5 bg-gradient-to-br from-violet-600/15 to-violet-500/5 border-2 border-violet-500/30 rounded-2xl text-left hover:border-violet-400 hover:from-violet-600/25 transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 bg-violet-500/20 rounded-xl flex items-center justify-center">
                  <ClipboardPaste className="w-5 h-5 text-violet-400" />
                </div>
                <span className="text-[10px] font-bold text-violet-300 bg-violet-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Más rápido
                </span>
              </div>
              <h3 className="text-base font-bold text-white mb-2">
                Pegar conversación
              </h3>
              <p className="text-sm text-white/60 leading-relaxed">
                Copia un chat de WhatsApp o un hilo de correo y pégalo aquí. La IA detectará tareas, riesgos y decisiones.
              </p>
              <p className="text-xs text-violet-300 mt-3 font-medium opacity-80 group-hover:opacity-100">
                Texto pegado → continuar
              </p>
            </button>

            {/* Opción 2: Subir documento */}
            <button
              onClick={() => setMode('document')}
              className="group p-5 bg-[#161625] border-2 border-white/10 rounded-2xl text-left hover:border-violet-500/50 hover:bg-[#1a1a2e] transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 bg-white/5 rounded-xl flex items-center justify-center">
                  <FileText className="w-5 h-5 text-violet-400" />
                </div>
              </div>
              <h3 className="text-base font-bold text-white mb-2">
                Subir un documento
              </h3>
              <p className="text-sm text-white/60 leading-relaxed">
                Brief, acta, propuesta o PDF. La IA leerá su contenido y creará el proyecto con todo.
              </p>
              <p className="text-xs text-white/40 mt-3 font-medium">
                PDF, Word, TXT, imagen → continuar
              </p>
            </button>

            {/* Opción 3: Llenar formulario manual */}
            <button
              onClick={() => setMode('manual')}
              className="group p-5 bg-[#161625] border-2 border-white/10 rounded-2xl text-left hover:border-white/20 hover:bg-[#1a1a2e] transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 bg-white/5 rounded-xl flex items-center justify-center">
                  <Edit3 className="w-5 h-5 text-white/60" />
                </div>
              </div>
              <h3 className="text-base font-bold text-white mb-2">Llenar formulario</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                Completa los campos del proyecto manualmente: nombre, equipo, canales, fechas.
              </p>
              <p className="text-xs text-white/40 mt-3 font-medium">
                3 pasos guiados → continuar
              </p>
            </button>
          </div>

          <button
            onClick={() => onNavigate('proyectos')}
            className="mt-6 mx-auto block text-sm text-white/40 hover:text-white/60 transition-colors"
          >
            ← Cancelar y volver
          </button>
        </div>
      </div>
    )
  }

  // Pantalla de pegar texto
  if (mode === 'paste') {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-56px)] p-6 bg-[#0B0B14]">
        <div className="w-full max-w-2xl">
          <div className="mb-6">
            <button
              onClick={() => { setMode('choose'); setUploadError(''); setUploadSuccess('') }}
              className="text-sm text-white/50 hover:text-white/80 transition-colors flex items-center gap-1.5 mb-4"
            >
              <ArrowLeft className="w-4 h-4" /> Volver
            </button>
            <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              <ClipboardPaste className="w-5 h-5 text-violet-400" />
              Crear proyecto desde una conversación
            </h1>
            <p className="text-sm text-white/50">
              Pega un chat de WhatsApp, hilo de correo o cualquier texto. La IA detectará tareas, riesgos y decisiones, y creará el proyecto automáticamente.
            </p>
          </div>

          <TextPaster
            variant="dark"
            loading={uploadingDoc}
            loadingText="🤖 La IA está analizando el texto..."
            errorMessage={uploadError}
            successMessage={uploadSuccess}
            onAnalyze={handlePastedText}
          />

          <p className="text-xs text-white/30 text-center mt-4">
            El texto queda guardado como adjunto del proyecto.
          </p>
        </div>
      </div>
    )
  }

  // Pantalla de subir documento
  if (mode === 'document') {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-56px)] p-6 bg-[#0B0B14]">
        <div className="w-full max-w-2xl">
          <div className="mb-6">
            <button
              onClick={() => { setMode('choose'); setUploadError(''); setUploadSuccess('') }}
              className="text-sm text-white/50 hover:text-white/80 transition-colors flex items-center gap-1.5 mb-4"
            >
              <ArrowLeft className="w-4 h-4" /> Volver
            </button>
            <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-400" />
              Crear proyecto desde documento
            </h1>
            <p className="text-sm text-white/50">
              La IA leerá el contenido del documento y generará automáticamente el nombre, la descripción y los insights del proyecto.
            </p>
          </div>

          <DocumentUploader
            variant="dark"
            onFileSelected={handleDocumentUpload}
            loading={uploadingDoc}
            loadingText="🤖 La IA está leyendo el documento..."
            errorMessage={uploadError}
            successMessage={uploadSuccess}
            label="Sube tu documento"
            hint="Acta, brief, propuesta, requisitos... la IA inferirá todo"
          />

          <p className="text-xs text-white/30 text-center mt-4">
            El documento queda anexado al proyecto y podrás descargarlo después.
          </p>
        </div>
      </div>
    )
  }

  // Pantalla de revisión post-análisis
  if (mode === 'document-review' && docDraft) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-56px)] p-6 bg-[#0B0B14]">
        <div className="w-full max-w-2xl my-8">
          <div className="mb-6">
            <button
              onClick={() => { setMode('document'); setUploadError(''); setUploadSuccess(''); setDocDraft(null) }}
              disabled={docDraftCreating}
              className="text-sm text-white/50 hover:text-white/80 transition-colors flex items-center gap-1.5 mb-4 disabled:opacity-50"
            >
              <ArrowLeft className="w-4 h-4" /> Subir otro documento
            </button>
            <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-400" />
              Revisa el proyecto antes de crear
            </h1>
            <p className="text-sm text-white/50">
              La IA analizó <strong className="text-white/80">{docDraft.fileName}</strong> ({docDraft.extractedTextLength.toLocaleString()} caracteres). Revisa, edita lo que quieras y elige los canales antes de crear el proyecto.
            </p>
          </div>

          <div className="bg-[#161625] border border-white/10 rounded-xl p-5 space-y-4">
            {/* Nombre */}
            <div>
              <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-1.5">Nombre del proyecto</label>
              <input
                type="text"
                value={docDraftName}
                onChange={e => setDocDraftName(e.target.value)}
                disabled={docDraftCreating}
                className="w-full px-3 py-2.5 bg-[#0E0E1A] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition disabled:opacity-50"
              />
            </div>

            {/* Tipo (input libre con sugerencias) */}
            <div>
              <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-1.5">Tipo de proyecto</label>
              <input
                type="text"
                list="doc-draft-types"
                value={docDraftType}
                onChange={e => setDocDraftType(e.target.value)}
                disabled={docDraftCreating}
                placeholder="Ej: Desarrollo Web, Marketing, RRHH... o el que necesites"
                maxLength={60}
                className="w-full px-3 py-2.5 bg-[#0E0E1A] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition disabled:opacity-50"
              />
              <datalist id="doc-draft-types">
                {DOC_PROJECT_TYPES.map(t => <option key={t} value={t} />)}
              </datalist>
              <p className="text-[10px] text-white/30 mt-1 italic">Puedes elegir una sugerencia o escribir el tipo personalizado.</p>
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-1.5">Descripción</label>
              <textarea
                value={docDraftDescription}
                onChange={e => setDocDraftDescription(e.target.value)}
                disabled={docDraftCreating}
                rows={4}
                className="w-full px-3 py-2.5 bg-[#0E0E1A] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition resize-none disabled:opacity-50"
              />
              <p className="text-[10px] text-white/30 mt-1 italic">Generada por la IA — puedes editarla.</p>
            </div>

            {/* Timing del proyecto (opcional) */}
            <div>
              <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-1.5">
                Timing del proyecto <span className="text-white/30 font-normal lowercase">(opcional, recomendado)</span>
              </label>
              <input
                type="text"
                value={docDraftTiming}
                onChange={e => setDocDraftTiming(e.target.value)}
                disabled={docDraftCreating}
                placeholder="Ej: 8 semanas, Q3 2026, entrega el 30/06/2026..."
                maxLength={100}
                className="w-full px-3 py-2.5 bg-[#0E0E1A] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition disabled:opacity-50"
              />
              <p className="text-[10px] text-white/30 mt-1 italic">Plazo aproximado del proyecto. Puede ser una duración o una fecha.</p>
            </div>

            {/* Canales */}
            <div>
              <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
                Canales del proyecto <span className="text-amber-400">*</span>
              </label>
              <p className="text-[11px] text-white/40 mb-2">Selecciona al menos uno. Estos canales se usarán para notificaciones y comunicación.</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'Gmail', label: 'Gmail', icon: Mail, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
                  { id: 'WhatsApp', label: 'WhatsApp', icon: MessageCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
                ].map(c => {
                  const active = docDraftChannels.includes(c.id)
                  const Icon = c.icon
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={docDraftCreating}
                      onClick={() => toggleDocDraftChannel(c.id)}
                      className={`relative flex items-center gap-2 p-3 rounded-lg border-2 transition-all disabled:opacity-50 ${
                        active ? `${c.bg} ${c.border}` : 'bg-white/5 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${active ? c.color : 'text-white/40'}`} />
                      <span className={`text-sm font-medium ${active ? 'text-white' : 'text-white/60'}`}>{c.label}</span>
                      {active && <Check className="w-3.5 h-3.5 text-violet-400 ml-auto" />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* === SECCIÓN UNIFICADA: PERSONAS DEL PROYECTO === */}
            {/* Detectadas por IA + Extras agregadas manualmente + Botón "Agregar persona" */}
            <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-3">
              <div className="flex items-start gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-cyan-300 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                    Personas del proyecto {detectedParticipants.length + extraPeople.length > 0 ? `(${detectedParticipants.filter(p => p.include).length + extraPeople.length})` : '(opcional)'}
                  </p>
                  <p className="text-[11px] text-cyan-200/60 mt-0.5">
                    {detectedParticipants.length > 0
                      ? 'La IA detectó estas personas. Completa sus contactos (o desmárcalas si no aplican). Puedes agregar más con el botón al final.'
                      : 'No se detectaron personas en el texto. Puedes agregar miembros del equipo con el botón al final.'}
                  </p>
                </div>
              </div>

              {/* Detectadas por IA */}
              {detectedParticipants.length > 0 && (
                <div className="space-y-2 mb-2">
                  {detectedParticipants.map((p, idx) => {
                    const hasEmail = p.email.trim().includes('@')
                    const hasPhone = p.phone.replace(/\D/g, '').length >= 9
                    const willNotify = hasEmail || hasPhone
                    return (
                      <div
                        key={idx}
                        className={`rounded-md border p-2.5 transition-all ${
                          p.include
                            ? 'bg-[#0E0E1A] border-cyan-500/20'
                            : 'bg-[#0E0E1A]/40 border-white/5 opacity-50'
                        }`}
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <label className="flex items-center gap-1.5 cursor-pointer pt-0.5">
                            <input
                              type="checkbox"
                              checked={p.include}
                              onChange={e => {
                                const updated = [...detectedParticipants]
                                updated[idx] = { ...updated[idx], include: e.target.checked }
                                setDetectedParticipants(updated)
                              }}
                              disabled={docDraftCreating}
                              className="w-3.5 h-3.5 rounded accent-cyan-500 cursor-pointer"
                            />
                          </label>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-white">{p.name}</span>
                              <span className="text-[10px] text-cyan-300/70 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                                {p.roleInferred}
                              </span>
                              <span className="text-[10px] text-violet-300/70 bg-violet-500/10 px-1.5 py-0.5 rounded">
                                Detectada por IA
                              </span>
                            </div>
                          </div>
                        </div>
                        {p.include && (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 ml-5">
                              <input
                                type="email"
                                value={p.email}
                                onChange={e => {
                                  const updated = [...detectedParticipants]
                                  updated[idx] = { ...updated[idx], email: e.target.value }
                                  setDetectedParticipants(updated)
                                }}
                                disabled={docDraftCreating}
                                placeholder="📧 email@empresa.com"
                                className={`px-2.5 py-1.5 bg-[#0B0B14] border rounded-md text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-cyan-400 ${
                                  hasEmail ? 'border-emerald-500/30' : 'border-white/10'
                                }`}
                              />
                              <input
                                type="tel"
                                value={p.phone}
                                onChange={e => {
                                  const updated = [...detectedParticipants]
                                  updated[idx] = { ...updated[idx], phone: e.target.value }
                                  setDetectedParticipants(updated)
                                }}
                                disabled={docDraftCreating}
                                placeholder="📱 +34 600 000 000"
                                className={`px-2.5 py-1.5 bg-[#0B0B14] border rounded-md text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-cyan-400 ${
                                  hasPhone ? 'border-emerald-500/30' : 'border-white/10'
                                }`}
                              />
                            </div>
                            <p className="text-[10px] text-white/40 mt-1.5 ml-5">
                              {willNotify ? (
                                <span className="text-emerald-300">
                                  ✓ Se agregará con notificaciones por {hasEmail && hasPhone ? 'email y WhatsApp' : hasEmail ? 'email' : 'WhatsApp'}
                                </span>
                              ) : (
                                <span className="text-white/40 italic">Se agregará como participante sin canal de notificación</span>
                              )}
                            </p>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Extras agregadas manualmente */}
              {extraPeople.length > 0 && (
                <div className="space-y-2 mb-2">
                  {extraPeople.map((p, idx) => {
                    const hasEmail = p.email.trim().includes('@')
                    const hasPhone = p.phone.replace(/\D/g, '').length >= 9
                    const willNotify = hasEmail || hasPhone
                    return (
                      <div key={idx} className="rounded-md border border-cyan-500/20 bg-[#0E0E1A] p-2.5">
                        <div className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-cyan-300 mt-1 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-sm font-semibold text-white">{p.name}</span>
                              {p.role && (
                                <span className="text-[10px] text-cyan-300/70 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                                  {p.role}
                                </span>
                              )}
                              <span className="text-[10px] text-amber-300/70 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                Agregada por ti
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-white/50">
                              {hasEmail && <span>📧 {p.email}</span>}
                              {hasPhone && <span>📱 {p.phone}</span>}
                              {!willNotify && <span className="italic">Sin canal de notificación</span>}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeExtraPerson(idx)}
                            disabled={docDraftCreating}
                            className="text-white/40 hover:text-red-400 transition-colors"
                            title="Quitar persona"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Mini-formulario para agregar persona extra */}
              {addingExtra ? (
                <div className="rounded-md border border-cyan-500/30 bg-[#0E0E1A] p-3 space-y-2">
                  <p className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider mb-1">Agregar persona al equipo</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={extraForm.name}
                      onChange={e => setExtraForm({ ...extraForm, name: e.target.value })}
                      disabled={docDraftCreating}
                      placeholder="Nombre (ej: Ana López)"
                      className="px-2.5 py-1.5 bg-[#0B0B14] border border-white/10 rounded-md text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={extraForm.role}
                      onChange={e => setExtraForm({ ...extraForm, role: e.target.value })}
                      disabled={docDraftCreating}
                      placeholder="Rol (ej: Diseñadora, PM)"
                      className="px-2.5 py-1.5 bg-[#0B0B14] border border-white/10 rounded-md text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                    />
                    <input
                      type="email"
                      value={extraForm.email}
                      onChange={e => setExtraForm({ ...extraForm, email: e.target.value })}
                      disabled={docDraftCreating}
                      placeholder="📧 email@empresa.com (opcional)"
                      className="px-2.5 py-1.5 bg-[#0B0B14] border border-white/10 rounded-md text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                    />
                    <input
                      type="tel"
                      value={extraForm.phone}
                      onChange={e => setExtraForm({ ...extraForm, phone: e.target.value })}
                      onKeyPress={e => { if (e.key === 'Enter') { e.preventDefault(); submitExtraPerson() } }}
                      disabled={docDraftCreating}
                      placeholder="📱 +34 600 000 000 (opcional)"
                      className="px-2.5 py-1.5 bg-[#0B0B14] border border-white/10 rounded-md text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                    />
                  </div>
                  {extraFormError && (
                    <p className="text-[11px] text-red-400">{extraFormError}</p>
                  )}
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      type="button"
                      onClick={cancelExtraForm}
                      disabled={docDraftCreating}
                      className="px-3 py-1.5 text-[11px] text-white/60 hover:text-white transition-colors disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={submitExtraPerson}
                      disabled={docDraftCreating}
                      className="px-3 py-1.5 bg-cyan-600 text-white text-[11px] font-medium rounded-md hover:bg-cyan-500 transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" /> Agregar al equipo
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingExtra(true)}
                  disabled={docDraftCreating}
                  className="w-full px-3 py-2 bg-[#0E0E1A] border border-dashed border-cyan-500/30 hover:border-cyan-400/50 hover:bg-cyan-500/5 rounded-md text-xs text-cyan-300 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <span className="text-base">+</span> Agregar otra persona al equipo
                </button>
              )}
            </div>

            {/* Errores y feedback */}
            {uploadError && (
              <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-300 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                {uploadError}
              </div>
            )}
            {uploadSuccess && (
              <div className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-300">
                {uploadSuccess}
              </div>
            )}

            {/* Botón confirmar */}
            <button
              type="button"
              onClick={handleConfirmDraft}
              disabled={docDraftCreating || !docDraftName.trim() || docDraftChannels.length === 0}
              className="w-full px-6 py-3.5 bg-violet-600 text-white font-medium rounded-xl hover:bg-violet-500 transition-all shadow-lg shadow-violet-600/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {docDraftCreating ? (
                <>
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  Creando proyecto y generando insights...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Crear proyecto
                </>
              )}
            </button>

            <p className="text-[10px] text-white/30 text-center">
              El documento <strong>{docDraft.fileName}</strong> quedará anexado al proyecto.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Pantalla manual (wizard tradicional)
  return (
    <div className="flex h-[calc(100vh-56px)]">
      <aside className="w-64 border-r border-white/5 bg-[#0E0E1A] flex-shrink-0 flex flex-col justify-between">
        <div className="p-6">
          <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-6">Nuevo Proyecto</h3>

          <div className="space-y-2">
            {[
              { num: 1, label: 'Proyecto', sub: 'Nombre y tipo' },
              { num: 2, label: 'Equipo', sub: 'PM y participantes' },
              { num: 3, label: 'Canales y timing', sub: 'Comunicación y fechas' },
            ].map(s => (
              <div key={s.num} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step > s.num ? 'bg-emerald-500 text-white' :
                  step === s.num ? 'bg-violet-600 text-white' :
                  'bg-white/10 text-white/30'
                }`}>
                  {step > s.num ? <Check className="w-4 h-4" /> : s.num}
                </div>
                <div>
                  <p className={`text-sm font-medium ${step >= s.num ? 'text-white' : 'text-white/30'}`}>{s.label}</p>
                  <p className="text-[11px] text-white/30">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {nombre && (
          <div className="p-4">
            <div className="bg-[#161625] rounded-xl p-4 border border-white/5">
              <p className="text-[10px] font-bold text-white/30 uppercase mb-2">Vista Previa</p>
              <h4 className="text-sm font-bold text-white">{nombre}</h4>
              {tipo && <p className="text-xs text-violet-400 mt-0.5">{tipo}</p>}
              {selectedTeam.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] text-white/30 mb-1">PM</p>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${selectedTeam[0].color} flex items-center justify-center text-[8px] text-white font-bold`}>
                      {selectedTeam[0].iniciales}
                    </div>
                    <span className="text-xs text-white/60">{selectedTeam[0].nombre}</span>
                  </div>
                </div>
              )}
              {selectedTeam.length > 1 && (
                <div className="mt-2">
                  <p className="text-[10px] text-white/30 mb-1">Equipo</p>
                  <div className="flex -space-x-1.5">
                    {selectedTeam.slice(1).map((m, i) => (
                      <div key={i} className={`w-5 h-5 rounded-full bg-gradient-to-br ${m.color} flex items-center justify-center text-[8px] text-white font-bold border border-[#161625]`}>
                        {m.iniciales}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedChannels.length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] text-white/30 mb-1">Canales</p>
                  <div className="flex gap-1">
                    {selectedChannels.map(ch => {
                      const channel = CHANNELS.find(c => c.id === ch)
                      if (!channel) return null
                      const Icon = channel.icon
                      return <Icon key={ch} className={`w-4 h-4 ${channel.color}`} />
                    })}
                  </div>
                </div>
              )}
              {deliveryDate ? (
                <div className="mt-2">
                  <p className="text-[10px] text-white/30">Entrega</p>
                  <p className="text-xs text-white/60">{deliveryDate}</p>
                </div>
              ) : (
                <div className="mt-2">
                  <p className="text-[10px] text-white/30">Entrega</p>
                  <p className="text-xs text-white/30">— por definir</p>
                </div>
              )}
            </div>
          </div>
        )}
      </aside>

      <main className="flex-1 overflow-y-auto flex flex-col">
        <div className="flex-1 max-w-2xl mx-auto w-full px-8 py-10">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-2xl font-bold text-white mb-2">¿Cómo se llama tu proyecto?</h2>
                <p className="text-sm text-white/40 mb-8">Define el nombre, tipo y descripción del proyecto.</p>

                <div className="space-y-6">
                  <div>
                    <label className="text-sm text-white/60 block mb-2">Nombre del proyecto</label>
                    <input
                      value={nombre}
                      onChange={e => setNombre(e.target.value)}
                      className="w-full px-4 py-3 bg-[#161625] border border-white/10 rounded-xl text-white placeholder-white/20 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 outline-none transition-all"
                      placeholder="Ej: Rediseño Portal Web"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-white/60 block mb-2">Tipo de proyecto</label>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      {PROJECT_TYPES.map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTipo(t)}
                          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                            tipo === t
                              ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
                              : 'bg-white/5 border-white/5 text-white/50 hover:border-white/10 hover:text-white/70'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={tipo}
                      onChange={e => setTipo(e.target.value)}
                      placeholder="O escribe un tipo personalizado..."
                      maxLength={60}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-white/60 block mb-2">Descripción (opcional)</label>
                    <textarea
                      value={descripcion}
                      onChange={e => setDescripcion(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 bg-[#161625] border border-white/10 rounded-xl text-white placeholder-white/20 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 outline-none transition-all resize-none"
                      placeholder="Describe brevemente el alcance del proyecto..."
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-2xl font-bold text-white mb-2">¿Quién trabaja en este proyecto?</h2>
                <p className="text-sm text-white/40 mb-8">Busca por nombre. El sistema detecta si alguien ya está añadido.</p>

                <div className="relative mb-4">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                  <input
                    value={teamSearch}
                    onChange={e => setTeamSearch(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-[#161625] border border-white/10 rounded-xl text-white placeholder-white/20 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 outline-none transition-all"
                    placeholder="Buscar por nombre..."
                  />
                </div>

                {searchResults.length > 0 && (
                  <div className="bg-[#161625] border border-white/10 rounded-xl mb-4 overflow-hidden">
                    {searchResults.map(person => (
                      <div key={person.email} className="flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${person.color} flex items-center justify-center text-[10px] text-white font-bold`}>
                            {person.iniciales}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{person.nombre}</p>
                            <p className="text-xs text-white/30">{person.rol} · {person.email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => addTeamMember(person)}
                          className="text-xs text-violet-400 hover:text-violet-300 font-medium transition-colors"
                        >
                          + Añadir
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {selectedTeam.some(m => m.projectCount >= 3 && m.email !== 'jeniffer@agencia.com') && (
                  <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-4">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <p className="text-xs text-amber-400">
                      <span className="font-bold">{selectedTeam.find(m => m.projectCount >= 3 && m.email !== 'jeniffer@agencia.com')?.nombre}</span> ya participa en {selectedTeam.find(m => m.projectCount >= 3)?.projectCount} proyectos activos. Puedes añadirlo igualmente.
                    </p>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">Equipo Seleccionado</h3>
                  <div className="space-y-2">
                    {selectedTeam.map(member => (
                      <div key={member.email} className="bg-[#161625] rounded-xl px-4 py-3 border border-white/5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${member.color} flex items-center justify-center text-[10px] text-white font-bold`}>
                              {member.iniciales}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white">{member.nombre}</p>
                              <p className="text-xs text-white/30">{member.email}{member.isExternal ? ' · externo' : ''}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {member.email === 'jeniffer@agencia.com' ? (
                              <span className="px-3 py-1 bg-violet-600/20 text-violet-400 text-xs font-bold rounded-lg">PM</span>
                            ) : (
                              <>
                                <select
                                  value={teamRoles[member.email] || member.rol}
                                  onChange={e => updateRole(member.email, e.target.value)}
                                  className="bg-[#0E0E1A] border border-white/10 rounded-lg px-2 py-1 text-xs text-white/70 outline-none"
                                >
                                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                                <button
                                  onClick={() => removeTeamMember(member.email)}
                                  className="p-1 text-white/20 hover:text-red-400 transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2 ml-11">
                          <Phone className="w-3.5 h-3.5 text-white/20" />
                          <input
                            value={teamPhones[member.email] || ''}
                            onChange={e => setTeamPhones({ ...teamPhones, [member.email]: e.target.value })}
                            className="flex-1 px-3 py-1.5 bg-[#0E0E1A] border border-white/10 rounded-lg text-xs text-white/70 placeholder-white/20 focus:border-green-500/40 outline-none transition-all"
                            placeholder="+34 600 000 000"
                          />
                          {teamPhones[member.email] && (
                            <span className="text-[10px] text-green-400 font-medium">WhatsApp</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    value={externalEmail}
                    onChange={e => setExternalEmail(e.target.value)}
                    className="flex-1 px-4 py-3 bg-[#161625] border border-white/10 rounded-xl text-white placeholder-white/20 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 outline-none transition-all"
                    placeholder="Invitar externo por email..."
                    onKeyDown={e => e.key === 'Enter' && addExternal()}
                  />
                  <button
                    onClick={addExternal}
                    disabled={!externalEmail.includes('@')}
                    className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-medium text-white/60 hover:bg-white/10 transition-all disabled:opacity-30"
                  >
                    + Invitar
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-2xl font-bold text-white mb-2">Canales y timing</h2>
                <p className="text-sm text-white/40 mb-8">Selecciona los canales de comunicación y la fecha estimada de entrega.</p>

                <div className="mb-8">
                  <label className="text-sm text-white/60 block mb-3">Canales de comunicación</label>
                  <div className="grid grid-cols-3 gap-3">
                    {CHANNELS.map(ch => {
                      const Icon = ch.icon
                      const isActive = selectedChannels.includes(ch.id)
                      return (
                        <button
                          key={ch.id}
                          onClick={() => toggleChannel(ch.id)}
                          className={`flex items-center gap-3 px-4 py-4 rounded-xl border transition-all ${
                            isActive
                              ? `${ch.bgActive} border`
                              : 'bg-white/5 border-white/5 hover:border-white/10'
                          }`}
                        >
                          <Icon className={`w-5 h-5 ${ch.color}`} />
                          <span className={`text-sm font-medium ${isActive ? 'text-white' : 'text-white/50'}`}>{ch.label}</span>
                          {isActive && <Check className="w-4 h-4 text-emerald-400 ml-auto" />}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="mb-8">
                  <label className="text-sm text-white/60 block mb-3">Fecha estimada de entrega</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={e => setDeliveryDate(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-[#161625] border border-white/10 rounded-xl text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="bg-[#161625] rounded-xl p-6 border border-white/5">
                  <h3 className="text-sm font-bold text-white mb-4">Resumen del proyecto</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-white/30 uppercase">Nombre</p>
                      <p className="text-sm text-white font-medium">{nombre}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/30 uppercase">Tipo</p>
                      <p className="text-sm text-white font-medium">{tipo}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/30 uppercase">Equipo</p>
                      <div className="flex -space-x-2 mt-1">
                        {selectedTeam.map((m, i) => (
                          <div key={i} className={`w-7 h-7 rounded-full bg-gradient-to-br ${m.color} flex items-center justify-center text-[9px] text-white font-bold border-2 border-[#161625]`}>
                            {m.iniciales}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/30 uppercase">Canales</p>
                      <div className="flex gap-2 mt-1">
                        {selectedChannels.map(ch => {
                          const channel = CHANNELS.find(c => c.id === ch)
                          if (!channel) return null
                          const Icon = channel.icon
                          return (
                            <span key={ch} className="flex items-center gap-1 text-xs text-white/50">
                              <Icon className={`w-3.5 h-3.5 ${channel.color}`} />
                              {channel.label}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                    {deliveryDate && (
                      <div>
                        <p className="text-[10px] text-white/30 uppercase">Entrega</p>
                        <p className="text-sm text-white font-medium">{new Date(deliveryDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                      </div>
                    )}
                    {descripcion && (
                      <div className="col-span-2">
                        <p className="text-[10px] text-white/30 uppercase">Descripción</p>
                        <p className="text-sm text-white/60">{descripcion}</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="border-t border-white/5 px-8 py-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <button
              onClick={() => step === 1 ? onNavigate('proyectos') : setStep(step - 1)}
              className="flex items-center gap-2 px-4 py-2.5 border border-white/10 rounded-xl text-sm text-white/60 hover:text-white hover:border-white/20 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              {step === 1 ? 'Cancelar' : 'Atrás'}
            </button>

            <span className="text-sm text-white/30">Paso {step} de 3</span>

            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canAdvance()}
                className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-violet-600"
              >
                Siguiente
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-50"
              >
                {creating ? 'Creando...' : 'Crear proyecto'}
                {!creating && <Check className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
