/**
 * Notifications page.
 *
 * Before: the bell opened a small dropdown in the header — the dropdown
 * had limited interaction and couldn't be filtered easily by project.
 *
 * Now: the bell navigates to this full page. Notifications are grouped
 * by project (FolderKanban), and each group is collapsible. Supports
 * marking as read (individually and all at once), filtering by
 * channel/status, and returning to the dashboard with a button.
 */
import { useState, useEffect, useMemo } from 'react'
import { useAuth } from 'react-oidc-context'
import { useTranslation } from 'react-i18next'
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
  message?: string
  channel: string
  status: string
  createdAt: string
  readAt?: string
}

interface Props {
  onNavigate: (page: PageType) => void
}

// Type → aesthetics map. The keys cover the types the backend emits.
// `labelKey` is an i18n key; it's resolved with t() at render time.
const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string; labelKey: string }> = {
  project_created:     { icon: FolderKanban, color: 'text-violet-400',  bg: 'bg-violet-500/10',  labelKey: 'project_created' },
  insights_generated:  { icon: Sparkles,     color: 'text-amber-400',   bg: 'bg-amber-500/10',   labelKey: 'insights_generated' },
  task_created:        { icon: ListTodo,     color: 'text-emerald-400', bg: 'bg-emerald-500/10', labelKey: 'task_created' },
  risk:                { icon: AlertTriangle,color: 'text-red-400',     bg: 'bg-red-500/10',     labelKey: 'risk' },
  whatsapp:            { icon: MessageSquare,color: 'text-green-400',   bg: 'bg-green-500/10',   labelKey: 'whatsapp' },
  email:               { icon: Mail,         color: 'text-blue-400',    bg: 'bg-blue-500/10',    labelKey: 'email' },
  document_analyzed:   { icon: Sparkles,     color: 'text-amber-400',   bg: 'bg-amber-500/10',   labelKey: 'document_analyzed' },
  text_analyzed:       { icon: Sparkles,     color: 'text-amber-400',   bg: 'bg-amber-500/10',   labelKey: 'text_analyzed' },
  system:              { icon: Bell,         color: 'text-white/60',    bg: 'bg-white/5',        labelKey: 'system' },
}

function getConfig(type: string) {
  return TYPE_CONFIG[type] || TYPE_CONFIG.system
}

function useFormatDate() {
  const { t } = useTranslation()
  const locale = 'en-US'
  return (iso: string): string => {
    try {
      const d = new Date(iso)
      const now = new Date()
      const diffMs = now.getTime() - d.getTime()
      const diffMin = Math.floor(diffMs / 60000)
      const diffHrs = Math.floor(diffMs / 3600000)
      const diffDays = Math.floor(diffMs / 86400000)
      if (diffMin < 1) return t('notifications.relative.now')
      if (diffMin < 60) return t('notifications.relative.minutes', { count: diffMin })
      if (diffHrs < 24) return t('notifications.relative.hours', { count: diffHrs })
      if (diffDays < 7) return t('notifications.relative.days', { count: diffDays })
      return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
    } catch {
      return iso
    }
  }
}

