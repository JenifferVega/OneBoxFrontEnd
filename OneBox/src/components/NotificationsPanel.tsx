/**
 * Notifications bell in the header.
 *
 * Before: this component opened a big dropdown with the full list of
 * notifications. The dropdown had limited interaction and didn't group
 * by project — it ended up being a panel that was hard to use.
 *
 * Now: this component is ONLY the icon + unread badge. Clicking it
 * navigates to the /notifications page (NotificationsPage.tsx), which
 * has the full view, filters, and grouping by project.
 *
 * We keep the 60s polling here so the badge is always up to date
 * without having to open the page.
 */
import { useState, useEffect } from 'react'
import { useAuth } from 'react-oidc-context'
import { useTranslation } from 'react-i18next'
import { Bell } from 'lucide-react'
import { api } from '../services/api'

interface Notification {
  notificationId: string
  status: string
}

interface Props {
  /** Callback that triggers navigation to the notifications page. */
  onOpen: () => void
}

export default function NotificationsPanel({ onOpen }: Props) {
  const auth = useAuth()
  const { t } = useTranslation()
  const token = auth.user?.access_token || ''
  const [unreadCount, setUnreadCount] = useState(0)

  // Badge polling. Fetches all notifications (the only thing the endpoint
  // exposes today), counts unread and discards the rest.
  useEffect(() => {
    if (!token) return
    let cancelled = false

    const fetchBadge = async () => {
      try {
        const data = await api.getNotifications(token)
        if (cancelled) return
        if (Array.isArray(data)) {
          const unread = (data as Notification[]).filter(n => n.status !== 'read').length
          setUnreadCount(unread)
        }
      } catch (err) {
        console.warn('[NotificationsPanel] badge fetch error:', err)
      }
    }

    fetchBadge()
    const id = setInterval(fetchBadge, 60_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [token])

  return (
    <button
      onClick={onOpen}
      className="relative p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-all"
      title={t('notifications.bellTitle')}
    >
      <Bell className="w-5 h-5" />
      {unreadCount > 0 && (
        <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#12121E]">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  )
}
