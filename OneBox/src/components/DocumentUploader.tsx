import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, FileText, Image, FileType, X, Loader2, CheckCircle2,
  AlertCircle, Sparkles
} from 'lucide-react'

const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.txt', '.md', '.png', '.jpg', '.jpeg', '.webp']
const ACCEPTED_TYPES = ACCEPTED_EXTENSIONS.join(',')

export type UploadVariant = 'light' | 'dark'

interface DocumentUploaderProps {
  variant?: UploadVariant
  onFileSelected: (file: File) => void
  loading?: boolean
  loadingText?: string
  successMessage?: string
  errorMessage?: string
  label?: string
  hint?: string
  enableDrop?: boolean
  compact?: boolean
}

function getIconForFile(file: File) {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) return FileType
  if (name.endsWith('.docx') || name.endsWith('.doc')) return FileText
  if (/\.(png|jpe?g|webp)$/.test(name)) return Image
  return FileText
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export default function DocumentUploader({
  variant = 'dark',
  onFileSelected,
  loading = false,
  loadingText = 'Procesando...',
  successMessage,
  errorMessage,
  label = 'Sube un documento',
  hint = 'PDF, Word, TXT o imagen — la IA leerá su contenido y creará el proyecto automáticamente',
  enableDrop = true,
  compact = false,
}: DocumentUploaderProps) {
  const [dragOver, setDragOver] = useState(false)
  const [localError, setLocalError] = useState<string>('')
  const [selected, setSelected] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isLight = variant === 'light'

  const validateAndPick = useCallback((file: File) => {
    setLocalError('')
    const lower = file.name.toLowerCase()
    const okExt = ACCEPTED_EXTENSIONS.some(ext => lower.endsWith(ext))
    if (!okExt) {
      setLocalError(`Formato no soportado. Permitidos: ${ACCEPTED_EXTENSIONS.join(', ')}`)
      return
    }
    if (file.size > MAX_SIZE_BYTES) {
      setLocalError(`El archivo supera ${MAX_SIZE_BYTES / 1024 / 1024} MB.`)
      return
    }
    setSelected(file)
    onFileSelected(file)
  }, [onFileSelected])

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    if (loading) return
    const file = e.dataTransfer.files?.[0]
    if (file) validateAndPick(file)
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) validateAndPick(file)
    // Reset input para permitir reseleccionar el mismo archivo
    e.target.value = ''
  }

  const removeSelected = () => {
    if (loading) return
    setSelected(null)
    setLocalError('')
  }

  const onClickUpload = () => {
    if (loading) return
    inputRef.current?.click()
  }

  const error = localError || errorMessage
  const Icon = selected ? getIconForFile(selected) : Upload

  // Estilos por variante
  const baseClasses = isLight
    ? 'bg-white border-slate-200 text-slate-900'
    : 'bg-[#161625] border-white/10 text-white'

  const dropZoneClasses = `
    relative rounded-xl border-2 border-dashed transition-all
    ${dragOver
      ? (isLight ? 'border-violet-400 bg-violet-50' : 'border-violet-500 bg-violet-500/10')
      : (isLight ? 'border-slate-300 hover:border-violet-400 hover:bg-slate-50' : 'border-white/20 hover:border-violet-500/50 hover:bg-white/[0.03]')
    }
    ${loading ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}
    ${compact ? 'p-4' : 'p-6'}
  `

  const labelColor = isLight ? 'text-slate-900' : 'text-white'
  const hintColor = isLight ? 'text-slate-500' : 'text-white/50'
  const iconBg = isLight ? 'bg-violet-100' : 'bg-violet-500/15'
  const iconColor = isLight ? 'text-violet-600' : 'text-violet-400'

  return (
    <div className={`rounded-xl border ${baseClasses}`}>
      <div
        className={dropZoneClasses}
        onDragEnter={enableDrop ? () => !loading && setDragOver(true) : undefined}
        onDragOver={enableDrop ? (e) => { e.preventDefault(); !loading && setDragOver(true) } : undefined}
        onDragLeave={enableDrop ? () => setDragOver(false) : undefined}
        onDrop={enableDrop ? handleDrop : undefined}
        onClick={!selected && !loading ? onClickUpload : undefined}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={handleChange}
          className="hidden"
          disabled={loading}
        />

        <AnimatePresence mode="wait">
          {/* Estado: cargando */}
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center text-center py-2"
            >
              <div className={`w-12 h-12 ${iconBg} rounded-full flex items-center justify-center mb-3`}>
                <Sparkles className={`w-6 h-6 ${iconColor} animate-pulse`} />
              </div>
              <p className={`text-sm font-semibold ${labelColor}`}>{loadingText}</p>
              <p className={`text-xs ${hintColor} mt-1 flex items-center gap-1.5`}>
                <Loader2 className="w-3 h-3 animate-spin" />
                La IA está leyendo el documento, esto puede tardar 10-20 segundos
              </p>
            </motion.div>
          )}

          {/* Estado: archivo seleccionado (sin cargar) */}
          {!loading && selected && (
            <motion.div
              key="selected"
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-3"
            >
              <div className={`w-11 h-11 ${iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-5 h-5 ${iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${labelColor} truncate`} title={selected.name}>
                  {selected.name}
                </p>
                <p className={`text-xs ${hintColor}`}>{formatSize(selected.size)}</p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeSelected() }}
                className={`p-1.5 rounded-lg transition-colors ${
                  isLight
                    ? 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                    : 'text-white/40 hover:text-red-400 hover:bg-red-500/10'
                }`}
                title="Quitar"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* Estado: vacío */}
          {!loading && !selected && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center text-center"
            >
              <div className={`w-12 h-12 ${iconBg} rounded-full flex items-center justify-center mb-3`}>
                <Upload className={`w-6 h-6 ${iconColor}`} />
              </div>
              <p className={`text-sm font-semibold ${labelColor}`}>{label}</p>
              <p className={`text-xs ${hintColor} mt-1 max-w-md`}>{hint}</p>
              <p className={`text-[11px] ${hintColor} mt-2 italic`}>
                Arrastra aquí o haz click · máx. 10 MB
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mensajes de feedback */}
      {error && (
        <div className={`flex items-start gap-2 px-4 py-2 ${isLight ? 'bg-red-50 border-t border-red-200' : 'bg-red-500/10 border-t border-red-500/20'}`}>
          <AlertCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isLight ? 'text-red-600' : 'text-red-400'}`} />
          <p className={`text-xs ${isLight ? 'text-red-700' : 'text-red-300'}`}>{error}</p>
        </div>
      )}
      {successMessage && !error && (
        <div className={`flex items-start gap-2 px-4 py-2 ${isLight ? 'bg-emerald-50 border-t border-emerald-200' : 'bg-emerald-500/10 border-t border-emerald-500/20'}`}>
          <CheckCircle2 className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
          <p className={`text-xs ${isLight ? 'text-emerald-700' : 'text-emerald-300'}`}>{successMessage}</p>
        </div>
      )}
    </div>
  )
}
