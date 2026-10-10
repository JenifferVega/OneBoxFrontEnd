import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from 'react-oidc-context'
import {
  Mail, MessageCircle, Check, AlertCircle, Plus,
  ExternalLink, Settings, Loader2, Trello
} from 'lucide-react'
import { api } from '../services/api'
import { getTrelloStatus } from '../services/trello'
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
  /** Not this user's to connect: shown for information, not clickable. */
  managed?: boolean
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
  const [trelloConnected, setTrelloConnected] = useState(false)
  const [trelloUser, setTrelloUser] = useState<string>('')
  const [trelloLoading, setTrelloLoading] = useState(true)
  // Does this user OWN any project? Trello is connected by project owners
  // only: OneBox reaches a project's board with its owner's connection, so a
  // member's connection would never be used -- offering it only invited
  // members to set up boards in their own accounts. null = not known yet.
  const [ownsProject, setOwnsProject] = useState<boolean | null>(null)

  // Check Gmail email
  useEffect(() => {
    if (gmailConnected && auth.user?.profile?.email) {
      setGmailMeta(auth.user.profile.email as string)
    }
  }, [gmailConnected, auth.user?.profile?.email])

  // Count WhatsApp numbers in the user's projects
  useEffect(() => {
    const token = auth.user?.access_token
    if (!token) return
    api.getProjects(token).then((projects: any[]) => {
      const numbers = new Set<string>()
      projects?.forEach((p: any) => {
        const parts = p.participants || []
        parts.forEach((part: any) => {
          if (part.phone) numbers.add(part.phone)
        })
      })
      setWhatsappCount(numbers.size)
      // Only a user who is ON projects and owns none of them is "just a
      // member". Someone with no projects yet is about to own one, and a
      // member who creates a project becomes its owner: both see Connect.
      const list = projects || []
      setOwnsProject(list.length === 0 || list.some((p: any) => p.isOwner === true))
    }).catch(() => {})
  }, [auth.user?.access_token])

  // Trello status. Re-checked automatically after the user comes back from
  // authorizing: that redirect remounts the app, so this effect runs again.
  useEffect(() => {
    let alive = true
    getTrelloStatus()
      .then(s => {
        if (!alive) return
        setTrelloConnected(!!s.connected)
        setTrelloUser(s.username || '')
      })
      .finally(() => { if (alive) setTrelloLoading(false) })
    return () => { alive = false }
  }, [])

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

  // A member who is not connected sees Trello as managed by the owner. One
  // who IS connected (from before this rule) can still open it to disconnect.
  const trelloManaged = ownsProject === false && !trelloConnected

  const channels: ChannelStatus[] = [
    {
      id: 'gmail',
      label: 'Gmail',
      description: 'Automatically receive and analyze emails',
      icon: Mail,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10',
      bgHover: 'hover:bg-rose-500/15',
      connected: gmailConnected,
      loading: refreshing,
      meta: gmailMeta || undefined,
      action: () => onNavigate?.('connect-gmail')
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      description: 'Messages via Twilio for your projects',
      icon: MessageCircle,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      bgHover: 'hover:bg-emerald-500/15',
      connected: whatsappCount > 0,
      loading: false,
      meta: whatsappCount > 0 ? `${whatsappCount} active number${whatsappCount > 1 ? 's' : ''}` : undefined,
      action: () => onNavigate?.('projects')
    },
    {
      id: 'trello',
      label: 'Trello',
      description: trelloManaged
        ? 'Managed by the project owner'
        : 'Send project tasks to a Trello board',
      icon: Trello,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      bgHover: 'hover:bg-blue-500/15',
      connected: trelloConnected,
      loading: trelloLoading,
      meta: trelloManaged
        ? 'Managed by the project owner'
        : (trelloUser ? `@${trelloUser}` : undefined),
      managed: trelloManaged,
      action: trelloManaged ? undefined : () => onNavigate?.('connect-trello')
    },
  ]

  // A channel managed by someone else is neither "active" nor "missing" for
  // this user, so it is left out of the count.
  const counted = channels.filter(c => !c.managed)
  const connectedCount = counted.filter(c => c.connected).length

  return (
    <div className="bg-[#161625] rounded-xl border border-white/5 p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="min-w-0">
          <h3 className="text-xs font-bold text-white truncate">Connected channels</h3>
          <p className="text-[10px] text-white/40 mt-0.5">
            {connectedCount} of {counted.length} active
          </p>
        </div>
        <button
          onClick={handleRefreshGmail}
          className="p-1 rounded-md text-white/40 hover:text-white/70 hover:bg-white/5 transition-all flex-shrink-0"
          title="Refresh status"
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
              disabled={channel.managed}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.05 }}
              title={channel.managed
                ? `${channel.label} is managed by the owner of each project. Your task updates reach the board automatically; you do not need to connect it.`
                : channel.connected ? `${channel.label} connected${channel.meta ? ' · ' + channel.meta : ''}` : `${channel.label} not connected — click to connect`}
              className={`w-full flex items-center gap-2 p-2 rounded-lg border transition-all text-left ${
                channel.managed
                  ? 'bg-white/[0.02] border-white/5 cursor-default'
                  : channel.connected
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
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" title="Connected" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-white/20 flex-shrink-0" title="Not connected" />
                  )}
                </div>
                {channel.meta && (
                  <p className="text-[10px] text-white/40 mt-0.5 truncate" title={channel.meta}>
                    {channel.meta}
                  </p>
                )}
              </div>

              {channel.managed ? null : !channel.connected ? (
                <Plus className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
              ) : (
                <ExternalLink className="w-3 h-3 text-white/30 flex-shrink-0" />
              )}
            </motion.button>
          )
        })}
      </div>

      {connectedCount === counted.length && (
        <div className="mt-2 p-1.5 bg-emerald-500/5 border border-emerald-500/10 rounded-md flex items-center gap-1.5">
          <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
          <p className="text-[10px] text-emerald-400 truncate">All channels ready</p>
        </div>
      )}
    </div>
  )
}
