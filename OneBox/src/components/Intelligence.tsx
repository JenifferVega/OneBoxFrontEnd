import { useState, useEffect, useMemo } from 'react'
import { useAuth } from 'react-oidc-context'
import { api } from '../services/api'
import {
  Zap, CheckCircle2, Eye, X, AlertTriangle, Clock,
  MessageCircle, Mail, Users, Hash, TrendingUp, Phone
} from 'lucide-react'

interface ActionTag {
  label: string; icon?: string; color: string;
}
interface IAAction {
  id: string; projectName: string; type: string;
  badge: string; badgeColor: string; icon: string; iconColor: string;
  detected: string; action: string; actionType: string; actionColor: string;
  tags: ActionTag[]; time: string; status: string; requiresReview: boolean;
}

const ChannelIcon = ({ type, className = 'w-3.5 h-3.5' }: { type: string; className?: string }) => {
  switch (type) {
    case 'whatsapp': return <MessageCircle className={`${className} text-green-400`} />
    case 'email': return <Mail className={`${className} text-blue-400`} />
    case 'sms': return <Phone className={`${className} text-sky-400`} />
    case 'slack': return <Hash className={`${className} text-cyan-400`} />
    case 'partners': return <Users className={`${className} text-purple-400`} />
    default: return <MessageCircle className={`${className} text-white/40`} />
  }
}

