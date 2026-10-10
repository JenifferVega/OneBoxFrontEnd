import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from 'react-oidc-context'
import { useTranslation } from 'react-i18next'
import {
  Paperclip, Upload, Download, Trash2, FileText, Image as ImageIcon,
  FileType, File, Loader2, Sparkles, X, AlertCircle, CheckCircle2,
  ClipboardPaste, ListChecks
} from 'lucide-react'
import { api } from '../services/api'
import DocumentUploader from './DocumentUploader'
import TextPaster from './TextPaster'

interface Attachment {
  attachmentId: string
  fileName: string
  fileSize: number
  contentType: string
  extension: string
  extractedTextPreview: string
  extractedTextLength: number
  source: string
  createdAt: string
}

interface ProjectAttachmentsProps {
  projectId: string
  projectName: string
  /** Is the current user the project owner?
   *  Defaults to true (compatibility with instances that don't pass the prop). */
  isOwner?: boolean
  /** Callback for when a new attachment is uploaded that generated new insights. */
  onInsightsGenerated?: (count: number) => void
}

function getIconForExt(ext: string) {
  const e = (ext || '').toLowerCase()
  if (e === 'pdf') return FileType
  if (e === 'docx' || e === 'doc') return FileText
  if (['png', 'jpg', 'jpeg', 'webp'].includes(e)) return ImageIcon
  if (['txt', 'md'].includes(e)) return FileText
  return File
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function formatDate(iso: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const diff = Date.now() - d.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

export default function ProjectAttachments({ projectId, projectName, isOwner = true, onInsightsGenerated }: ProjectAttachmentsProps) {
  const auth = useAuth()
  const { t } = useTranslation()
  const token = auth.user?.access_token || ''
  const userId = auth.user?.profile?.sub || ''

  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ msg: string; ok: boolean } | null>(null)
  const [panelMode, setPanelMode] = useState<'closed' | 'document' | 'paste'>('closed')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  // After an upload the OWNER is asked whether this document should update
  // the task plan. It used to happen on every upload, unannounced.
  const [replanOffer, setReplanOffer] = useState<{ attachmentId: string; fileName: string } | null>(null)
  const [replanningId, setReplanningId] = useState<string | null>(null)
  const [replanMsg, setReplanMsg] = useState<{ msg: string; ok: boolean } | null>(null)

  const handleReplan = async (attachmentId: string, fileName: string) => {
    setReplanningId(attachmentId)
    setReplanMsg(null)
    try {
      await api.replanFromAttachment(projectId, attachmentId, token)
      setReplanOffer(null)
      setReplanMsg({ ok: true, msg: t('attachments.replanStarted', {
        file: fileName,
        defaultValue: `Updating the task plan with "${fileName}". It takes a few minutes; you will get a notification, and changes to existing tasks wait for your approval in Intelligence > Replanning.`,
      }) })
    } catch (err: any) {
      setReplanMsg({ ok: false, msg: err?.message?.substring(0, 200) || 'Could not start the update.' })
    } finally {
      setReplanningId(null)
    }
  }

  const fetchAttachments = useCallback(async () => {
    if (!token || !projectId) return
    try {
      setLoading(true)
      const data = await api.listAttachments(projectId, token)
      if (Array.isArray(data)) setAttachments(data)
    } catch (err) {
      console.warn('[Attachments] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [token, projectId])

  useEffect(() => {
    fetchAttachments()
  }, [fetchAttachments])

  const handleUpload = async (file: File) => {
    setUploading(true)
    setUploadResult(null)
    try {
      const result = await api.uploadAttachment(projectId, file, { userId, token })
      const ig = result?.insightsGenerated || {}
      const count = ig.count || 0
      if (count > 0) {
        setUploadResult({ msg: `✓ Document attached and the AI generated ${count} new insights.`, ok: true })
        onInsightsGenerated?.(count)
      } else {
        setUploadResult({ msg: `✓ Document attached.`, ok: true })
      }
      await fetchAttachments()
      if (result?.replanAvailable && result?.attachment?.attachmentId) {
        setReplanOffer({ attachmentId: result.attachment.attachmentId, fileName: result.attachment.fileName || file.name })
      }
      setTimeout(() => {
        setPanelMode('closed')
        setUploadResult(null)
      }, 2500)
    } catch (err: any) {
      console.error('[Attachments] upload error:', err)
      setUploadResult({ msg: err?.message?.substring(0, 200) || 'Error uploading the file.', ok: false })
    } finally {
      setUploading(false)
    }
  }

  const handleAnalyzeText = async (text: string, source: 'whatsapp' | 'gmail' | 'paste') => {
    setUploading(true)
    setUploadResult(null)
    try {
      const result = await api.analyzeTextForProject(projectId, { text, source }, token)
      const ig = result?.insightsGenerated || {}
      const count = ig.count || 0
      if (count > 0) {
        setUploadResult({ msg: `✓ Text analyzed: the AI generated ${count} new insights.`, ok: true })
        onInsightsGenerated?.(count)
      } else {
        setUploadResult({ msg: `✓ Text saved.`, ok: true })
      }
      await fetchAttachments()
      if (result?.replanAvailable && result?.attachmentId) {
        setReplanOffer({ attachmentId: result.attachmentId, fileName: result.savedAs || 'pasted text' })
      }
      setTimeout(() => {
        setPanelMode('closed')
        setUploadResult(null)
      }, 2500)
    } catch (err: any) {
      console.error('[Attachments] paste text error:', err)
      setUploadResult({ msg: err?.message?.substring(0, 200) || 'Error analyzing the text.', ok: false })
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = async (attachmentId: string, fileName: string) => {
    setDownloadingId(attachmentId)
    try {
      const result = await api.getAttachmentDownloadUrl(projectId, attachmentId, token)
      if (!result?.url) {
        alert('Could not get the download link.')
        return
      }
      // ⚠️ Previously used window.open(url, '_blank'). Problem: after an `await`
      // the browser is no longer in a synchronous user-gesture context and many
      // browsers block the new tab as a popup → the button appeared to
      // do nothing.
      //
      // Now we use a temporary anchor with the `download` attribute and
      // trigger click() on it. This is treated as a download, not a popup
      // → works reliably, even with strict popup blockers.
      const a = document.createElement('a')
      a.href = result.url
      a.download = fileName || result.fileName || 'file'
      a.rel = 'noopener noreferrer'
      // Some browsers require the anchor to be in the DOM
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err) {
      console.error('[Attachments] download error:', err)
      alert('Could not download the file.')
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDelete = async (attachmentId: string) => {
    if (!confirm(t('attachments.confirmDelete'))) return
    setDeletingId(attachmentId)
    try {
      await api.deleteAttachment(projectId, attachmentId, token)
      setAttachments(prev => prev.filter(a => a.attachmentId !== attachmentId))
    } catch (err) {
      console.error('[Attachments] delete error:', err)
      alert(t('attachments.deleteError'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="bg-[#161625] rounded-xl border border-white/5 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-violet-400" />
            {t('attachments.header')}
            {attachments.length > 0 && (
              <span className="text-xs text-white/40 font-normal">({attachments.length})</span>
            )}
          </h2>
          <p className="text-xs text-white/40 mt-0.5">
            {t('attachments.subtitle')}
          </p>
        </div>
        {panelMode === 'closed' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setPanelMode('paste'); setUploadResult(null) }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 rounded-lg text-xs font-medium text-violet-300 transition-all"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              {t('attachments.pasteBtn')}
            </button>
            <button
              onClick={() => { setPanelMode('document'); setUploadResult(null) }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium text-white/70 transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              {t('attachments.uploadBtn')}
            </button>
          </div>
        )}
      </div>

      {/* Toggle panel: paste text or upload document */}
      <AnimatePresence>
        {panelMode !== 'closed' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-4"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-white/50 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-violet-400" />
                  {panelMode === 'paste'
                    ? t('attachments.panelPasteHint')
                    : t('attachments.panelDocHint')}
                </p>
                <button
                  onClick={() => { setPanelMode('closed'); setUploadResult(null) }}
                  className="p-1 text-white/40 hover:text-white/70 transition-colors"
                  disabled={uploading}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {panelMode === 'paste' ? (
                <TextPaster
                  variant="dark"
                  loading={uploading}
                  loadingText={t('attachments.loadingText')}
                  errorMessage={uploadResult && !uploadResult.ok ? uploadResult.msg : undefined}
                  successMessage={uploadResult && uploadResult.ok ? uploadResult.msg : undefined}
                  onAnalyze={handleAnalyzeText}
                  compact
                />
              ) : (
                <DocumentUploader
                  variant="dark"
                  onFileSelected={handleUpload}
                  loading={uploading}
                  loadingText={t('attachments.processingDoc')}
                  errorMessage={uploadResult && !uploadResult.ok ? uploadResult.msg : undefined}
                  successMessage={uploadResult && uploadResult.ok ? uploadResult.msg : undefined}
                  label={t('attachments.uploadLabel')}
                  hint={t('attachments.uploadHint')}
                  compact
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* "Update the plan with this document?" -- owner only, after an upload */}
      {isOwner && replanOffer && (
        <div className="mb-4 p-3 rounded-lg border border-violet-500/30 bg-violet-500/10 text-sm">
          <p className="text-white/85 flex items-start gap-2">
            <ListChecks className="w-4 h-4 text-violet-300 mt-0.5 flex-shrink-0" />
            <span>
              {t('attachments.replanQuestion', {
                file: replanOffer.fileName,
                defaultValue: `Do you want to update the task plan with "${replanOffer.fileName}"? OneBox will compare it with the current tasks; changes to existing tasks wait for your approval.`,
              })}
            </span>
          </p>
          <div className="flex gap-2 mt-3 justify-end">
            <button onClick={() => setReplanOffer(null)} disabled={!!replanningId}
                    className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-white/70 hover:text-white">
              {t('attachments.replanNo', 'No, just keep the document')}
            </button>
            <button onClick={() => handleReplan(replanOffer.attachmentId, replanOffer.fileName)} disabled={!!replanningId}
                    className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs flex items-center gap-1.5 disabled:opacity-50">
              {replanningId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ListChecks className="w-3.5 h-3.5" />}
              {t('attachments.replanYes', 'Update the plan')}
            </button>
          </div>
        </div>
      )}
      {replanMsg && (
        <div className={`mb-4 p-3 rounded-lg text-xs flex items-start gap-2 ${replanMsg.ok
          ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
          : 'border border-red-500/20 bg-red-500/10 text-red-300'}`}>
          {replanMsg.ok ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          <span className="flex-1">{replanMsg.msg}</span>
          <button onClick={() => setReplanMsg(null)} className="text-white/40 hover:text-white/70"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Attachments list */}
      {loading && attachments.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
        </div>
      ) : attachments.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-white/5 rounded-lg">
          <Paperclip className="w-8 h-8 text-white/20 mx-auto mb-2" />
          <p className="text-sm text-white/40">{t('attachments.emptyTitle')}</p>
          <p className="text-xs text-white/30 mt-1">
            {t('attachments.emptyHint')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {attachments.map(att => {
            const Icon = getIconForExt(att.extension)
            const isDownloading = downloadingId === att.attachmentId
            const isDeleting = deletingId === att.attachmentId
            return (
              <motion.div
                key={att.attachmentId}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-3 bg-[#0E0E1A] rounded-lg border border-white/5 hover:border-white/10 transition-all"
              >
                <div className="w-10 h-10 bg-violet-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate" title={att.fileName}>
                    {att.fileName}
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-white/40 mt-0.5 flex-wrap">
                    <span>{formatSize(att.fileSize)}</span>
                    <span>·</span>
                    <span>{formatDate(att.createdAt)}</span>
                    {/* WhatsApp badge hidden — today we only work with email. */}
                    {att.extractedTextLength > 0 && (
                      <>
                        <span>·</span>
                        <span className="text-violet-400 flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" />
                          {t('attachments.aiRead', { count: att.extractedTextLength.toLocaleString() })}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleDownload(att.attachmentId, att.fileName)}
                    disabled={isDownloading || isDeleting}
                    className="p-2 text-white/50 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-colors disabled:opacity-50"
                    title={t('attachments.downloadTooltip')}
                  >
                    {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  </button>
                  {/* Update the plan with this document later: owner-only. */}
                  {isOwner && att.extractedTextLength >= 100 && (
                    <button
                      onClick={() => handleReplan(att.attachmentId, att.fileName)}
                      disabled={!!replanningId || isDeleting}
                      className="p-2 text-white/40 hover:text-violet-300 hover:bg-violet-500/10 rounded-lg transition-colors disabled:opacity-50"
                      title={t('attachments.replanTooltip', 'Update the task plan with this document')}
                    >
                      {replanningId === att.attachmentId ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListChecks className="w-4 h-4" />}
                    </button>
                  )}
                  {/* Delete attachment: owner-only. */}
                  {isOwner && (
                    <button
                      onClick={() => handleDelete(att.attachmentId)}
                      disabled={isDeleting || isDownloading}
                      className="p-2 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                      title={t('attachments.deleteTooltip')}
                    >
                      {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
