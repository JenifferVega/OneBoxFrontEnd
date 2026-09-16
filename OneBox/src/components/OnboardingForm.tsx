import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  MessageCircle, Mail, ArrowLeft, ArrowRight, Check, Sparkles,
  FileText, Edit3, ClipboardPaste
} from 'lucide-react'
import DocumentUploader from './DocumentUploader'
import LocaleSwitcher from './LocaleSwitcher'

export interface PendingProject {
  channels: string[]
  name: string
  type: string
  description: string
  whatsappNumbers?: string[]
  emails?: string[]
  /** Serialized attached document (base64) — the AI will process it after login. */
  documentBase64?: string
  documentName?: string
  documentContentType?: string
  documentSize?: number
  /** Pre-login pasted text (WhatsApp, Gmail, etc.) — the AI will process it after login. */
  pastedText?: string
  pastedSource?: 'whatsapp' | 'gmail' | 'paste'
}

interface OnboardingFormProps {
  onBack: () => void
  onSubmit: (data: PendingProject) => void
  onLoginInstead?: () => void
}

// WhatsApp hidden until the channel is enabled (today we only work with
// email). To show it again, add the entry back here.
const CHANNELS = [
  { id: 'Gmail', label: 'Gmail', icon: Mail, color: 'text-rose-500', bg: 'bg-rose-50', bgActive: 'bg-rose-100 border-rose-300' },
]

const PROJECT_TYPES = ['Web Development', 'Infrastructure', 'Design', 'Marketing', 'Ecommerce', 'Consulting', 'Support', 'HR', 'Other']

