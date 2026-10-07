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
import PersonAutocomplete from './PersonAutocomplete'
import { matchContacts, useContacts } from '../hooks/useContacts'

// Gradient palette assigned deterministically by email — the backend
// doesn't send a color per member, we derive it here so each person always
// gets the same avatar across sessions.
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

const ROLES = ['PM', 'Dev Frontend', 'Dev Backend', 'DevOps', 'Design', 'QA', 'Partner', 'Client']
const PROJECT_TYPES = ['Web Development', 'Infrastructure', 'Design', 'Marketing', 'Ecommerce', 'Consulting', 'Support', 'HR', 'Other']
// WhatsApp hidden until the channel is re-enabled (today we only work with
// email). To show it again, add the entry back here.
const CHANNELS = [
  { id: 'Gmail', label: 'Gmail', icon: Mail, color: 'text-blue-400', bgActive: 'bg-blue-500/20 border-blue-500/30' },
]

interface TeamMember {
  name: string
  email: string
  phone: string
  role: string
  initials: string
  color: string
  projectCount: number
  isExternal?: boolean
}

export interface DetectedParticipant {
  name: string
  role_inferred: string
}

/** A task suggested by the AI in the preview. The AI proposes `assigned_to`
 *  with the name of one of the `detected_participants`; the user reviews and
 *  it's sent as-is to the backend at /api/projects/from-document-draft.
 *  `_include` is client-only: true by default, false if the user unchecks
 *  it in the preview (then it's not sent). */
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
  /** If provided, the wizard starts in "document-review" mode with this draft. */
  initialDraft?: InitialDocumentDraft | null
  /** Callback for when the wizard closes (so App.tsx can clear the draft). */
  onWizardClose?: () => void
}

