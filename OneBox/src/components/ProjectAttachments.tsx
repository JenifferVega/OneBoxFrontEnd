import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from 'react-oidc-context'
import {
  Paperclip, Upload, Download, Trash2, FileText, Image as ImageIcon,
  FileType, File, Loader2, Sparkles, X, AlertCircle, CheckCircle2,
  ClipboardPaste
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
  /** ¿El usuario actual es dueño del proyecto?
   *  Default true (compatibilidad con instancias que no pasen el prop). */
  isOwner?: boolean
  /** Callback cuando se sube un nuevo adjunto que generó insights nuevos. */
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
    if (days === 0) return 'Hoy'
    if (days === 1) return 'Ayer'
    if (days < 7) return `Hace ${days} días`
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

export default function ProjectAttachments({ projectId, projectName, isOwner = true, onInsightsGenerated }: ProjectAttachmentsProps) {
  const auth = useAuth()
  const token = auth.user?.access_token || ''
  const userId = auth.user?.profile?.sub || ''

  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ msg: string; ok: boolean } | null>(null)
  const [panelMode, setPanelMode] = useState<'closed' | 'document' | 'paste'>('closed')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

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
        setUploadResult({ msg: `✓ Documento adjuntado y la IA generó ${count} insights nuevos.`, ok: true })
        onInsightsGenerated?.(count)
      } else {
        setUploadResult({ msg: '✓ Documento adjuntado.', ok: true })
      }
      await fetchAttachments()
      setTimeout(() => {
        setPanelMode('closed')
        setUploadResult(null)
      }, 2500)
    } catch (err: any) {
      console.error('[Attachments] upload error:', err)
      setUploadResult({ msg: err?.message?.substring(0, 200) || 'Error subiendo el archivo.', ok: false })
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
        setUploadResult({ msg: `✓ Texto analizado: la IA generó ${count} insights nuevos.`, ok: true })
        onInsightsGenerated?.(count)
      } else {
        setUploadResult({ msg: '✓ Texto guardado.', ok: true })
      }
      await fetchAttachments()
      setTimeout(() => {
        setPanelMode('closed')
        setUploadResult(null)
      }, 2500)
    } catch (err: any) {
      console.error('[Attachments] paste text error:', err)
      setUploadResult({ msg: err?.message?.substring(0, 200) || 'Error analizando el texto.', ok: false })
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = async (attachmentId: string, fileName: string) => {
    setDownloadingId(attachmentId)
    try {
      const result = await api.getAttachmentDownloadUrl(projectId, attachmentId, token)
      if (!result?.url) {
        alert('No se pudo obtener el link de descarga.')
        return
      }
      // ⚠️ ANTES usaba window.open(url, '_blank'). Problema: tras un `await`
      // el browser ya NO está en contexto de user-gesture síncrono y muchos
      // navegadores bloquean la nueva pestaña como popup → el botón parecía
      // no hacer nada.
      //
      // Ahora usamos un anchor temporal con el atributo `download` y le
      // disparamos click(). Esto se trata como descarga, no como popup
      // → funciona siempre, incluso con popup blocker estricto.
      const a = document.createElement('a')
      a.href = result.url
      a.download = fileName || result.fileName || 'archivo'
      a.rel = 'noopener noreferrer'
      // Algunos navegadores requieren que el anchor esté en el DOM
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err) {
      console.error('[Attachments] download error:', err)
      alert('No se pudo descargar el archivo.')
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDelete = async (attachmentId: string) => {
    if (!confirm('¿Eliminar este adjunto? Esta acción no se puede deshacer.')) return
    setDeletingId(attachmentId)
    try {
      await api.deleteAttachment(projectId, attachmentId, token)
      setAttachments(prev => prev.filter(a => a.attachmentId !== attachmentId))
    } catch (err) {
      console.error('[Attachments] delete error:', err)
      alert('No se pudo eliminar el adjunto.')
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
            Adjuntos del proyecto
            {attachments.length > 0 && (
              <span className="text-xs text-white/40 font-normal">({attachments.length})</span>
            )}
          </h2>
          <p className="text-xs text-white/40 mt-0.5">
            Sube documentos relacionados con el proyecto. La IA los analizará y generará insights.
          </p>
        </div>
        {panelMode === 'closed' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setPanelMode('paste'); setUploadResult(null) }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 rounded-lg text-xs font-medium text-violet-300 transition-all"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              Pegar texto
            </button>
            <button
              onClick={() => { setPanelMode('document'); setUploadResult(null) }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium text-white/70 transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              Subir documento
            </button>
          </div>
        )}
      </div>

      {/* Panel toggle: pegar texto o subir documento */}
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
                    ? 'Pega una conversación o texto. La IA detectará tareas, riesgos y decisiones.'
                    : 'La IA leerá el documento y generará nuevos insights para este proyecto.'}
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
                  loadingText="🤖 La IA está analizando el texto..."
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
                  loadingText="Procesando documento..."
                  errorMessage={uploadResult && !uploadResult.ok ? uploadResult.msg : undefined}
                  successMessage={uploadResult && uploadResult.ok ? uploadResult.msg : undefined}
                  label="Adjunta un documento"
                  hint="PDF, Word, TXT o imagen — máx. 10 MB"
                  compact
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lista de adjuntos */}
      {loading && attachments.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
        </div>
      ) : attachments.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-white/5 rounded-lg">
          <Paperclip className="w-8 h-8 text-white/20 mx-auto mb-2" />
          <p className="text-sm text-white/40">Sin adjuntos aún</p>
          <p className="text-xs text-white/30 mt-1">
            Sube actas, briefs, propuestas o cualquier doc relacionado.
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
                    {att.source === 'whatsapp' && (
                      <>
                        <span>·</span>
                        <span className="text-emerald-400">WhatsApp</span>
                      </>
                    )}
                    {att.extractedTextLength > 0 && (
                      <>
                        <span>·</span>
                        <span className="text-violet-400 flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" />
                          IA leyó {att.extractedTextLength.toLocaleString()} caracteres
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
                    title="Descargar"
                  >
                    {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  </button>
                  {/* Borrar adjunto: solo owner. */}
                  {isOwner && (
                    <button
                      onClick={() => handleDelete(att.attachmentId)}
                      disabled={isDeleting || isDownloading}
                      className="p-2 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                      title="Eliminar"
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