export default function NotificationsPage({ onNavigate }: Props) {
  const auth = useAuth()
  const { t } = useTranslation()
  const formatDate = useFormatDate()
  const token = auth.user?.access_token || ''
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set())
  // Optional filters: by channel and by status (unread/all)
  const [filterChannel, setFilterChannel] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'unread'>('all')

  const fetchNotifications = async () => {
    if (!token) return
    try {
      setLoading(true)
      const data = await api.getNotifications(token)
      if (Array.isArray(data)) {
        // Sort most recent first
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

  // Mark ONE notification as read.
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

  // Mark all as read.
  const handleMarkAll = async () => {
    try {
      await api.markAllNotificationsRead(token)
      setNotifications(prev => prev.map(n => ({ ...n, status: 'read' })))
    } catch (err) {
      console.error('[NotificationsPage] mark all error:', err)
    }
  }

  // Filter by channel/status before grouping.
  const filtered = useMemo(() => {
    return notifications.filter(n => {
      if (filterChannel !== 'all' && n.channel !== filterChannel) return false
      if (filterStatus === 'unread' && n.status === 'read') return false
      return true
    })
  }, [notifications, filterChannel, filterStatus])

  // Group by projectId. Without a project → special group "System / no project".
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; items: Notification[] }>()
    for (const n of filtered) {
      const key = n.projectId || '__no_project__'
      const name = n.projectName || 'System / no project'
      if (!map.has(key)) map.set(key, { name, items: [] })
      map.get(key)!.items.push(n)
    }
    // Sort groups by the most recent notification's date in the group
    return Array.from(map.entries())
      .map(([projectId, g]) => ({ projectId, name: g.name, items: g.items }))
      .sort((a, b) => {
        const aDate = a.items[0]?.createdAt || ''
        const bDate = b.items[0]?.createdAt || ''
        return bDate.localeCompare(aDate)
      })
  }, [filtered])

  const totalUnread = notifications.filter(n => n.status !== 'read').length
  // Unique list of channels found, for the filter dropdown.
  // WhatsApp is hidden — we don't list it even if there are notifications
  // with channel 'whatsapp'.
  const channels = useMemo(() => {
    const s = new Set(
      notifications
        .map(n => n.channel)
        .filter(Boolean)
        .filter(c => (c || '').toLowerCase() !== 'whatsapp')
    )
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
              onClick={() => onNavigate('projects')}
              className="p-2 rounded-lg hover:bg-white/5 text-white/60 hover:text-white transition-colors"
              title={t('notifications.backToProjects')}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-3">
                <Bell className="w-6 h-6 text-violet-400" />
                {t('notifications.title')}
                {totalUnread > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full">
                    {t('notifications.unreadBadge', { count: totalUnread })}
                  </span>
                )}
              </h1>
              <p className="text-sm text-white/40 mt-1">
                {t('notifications.subtitle')}
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
              {t('notifications.refresh')}
            </button>
            {totalUnread > 0 && (
              <button
                onClick={handleMarkAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-violet-300 hover:text-violet-200 border border-violet-500/30 bg-violet-500/10 rounded-lg hover:bg-violet-500/20 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
          <span className="text-white/40">{t('notifications.filterLabel')}</span>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as 'all' | 'unread')}
            className="bg-[#161625] border border-white/10 rounded-md px-2.5 py-1 text-white/70 focus:outline-none focus:border-violet-500/40"
          >
            <option value="all">{t('notifications.filterAll')}</option>
            <option value="unread">{t('notifications.filterUnread')}</option>
          </select>
          {channels.length > 0 && (
            <select
              value={filterChannel}
              onChange={e => setFilterChannel(e.target.value)}
              className="bg-[#161625] border border-white/10 rounded-md px-2.5 py-1 text-white/70 focus:outline-none focus:border-violet-500/40"
            >
              <option value="all">{t('notifications.filterAllChannels')}</option>
              {channels.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          <span className="ml-auto text-white/30">
            {t('notifications.filterCount', { shown: filtered.length, total: notifications.length })}
          </span>
        </div>

        {/* Content */}
        {loading && notifications.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-white/40">
            {t('notifications.loading')}
          </div>
        ) : grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/30">
            <Inbox className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">{t('notifications.empty')}</p>
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
                  {/* Group header (clickable to collapse) */}
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
                          {t('notifications.groupUnread', { count: unreadInGroup })}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-white/30">
                      {t('notifications.groupTotal', { count: group.items.length })}
                    </span>
                  </button>

                  {/* Group notifications */}
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
                                <p className="text-sm text-white font-medium">{n.title || t(`notifications.types.${cfg.labelKey}`)}</p>
                                {isUnread && (
                                  <span className="w-2 h-2 rounded-full bg-violet-400 flex-shrink-0 mt-1.5" />
                                )}
                              </div>
                              {n.message && (
                                <p className="text-xs text-white/60 mt-0.5 line-clamp-2">{n.message}</p>
                              )}
                              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-white/30">
                                <span>{formatDate(n.createdAt)}</span>
                                {n.channel && (
                                  <span className="px-1.5 py-0.5 bg-white/5 rounded">
                                    {n.channel}
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
                                {t('notifications.markRead')}
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