export default function ProjectWizard({ onNavigate, initialDraft, onWizardClose }: ProjectsWizardProps) {
  const auth = useAuth()
  const { t } = useTranslation()
  const token = auth.user?.access_token || ''

  // If an initialDraft arrives, we start directly on the review screen
  const [mode, setMode] = useState<'choose' | 'document' | 'document-review' | 'paste' | 'manual'>(
    initialDraft ? 'document-review' : 'choose'
  )

  // Document flow state
  const [docDraft, setDocDraft] = useState<InitialDocumentDraft | null>(initialDraft || null)
  const [docDraftName, setDocDraftName] = useState(initialDraft?.suggestion?.name || '')
  const [docDraftType, setDocDraftType] = useState(initialDraft?.suggestion?.type || 'Other')
  const [docDraftDescription, setDocDraftDescription] = useState(initialDraft?.suggestion?.description || '')
  const [docDraftChannels, setDocDraftChannels] = useState<string[]>(['Gmail'])
  const [docDraftEmails, setDocDraftEmails] = useState<string[]>([])
  const [docDraftEmailInput, setDocDraftEmailInput] = useState('')
  const [docDraftPhones, setDocDraftPhones] = useState<string[]>([])
  const [docDraftPhoneInput, setDocDraftPhoneInput] = useState('')
  const [docDraftTiming, setDocDraftTiming] = useState('')
  const [docDraftCreating, setDocDraftCreating] = useState(false)
  // Tasks suggested by the AI in the preview (with assigned_to).
  // They're forwarded as-is to /from-document-draft so the backend persists
  // them without regenerating (which would lose the assigned_to).
  const [docDraftTasks, setDocDraftTasks] = useState<PreviewTask[]>(
    (initialDraft?.suggestion?.tasks || []).map(t => ({ ...t, _include: t._include !== false }))
  )
  // Extra people added manually (in addition to those detected by the AI)
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
    const role = extraForm.role.trim() || 'Participant'
    if (!name && !email && !phone) {
      setExtraFormError('Enter at least a name and email')
      return
    }
    if (email && !email.includes('@')) {
      setExtraFormError('The email is not valid')
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
  // People the AI detected in the text — the user can add email/phone/role
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
      roleInferred: p.role_inferred || 'Participant',
      email: '',
      phone: '',
      role: p.role_inferred || 'Participant',
      include: true,
    }))
  )

  const DOC_PROJECT_TYPES = ['Web Development', 'Infrastructure', 'Design', 'Marketing', 'Ecommerce', 'Consulting', 'Support', 'HR', 'Other']
  const [step, setStep] = useState(1)
  const [creating, setCreating] = useState(false)
  // Extra ref-guard on top of state: `setCreating(true)` doesn't reflect until
  // the next render, so an eager user can click twice before the `disabled`
  // is applied. The ref blocks it within the same tick.
  const creatingRef = useRef(false)
  const [manualCreateError, setManualCreateError] = useState('')
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')

  const userId = auth.user?.profile?.sub || ''

  // Paste text: now also goes through the review screen (same as document)
  const handlePastedText = async (text: string, source: 'whatsapp' | 'gmail' | 'paste') => {
    setUploadError('')
    setUploadSuccess('')
    // Guard: the pasted description/conversation is the raw material for the
    // AI to infer name, tasks and participants. With fewer than 15 chars there
    // isn't enough signal and it ends up generating garbage (or the project
    // is left empty). Same threshold as manual mode for consistency.
    if ((text || '').trim().length < 15) {
      setUploadError('Paste at least 15 characters so the AI can analyze it.')
      return
    }
    setUploadingDoc(true)
    try {
      const result = await api.analyzeTextPreview({ text, source }, token)
      // We reuse the draft state (the /from-document-draft endpoint accepts any draft)
      setDocDraft({
        draftId: result.draftId,
        fileName: result.fileName,
        fileSize: result.fileSize,
        extractedTextLength: result.extractedTextLength,
        suggestion: result.suggestion,
      })
      setDocDraftName(result.suggestion?.name || '')
      setDocDraftType(result.suggestion?.type || 'Other')
      setDocDraftDescription(result.suggestion?.description || '')
      setDocDraftChannels(['Gmail'])
      setDocDraftEmails([])
      setDocDraftPhones([])
      // Suggested tasks with assigned_to (we preserve them to send on create).
      // _include: true by default — the user can uncheck in the preview.
      setDocDraftTasks(((result.suggestion?.tasks || []) as PreviewTask[]).map(t => ({ ...t, _include: true })))
      // Detected by AI: the user will fill in email/phone
      const detected = (result.suggestion?.detected_participants || []) as DetectedParticipant[]
      setDetectedParticipants(detected.map(p => ({
        name: p.name,
        roleInferred: p.role_inferred || 'Participant',
        email: '',
        phone: '',
        role: p.role_inferred || 'Participant',
        include: true,
      })))
      setMode('document-review')
    } catch (err: any) {
      console.error('[ProjectWizard] analyze text error:', err)
      const msg = err?.message || 'Could not process the text.'
      setUploadError(msg.length > 200 ? msg.substring(0, 200) + '...' : msg)
    } finally {
      setUploadingDoc(false)
    }
  }

  // Step 1: user uploads the doc, backend analyzes it and returns the draft with suggestion
  const handleDocumentUpload = async (file: File) => {
    setUploadError('')
    setUploadSuccess('')
    // Guard: reject empty files before uploading (the backend would fail
    // anyway but with a less clear message).
    if (!file || file.size === 0) {
      setUploadError('The file is empty. Select one with content so the AI can analyze it.')
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
      // Pre-fill editable fields with the AI suggestion
      setDocDraftName(result.suggestion?.name || '')
      setDocDraftType(result.suggestion?.type || 'Other')
      setDocDraftDescription(result.suggestion?.description || '')
      setDocDraftChannels(['Gmail'])
      setDocDraftEmails([])
      setDocDraftPhones([])
      // Suggested tasks with assigned_to (we preserve them to send on create).
      // _include: true by default — the user can uncheck in the preview.
      setDocDraftTasks(((result.suggestion?.tasks || []) as PreviewTask[]).map(t => ({ ...t, _include: true })))
      const detected = (result.suggestion?.detected_participants || []) as DetectedParticipant[]
      setDetectedParticipants(detected.map(p => ({
        name: p.name,
        roleInferred: p.role_inferred || 'Participant',
        email: '',
        phone: '',
        role: p.role_inferred || 'Participant',
        include: true,
      })))
      setMode('document-review')
    } catch (err: any) {
      console.error('[ProjectWizard] doc analyze error:', err)
      const msg = err?.message || 'Could not process the document.'
      setUploadError(msg.length > 200 ? msg.substring(0, 200) + '...' : msg)
    } finally {
      setUploadingDoc(false)
    }
  }

  // Step 2: user confirms → create the final project
  const handleConfirmDraft = async () => {
    if (!docDraft) return
    if (!docDraftName.trim()) { setUploadError('Project name is required'); return }
    if (docDraftChannels.length === 0) { setUploadError('Select at least one channel'); return }
    setUploadError('')
    setDocDraftCreating(true)
    try {
      // Prepare detected participants with original name (Kevin, Mateo...)
      const includedDetected = detectedParticipants
        .filter(p => p.include && (p.name.trim() || p.email.trim() || p.phone.trim()))
        .map(p => {
          const phoneRaw = p.phone.replace(/\D/g, '')
          return {
            name: p.name.trim(),
            email: p.email.trim().toLowerCase(),
            phone: phoneRaw.length >= 9 ? '+' + phoneRaw : '',
            role: p.role || p.roleInferred || 'Participant',
          }
        })

      // Also add the extra people the user added manually
      const extras = extraPeople.map(p => {
        const phoneRaw = (p.phone || '').replace(/\D/g, '')
        return {
          name: p.name,
          email: p.email,
          phone: phoneRaw.length >= 9 ? '+' + phoneRaw : '',
          role: p.role || 'Participant',
        }
      })

      const allParticipants = [...includedDetected, ...extras]

      // Keep only the tasks the user marked as included, strip the
      // client-only _include flag before sending to the backend, and
      // validate that assigned_to is a real team name (otherwise → empty).
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
        // Tasks confirmed and edited in the preview along with their assigned_to.
        tasks: tasksToSend,
      }, token)
      const count = result?.insightsGenerated?.count || 0
      setUploadSuccess(
        `✓ Project "${result.name}" created.${count > 0 ? ` ${count} insights generated.` : ''} Redirecting...`
      )
      setTimeout(() => {
        onWizardClose?.()
        onNavigate('projects')
      }, 1800)
    } catch (err: any) {
      console.error('[ProjectWizard] confirm draft error:', err)
      setUploadError(err?.message?.substring(0, 200) || 'Error creating the project')
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

  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [description, setDescription] = useState('')

  const [teamSearch, setTeamSearch] = useState('')
  const [selectedTeam, setSelectedTeam] = useState<TeamMember[]>([])
  const [teamRoles, setTeamRoles] = useState<Record<string, string>>({})
  const [teamPhones, setTeamPhones] = useState<Record<string, string>>({})
  const [externalEmail, setExternalEmail] = useState('')
  // Real name of the external person. Previously we derived it from the email
  // prefix (kotomivega@gmail.com → "kotomivega") which produced ugly names
  // that ended up registered in the project. Now the user provides it
  // explicitly; if left empty, we fall back to the prefix.
  const [externalName, setExternalName] = useState('')

  const [selectedChannels, setSelectedChannels] = useState<string[]>(['email'])
  const [deliveryDate, setDeliveryDate] = useState('')

  // Real org members — fetched from the backend on mount. Previously this
  // was a hardcoded list of 7 fictional people @agencia.com.
  const [orgMembers, setOrgMembers] = useState<TeamMember[]>([])
  useEffect(() => {
    if (!token) return
    let cancelled = false
    api.getOrgMembers(token)
      .then(res => {
        if (cancelled) return
        const members: TeamMember[] = (res.members || []).map(m => ({
          name: m.name,
          email: m.email,
          phone: '',
          role: 'Member',
          initials: m.initials,
          color: gradientForEmail(m.email),
          projectCount: 0,
        }))
        setOrgMembers(members)
      })
      .catch(() => { /* silent — the search stays empty and externals can still be added */ })
    return () => { cancelled = true }
  }, [token])

  // People from the user's other projects. /api/org/members does not exist
  // on this backend yet, so the org list above is empty and this search used
  // to find nobody, however well the name was typed.
  const contacts = useContacts()
  const searchResults: TeamMember[] = (() => {
    if (!teamSearch.trim()) return []
    const taken = selectedTeam.map(s => s.email)
    const fromOrg = orgMembers.filter(p =>
      matchContacts([{ ...p, projects: [] }], teamSearch).length > 0 &&
      !taken.includes(p.email))
    const fromContacts: TeamMember[] = matchContacts(
      contacts.filter(c => c.email), teamSearch, taken, 8)
      .filter(c => !fromOrg.some(o => o.email === c.email))
      .map(c => ({
        name: c.name || c.email.split('@')[0],
        email: c.email,
        phone: c.phone || '',
        role: ROLES.includes(c.role) ? c.role : 'Partner',
        initials: (c.name || c.email).split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase(),
        color: gradientForEmail(c.email),
        projectCount: c.projects.length,
      }))
    return [...fromOrg, ...fromContacts].slice(0, 8)
  })()

  const addTeamMember = (member: TeamMember) => {
    setSelectedTeam([...selectedTeam, member])
    setTeamRoles({ ...teamRoles, [member.email]: member.role })
    if (member.phone) setTeamPhones({ ...teamPhones, [member.email]: member.phone })
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

  const updateRole = (email: string, role: string) => {
    setTeamRoles({ ...teamRoles, [email]: role })
  }

  const addExternal = () => {
    if (!externalEmail.includes('@')) return
    // Explicit user-provided name > fallback to email prefix. Example:
    // email=kotomivega@gmail.com without name → "Kotomivega"; with name="Maria
    // Lopez" → "Maria Lopez".
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
      name: finalName,
      email: externalEmail,
      phone: '',
      role: 'Partner',
      initials: initials,
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
    // Step 1: require name + type + description with real content (≥15 ch).
    // Without a minimum description, the AI can't generate useful insights
    // and the project ends up empty. 15 characters is a soft threshold so we
    // don't block legitimate users but reject empty inputs or "aaa".
    if (step === 1) {
      return name.trim().length >= 3
        && type.length > 0
        && description.trim().length >= 15
    }
    if (step === 2) return selectedTeam.length > 0
    return true
  }

  const handleCreate = async () => {
    // Double guard: the ref blocks within the same click tick, state manages
    // the button's disabled state between renders. Without the ref, a fast
    // double-click triggers 2 analyses + 2 duplicate projects.
    if (creatingRef.current || creating) return
    creatingRef.current = true
    setManualCreateError('')
    setCreating(true)
    try {
      // UNIFIED FLOW: instead of a direct POST /api/projects, we send the
      // description to analyzeTextPreview so the AI analyzes and proposes
      // tasks, additional participants and channels. Then the user lands
      // on `document-review` (the same view used by paste/document) and
      // confirms. Benefit: a single human validation flow before the
      // project exists. This closes the silent shortcut that allowed
      // creating projects without reviewing anything.
      const result = await api.analyzeTextPreview({
        text: description.trim(),
        source: 'paste',
      }, token)

      setDocDraft({
        draftId: result.draftId,
        fileName: result.fileName,
        fileSize: result.fileSize,
        extractedTextLength: result.extractedTextLength,
        suggestion: result.suggestion,
      })
      // What the user typed manually wins; the AI suggestion only fills
      // the gaps (refined description, tasks, extra participants).
      setDocDraftName(name.trim() || result.suggestion?.name || '')
      setDocDraftType(type || result.suggestion?.type || 'Other')
      setDocDraftDescription(result.suggestion?.description || description.trim())
      setDocDraftChannels(selectedChannels.length > 0 ? selectedChannels : ['Gmail'])
      // The team the user selected in step 2 goes as `extraPeople` so it's
      // visible on the review screen. Previously it was placed in
      // `docDraftEmails` which only went to the backend and not the UI, so
      // the user thought their emails had been lost.
      setDocDraftEmails([])
      setDocDraftPhones([])
      setExtraPeople(selectedTeam.map(m => ({
        name: m.name || (m.email ? m.email.split('@')[0] : ''),
        email: m.email || '',
        phone: teamPhones[m.email] || '',
        role: teamRoles[m.email] || m.role || 'Participant',
      })))
      setDocDraftTiming('')
      // Tasks suggested by the AI — the user can uncheck in the preview.
      setDocDraftTasks(((result.suggestion?.tasks || []) as PreviewTask[]).map(t => ({ ...t, _include: true })))
      const detected = (result.suggestion?.detected_participants || []) as DetectedParticipant[]
      setDetectedParticipants(detected.map(p => ({
        name: p.name,
        roleInferred: p.role_inferred || 'Participant',
        email: '',
        phone: '',
        role: p.role_inferred || 'Participant',
        include: true,
      })))
      setMode('document-review')
    } catch (err: any) {
      console.error('Error creating project (analyze phase):', err)
      const msg = (err?.message || '').substring(0, 200) || 'Error analyzing the project description'
      setManualCreateError(msg)
    } finally {
      setCreating(false)
      creatingRef.current = false
    }
  }

  // Initial screen: choose mode
  if (mode === 'choose') {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-56px)] p-6 bg-[#0B0B14]">
        <div className="w-full max-w-3xl">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-white mb-2">{t('wizard.chooseTitle')}</h1>
            <p className="text-white/50">{t('wizard.chooseSubtitle')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Option 1: Paste text */}
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

            {/* Option 2: Upload document */}
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

            {/* Option 3: Fill out manual form */}
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
            onClick={() => onNavigate('projects')}
            className="mt-6 mx-auto block text-sm text-white/40 hover:text-white/60 transition-colors"
          >
            {t('wizard.cancel')}
          </button>
        </div>
      </div>
    )
  }

  // Paste text screen
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

  // Upload document screen
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

  // Post-analysis review screen
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
            {/* Name */}
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

            {/* Type (free input with suggestions) */}
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

            {/* Description */}
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

            {/* Project timing (optional) */}
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

            {/* Channels */}
            <div>
              <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
                Project channels <span className="text-amber-400">*</span>
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

            {/* === UNIFIED SECTION: PROJECT PEOPLE === */}
            {/* Detected by AI + Extras added manually + "Add person" button */}
            <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-3">
              <div className="flex items-start gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-cyan-300 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                    Project people {detectedParticipants.length + extraPeople.length > 0 ? `(${detectedParticipants.filter(p => p.include).length + extraPeople.length})` : '(optional)'}
                  </p>
                  <p className="text-[11px] text-cyan-200/60 mt-0.5">
                    {detectedParticipants.length > 0
                      ? 'The AI detected these people. Fill in their contact info (or uncheck them if they don\'t apply). You can add more with the button at the end.'
                      : 'No people were detected in the text. You can add team members with the button at the end.'}
                  </p>
                </div>
              </div>

              {/* Detected by AI */}
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
                                Detected by AI
                              </span>
                            </div>
                          </div>
                        </div>
                        {p.include && (
                          <>
                            <div className="ml-5">
                              <PersonAutocomplete
                                type="email"
                                value={p.email}
                                onChange={v => {
                                  const updated = [...detectedParticipants]
                                  updated[idx] = { ...updated[idx], email: v }
                                  setDetectedParticipants(updated)
                                }}
                                onPick={c => {
                                  const updated = [...detectedParticipants]
                                  updated[idx] = { ...updated[idx], email: c.email }
                                  setDetectedParticipants(updated)
                                }}
                                suggestFor={p.name}
                                requireEmail
                                disabled={docDraftCreating}
                                placeholder={t('wizard.manual.detectedTasks.emailPlaceholder')}
                                className={`w-full px-2.5 py-1.5 bg-[#0B0B14] border rounded-md text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-cyan-400 ${
                                  hasEmail ? 'border-emerald-500/30' : 'border-white/10'
                                }`}
                              />
                              {/* WhatsApp input hidden. */}
                            </div>
                            <p className="text-[10px] text-white/40 mt-1.5 ml-5">
                              {hasEmail ? (
                                <span className="text-emerald-300">
                                  ✓ Will be added with email notifications
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

              {/* Extras added manually */}
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
                                Added by you
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

              {/* Mini-form to add an extra person */}
              {addingExtra ? (
                <div className="rounded-md border border-cyan-500/30 bg-[#0E0E1A] p-3 space-y-2">
                  <p className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider mb-1">{t('wizard.manual.detectedTasks.addPersonTitle')}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <PersonAutocomplete
                      value={extraForm.name}
                      onChange={v => setExtraForm({ ...extraForm, name: v })}
                      onPick={c => setExtraForm({ ...extraForm, name: c.name,
                        email: c.email || extraForm.email, role: extraForm.role || c.role })}
                      wrapperClassName="relative [&>input]:w-full"
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
                    <PersonAutocomplete
                      type="email"
                      value={extraForm.email}
                      onChange={v => setExtraForm({ ...extraForm, email: v })}
                      onPick={c => setExtraForm({ ...extraForm, email: c.email,
                        name: extraForm.name || c.name, role: extraForm.role || c.role })}
                      suggestFor={extraForm.name}
                      requireEmail
                      wrapperClassName="relative [&>input]:w-full"
                      disabled={docDraftCreating}
                      placeholder={t('wizard.manual.detectedTasks.emailPlaceholderOptional')}
                      className="px-2.5 py-1.5 bg-[#0B0B14] border border-white/10 rounded-md text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                    />
                    {/* WhatsApp input hidden — email only. */}
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
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={submitExtraPerson}
                      disabled={docDraftCreating}
                      className="px-3 py-1.5 bg-cyan-600 text-white text-[11px] font-medium rounded-md hover:bg-cyan-500 transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" /> Add to team
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
                  <span className="text-base">+</span> Add another person to the team
                </button>
              )}
            </div>

            {/* === SECTION: DETECTED TASKS WITH ASSIGNMENT ===
                The AI proposes tasks with an assignee (rule: only names from
                the detected team). Here the user reviews, edits, unchecks or
                reassigns before creating the project — so they don't have to
                go task by task later in the project view. */}
            {docDraftTasks.length > 0 && (
              <div className="rounded-lg border border-violet-500/20 bg-[#0E0E1A] p-3 space-y-2.5">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <p className="text-[11px] font-bold text-violet-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3" />
                      Detected tasks ({docDraftTasks.filter(t => t._include !== false).length}/{docDraftTasks.length})
                    </p>
                    <p className="text-[10px] text-white/40 mt-0.5">
                      The AI assigned each task based on the chat. Uncheck the ones that don't apply or change the assignee.
                    </p>
                  </div>
                </div>

                {/* Pool of valid names for the dropdown = checked detected + extras */}
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
                            title={included ? 'Exclude this task' : 'Include this task'}
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
                                <option value="">👤 Unassigned</option>
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
                                  ⚠ not on the team
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

            {/* Errors and feedback */}
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

            {/* Confirm button */}
            <button
              type="button"
              onClick={handleConfirmDraft}
              disabled={docDraftCreating || !docDraftName.trim() || docDraftChannels.length === 0}
              className="w-full px-6 py-3.5 bg-violet-600 text-white font-medium rounded-xl hover:bg-violet-500 transition-all shadow-lg shadow-violet-600/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {docDraftCreating ? (
                <>
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  Creating project and generating insights...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Create project
                </>
              )}
            </button>

            <p className="text-[10px] text-white/30 text-center">
              The document <strong>{docDraft.fileName}</strong> will be attached to the project.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Manual screen (traditional wizard)
  return (
    <div className="flex h-[calc(100vh-56px)]">
      <aside className="w-64 border-r border-white/5 bg-[#0E0E1A] flex-shrink-0 flex flex-col justify-between">
        <div className="p-6">
          <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-6">{t('wizard.manual.sidebar.title')}</h3>

          <div className="space-y-2">
            {[
              { num: 1, label: 'Project', sub: 'Name and type' },
              { num: 2, label: 'Team', sub: 'PM and participants' },
              { num: 3, label: 'Channels and timing', sub: 'Communication and dates' },
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

        {name && (
          <div className="p-4">
            <div className="bg-[#161625] rounded-xl p-4 border border-white/5">
              <p className="text-[10px] font-bold text-white/30 uppercase mb-2">{t('wizard.manual.sidebar.previewLabel')}</p>
              <h4 className="text-sm font-bold text-white">{name}</h4>
              {type && <p className="text-xs text-violet-400 mt-0.5">{type}</p>}
              {selectedTeam.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] text-white/30 mb-1">PM</p>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${selectedTeam[0].color} flex items-center justify-center text-[8px] text-white font-bold`}>
                      {selectedTeam[0].initials}
                    </div>
                    <span className="text-xs text-white/60">{selectedTeam[0].name}</span>
                  </div>
                </div>
              )}
              {selectedTeam.length > 1 && (
                <div className="mt-2">
                  <p className="text-[10px] text-white/30 mb-1">{t('wizard.manual.sidebar.teamLabel')}</p>
                  <div className="flex -space-x-1.5">
                    {selectedTeam.slice(1).map((m, i) => (
                      <div key={i} className={`w-5 h-5 rounded-full bg-gradient-to-br ${m.color} flex items-center justify-center text-[8px] text-white font-bold border border-[#161625]`}>
                        {m.initials}
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
                  <p className="text-xs text-white/30">— to be defined</p>
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
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full px-4 py-3 bg-[#161625] border border-white/10 rounded-xl text-white placeholder-white/20 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 outline-none transition-all"
                      placeholder={t('wizard.manual.step1.namePlaceholder')}
                    />
                  </div>

                  <div>
                    <label className="text-sm text-white/60 block mb-2">{t('wizard.manual.step1.typeLabel')}</label>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      {PROJECT_TYPES.map(pt => (
                        <button
                          key={pt}
                          type="button"
                          onClick={() => setType(pt)}
                          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                            type === pt
                              ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
                              : 'bg-white/5 border-white/5 text-white/50 hover:border-white/10 hover:text-white/70'
                          }`}
                        >
                          {pt}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={type}
                      onChange={e => setType(e.target.value)}
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
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      rows={3}
                      className={`w-full px-4 py-3 bg-[#161625] border rounded-xl text-white placeholder-white/20 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 outline-none transition-all resize-none ${
                        description.trim().length > 0 && description.trim().length < 15
                          ? 'border-red-500/40'
                          : 'border-white/10'
                      }`}
                      placeholder={t('wizard.manual.step1.descriptionPlaceholder')}
                    />
                    <p className={`text-[11px] mt-1.5 ${
                      description.trim().length > 0 && description.trim().length < 15
                        ? 'text-red-300'
                        : 'text-white/40'
                    }`}>
                      {description.trim().length > 0 && description.trim().length < 15
                        ? `${15 - description.trim().length} more characters for the minimum (15).`
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
                            {person.initials}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{person.name}</p>
                            <p className="text-xs text-white/30">{person.role} · {person.email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => addTeamMember(person)}
                          className="text-xs text-violet-400 hover:text-violet-300 font-medium transition-colors"
                        >
                          + Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {selectedTeam.some(m => m.projectCount >= 3) && (
                  <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-4">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <p className="text-xs text-amber-400">
                      <span className="font-bold">{selectedTeam.find(m => m.projectCount >= 3)?.name}</span> is already on {selectedTeam.find(m => m.projectCount >= 3)?.projectCount} active projects. You can add them anyway.
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
                              {member.initials}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white">{member.name}</p>
                              <p className="text-xs text-white/30">{member.email}{member.isExternal ? ' · external' : ''}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              value={teamRoles[member.email] || member.role}
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
                        {/* WhatsApp input hidden — email only for now. */}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <PersonAutocomplete
                    value={externalName}
                    onChange={setExternalName}
                    onPick={c => { setExternalName(c.name); if (c.email) setExternalEmail(c.email) }}
                    exclude={selectedTeam.map(m => m.email)}
                    wrapperClassName="relative w-40"
                    className="w-full px-4 py-3 bg-[#161625] border border-white/10 rounded-xl text-white placeholder-white/20 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 outline-none transition-all"
                    placeholder="Name"
                    onEnter={addExternal}
                    maxLength={80}
                  />
                  <PersonAutocomplete
                    value={externalEmail}
                    onChange={setExternalEmail}
                    onPick={c => { if (c.email) setExternalEmail(c.email); if (c.name) setExternalName(c.name) }}
                    exclude={selectedTeam.map(m => m.email)}
                    requireEmail
                    wrapperClassName="relative flex-1"
                    className="w-full px-4 py-3 bg-[#161625] border border-white/10 rounded-xl text-white placeholder-white/20 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 outline-none transition-all"
                    placeholder={t('wizard.manual.step2.externalPlaceholder')}
                    onEnter={addExternal}
                  />
                  <button
                    onClick={addExternal}
                    disabled={!externalEmail.includes('@')}
                    className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-medium text-white/60 hover:bg-white/10 transition-all disabled:opacity-30"
                  >
                    + Invite
                  </button>
                </div>
                <p className="text-[11px] text-white/30 mt-2 italic">
                  Name is optional but recommended — if you leave it empty we'll use the email prefix.
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
                      <p className="text-sm text-white font-medium">{name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/30 uppercase">Type</p>
                      <p className="text-sm text-white font-medium">{type}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/30 uppercase">{t('wizard.manual.step3.summaryTeam')}</p>
                      <div className="flex -space-x-2 mt-1">
                        {selectedTeam.map((m, i) => (
                          <div key={i} className={`w-7 h-7 rounded-full bg-gradient-to-br ${m.color} flex items-center justify-center text-[9px] text-white font-bold border-2 border-[#161625]`}>
                            {m.initials}
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
                        <p className="text-sm text-white font-medium">{new Date(deliveryDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                      </div>
                    )}
                    {description && (
                      <div className="col-span-2">
                        <p className="text-[10px] text-white/30 uppercase">{t('wizard.manual.step3.summaryDescription')}</p>
                        <p className="text-sm text-white/60">{description}</p>
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
              onClick={() => step === 1 ? onNavigate('projects') : setStep(step - 1)}
              className="flex items-center gap-2 px-4 py-2.5 border border-white/10 rounded-xl text-sm text-white/60 hover:text-white hover:border-white/20 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              {step === 1 ? 'Cancel' : 'Back'}
            </button>

            <span className="text-sm text-white/30">Step {step} of 3</span>

            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canAdvance()}
                className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-violet-600"
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create project'}
                {!creating && <Check className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