export default function Intelligence() {
  const auth = useAuth()
  const token = auth.user?.access_token || ''
  const [actions, setActions] = useState<IAAction[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState('all')
  const [filtroProyecto, setFiltroProyecto] = useState<string | null>(null)
  const [filtroCanal, setFiltroCanal] = useState<string | null>(null)
  const [filtroTiempo, setFiltroTiempo] = useState('hoy')

  const userId = auth.user?.profile?.sub || ''
  useEffect(() => {
    if (!token || !userId) return
    const fetchInsights = async () => {
      try {
        setLoading(true)
        const data = await api.getInsights(token)
        if (Array.isArray(data)) {
          setActions(data)
        }
      } catch (err) {
        console.warn('[Intelligence] Error cargando insights del API:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchInsights()
  }, [token, userId])

  const projectsList = useMemo(() => {
    const names = new Set(actions.map(a => a.projectName).filter(Boolean))
    return Array.from(names).sort()
  }, [actions])

  const filtered = useMemo(() => {
    let result = actions
    if (filtroTipo === 'executed') result = result.filter(a => a.status === 'executed')
    if (filtroTipo === 'review') result = result.filter(a => a.status === 'review')
    if (filtroTipo === 'errors') result = result.filter(a => a.status === 'error')
    if (filtroProyecto) result = result.filter(a => a.projectName === filtroProyecto)
    return result
  }, [filtroTipo, filtroProyecto, actions])

  const stats = useMemo(() => ({
    mensajes: actions.length,
    acciones: actions.filter(a => a.status === 'executed').length,
    revision: actions.filter(a => a.status === 'review').length,
    noClasificados: actions.filter(a => a.status === 'error').length,
    precision: actions.length > 0
      ? Math.round((actions.filter(a => a.status === 'executed').length / actions.length) * 100)
      : 0,
  }), [actions])

  const actionsByType = useMemo(() => {
    const typeMap: Record<string, { label: string; color: string }> = {
      'task_created': { label: 'Tareas creadas', color: 'bg-violet-500' },
      'decision':     { label: 'Decisiones', color: 'bg-blue-500' },
      'followup':     { label: 'Follow-ups / Emails', color: 'bg-indigo-500' },
      'blocker':      { label: 'Bloqueadores', color: 'bg-red-500' },
      'risk':         { label: 'Riesgos', color: 'bg-orange-500' },
      'sla':          { label: 'SLA / Escalaciones', color: 'bg-red-500' },
      'notification': { label: 'Notificaciones', color: 'bg-sky-500' },
      'classification':{ label: 'Auto-clasificaci\u00F3n', color: 'bg-teal-500' },
      'summary':      { label: 'Res\u00FAmenes', color: 'bg-purple-500' },
    }
    const counts: Record<string, number> = {}
    actions.forEach(a => { counts[a.type] = (counts[a.type] || 0) + 1 })
    return Object.entries(counts)
      .map(([type, count]) => ({
        label: typeMap[type]?.label || type,
        count,
        color: typeMap[type]?.color || 'bg-white/20',
      }))
      .sort((a, b) => b.count - a.count)
  }, [actions])

  const activityDays = [
    { day: 'L', value: 30 }, { day: 'M', value: 45 }, { day: 'X', value: 35 },
    { day: 'J', value: 50 }, { day: 'V', value: 40 }, { day: 'S', value: 15 },
    { day: 'H', value: 65 },
  ]

  return (
    <div className="flex h-[calc(100vh-56px)]">
      <aside className="w-56 border-r border-white/5 bg-[#0E0E1A] flex-shrink-0 overflow-y-auto">
        <div className="p-4 space-y-6">
          <div>
            <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">Filtrar por Tipo</h3>
            {[
              { id: 'all', label: 'Todas las acciones', count: actions.length, icon: Zap, color: 'text-yellow-400' },
              { id: 'executed', label: 'Ejecutadas', count: stats.acciones, icon: CheckCircle2, color: 'text-emerald-400' },
              { id: 'review', label: 'Requieren revisión', count: stats.revision, icon: Eye, color: 'text-amber-400' },
              { id: 'errors', label: 'Errores', count: stats.noClasificados, icon: X, color: 'text-red-400' },
            ].map(f => {
              const Icon = f.icon
              return (
                <button
                  key={f.id}
                  onClick={() => setFiltroTipo(f.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                    filtroTipo === f.id ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/70 hover:bg-white/5'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon className={`w-3.5 h-3.5 ${f.color}`} />
                    {f.label}
                  </span>
                  <span className="text-xs text-white/30">{f.count}</span>
                </button>
              )
            })}
          </div>

          <div>
            <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">Filtrar por Proyecto</h3>
            {projectsList.map(name => (
              <button
                key={name}
                onClick={() => setFiltroProyecto(filtroProyecto === name ? null : name)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                  filtroProyecto === name ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/70 hover:bg-white/5'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${
                  name.includes('WordPress') ? 'bg-emerald-400' :
                  name.includes('ADS') ? 'bg-red-400' :
                  name.includes('AWS') ? 'bg-orange-400' :
                  name.includes('Recruiting') ? 'bg-blue-400' :
                  name.includes('Soporte') ? 'bg-cyan-400' : 'bg-purple-400'
                }`} />
                <span className="truncate">{name}</span>
              </button>
            ))}
          </div>

          <div>
            <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">Filtrar por Canal</h3>
            {[
              { icon: 'whatsapp', label: 'WhatsApp' },
              { icon: 'sms', label: 'SMS' },
              { icon: 'email', label: 'Email' },
              { icon: 'partners', label: 'Partners' },
              { icon: 'slack', label: 'Slack' },
            ].map(ch => (
              <button
                key={ch.icon}
                onClick={() => setFiltroCanal(filtroCanal === ch.icon ? null : ch.icon)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                  filtroCanal === ch.icon ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/70 hover:bg-white/5'
                }`}
              >
                <ChannelIcon type={ch.icon} className="w-4 h-4" />
                {ch.label}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Centro de Inteligencia</h1>
            <p className="text-sm text-white/40 mt-1">
              {loading ? 'Cargando datos...' : `${actions.length} acciones registradas · Datos en tiempo real desde DynamoDB`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {['Hoy', 'Últimas 48h', 'Esta semana', 'Este mes'].map(t => {
              const tId = t === 'Hoy' ? 'hoy' : t === 'Últimas 48h' ? '48h' : t === 'Esta semana' ? 'semana' : 'mes'
              return (
                <button
                  key={t}
                  onClick={() => setFiltroTiempo(tId)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    filtroTiempo === tId
                      ? 'bg-white/10 text-white border-white/20'
                      : 'text-white/40 border-white/5 hover:border-white/10'
                  }`}
                >
                  {t}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4 mb-6">
          {[
            { icon: Mail, value: stats.mensajes, label: 'Mensajes procesados', color: 'text-white/60' },
            { icon: Zap, value: stats.acciones, label: 'Acciones ejecutadas', color: 'text-emerald-400' },
            { icon: Eye, value: stats.revision, label: 'Requieren revisión', color: 'text-amber-400' },
            { icon: X, value: stats.noClasificados, label: 'No clasificados', color: 'text-red-400' },
            { icon: TrendingUp, value: `${stats.precision}%`, label: 'Precisión clasificación', color: 'text-emerald-400' },
          ].map((stat, i) => {
            const Icon = stat.icon
            return (
              <div key={i} className="bg-[#161625] rounded-xl p-4 border border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                  <span className={`text-2xl font-bold ${stat.color}`}>{stat.value}</span>
                </div>
                <p className="text-[11px] text-white/30">{stat.label}</p>
              </div>
            )
          })}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-white/40">Cargando insights desde DynamoDB...</p>
            </div>
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <Zap className="w-12 h-12 text-white/10" />
              <p className="text-sm text-white/40">No hay acciones de IA registradas a&#250;n</p>
              <p className="text-xs text-white/20">Usa el chat para interactuar con el agente y generar insights</p>
            </div>
          </div>
        )}
        <div className="space-y-4">
          {filtered.map(action => (
            <div key={action.id} className="bg-[#161625] rounded-xl border border-white/5 p-5 hover:border-white/10 transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${action.iconColor}`}>
                    {action.icon}
                  </div>
                  <span className="text-sm font-bold text-violet-400">{action.projectName}</span>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${action.badgeColor}`}>
                    {action.badge}
                  </span>
                </div>
                {action.requiresReview && (
                  <button className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg text-xs font-bold hover:bg-amber-500/30 transition-all">
                    <Eye className="w-3.5 h-3.5" /> Revisar
                  </button>
                )}
                {action.status === 'error' && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs font-bold">
                    <X className="w-3.5 h-3.5" /> Sin clasificar
                  </span>
                )}
              </div>

              <div className="flex items-start gap-2 mb-2">
                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0">DETECTÓ</span>
                <p className="text-sm text-white/80">{action.detected}</p>
              </div>

              <div className="flex items-start gap-2 mb-3 pl-4 border-l-2 border-white/10 ml-1">
                <span className={`text-[10px] font-bold ${action.actionColor} bg-${action.status === 'error' ? 'red' : action.status === 'review' ? 'amber' : 'emerald'}-500/10 px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0`}>
                  {action.actionType}
                </span>
                <p className="text-sm text-white/50">{action.action}</p>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  {action.tags.map((tag, i) => (
                    <span key={i} className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium ${tag.color}`}>
                      {tag.icon && <ChannelIcon type={tag.icon} className="w-3 h-3" />}
                      {tag.label}
                    </span>
                  ))}
                </div>
                <span className="text-[11px] text-white/30">{action.time}</span>
              </div>
            </div>
          ))}
        </div>
      </main>

      <aside className="w-72 border-l border-white/5 bg-[#0E0E1A] flex-shrink-0 overflow-y-auto p-4 space-y-6">
        <div className="text-center">
          <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">Precisión de Clasificación</h3>
          <div className="text-6xl font-black text-emerald-400">{stats.precision}<span className="text-3xl">%</span></div>
          <p className="text-xs text-white/40 mt-2">Precisi&#243;n actual</p>
          <p className="text-xs text-emerald-400">{stats.acciones} acciones ejecutadas de {actions.length}</p>
        </div>

        <div>
          <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">Acciones por Tipo</h3>
          <div className="space-y-2.5">
            {actionsByType.map((a, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className={`w-3 h-3 rounded-sm ${a.color} flex-shrink-0`} />
                <span className="text-xs text-white/60 flex-1">{a.label}</span>
                <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${a.color}`} style={{ width: `${(a.count / Math.max(...actionsByType.map(x => x.count), 1)) * 100}%` }} />
                </div>
                <span className="text-xs font-bold text-white/50 w-6 text-right">{a.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">Actividad Últimos 7 Días</h3>
          <div className="flex items-end gap-1.5 h-16">
            {activityDays.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`w-full rounded-sm transition-all ${i === activityDays.length - 1 ? 'bg-violet-500' : 'bg-white/10'}`}
                  style={{ height: `${(d.value / 65) * 48}px` }}
                />
                <span className="text-[9px] text-white/30">{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">Proyectos con Actividad IA</h3>
          <div className="space-y-3">
            {projectsList.length > 0 ? projectsList.map((name, i) => {
              const count = actions.filter(a => a.projectName === name).length
              return (
                <button
                  key={i}
                  onClick={() => setFiltroProyecto(filtroProyecto === name ? null : name)}
                  className={`w-full bg-white/5 rounded-lg p-3 text-left hover:bg-white/10 transition-all ${
                    filtroProyecto === name ? 'ring-1 ring-violet-500/50' : ''
                  }`}
                >
                  <p className="text-xs text-white/70 font-medium">{name}</p>
                  <p className="text-[10px] text-white/30 mt-1">{count} acciones registradas</p>
                </button>
              )
            }) : (
              <p className="text-xs text-white/30">Sin actividad IA registrada</p>
            )}
          </div>
        </div>
      </aside>
    </div>
  )
}
