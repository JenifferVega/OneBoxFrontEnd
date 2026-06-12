/**
 * Página de Notificaciones.
 *
 * Antes: la campana abría un dropdown pequeño en el header — el dropdown
 * tenía interacción limitada y no se podía filtrar fácil por proyecto.
 *
 * Ahora: la campana navega a esta página completa. Las notificaciones se
 * agrupan por proyecto (FolderKanban), cada grupo es colapsable. Permite
 * marcar como leído (individual y todas), filtrar por canal/estado y
 * volver al dashboard con un botón.
 */
import { useState, useEffect, useMemo } from 'react'
import { useAuth } from 'react-oidc-context'
import { motion } from 'framer-motion'
import {
  Bell, CheckCheck, FolderKanban, Sparkles, ListTodo,
  AlertTriangle, MessageSquare, Mail, Inbox, ChevronDown,
  ChevronRight, ArrowLeft, RefreshCw
} from 'lucide-react'
import { api } from '../services/api'
import { PageType } from '../App'

interface Notification {
  notificationId: string
  userId: string
  projectId?: string
  projectName?: string
  type: string
  title: string
  mensaje?: string
  canal: string
  status: string
  createdAt: string
  readAt?: string
}

interface Props {
  onNavigate: (page: PageType) => void
}

// Mapa tipo → estética. Las claves cubren los tipos que el backend emite
// (project_created, insights_generated, task_created, risk, whatsapp, email,
// document_analyzed, text_analyzed, system, etc.).
const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  project_created:     { icon: FolderKanban, color: 'text-violet-400',  bg: 'bg-violet-500/10',  label: 'Proyecto creado' },
  insights_generated:  { icon: Sparkles,     color: 'text-amber-400',   bg: 'bg-amber-500/10',   label: 'Insights nuevos' },
  task_created:        { icon: ListTodo,     color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Tarea nueva'      },
  risk:                { icon: AlertTriangle,color: 'text-red-400',     bg: 'bg-red-500/10',     label: 'Riesgo'           },
  whatsapp:            { icon: MessageSquare,color: 'text-green-400',   bg: 'bg-green-500/10',   label: 'WhatsApp'         },
  email:               { icon: Mail,         color: 'text-blue-400',    bg: 'bg-blue-500/10',    label: 'Email'            },
  document_analyzed:   { icon: Sparkles,     color: 'text-amber-400',   bg: 'bg-amber-500/10',   label: 'Documento analizado' },
  text_analyzed:       { icon: Sparkles,     color: 'text-amber-400',   bg: 'bg-amber-500/10',   label: 'Texto analizado' },
  system:              { icon: Bell,         color: 'text-white/60',    bg: 'bg-white/5',        label: 'Sistema'          },
}

function getConfig(type: string) {
  return TYPE_CONFIG[type] || TYPE_CONFIG.system
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const diffHrs = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffMin < 1) return 'ahora mismo'
    if (diffMin < 60) return `hace ${diffMin} min`
    if (diffHrs < 24) return `hace ${diffHrs}h`
    if (diffDays < 7) return `hace ${diffDays}d`
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

