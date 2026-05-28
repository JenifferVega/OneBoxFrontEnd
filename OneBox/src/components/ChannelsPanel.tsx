import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from 'react-oidc-context'
import {
  Mail, MessageCircle, Check, AlertCircle, Plus,
  ExternalLink, Settings, Loader2
} from 'lucide-react'
import { api } from '../services/api'
import { PageType } from '../App'

interface ChannelStatus {
  id: string
  label: string
  description: string
  icon: any
  color: string
  bg: string
  bgHover: string
  connected: boolean
  loading: boolean
  meta?: string
  action?: () => void
}

interface ChannelsPanelProps {
  onNavigate?: (page: PageType) => void
  gmailConnected: boolean
  onGmailRefresh?: () => void
}

export default function ChannelsPanel({ onNavigate, gmailConnected, onGmailRefresh }: ChannelsPanelProps) {
  const auth = useAuth()
  const userId = auth.user?.profile?.sub || ''

  const [gmailMeta, setGmailMeta] = useState<string>('')
  const [whatsappCount, setWhatsappCount] = useState<number>(0)
  const [refreshing, setRefreshing] = useState(false)

  // Verificar email Gmail
  useEffect(() => {
    if (gmailConnected && auth.user?.profile?.email) {
      setGmailMeta(auth.user.profile.email as string)
    }
  }, [gmailConnected, auth.user?.profile?.email])

  // Contar números WhatsApp en proyectos del usuario
  useEffect(() => {
    const token = auth.user?.access_token
    if (!token) return
    api.getProjects(token).then((projects: any[]) => {
      const numbers = new Set<string>()
      projects?.forEach((p: any) => {
        const parts = p.participants || []
        parts.forEach((part: any) => {
          if (part.telefono) numbers.add(part.telefono)
        })
      })
      setWhatsappCount(numbers.size)
    }).catch(() => {})
  }, [auth.user?.access_token])

  const handleRefreshGmail = async () => {
    if (!userId) return
    try {
      setRefreshing(true)
      const data = await api.getGmailStatus(userId)
      if (data.connected && onGmailRefresh) onGmailRefresh()
    } catch (e) {
      console.error('[Channels] gmail status:', e)
    } finally {
      setRefreshing(false)
    }
  }

  const channels: ChannelStatus[] = [
    {
      id: 'gmail',
      label: 'Gmail',
      description: 'Recibe y analiza correos automáticamente',
      icon: Mail,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10',
      bgHover: 'hover:bg-rose-500/15',
      connected: gmailConnected,
      loading: refreshing,
      meta: gmailMeta || undefined,
      action: () => onNavigate?.('conectar-gmail')
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      description: 'Mensajes vía Twilio para tus proyectos',
      icon: MessageCircle,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      bgHover: 'hover:bg-emerald-500/15',
      connected: whatsappCount > 0,
      loading: false,
      meta: whatsappCount > 0 ? `${whatsappCount} número${whatsappCount > 1 ? 's' : ''} activo${whatsappCount > 1 ? 's' : ''}` : undefined,
      action: () => onNavigate?.('proyectos')
    },
  ]

  const connectedCount = channels.filter(c => c.connected).length

  return (
    <div className="bg-[#161625] rounded-xl border border-white/5 p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="min-w-0">
          <h3 className="text-xs font-bold text-white truncate">Canales conectados</h3>
          <p className="text-[10px] text-white/40 mt-0.5">
            {connectedCount} de {channels.length} activos
          </p>
        </div>
        <button
          onClick={handleRefreshGmail}
          className="p-1 rounded-md text-white/40 hover:text-white/70 hover:bg-white/5 transition-all flex-shrink-0"
          title="Actualizar estado"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-1.5">
        {channels.map((channel, idx) => {
          const Icon = channel.icon
          return (
            <motion.button
              key={channel.id}
              onClick={channel.action}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.05 }}
              title={channel.connected ? `${channel.label} conectado${channel.meta ? ' · ' + channel.meta : ''}` : `${channel.label} sin conectar — click para conectar`}
              className={`w-full flex items-center gap-2 p-2 rounded-lg border transition-all text-left ${
                channel.connected
                  ? `${channel.bg} border-white/5 ${channel.bgHover}`
                  : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06] border-dashed'
              }`}
            >
              <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
                channel.connected ? channel.bg : 'bg-white/5'
              }`}>
                {channel.loading ? (
                  <Loader2 className={`w-3.5 h-3.5 ${channel.color} animate-spin`} />
                ) : (
                  <Icon className={`w-3.5 h-3.5 ${channel.connected ? channel.color : 'text-white/30'}`} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-medium truncate ${channel.connected ? 'text-white' : 'text-white/60'}`}>
                    {channel.label}
                  </span>
                  {channel.connected ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" title="Conectado" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-white/20 flex-shrink-0" title="Sin conectar" />
                  )}
                </div>
                {channel.meta && (
                  <p className="text-[10px] text-white/40 mt-0.5 truncate" title={channel.meta}>
                    {channel.meta}
                  </p>
                )}
              </div>

              {!channel.connected ? (
                <Plus className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
              ) : (
                <ExternalLink className="w-3 h-3 text-white/30 flex-shrink-0" />
              )}
            </motion.button>
          )
        })}
      </div>

      {connectedCount === channels.length && (
        <div className="mt-2 p-1.5 bg-emerald-500/5 border border-emerald-500/10 rounded-md flex items-center gap-1.5">
          <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
          <p className="text-[10px] text-emerald-400 truncate">Todos los canales listos</p>
        </div>
      )}
    </div>
  )
}
