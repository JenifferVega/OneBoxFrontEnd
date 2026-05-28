import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from 'react-oidc-context'
import {
  Bell, X, CheckCheck, FolderKanban, Sparkles,
  ListTodo, AlertTriangle, MessageSquare, Mail, Inbox
} from 'lucide-react'
import { api } from '../services/api'

interface Notification {
  notificationId: string
  userId: string
  projectId?: string
  projectName?: string
  type: string
  title: string
  mensaje: string
  canal: string
  status: string
  createdAt: string
  readAt?: string
}

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  project_created: {
    icon: FolderKanban,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10'
  },
  insights_generated: {
    icon: Sparkles,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10'
  },
  task_created: {
    icon: ListTodo,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10'
  },
  risk: {
    icon: AlertTriangle,
    color: 'text-red-400',
    bg: 'bg-red-500/10'
  },
  whatsapp: {
    icon: MessageSquare,
    color: 'text-green-400',
    bg: 'bg-green-500/10'
  },
  email: {
    icon: Mail,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10'
  },
}

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] || {
    icon: Bell,
    color: 'text-white/60',
    bg: 'bg-white/5'
  }
}

function formatTime(iso: string): string {
  if (!iso) return ''
  try {
    const date = new Date(iso)
    const diffMs = Date.now() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'Ahora'
    if (diffMin < 60) return `Hace ${diffMin}m`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `Hace ${diffHr}h`
    const diffDay = Math.floor(diffHr / 24)
    if (diffDay < 7) return `Hace ${diffDay}d`
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  } catch {
    return ''
  }
}

export default function NotificationsPanel() {
  const auth = useAuth()
  const token = auth.user?.access_token || ''
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const unreadCount = notifications.filter(n => n.status !== 'read').length

  const fetchNotifications = async () => {
    if (!token) return
    try {
      setLoading(true)
      const data = await api.getNotifications(token)
      if (Array.isArray(data)) {
        setNotifications(data)
      }
    } catch (err) {
      console.warn('[Notifications] Error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
    // Refresh every 60 seconds
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [token])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleMarkRead = async (id: string) => {
    try {
      await api.markNotificationRead(id, token)
      setNotifications(prev =>
        prev.map(n => n.notificationId === id ? { ...n, status: 'read' } : n)
      )
    } catch (err) {
      console.error('[Notifications] mark read:', err)
    }
  }

  const handleMarkAll = async () => {
    try {
      await api.markAllNotificationsRead(token)
      setNotifications(prev => prev.map(n => ({ ...n, status: 'read' })))
    } catch (err) {
      console.error('[Notifications] mark all:', err)
    }
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-all"
        title="Notificaciones"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#12121E]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 w-[380px] max-h-[520px] bg-[#161625] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-white/70" />
                <h3 className="text-sm font-semibold text-white">Notificaciones</h3>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-violet-500/20 text-violet-300 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAll}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] text-white/50 hover:text-white/80 rounded transition-colors"
                    title="Marcar todas como leídas"
                  >
                    <CheckCheck className="w-3 h-3" />
                    Marcar todo
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1 rounded hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loading && notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs text-white/40">Cargando...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-12 text-center">
                  <Inbox className="w-10 h-10 text-white/20 mx-auto mb-2" />
                  <p className="text-sm text-white/50">Sin notificaciones</p>
                  <p className="text-xs text-white/30 mt-1">
                    Te avisaremos cuando pase algo
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {notifications.map(n => {
                    const cfg = getTypeConfig(n.type)
                    const Icon = cfg.icon
                    const isUnread = n.status !== 'read'
                    return (
                      <button
                        key={n.notificationId}
                        onClick={() => isUnread && handleMarkRead(n.notificationId)}
                        className={`w-full text-left p-3 transition-colors ${
                          isUnread ? 'bg-violet-500/5 hover:bg-violet-500/10' : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 ${cfg.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                            <Icon className={`w-4 h-4 ${cfg.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-sm font-medium ${isUnread ? 'text-white' : 'text-white/70'} line-clamp-2`}>
                                {n.title}
                              </p>
                              {isUnread && (
                                <span className="w-2 h-2 bg-violet-500 rounded-full flex-shrink-0 mt-1.5" />
                              )}
                            </div>
                            {n.mensaje && (
                              <p className="text-xs text-white/50 mt-0.5 line-clamp-2">
                                {n.mensaje}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1.5">
                              {n.projectName && (
                                <span className="text-[10px] text-white/40 px-1.5 py-0.5 bg-white/5 rounded">
                                  {n.projectName}
                                </span>
                              )}
                              <span className="text-[10px] text-white/30">
                                {formatTime(n.createdAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