export default function NotificationsPage({ onNavigate }: Props) {
  const auth = useAuth()
  const token = auth.user?.access_token || ''
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set())
  // Filtros opcionales: por canal y por estado (unread/all)
  const [filterChannel, setFilterChannel] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'unread'>('all')

  const fetchNotifications = async () => {
    if (!token) return
    try {
      setLoading(true)
      const data = await api.getNotifications(token)
      if (Array.isArray(data)) {
        // Ordenar más reciente primero
        const sorted = [...data].sort(
          (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')
        )
        setNotifications(sorted)
      }
    } catch (err) {
      console.error('[NotificationsPage] fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [token])

  // Marcar UNA notif como leída.
  const handleMarkRead = async (id: string) => {
    try {
      await api.markNotificationRead(id, token)
      setNotifications(prev =>
        prev.map(n => n.notificationId === id ? { ...n, status: 'read' } : n)
      )
    } catch (err) {
      console.error('[NotificationsPage] mark read error:', err)
    }
  }

  // Marcar todas como leídas.
  const handleMarkAll = async () => {
    try {
      await api.markAllNotificationsRead(token)
      setNotifications(prev => prev.map(n => ({ ...n, status: 'read' })))
    } catch (err) {
      console.error('[NotificationsPage] mark all error:', err)
    }
  }

  // Filtrado por canal/estado antes de agrupar.
  const filtered = useMemo(() => {
    return notifications.filter(n => {
      if (filterChannel !== 'all' && n.canal !== filterChannel) return false
      if (filterStatus === 'unread' && n.status === 'read') return false
      return true
    })
  }, [notifications, filterChannel, filterStatus])

  // Agrupar por projectId. Sin proyecto → grupo especial "Sistema / sin proyecto".
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; items: Notification[] }>()
    for (const n of filtered) {
      const key = n.projectId || '__no_project__'
      const name = n.projectName || 'Sistema / sin proyecto'
      if (!map.has(key)) map.set(key, { name, items: [] })
      map.get(key)!.items.push(n)
    }
    // Ordenar grupos por fecha de la notif más reciente del grupo
    return Array.from(map.entries())
      .map(([projectId, g]) => ({ projectId, name: g.name, items: g.items }))
      .sort((a, b) => {
        const aDate = a.items[0]?.createdAt || ''
        const bDate = b.items[0]?.createdAt || ''
        return bDate.localeCompare(aDate)
      })
  }, [filtered])

  const totalUnread = notifications.filter(n => n.status !== 'read').length
  // Lista única de canales encontrados, para el dropdown de filtro
  const channels = useMemo(() => {
    const s = new Set(notifications.map(n => n.canal).filter(Boolean))
    return Array.from(s).sort()
  }, [notifications])

  const toggleProject = (pid: string) => {
    setCollapsedProjects(prev => {
      const next = new Set(prev)
      if (next.has(pid)) next.delete(pid)
      else next.add(pid)
      return next
    })
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[#0E0E18] text-white">
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('proyectos')}
              className="p-2 rounded-lg hover:bg-white/5 text-white/60 hover:text-white transition-colors"
              title="Volver a proyectos"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-3">
                <Bell className="w-6 h-6 text-violet-400" />
                Notificaciones
                {totalUnread > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full">
                    {totalUnread} sin leer
                  </span>
                )}
              </h1>
              <p className="text-sm text-white/40 mt-1">
                Todo lo que se mandó por tus proyectos, agrupado para que encuentres rápido.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchNotifications}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/60 hover:text-white border border-white/10 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refrescar
            </button>
            {totalUnread > 0 && (
              <button
                onClick={handleMarkAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-violet-300 hover:text-violet-200 border border-violet-500/30 bg-violet-500/10 rounded-lg hover:bg-violet-500/20 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Marcar todas como leídas
              </button>
            )}
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
          <span className="text-white/40">Filtrar:</span>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as 'all' | 'unread')}
            className="bg-[#161625] border border-white/10 rounded-md px-2.5 py-1 text-white/70 focus:outline-none focus:border-violet-500/40"
          >
            <option value="all">Todas</option>
            <option value="unread">Solo no leídas</option>
          </select>
          {channels.length > 0 && (
            <select
              value={filterChannel}
              onChange={e => setFilterChannel(e.target.value)}
              className="bg-[#161625] border border-white/10 rounded-md px-2.5 py-1 text-white/70 focus:outline-none focus:border-violet-500/40"
            >
              <option value="all">Todos los canales</option>
              {channels.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          <span className="ml-auto text-white/30">
            {filtered.length} de {notifications.length} notificaciones
          </span>
        </div>

        {/* Contenido */}
        {loading && notifications.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-white/40">
            Cargando notificaciones...
          </div>
        ) : grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/30">
            <Inbox className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">No hay notificaciones que coincidan con los filtros.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.map(group => {
              const collapsed = collapsedProjects.has(group.projectId)
              const unreadInGroup = group.items.filter(n => n.status !== 'read').length
              return (
                <motion.div
                  key={group.projectId}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[#161625] border border-white/5 rounded-xl overflow-hidden"
                >
                  {/* Encabezado del grupo (clickeable para colapsar) */}
                  <button
                    onClick={() => toggleProject(group.projectId)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {collapsed
                        ? <ChevronRight className="w-4 h-4 text-white/40" />
                        : <ChevronDown className="w-4 h-4 text-white/40" />}
                      <FolderKanban className="w-4 h-4 text-violet-400" />
                      <span className="text-sm font-semibold text-white">{group.name}</span>
                      {unreadInGroup > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-500/20 text-red-300 rounded-full">
                          {unreadInGroup} sin leer
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-white/30">
                      {group.items.length} total
                    </span>
                  </button>

                  {/* Notificaciones del grupo */}
                  {!collapsed && (
                    <div className="border-t border-white/5">
                      {group.items.map((n) => {
                        const cfg = getConfig(n.type)
                        const Icon = cfg.icon
                        const isUnread = n.status !== 'read'
                        return (
                          <div
                            key={n.notificationId}
                            className={`group flex items-start gap-3 px-4 py-3 border-b border-white/5 last:border-b-0 transition-colors ${
                              isUnread ? 'bg-violet-500/[0.03]' : ''
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                              <Icon className={`w-4 h-4 ${cfg.color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm text-white font-medium">{n.title || cfg.label}</p>
                                {isUnread && (
                                  <span className="w-2 h-2 rounded-full bg-violet-400 flex-shrink-0 mt-1.5" />
                                )}
                              </div>
                              {n.mensaje && (
                                <p className="text-xs text-white/60 mt-0.5 line-clamp-2">{n.mensaje}</p>
                              )}
                              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-white/30">
                                <span>{formatDate(n.createdAt)}</span>
                                {n.canal && (
                                  <span className="px-1.5 py-0.5 bg-white/5 rounded">
                                    {n.canal}
                                  </span>
                                )}
                                {n.status && (
                                  <span className={`px-1.5 py-0.5 rounded ${
                                    n.status === 'sent' || n.status === 'delivered'
                                      ? 'bg-emerald-500/10 text-emerald-400'
                                      : n.status === 'queued'
                                      ? 'bg-amber-500/10 text-amber-400'
                                      : n.status === 'failed'
                                      ? 'bg-red-500/10 text-red-400'
                                      : 'bg-white/5 text-white/40'
                                  }`}>
                                    {n.status}
                                  </span>
                                )}
                              </div>
                            </div>
                            {isUnread && (
                              <button
                                onClick={() => handleMarkRead(n.notificationId)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-white/40 hover:text-violet-300 px-2 py-1 rounded hover:bg-white/5 flex-shrink-0"
                              >
                                Marcar leído
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
