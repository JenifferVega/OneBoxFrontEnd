import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
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

// Paleta de gradientes que asignamos deterministamente por email — el backend
// no manda color por miembro, lo derivamos acá para que cada persona tenga
// siempre el mismo avatar entre sesiones.
const AVATAR_GRADIENTS = [
  'from-violet-500 to-indigo-600',
  'from-blue-500 to-cyan-600',
  'from-pink-500 to-rose-600',
  'from-emerald-500 to-green-600',
  'from-amber-500 to-orange-600',
  'from-teal-500 to-emerald-600',
  'from-orange-500 to-red-600',
  'from-fuchsia-500 to-purple-600',
]

function gradientForEmail(email: string): string {
  let hash = 0
  for (let i = 0; i < email.length; i++) hash = (hash * 31 + email.charCodeAt(i)) >>> 0
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length]
}

const ROLES = ['PM', 'Dev Frontend', 'Dev Backend', 'DevOps', 'Diseño', 'QA', 'Partner', 'Cliente']
const PROJECT_TYPES = ['Desarrollo Web', 'Infraestructura', 'Diseño', 'Marketing', 'Ecommerce', 'Consultoría', 'Soporte', 'RRHH', 'Otro']
// WhatsApp escondido hasta que se re-active el canal (hoy solo trabajamos con
// correo). Para volver a mostrarlo, agregar la entrada de nuevo acá.
const CHANNELS = [
  { id: 'Gmail', label: 'Gmail', icon: Mail, color: 'text-blue-400', bgActive: 'bg-blue-500/20 border-blue-500/30' },
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

/** Una tarea sugerida por la IA en el preview. La IA propone `assigned_to`
 *  con el nombre de uno de los `detected_participants`; el usuario revisa y
 *  se manda tal cual al backend en /api/projects/from-document-draft.
 *  `_include` es client-only: true por defecto, false si el usuario la
 *  desmarca en el preview (entonces no se envía). */
export interface PreviewTask {
  text: string
  assigned_to?: string
  start_date?: string
  due_date?: string
  status?: string
  _include?: boolean
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
    tasks?: PreviewTask[]
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
  const { t } = useTranslation()
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
  // Tareas sugeridas por la IA en el preview (con assigned_to).
  // Se forwardean tal cual a /from-document-draft para que el backend las
  // persista sin regenerarlas (lo que perdería el assigned_to).
  const [docDraftTasks, setDocDraftTasks] = useState<PreviewTask[]>(
    (initialDraft?.suggestion?.tasks || []).map(t => ({ ...t, _include: t._include !== false }))
  )
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
      setExtraFormError('Ingresa al menos el nombre y correo')
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
  // Ref-guard adicional al state: `setCreating(true)` recién refleja en el
  // siguiente render, así que un usuario ansioso puede clickear 2 veces antes
  // de que el `disabled` se aplique. El ref bloquea en el mismo tick.
  const creatingRef = useRef(false)
  const [manualCreateError, setManualCreateError] = useState('')
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')

  const userId = auth.user?.profile?.sub || ''

  // Pegar texto: ahora también pasa por la pantalla de revisión (igual que documento)
  const handlePastedText = async (text: string, source: 'whatsapp' | 'gmail' | 'paste') => {
    setUploadError('')
    setUploadSuccess('')
    // Guard: la descripción/conversación pegada es la materia prima para que
    // la IA infiera nombre, tareas y participantes. Con menos de 15 chars no
    // hay señal suficiente y termina generando basura (o el proyecto queda
    // vacío). Mismo umbral que el modo manual para ser consistentes.
    if ((text || '').trim().length < 15) {
      setUploadError('Pega al menos 15 caracteres para que la IA pueda analizar.')
      return
    }
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
      // Tareas sugeridas con assigned_to (las preservamos para mandarlas al crear).
      // _include: true por defecto — el usuario puede desmarcar en el preview.
      setDocDraftTasks(((result.suggestion?.tasks || []) as PreviewTask[]).map(t => ({ ...t, _include: true })))
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
    // Guard: rechazar archivos vacíos antes de subir (el backend fallaría
    // igual pero con un mensaje menos claro).
    if (!file || file.size === 0) {
      setUploadError('El archivo está vacío. Selecciona uno con contenido para que la IA pueda analizarlo.')
      return
    }
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
      // Tareas sugeridas con assigned_to (las preservamos para mandarlas al crear).
      // _include: true por defecto — el usuario puede desmarcar en el preview.
      setDocDraftTasks(((result.suggestion?.tasks || []) as PreviewTask[]).map(t => ({ ...t, _include: true })))
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

      // Filtrar solo las tareas que el usuario marcó como incluidas, quitar
      // el flag client-only _include antes de mandar al backend, y validar
      // que assigned_to sea un nombre real del equipo (sino → vacío).
      const validNames = new Set(allParticipants.map(p => p.name.trim().toLowerCase()).filter(Boolean))
      const tasksToSend = docDraftTasks
        .filter(t => t._include !== false && t.text.trim())
        .map(({ _include, ...rest }) => {
          const assigned = (rest.assigned_to || '').trim()
          return {
            ...rest,
            text: rest.text.trim(),
            assigned_to: assigned && validNames.has(assigned.toLowerCase()) ? assigned : '',
          }
        })

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
        // Tareas confirmadas y editadas en el preview con su assigned_to.
        tasks: tasksToSend,
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
  const [selectedTeam, setSelectedTeam] = useState<TeamMember[]>([])
  const [teamRoles, setTeamRoles] = useState<Record<string, string>>({})
  const [teamPhones, setTeamPhones] = useState<Record<string, string>>({})
  const [externalEmail, setExternalEmail] = useState('')
  // Nombre real de la persona externa. Antes lo derivábamos del prefijo del
  // email (kotomivega@gmail.com → "kotomivega") lo cual resultaba en nombres
  // feos que quedaban registrados en el proyecto. Ahora el user lo introduce
  // explícito; si lo deja vacío, seguimos con el fallback del prefijo.
  const [externalName, setExternalName] = useState('')

  const [selectedChannels, setSelectedChannels] = useState<string[]>(['email'])
  const [deliveryDate, setDeliveryDate] = useState('')

  // Miembros reales de la org — se traen del backend al montar. Antes esto
  // era una lista hardcoded de 7 personas ficticias @agencia.com.
  const [orgMembers, setOrgMembers] = useState<TeamMember[]>([])
  useEffect(() => {
    if (!token) return
    let cancelled = false
    api.getOrgMembers(token)
      .then(res => {
        if (cancelled) return
        const members: TeamMember[] = (res.members || []).map(m => ({
          nombre: m.nombre,
          email: m.email,
          telefono: '',
          rol: 'Miembro',
          iniciales: m.iniciales,
          color: gradientForEmail(m.email),
          projectCount: 0,
        }))
        setOrgMembers(members)
      })
      .catch(() => { /* silencioso — el buscador queda vacío y se puede agregar externos */ })
    return () => { cancelled = true }
  }, [token])

  const searchResults = teamSearch.length >= 2
    ? orgMembers.filter(p =>
        (p.nombre.toLowerCase().includes(teamSearch.toLowerCase()) ||
         p.email.toLowerCase().includes(teamSearch.toLowerCase())) &&
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
    // Nombre explícito del user > fallback al prefijo del email. Ejemplo:
    // email=kotomivega@gmail.com sin nombre → "Kotomivega"; con nombre="María
    // López" → "María López".
    const typedName = externalName.trim()
    const derived = externalEmail.split('@')[0]
    const finalName = typedName || (derived.charAt(0).toUpperCase() + derived.slice(1))
    const initials = finalName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0].toUpperCase())
      .join('') || finalName.slice(0, 2).toUpperCase()
    const newMember: TeamMember = {
      nombre: finalName,
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
    setExternalName('')
  }

  const toggleChannel = (id: string) => {
    setSelectedChannels(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  const canAdvance = () => {
    // Step 1: exigir nombre + tipo + descripción con contenido real (≥15 ch).
    // Sin descripción mínima, la IA no puede generar insights útiles y el
    // proyecto queda vacío. 15 caracteres es umbral suave para no bloquear
    // usuarios legítimos pero rechazar entradas vacías o "aaa".
    if (step === 1) {
      return nombre.trim().length >= 3
        && tipo.length > 0
        && descripcion.trim().length >= 15
    }
    if (step === 2) return selectedTeam.length > 0
    return true
  }

  const handleCreate = async () => {
    // Guard doble: ref bloquea en el mismo tick del click, state maneja el
    // disabled del botón entre renders. Sin el ref, un doble-click rápido
    // dispara 2 análisis + 2 proyectos duplicados.
    if (creatingRef.current || creating) return
    creatingRef.current = true
    setManualCreateError('')
    setCreating(true)
    try {
      // FLUJO UNIFICADO: en vez de POST directo /api/projects, mandamos la
      // descripción a analyzeTextPreview para que la IA analice y proponga
      // tareas, participantes adicionales y canales. Luego el user aterriza
      // en `document-review` (la misma vista que usan paste/document) y
      // confirma. Beneficio: un solo flujo de validación humana antes de
      // que el proyecto exista. Rompemos así el atajo silencioso que
      // permitía crear proyectos sin revisar nada.
      const result = await api.analyzeTextPreview({
        text: descripcion.trim(),
        source: 'paste',
      }, token)

      setDocDraft({
        draftId: result.draftId,
        fileName: result.fileName,
        fileSize: result.fileSize,
        extractedTextLength: result.extractedTextLength,
        suggestion: result.suggestion,
      })
      // Prevalece lo que el user llenó a mano; la sugerencia de la IA solo
      // rellena huecos (descripción refinada, tareas, participantes extra).
      setDocDraftName(nombre.trim() || result.suggestion?.name || '')
      setDocDraftType(tipo || result.suggestion?.type || 'Otro')
      setDocDraftDescription(result.suggestion?.description || descripcion.trim())
      setDocDraftChannels(selectedChannels.length > 0 ? selectedChannels : ['Gmail'])
      // El equipo que el user seleccionó en step 2 va como `extraPeople` para
      // que se muestre visualmente en la pantalla de revisión. Antes lo ponía
      // en `docDraftEmails` que solo iba al backend pero no al UI, así que el
      // user pensaba que se habían perdido sus correos.
      setDocDraftEmails([])
      setDocDraftPhones([])
      setExtraPeople(selectedTeam.map(m => ({
        name: m.nombre || (m.email ? m.email.split('@')[0] : ''),
        email: m.email || '',
        phone: teamPhones[m.email] || '',
        role: teamRoles[m.email] || m.rol || 'Participante',
      })))
      setDocDraftTiming('')
      // Tareas sugeridas por la IA — el user puede desmarcar en el preview.
      setDocDraftTasks(((result.suggestion?.tasks || []) as PreviewTask[]).map(t => ({ ...t, _include: true })))
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
      console.error('Error creating project (analyze phase):', err)
      const msg = (err?.message || '').substring(0, 200) || 'Error al analizar la descripción del proyecto'
      setManualCreateError(msg)
    } finally {
      setCreating(false)
      creatingRef.current = false
    }
  }

  // Pantalla inicial: elegir modo
  if (mode === 'choose') {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-56px)] p-6 bg-[#0B0B14]">
        <div className="w-full max-w-3xl">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-white mb-2">{t('wizard.chooseTitle')}</h1>
            <p className="text-white/50">{t('wizard.chooseSubtitle')}</p>
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
                  {t('wizard.chooser.pasteBadge')}
                </span>
              </div>
              <h3 className="text-base font-bold text-white mb-2">
                {t('wizard.chooser.pasteTitle')}
              </h3>
              <p className="text-sm text-white/60 leading-relaxed">
                {t('wizard.chooser.pasteDesc')}
              </p>
              <p className="text-xs text-violet-300 mt-3 font-medium opacity-80 group-hover:opacity-100">
                {t('wizard.chooser.pasteFooter')}
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
                {t('wizard.chooser.documentTitle')}
              </h3>
              <p className="text-sm text-white/60 leading-relaxed">
                {t('wizard.chooser.documentDesc')}
              </p>
              <p className="text-xs text-white/40 mt-3 font-medium">
                {t('wizard.chooser.documentFooter')}
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
              <h3 className="text-base font-bold text-white mb-2">{t('wizard.chooser.manualTitle')}</h3>
              <p className="text-sm text-white/60 leading-relaxed">
                {t('wizard.chooser.manualDesc')}
              </p>
              <p className="text-xs text-white/40 mt-3 font-medium">
                {t('wizard.chooser.manualFooter')}
              </p>
            </button>
          </div>

          <button
            onClick={() => onNavigate('proyectos')}
            className="mt-6 mx-auto block text-sm text-white/40 hover:text-white/60 transition-colors"
          >
            {t('wizard.cancel')}
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
              <ArrowLeft className="w-4 h-4" /> {t('wizard.back')}
            </button>
            <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              <ClipboardPaste className="w-5 h-5 text-violet-400" />
              {t('wizard.paste.title')}
            </h1>
            <p className="text-sm text-white/50">
              {t('wizard.paste.subtitle')}
            </p>
          </div>

          <TextPaster
            variant="dark"
            loading={uploadingDoc}
            loadingText={t('wizard.paste.loading')}
            errorMessage={uploadError}
            successMessage={uploadSuccess}
            onAnalyze={handlePastedText}
          />

          <p className="text-xs text-white/30 text-center mt-4">
            {t('wizard.paste.attachmentNote')}
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
              <ArrowLeft className="w-4 h-4" /> {t('wizard.back')}
            </button>
            <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-400" />
              {t('wizard.document.title')}
            </h1>
            <p className="text-sm text-white/50">
              {t('wizard.document.subtitle')}
            </p>
          </div>

          <DocumentUploader
            variant="dark"
            onFileSelected={handleDocumentUpload}
            loading={uploadingDoc}
            loadingText={t('wizard.document.loading')}
            errorMessage={uploadError}
            successMessage={uploadSuccess}
            label={t('wizard.document.uploaderLabel')}
            hint={t('wizard.document.uploaderHint')}
          />

          <p className="text-xs text-white/30 text-center mt-4">
            {t('wizard.document.attachmentNote')}
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
              <ArrowLeft className="w-4 h-4" /> {t('wizard.backToUpload')}
            </button>
            <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-400" />
              {t('wizard.review.title')}
            </h1>
            <p className="text-sm text-white/50">
              {(() => {
                const raw = t('wizard.review.subtitle', {
                  fileName: docDraft.fileName,
                  chars: docDraft.extractedTextLength.toLocaleString(),
                })
                const parts = raw.split(/<1>|<\/1>/)
                return (<>{parts[0]}<strong className="text-white/80">{parts[1]}</strong>{parts[2]}</>)
              })()}
            </p>
          </div>

          <div className="bg-[#161625] border border-white/10 rounded-xl p-5 space-y-4">
            {/* Nombre */}
            <div>
              <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-1.5">{t('wizard.review.nameLabel')}</label>
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
              <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-1.5">{t('wizard.review.typeLabel')}</label>
              <input
                type="text"
                list="doc-draft-types"
                value={docDraftType}
                onChange={e => setDocDraftType(e.target.value)}
                disabled={docDraftCreating}
                placeholder={t('wizard.review.typePlaceholder')}
                maxLength={60}
                className="w-full px-3 py-2.5 bg-[#0E0E1A] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition disabled:opacity-50"
              />
              <datalist id="doc-draft-types">
                {DOC_PROJECT_TYPES.map(t => <option key={t} value={t} />)}
              </datalist>
              <p className="text-[10px] text-white/30 mt-1 italic">{t('wizard.review.typeHint')}</p>
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-1.5">{t('wizard.review.descriptionLabel')}</label>
              <textarea
                value={docDraftDescription}
                onChange={e => setDocDraftDescription(e.target.value)}
                disabled={docDraftCreating}
                rows={4}
                className="w-full px-3 py-2.5 bg-[#0E0E1A] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition resize-none disabled:opacity-50"
              />
              <p className="text-[10px] text-white/30 mt-1 italic">{t('wizard.review.descriptionHint')}</p>
            </div>

            {/* Timing del proyecto (opcional) */}
            <div>
              <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-1.5">
                {t('wizard.review.timingLabel')} <span className="text-white/30 font-normal lowercase">{t('wizard.review.timingOptional')}</span>
              </label>
              <input
                type="text"
                value={docDraftTiming}
                onChange={e => setDocDraftTiming(e.target.value)}
                disabled={docDraftCreating}
                placeholder={t('wizard.review.timingPlaceholder')}
                maxLength={100}
                className="w-full px-3 py-2.5 bg-[#0E0E1A] border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition disabled:opacity-50"
              />
              <p className="text-[10px] text-white/30 mt-1 italic">{t('wizard.review.timingHint')}</p>
            </div>

            {/* Canales */}
            <div>
              <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
                Canales del proyecto <span className="text-amber-400">*</span>
              </label>
              <p className="text-[11px] text-white/40 mb-2">{t('wizard.review.channelsHint')}</p>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { id: 'Gmail', label: 'Gmail', icon: Mail, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
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
                            <div className="ml-5">
                              <input
                                type="email"
                                value={p.email}
                                onChange={e => {
                                  const updated = [...detectedParticipants]
                                  updated[idx] = { ...updated[idx], email: e.target.value }
                                  setDetectedParticipants(updated)
                                }}
                                disabled={docDraftCreating}
                                placeholder={t('wizard.manual.detectedTasks.emailPlaceholder')}
                                className={`w-full px-2.5 py-1.5 bg-[#0B0B14] border rounded-md text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-cyan-400 ${
                                  hasEmail ? 'border-emerald-500/30' : 'border-white/10'
                                }`}
                              />
                              {/* Input de WhatsApp escondido. */}
                            </div>
                            <p className="text-[10px] text-white/40 mt-1.5 ml-5">
                              {hasEmail ? (
                                <span className="text-emerald-300">
                                  ✓ Se agregará con notificaciones por email
                                </span>
                              ) : (
                                <span className="text-white/40 italic">{t('wizard.manual.detectedTasks.noChannelHint')}</span>
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
                              {!willNotify && <span className="italic">{t('wizard.manual.detectedTasks.noChannelBadge')}</span>}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeExtraPerson(idx)}
                            disabled={docDraftCreating}
                            className="text-white/40 hover:text-red-400 transition-colors"
                            title={t('wizard.manual.detectedTasks.removeTooltip')}
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
                  <p className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider mb-1">{t('wizard.manual.detectedTasks.addPersonTitle')}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={extraForm.name}
                      onChange={e => setExtraForm({ ...extraForm, name: e.target.value })}
                      disabled={docDraftCreating}
                      placeholder={t('wizard.manual.detectedTasks.namePlaceholder')}
                      className="px-2.5 py-1.5 bg-[#0B0B14] border border-white/10 rounded-md text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={extraForm.role}
                      onChange={e => setExtraForm({ ...extraForm, role: e.target.value })}
                      disabled={docDraftCreating}
                      placeholder={t('wizard.manual.detectedTasks.rolePlaceholder')}
                      className="px-2.5 py-1.5 bg-[#0B0B14] border border-white/10 rounded-md text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                    />
                    <input
                      type="email"
                      value={extraForm.email}
                      onChange={e => setExtraForm({ ...extraForm, email: e.target.value })}
                      disabled={docDraftCreating}
                      placeholder={t('wizard.manual.detectedTasks.emailPlaceholderOptional')}
                      className="px-2.5 py-1.5 bg-[#0B0B14] border border-white/10 rounded-md text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                    />
                    {/* Input de WhatsApp escondido — solo email. */}
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

            {/* === SECCIÓN: TAREAS DETECTADAS CON ASIGNACIÓN ===
                La IA propone tareas con responsable (regla: solo nombres del
                equipo detectado). Aquí el usuario revisa, edita, desmarca o
                reasigna antes de crear el proyecto — así no tiene que ir tarea
                por tarea después en la vista del proyecto. */}
            {docDraftTasks.length > 0 && (
              <div className="rounded-lg border border-violet-500/20 bg-[#0E0E1A] p-3 space-y-2.5">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <p className="text-[11px] font-bold text-violet-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3" />
                      Tareas detectadas ({docDraftTasks.filter(t => t._include !== false).length}/{docDraftTasks.length})
                    </p>
                    <p className="text-[10px] text-white/40 mt-0.5">
                      La IA asignó cada tarea según el chat. Desmarca las que no apliquen o cambia el responsable.
                    </p>
                  </div>
                </div>

                {/* Pool de nombres válidos para el dropdown = detectados marcados + extras */}
                {(() => {
                  const assigneeOptions = [
                    ...detectedParticipants.filter(p => p.include && p.name.trim()).map(p => p.name.trim()),
                    ...extraPeople.map(p => p.name.trim()).filter(Boolean),
                  ]
                  return docDraftTasks.map((task, idx) => {
                    const included = task._include !== false
                    return (
                      <div
                        key={idx}
                        className={`rounded-md border p-2.5 transition-all ${
                          included
                            ? 'border-violet-500/20 bg-[#12121E]'
                            : 'border-white/5 bg-[#0B0B14] opacity-50'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => setDocDraftTasks(prev => prev.map((t, i) => i === idx ? { ...t, _include: !included } : t))}
                            disabled={docDraftCreating}
                            className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all ${
                              included
                                ? 'bg-violet-500 border-violet-500'
                                : 'border-white/30 hover:border-white/50'
                            }`}
                            title={included ? 'Excluir esta tarea' : 'Incluir esta tarea'}
                          >
                            {included && <Check className="w-3 h-3 text-white" />}
                          </button>
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <input
                              type="text"
                              value={task.text}
                              onChange={e => setDocDraftTasks(prev => prev.map((t, i) => i === idx ? { ...t, text: e.target.value } : t))}
                              disabled={docDraftCreating || !included}
                              className="w-full px-2 py-1 bg-[#0B0B14] border border-white/10 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-400 disabled:opacity-60"
                              placeholder={t('wizard.manual.detectedTasks.taskTextPlaceholder')}
                            />
                            <div className="flex items-center gap-2 flex-wrap">
                              <select
                                value={task.assigned_to || ''}
                                onChange={e => setDocDraftTasks(prev => prev.map((t, i) => i === idx ? { ...t, assigned_to: e.target.value } : t))}
                                disabled={docDraftCreating || !included}
                                className="px-2 py-1 bg-[#0B0B14] border border-white/10 rounded text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-violet-400 disabled:opacity-60"
                                title={t('wizard.manual.detectedTasks.assigneeTooltip')}
                              >
                                <option value="">👤 Sin asignar</option>
                                {assigneeOptions.map(n => (
                                  <option key={n} value={n}>👤 {n}</option>
                                ))}
                              </select>
                              <input
                                type="date"
                                value={task.start_date || ''}
                                onChange={e => setDocDraftTasks(prev => prev.map((t, i) => i === idx ? { ...t, start_date: e.target.value } : t))}
                                disabled={docDraftCreating || !included}
                                className="px-2 py-1 bg-[#0B0B14] border border-white/10 rounded text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-violet-400 disabled:opacity-60"
                                title={t('wizard.manual.detectedTasks.startDateTooltip')}
                              />
                              <input
                                type="date"
                                value={task.due_date || ''}
                                onChange={e => setDocDraftTasks(prev => prev.map((t, i) => i === idx ? { ...t, due_date: e.target.value } : t))}
                                disabled={docDraftCreating || !included}
                                className="px-2 py-1 bg-[#0B0B14] border border-white/10 rounded text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-violet-400 disabled:opacity-60"
                                title={t('wizard.manual.detectedTasks.dueDateTooltip')}
                              />
                              {task.assigned_to && !assigneeOptions.some(n => n.toLowerCase() === task.assigned_to!.toLowerCase()) && (
                                <span className="text-[10px] text-amber-400/80 bg-amber-500/10 px-1.5 py-0.5 rounded" title={t('wizard.manual.detectedTasks.ghostAssignee')}>
                                  ⚠ no está en el equipo
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            )}

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
          <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-6">{t('wizard.manual.sidebar.title')}</h3>

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
              <p className="text-[10px] font-bold text-white/30 uppercase mb-2">{t('wizard.manual.sidebar.previewLabel')}</p>
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
                  <p className="text-[10px] text-white/30 mb-1">{t('wizard.manual.sidebar.teamLabel')}</p>
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
                  <p className="text-[10px] text-white/30 mb-1">{t('wizard.manual.sidebar.channelsLabel')}</p>
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
                  <p className="text-[10px] text-white/30">{t('wizard.manual.sidebar.deliveryLabel')}</p>
                  <p className="text-xs text-white/60">{deliveryDate}</p>
                </div>
              ) : (
                <div className="mt-2">
                  <p className="text-[10px] text-white/30">{t('wizard.manual.sidebar.deliveryLabel')}</p>
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
                <h2 className="text-2xl font-bold text-white mb-2">{t('wizard.manual.step1.title')}</h2>
                <p className="text-sm text-white/40 mb-8">{t('wizard.manual.step1.subtitle')}</p>

                <div className="space-y-6">
                  <div>
                    <label className="text-sm text-white/60 block mb-2">{t('wizard.manual.step1.nameLabel')}</label>
                    <input
                      value={nombre}
                      onChange={e => setNombre(e.target.value)}
                      className="w-full px-4 py-3 bg-[#161625] border border-white/10 rounded-xl text-white placeholder-white/20 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 outline-none transition-all"
                      placeholder={t('wizard.manual.step1.namePlaceholder')}
                    />
                  </div>

                  <div>
                    <label className="text-sm text-white/60 block mb-2">{t('wizard.manual.step1.typeLabel')}</label>
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
                      placeholder={t('wizard.manual.step1.typeCustomPlaceholder')}
                      maxLength={60}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-white/60 block mb-2">
                      {t('wizard.manual.step1.descriptionLabel')}
                      <span className="text-red-400 ml-1">*</span>
                    </label>
                    <textarea
                      value={descripcion}
                      onChange={e => setDescripcion(e.target.value)}
                      rows={3}
                      className={`w-full px-4 py-3 bg-[#161625] border rounded-xl text-white placeholder-white/20 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 outline-none transition-all resize-none ${
                        descripcion.trim().length > 0 && descripcion.trim().length < 15
                          ? 'border-red-500/40'
                          : 'border-white/10'
                      }`}
                      placeholder={t('wizard.manual.step1.descriptionPlaceholder')}
                    />
                    <p className={`text-[11px] mt-1.5 ${
                      descripcion.trim().length > 0 && descripcion.trim().length < 15
                        ? 'text-red-300'
                        : 'text-white/40'
                    }`}>
                      {descripcion.trim().length > 0 && descripcion.trim().length < 15
                        ? `${15 - descripcion.trim().length} caracteres más para el mínimo (15).`
                        : t('wizard.manual.step1.descriptionHint')}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-2xl font-bold text-white mb-2">{t('wizard.manual.step2.title')}</h2>
                <p className="text-sm text-white/40 mb-8">{t('wizard.manual.step2.subtitle')}</p>

                <div className="relative mb-4">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                  <input
                    value={teamSearch}
                    onChange={e => setTeamSearch(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-[#161625] border border-white/10 rounded-xl text-white placeholder-white/20 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 outline-none transition-all"
                    placeholder={t('wizard.manual.step2.searchPlaceholder')}
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

                {selectedTeam.some(m => m.projectCount >= 3) && (
                  <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-4">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <p className="text-xs text-amber-400">
                      <span className="font-bold">{selectedTeam.find(m => m.projectCount >= 3)?.nombre}</span> ya participa en {selectedTeam.find(m => m.projectCount >= 3)?.projectCount} proyectos activos. Puedes añadirlo igualmente.
                    </p>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">{t('wizard.manual.step2.selectedTeam')}</h3>
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
                          </div>
                        </div>
                        {/* Input de WhatsApp escondido — solo email por ahora. */}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    value={externalName}
                    onChange={e => setExternalName(e.target.value)}
                    className="w-40 px-4 py-3 bg-[#161625] border border-white/10 rounded-xl text-white placeholder-white/20 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 outline-none transition-all"
                    placeholder="Nombre"
                    onKeyDown={e => e.key === 'Enter' && addExternal()}
                    maxLength={80}
                  />
                  <input
                    value={externalEmail}
                    onChange={e => setExternalEmail(e.target.value)}
                    className="flex-1 px-4 py-3 bg-[#161625] border border-white/10 rounded-xl text-white placeholder-white/20 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 outline-none transition-all"
                    placeholder={t('wizard.manual.step2.externalPlaceholder')}
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
                <p className="text-[11px] text-white/30 mt-2 italic">
                  El nombre es opcional pero recomendado — si lo dejás vacío usamos el prefijo del correo.
                </p>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-2xl font-bold text-white mb-2">{t('wizard.manual.step3.title')}</h2>
                <p className="text-sm text-white/40 mb-8">{t('wizard.manual.step3.subtitle')}</p>

                <div className="mb-8">
                  <label className="text-sm text-white/60 block mb-3">{t('wizard.manual.step3.channelsLabel')}</label>
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
                  <label className="text-sm text-white/60 block mb-3">{t('wizard.manual.step3.deliveryLabel')}</label>
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
                  <h3 className="text-sm font-bold text-white mb-4">{t('wizard.manual.step3.summaryTitle')}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-white/30 uppercase">{t('wizard.manual.step3.summaryName')}</p>
                      <p className="text-sm text-white font-medium">{nombre}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/30 uppercase">Tipo</p>
                      <p className="text-sm text-white font-medium">{tipo}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/30 uppercase">{t('wizard.manual.step3.summaryTeam')}</p>
                      <div className="flex -space-x-2 mt-1">
                        {selectedTeam.map((m, i) => (
                          <div key={i} className={`w-7 h-7 rounded-full bg-gradient-to-br ${m.color} flex items-center justify-center text-[9px] text-white font-bold border-2 border-[#161625]`}>
                            {m.iniciales}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/30 uppercase">{t('wizard.manual.step3.summaryChannels')}</p>
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
                        <p className="text-[10px] text-white/30 uppercase">{t('wizard.manual.step3.summaryDelivery')}</p>
                        <p className="text-sm text-white font-medium">{new Date(deliveryDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                      </div>
                    )}
                    {descripcion && (
                      <div className="col-span-2">
                        <p className="text-[10px] text-white/30 uppercase">{t('wizard.manual.step3.summaryDescription')}</p>
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
          {manualCreateError && (
            <div className="max-w-2xl mx-auto mb-3 px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-300">
              {manualCreateError}
            </div>
          )}
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
