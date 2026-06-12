/**
 * Campana de notificaciones del header.
 *
 * Antes: este componente abría un dropdown grande con toda la lista de
 * notificaciones. El dropdown tenía interacción limitada y no agrupaba
 * por proyecto — quedaba como un panel difícil de usar.
 *
 * Ahora: este componente es SOLO el icono + badge de no-leídas. Al click
 * navega a la página /notificaciones (NotificationsPage.tsx) donde hay
 * vista completa, filtros y agrupación por proyecto.
 *
 * Mantenemos aquí el polling cada 60s para que el badge esté siempre
 * actualizado sin abrir la página.
 */
import { useState, useEffect } from 'react'
import { useAuth } from 'react-oidc-context'
import { Bell } from 'lucide-react'
import { api } from '../services/api'

interface Notification {
  notificationId: string
  status: string
}

interface Props {
  /** Callback que dispara la navegación a la página de notificaciones. */
  onOpen: () => void
}

export default function NotificationsPanel({ onOpen }: Props) {
  const auth = useAuth()
  const token = auth.user?.access_token || ''
  const [unreadCount, setUnreadCount] = useState(0)

  // Polling del badge. Trae todas las notificaciones (es lo único que el
  // endpoint expone hoy), cuenta no-leídas y descarta el resto.
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
      title="Notificaciones"
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
