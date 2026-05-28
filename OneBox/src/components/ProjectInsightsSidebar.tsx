import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from 'react-oidc-context'
import {
  Sparkles, ListTodo, AlertTriangle, Lightbulb,
  Mail, MessageCircle, ChevronDown, Loader2, Inbox,
  CheckCircle2, TrendingUp, Wrench, Target, User, Construction
} from 'lucide-react'
import { api } from '../services/api'

interface Insight {
  insightId?: string
  id?: string
  projectId?: string
  projectName?: string
  type: 'summary' | 'task_created' | 'risk' | 'decision' | string
  title?: string
  detected?: string
  description?: string
  action?: string
  status: string
  createdAt?: string
}

interface ProjectInsightsSidebarProps {
  projectId: string
  projectName: string
  channels: string[]
  onBack: () => void
  /** Si se pasa, filtra los insights mostrados por este término. */
  searchQuery?: string
}

// Orden de aparición en el sidebar — los más importantes primero.
// Nota: NO incluye 'summary' porque ya está visible como descripción del proyecto
// (evitamos redundancia entre la descripción central y el sidebar).
const SECTIONS = [
  { key: 'key_insight',              label: 'Insight clave',      icon: Lightbulb,     color: 'text-amber-300',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  { key: 'project_characterization', label: 'Tipo real',          icon: Target,        color: 'text-fuchsia-300', bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/20' },
  { key: 'client_profile',           label: 'Perfil del cliente', icon: User,          color: 'text-cyan-300',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20' },
  { key: 'work_done',                label: 'Trabajo realizado',  icon: CheckCircle2,  color: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  { key: 'task_created',             label: 'Tareas pendientes',  icon: ListTodo,      color: 'text-violet-300',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20' },
  { key: 'blocker',                  label: 'Bloqueos del cliente', icon: Construction, color: 'text-red-300',     bg: 'bg-red-500/10',     border: 'border-red-500/20' },
  { key: 'risk',                     label: 'Riesgos',            icon: AlertTriangle, color: 'text-orange-300',  bg: 'bg-orange-500/10',  border: 'border-orange-500/20' },
  { key: 'tech_issue',               label: 'Problemas técnicos', icon: Wrench,        color: 'text-rose-300',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20' },
  { key: 'decision',                 label: 'Decisiones',         icon: Lightbulb,     color: 'text-blue-300',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
  { key: 'metric',                   label: 'Métricas',           icon: TrendingUp,    color: 'text-lime-300',    bg: 'bg-lime-500/10',    border: 'border-lime-500/20' },
] as const

const CHANNEL_CONFIG: Record<string, { icon: any; label: string; color: string; bg: string }> = {
  Gmail: { icon: Mail, label: 'Gmail', color: 'text-rose-400', bg: 'bg-rose-500/10' },
  WhatsApp: { icon: MessageCircle, label: 'WhatsApp', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
}

export default function ProjectInsightsSidebar({
  projectId,
  projectName,
  channels,
  onBack,
  searchQuery,
}: ProjectInsightsSidebarProps) {
  const auth = useAuth()
  const token = auth.user?.access_token || ''

  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    summary: true,
    key_insight: true,
    project_characterization: true,
    client_profile: true,
    work_done: true,
    task_created: true,
    blocker: true,
    risk: true,
    tech_issue: false,
    decision: false,
    metric: false,
    channels: true,
  })

  useEffect(() => {
    if (!token || !projectId) return
    let cancelled = false
    const fetchInsights = async () => {
      try {
        setLoading(true)
        const data = await api.getInsights(token)
        if (!cancelled && Array.isArray(data)) {
          // Filtrar por projectId, o por projectName si projectId no viene
          const filtered = data.filter((i: Insight) => {
            if (i.projectId) return i.projectId === projectId
            return i.projectName === projectName
          })
          setInsights(filtered)
        }
      } catch (err) {
        console.warn('[ProjectInsights] Error:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchInsights()
    return () => { cancelled = true }
  }, [token, projectId])

  // Filtrar por searchQuery si está presente
  const searchTerm = (searchQuery || '').trim().toLowerCase()
  const filteredInsights = searchTerm
    ? insights.filter(i => {
        const haystack = `${i.title || ''} ${i.detected || ''} ${i.description || ''} ${i.action || ''}`.toLowerCase()
        return haystack.includes(searchTerm)
      })
    : insights

  const grouped = filteredInsights.reduce((acc, insight) => {
    const type = insight.type
    if (!acc[type]) acc[type] = []
    acc[type].push(insight)
    return acc
  }, {} as Record<string, Insight[]>)

  const totalInsights = filteredInsights.length
  const totalAll = insights.length
  const isFiltered = searchTerm.length > 0

  const toggle = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <aside className="w-72 border-r border-white/5 bg-[#0E0E1A] flex-shrink-0 overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Header con botón de volver */}
        <div>
          <button
            onClick={onBack}
            className="text-xs text-white/40 hover:text-white/70 transition-colors mb-2"
          >
            ← Todos los proyectos
          </button>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-bold text-white">Análisis con IA</h2>
          </div>
          <p className="text-xs text-white/40 truncate" title={projectName}>
            {projectName}
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center py-6">
            <Loader2 className="w-5 h-5 text-violet-400 animate-spin mb-2" />
            <p className="text-xs text-white/40">Cargando insights...</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && totalInsights === 0 && (
          <div className="flex flex-col items-center py-6 text-center">
            <Inbox className="w-8 h-8 text-white/20 mb-2" />
            <p className="text-xs text-white/40 mb-1">Sin insights aún</p>
            <p className="text-[10px] text-white/30 leading-relaxed">
              La IA analizará tu proyecto en segundos
            </p>
          </div>
        )}

        {/* Sections de insights */}
        {!loading && totalInsights > 0 && SECTIONS.map(section => {
          const items = grouped[section.key] || []
          if (items.length === 0) return null
          const Icon = section.icon
          const isOpen = expanded[section.key]

          return (
            <div key={section.key} className={`rounded-lg border ${section.border} ${section.bg}`}>
              <button
                onClick={() => toggle(section.key)}
                className="w-full flex items-center justify-between p-3 transition-colors hover:bg-white/[0.03]"
              >
                <div className="flex items-center gap-2">
                  <Icon className={`w-3.5 h-3.5 ${section.color}`} />
                  <span className="text-[11px] font-bold text-white/80 uppercase tracking-wider">
                    {section.label}
                  </span>
                  <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${section.bg} ${section.color}`}>
                    {items.length}
                  </span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 space-y-2">
                      {items.map(insight => {
                        const key = insight.insightId || insight.id || Math.random().toString()
                        // Para tipos "narrativos" mostramos description; para resto, title.
                        const isNarrative = ['summary', 'key_insight', 'project_characterization', 'client_profile'].includes(insight.type)
                        const text = isNarrative
                          ? (insight.description || insight.action || insight.title || insight.detected || '')
                          : (insight.title || insight.detected || insight.description || '')
                        return (
                          <div
                            key={key}
                            className="bg-[#161625] rounded-md p-2.5 border border-white/5 hover:border-white/10 transition-colors"
                          >
                            <p className="text-xs text-white/85 leading-relaxed">
                              {text}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}

        {/* Canales conectados al proyecto */}
        {channels && channels.length > 0 && (
          <div className="rounded-lg border border-white/10 bg-white/[0.02]">
            <button
              onClick={() => toggle('channels')}
              className="w-full flex items-center justify-between p-3 transition-colors hover:bg-white/[0.03]"
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-white/80 uppercase tracking-wider">
                  Canales del proyecto
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-white/10 text-white/60">
                  {channels.length}
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-white/40 transition-transform ${expanded.channels ? 'rotate-180' : ''}`}
              />
            </button>

            <AnimatePresence initial={false}>
              {expanded.channels && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-3 space-y-1.5">
                    {channels.map(channel => {
                      const cfg = CHANNEL_CONFIG[channel] || {
                        icon: Inbox,
                        label: channel,
                        color: 'text-white/60',
                        bg: 'bg-white/5'
                      }
                      const Icon = cfg.icon
                      return (
                        <div
                          key={channel}
                          className={`flex items-center gap-2 p-2 rounded-md ${cfg.bg} border border-white/5`}
                        >
                          <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                          <span className="text-xs text-white/80 font-medium">
                            {cfg.label}
                          </span>
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        </div>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Footer summary */}
        {!loading && totalAll > 0 && (
          <div className="pt-2 border-t border-white/5">
            <p className="text-[10px] text-white/30 text-center">
              {isFiltered ? (
                <>
                  {totalInsights} de {totalAll} insight{totalAll !== 1 ? 's' : ''} coinciden con la búsqueda
                </>
              ) : (
                <>
                  {totalAll} insight{totalAll !== 1 ? 's' : ''} generado{totalAll !== 1 ? 's' : ''} por IA
                </>
              )}
            </p>
          </div>
        )}

        {/* Mensaje cuando hay búsqueda y 0 matches */}
        {!loading && isFiltered && totalInsights === 0 && totalAll > 0 && (
          <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3 text-center">
            <p className="text-xs text-white/40">
              Ningún insight coincide con <strong className="text-violet-300">"{searchQuery}"</strong>
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}