export default function OnboardingForm({ onBack, onSubmit, onLoginInstead }: OnboardingFormProps) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<'choose' | 'document' | 'paste' | 'manual'>('choose')
  const [channels, setChannels] = useState<string[]>(['Gmail'])
  const [name, setName] = useState('')
  const [type, setType] = useState('Web Development')
  const [description, setDescription] = useState('')
  const [whatsappNumbers, setWhatsappNumbers] = useState<string[]>([])
  const [whatsappInput, setWhatsappInput] = useState('')
  const [emails, setEmails] = useState<string[]>([])
  const [emailInput, setEmailInput] = useState('')
  const [emailError, setEmailError] = useState('')

  // Attached document (document mode)
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [documentError, setDocumentError] = useState('')
  const [documentSubmitting, setDocumentSubmitting] = useState(false)

  // Pasted text (paste mode)
  const [pastedText, setPastedText] = useState('')
  const [pastedSource, setPastedSource] = useState<'whatsapp' | 'gmail' | 'paste'>('whatsapp')
  const [pasteError, setPasteError] = useState('')
  const [pasteSubmitting, setPasteSubmitting] = useState(false)

  // Convert a file to base64 (without the data: prefix)
  const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Strip the "data:...;base64," prefix
      const idx = result.indexOf(',')
      resolve(idx >= 0 ? result.substring(idx + 1) : result)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

  const handleDocumentSelected = (file: File) => {
    setDocumentError('')
    // Limit to 4 MB so it fits in localStorage after base64 (~5.3 MB string)
    const MAX_BYTES_FOR_LOCALSTORAGE = 4 * 1024 * 1024
    if (file.size > MAX_BYTES_FOR_LOCALSTORAGE) {
      setDocumentError(t('onboarding.errors.fileTooBig'))
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
        type: 'Other',
        description: '',
        documentBase64: base64,
        documentName: documentFile.name,
        documentContentType: documentFile.type || 'application/octet-stream',
        documentSize: documentFile.size,
      })
    } catch (err) {
      console.error('[Onboarding] Error preparing document:', err)
      setDocumentError(t('onboarding.errors.docReadFailed'))
      setDocumentSubmitting(false)
    }
  }

  const handleSubmitPasted = () => {
    setPasteError('')
    const text = pastedText.trim()
    if (text.length < 50) {
      setPasteError(t('onboarding.errors.pasteTooShort'))
      return
    }
    // Limit to 100k characters to avoid saturating localStorage
    if (text.length > 100000) {
      setPasteError(t('onboarding.errors.pasteTooLong'))
      return
    }
    setPasteSubmitting(true)
    onSubmit({
      channels: ['Gmail'],
      name: '',
      type: 'Other',
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
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(value)) {
      setEmailError(t('onboarding.errors.emailInvalid'))
      return
    }
    if (emails.includes(value)) {
      setEmailError(t('onboarding.errors.emailDuplicate'))
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
      {/* Language switcher pinned to the top right, pre-login. */}
      <div className="absolute top-4 right-4 z-10">
        <LocaleSwitcher variant="light" />
      </div>
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
            {t('common.back')}
          </button>
          {onLoginInstead && (
            <button
              onClick={onLoginInstead}
              className="text-sm text-violet-600 hover:text-violet-700 font-medium transition-colors"
            >
              {t('onboarding.haveAccountCta')}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 text-violet-700 rounded-full text-xs font-medium w-fit mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          {t('onboarding.badge')}
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
          {t('onboarding.title')}
        </h1>
        <p className="mt-3 text-slate-600">
          {mode === 'document'
            ? t('onboarding.subtitle.document')
            : mode === 'manual'
              ? t('onboarding.subtitle.manual')
              : t('onboarding.subtitle.choose')}
        </p>

        {/* Mode selector: 3 options (paste conversation, upload doc, manual form) */}
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
                <span className="text-[10px] font-bold text-violet-700 bg-violet-200 px-2 py-0.5 rounded-full uppercase tracking-wider">{t('onboarding.chooser.paste.badge')}</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">
                {t('onboarding.chooser.paste.title')}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {t('onboarding.chooser.paste.description')}
              </p>
              <p className="text-xs text-violet-700 mt-3 font-medium">
                {t('onboarding.chooser.paste.footer')}
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
                {t('onboarding.chooser.document.title')}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {t('onboarding.chooser.document.description')}
              </p>
              <p className="text-xs text-slate-500 mt-3 font-medium">
                {t('onboarding.chooser.document.footer')}
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
                {t('onboarding.chooser.manual.title')}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {t('onboarding.chooser.manual.description')}
              </p>
              <p className="text-xs text-slate-500 mt-3 font-medium">
                {t('onboarding.chooser.manual.footer')}
              </p>
            </button>
          </div>
        )}

        {/* Mode: upload document */}
        {mode === 'document' && (
          <div className="mt-8 space-y-4">
            <button
              type="button"
              onClick={() => { setMode('choose'); setDocumentFile(null); setDocumentError('') }}
              className="text-xs text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" /> {t('onboarding.changeMode')}
            </button>

            <DocumentUploader
              variant="light"
              onFileSelected={handleDocumentSelected}
              loading={documentSubmitting}
              loadingText={t('onboarding.document.loadingText')}
              errorMessage={documentError}
              label={t('onboarding.document.label')}
              hint={t('onboarding.document.hint')}
            />

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-start gap-2">
              <span className="font-bold">{t('onboarding.document.noteLabel')}</span>
              <span>{t('onboarding.document.noteText')}</span>
            </div>

            <button
              type="button"
              onClick={handleSubmitDocument}
              disabled={!documentFile || documentSubmitting}
              className="w-full px-6 py-4 bg-violet-600 text-white font-medium rounded-xl hover:bg-violet-500 transition-all shadow-lg shadow-violet-600/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {documentSubmitting ? t('onboarding.preparing') : t('onboarding.continueCta')}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <p className="text-center text-xs text-slate-500">
              {t('onboarding.document.footerHint')}
            </p>
          </div>
        )}

        {/* Mode: paste conversation */}
        {mode === 'paste' && (
          <div className="mt-8 space-y-4">
            <button
              type="button"
              onClick={() => { setMode('choose'); setPastedText(''); setPasteError('') }}
              className="text-xs text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" /> {t('onboarding.changeMode')}
            </button>

            {/* Source selector */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">{t('onboarding.paste.sourceLabel')}</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: 'whatsapp' as const, label: t('onboarding.paste.sourceWhatsapp'), icon: MessageCircle, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-300' },
                  { id: 'gmail' as const,    label: t('onboarding.paste.sourceGmail'),    icon: Mail,           color: 'text-rose-600',    bg: 'bg-rose-50 border-rose-300' },
                  { id: 'paste' as const,    label: t('onboarding.paste.sourceOther'),    icon: ClipboardPaste, color: 'text-violet-600',  bg: 'bg-violet-50 border-violet-300' },
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
                {t('onboarding.paste.textareaLabel')}
              </label>
              <textarea
                value={pastedText}
                onChange={e => { setPastedText(e.target.value); setPasteError('') }}
                disabled={pasteSubmitting}
                rows={10}
                placeholder={
                  pastedSource === 'whatsapp'
                    ? t('onboarding.paste.placeholderWhatsapp')
                    : pastedSource === 'gmail'
                      ? t('onboarding.paste.placeholderGmail')
                      : t('onboarding.paste.placeholderOther')
                }
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition resize-none font-mono text-xs leading-relaxed"
              />
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-[11px] text-slate-500">
                  {pastedText.length === 0
                    ? t('onboarding.paste.empty')
                    : pastedText.length < 50
                      ? t('onboarding.paste.underMin', { count: pastedText.length })
                      : t('onboarding.paste.count', { count: pastedText.length.toLocaleString() })}
                </p>
                {pastedText.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPastedText('')}
                    className="text-[11px] text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    {t('onboarding.paste.clear')}
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
              <span>{t('onboarding.paste.info')}</span>
            </div>

            <button
              type="button"
              onClick={handleSubmitPasted}
              disabled={pastedText.trim().length < 50 || pasteSubmitting}
              className="w-full px-6 py-4 bg-violet-600 text-white font-medium rounded-xl hover:bg-violet-500 transition-all shadow-lg shadow-violet-600/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {pasteSubmitting ? t('onboarding.preparing') : t('onboarding.continueCta')}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <p className="text-center text-xs text-slate-500">
              {t('onboarding.paste.footerHint')}
            </p>
          </div>
        )}

        {/* Mode: manual form */}
        {mode === 'manual' && (
          <button
            type="button"
            onClick={() => setMode('choose')}
            className="text-xs text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1 mt-6"
          >
            <ArrowLeft className="w-3 h-3" /> {t('onboarding.changeMode')}
          </button>
        )}

        {mode === 'manual' && (
        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* Channels */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {t('onboarding.manual.channelsLabel')} <span className="text-slate-400 font-normal">{t('onboarding.manual.channelsHint')}</span>
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
                  {t('onboarding.manual.emailsLabel')}
                </label>
                <p className="text-xs text-rose-700/70 mb-3">
                  {t('onboarding.manual.emailsHint')}
                </p>
                <div className="flex gap-2 mb-2">
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => { setEmailInput(e.target.value); setEmailError('') }}
                    onKeyPress={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmail() } }}
                    placeholder="name@company.com"
                    className={`flex-1 px-3 py-2 bg-white border rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 ${
                      emailError ? 'border-red-400' : 'border-rose-200'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={addEmail}
                    className="px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 transition-colors"
                  >
                    {t('onboarding.manual.add')}
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
                          {t('onboarding.manual.remove')}
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
                  {t('onboarding.manual.whatsappLabel')}
                </label>
                <p className="text-xs text-emerald-700/70 mb-3">
                  {t('onboarding.manual.whatsappHint')}
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
                    {t('onboarding.manual.add')}
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
                          {t('onboarding.manual.remove')}
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
            <label className="block text-sm font-medium text-slate-700 mb-2">{t('onboarding.manual.nameLabel')}</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('onboarding.manual.namePlaceholder')}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
            />
          </div>

          {/* Project type (free-form input with suggestions) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{t('onboarding.manual.typeLabel')}</label>
            <input
              type="text"
              list="onboarding-project-types"
              value={type}
              onChange={e => setType(e.target.value)}
              placeholder={t('onboarding.manual.typePlaceholder')}
              maxLength={60}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
            />
            <datalist id="onboarding-project-types">
              {PROJECT_TYPES.map(pt => <option key={pt} value={pt} />)}
            </datalist>
            <p className="text-xs text-slate-500 mt-1">{t('onboarding.manual.typeHint')}</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{t('onboarding.manual.descriptionLabel')}</label>
            <textarea
              required
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder={t('onboarding.manual.descriptionPlaceholder')}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition resize-none"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full px-6 py-4 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            {t('onboarding.continueCta')}
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>

          <p className="text-center text-xs text-slate-500">
            {t('onboarding.manual.footerHint')}
          </p>
        </form>
        )}
      </motion.div>
    </div>
  )
}
