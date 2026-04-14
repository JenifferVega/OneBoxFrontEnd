import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from 'react-oidc-context'
import { api } from '../services/api'
import {
  Search, ArrowLeft, CheckCircle2, AlertTriangle, Clock, Settings,
  MessageCircle, Mail, Users, Hash, ChevronRight, Sparkles, X,
  FolderKanban, Zap, Eye, Shield, TrendingUp, AlertCircle,
  Phone, Send, Bell
} from 'lucide-react'
import { PageType } from '../App'

interface ProjectTeamMember {
  nombre: string; iniciales: string; rol: string; email: string; telefono: string; color: string; tareas: number;
}
interface ProjectChannel {
  nombre: string; icon: string; lastActivity: string; unread: number;
}
interface ProjectTask {
  id: string; text: string; status: string; description: string;
  assignedTo: { nombre: string; iniciales: string; color: string };
  tags: string[];
}
interface ProjectAction {
  id: string; detected: string; executed: string; channel: string; channelIcon: string; time: string;
}
interface ProjectNotification {
  id: string; canal: string; destinatario: string; mensaje: string; status: string; time: string;
}
interface Project {
  projectId: string; name: string; client: string; description: string;
  status: string; sla: string; type: string;
  deliveryDate: string; daysLeft: number; progress: number;
  hechas: number; pendientes: number; bloqueadas: number; mensajesIA: number;
  lastAction: { detected: string; action: string };
  team: ProjectTeamMember[]; channels: ProjectChannel[];
  etiquetas: { nombre: string; color: string }[];
  slaMetrics: { respuestaCliente: string; tareasResponsable: number; respuestaPartner: string; tareasBlockeadas24h: number };
  startDate: string; tasks: ProjectTask[]; aiActions: ProjectAction[];
  notifications?: ProjectNotification[];
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

const SLABadge = ({ sla }: { sla: string }) => {
  const config: Record<string, { label: string; color: string; dot: string }> = {
    on_track: { label: 'On track', color: 'text-emerald-400', dot: 'bg-emerald-400' },
    en_riesgo: { label: 'En riesgo', color: 'text-orange-400', dot: 'bg-orange-400' },
    sla_vencido: { label: 'SLA vencido', color: 'text-red-400', dot: 'bg-red-400' },
    paused: { label: 'Pausado', color: 'text-white/40', dot: 'bg-white/40' },
    delivered: { label: 'Entregado', color: 'text-emerald-400', dot: 'bg-emerald-400' },
  }
  const c = config[sla] || config.on_track
  return (
    <span className={`flex items-center gap-1.5 text-xs font-semibold ${c.color}`}>
      <span className={`w-2 h-2 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}

const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<string, { label: string; color: string; bg: string; border: string }> = {
    active: { label: 'Activo', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    paused: { label: 'En pausa', color: 'text-white/50', bg: 'bg-white/5', border: 'border-white/10' },
    finished: { label: 'Finalizado', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  }
  const c = config[status] || config.active
  return (
    <span className={`flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${c.color} ${c.bg} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'active' ? 'bg-emerald-400' : status === 'finished' ? 'bg-emerald-400' : 'bg-white/40'}`} />
      {c.label}
    </span>
  )
}

interface ProjectsProps {
  onNavigate: (page: PageType) => void
  gmailConectado: boolean
}

export default function Projects({ onNavigate }: ProjectsProps) {
  const auth = useAuth()
  const token = auth.user?.access_token || ''

  const [proyectos, setProyectos] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingPhones, setEditingPhones] = useState(false)
  const [phoneEdits, setPhoneEdits] = useState<Record<string, string>>({})
  const [savingPhones, setSavingPhones] = useState(false)

  const userId = auth.user?.profile?.sub || ''
  useEffect(() => {
    if (!token || !userId) return
    const fetchProjects = async () => {
      try {
        setLoading(true)
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
        fetch(`${API_URL}/api/scheduled/gmail-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': userId }
        }).catch(() => {})

        const data = await api.getProjects(token)
        if (Array.isArray(data)) {
          setProyectos(data)
        }
      } catch (err) {
        console.warn('[Projects] Error cargando proyectos del API:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchProjects()
  }, [token, userId])

  const stats = useMemo(() => {
    const activos = proyectos.filter(p => p.status === 'active').length
    const totalTareasCompletadas = proyectos.reduce((s, p) => s + p.hechas, 0)
    const totalTareasPendientes = proyectos.reduce((s, p) => s + p.pendientes, 0)
    const totalTareasBloqueadas = proyectos.reduce((s, p) => s + p.bloqueadas, 0)
    const totalMensajes = proyectos.reduce((s, p) => s + p.mensajesIA, 0)
    return { total: proyectos.length, activos, totalTareasCompletadas, totalTareasPendientes, totalTareasBloqueadas, totalMensajes }
  }, [proyectos])

  const filteredProjects = useMemo(() => {
    let result = proyectos
    if (busqueda) result = result.filter(p => p.name.toLowerCase().includes(busqueda.toLowerCase()) || p.client.toLowerCase().includes(busqueda.toLowerCase()))
    switch (filtroEstado) {
      case 'activos': result = result.filter(p => p.status === 'active'); break
      case 'en_riesgo': result = result.filter(p => p.sla === 'en_riesgo'); break
      case 'vencidos': result = result.filter(p => p.sla === 'sla_vencido'); break
      case 'en_pausa': result = result.filter(p => p.status === 'paused'); break
    }
    return result
  }, [proyectos, filtroEstado, busqueda])

  const sidebarFilters = useMemo(() => ({
    activos: proyectos.filter(p => p.status === 'active').length,
    en_pausa: proyectos.filter(p => p.status === 'paused').length,
    finalizados: proyectos.filter(p => p.status === 'finished').length,
    on_track: proyectos.filter(p => p.sla === 'on_track').length,
    en_riesgo: proyectos.filter(p => p.sla === 'en_riesgo').length,
    vencido: proyectos.filter(p => p.sla === 'sla_vencido').length,
  }), [proyectos])

  const progressColor = (sla: string) => {
    if (sla === 'sla_vencido') return 'bg-red-500'
    if (sla === 'en_riesgo') return 'bg-orange-500'
    return 'bg-emerald-500'
  }

  if (selectedProject) {
    const p = selectedProject
    const totalTareas = p.hechas + p.pendientes + p.bloqueadas
    return (
      <div className="flex h-[calc(100vh-56px)]">
        {/* Left sidebar - project list */}
        <aside className="w-60 border-r border-white/5 bg-[#0E0E1A] flex-shrink-0 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">Proyectos Activos</h3>
            {proyectos.filter(pr => pr.status === 'active').map(pr => (
              <button
                key={pr.projectId}
                onClick={() => setSelectedProject(pr)}
                className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 transition-all flex items-center justify-between ${
                  pr.projectId === p.projectId
                    ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                    : 'text-white/60 hover:bg-white/5 hover:text-white/80'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${pr.sla === 'sla_vencido' ? 'bg-red-400' : pr.sla === 'en_riesgo' ? 'bg-orange-400' : 'bg-emerald-400'}`} />
                  <span className="text-sm font-medium truncate">{pr.name}</span>
                </div>
                {pr.sla === 'en_riesgo' && <AlertTriangle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />}
                {pr.sla === 'sla_vencido' && <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold flex-shrink-0">!</span>}
              </button>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* Breadcrumb + header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 text-sm text-white/40 mb-2">
              <button onClick={() => setSelectedProject(null)} className="hover:text-white/70 transition-colors">Proyectos</button>
              <span>/</span>
              <span className="text-white/60">{p.name}</span>
            </div>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">{p.name}</h1>
                <p className="text-white/50 mt-1 text-sm">{p.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={p.status} />
                <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-white/5 border border-white/10 text-white/60">{p.type}</span>
                {p.daysLeft > 0 && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-white/5 border border-white/10 text-white/60">
                    <Clock className="w-3.5 h-3.5" /> {p.daysLeft} días restantes
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: 'COMPLETADAS', value: p.hechas, sub: `de ${totalTareas} tareas totales`, color: 'text-emerald-400' },
              { label: 'PENDIENTES', value: p.pendientes, sub: `${p.tasks.filter(t => t.tags?.includes('Alta prioridad')).length || 0} con fecha límite hoy`, color: 'text-amber-400' },
              { label: 'BLOQUEADAS', value: p.bloqueadas, sub: 'Requieren acción', color: 'text-red-400' },
              { label: 'MENSAJES PROCESADOS IA', value: p.mensajesIA, sub: '100% clasificados · ' + (p.channels.length || 4) + ' canales', color: 'text-violet-400' },
            ].map((stat, i) => (
              <div key={i} className="bg-[#161625] rounded-xl p-4 border border-white/5">
                <p className="text-[11px] font-bold text-white/40 uppercase tracking-wider">{stat.label}</p>
                <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-white/30 mt-1">{stat.sub}</p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="bg-[#161625] rounded-xl p-4 border border-white/5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-white">Progreso global del proyecto</span>
              <span className={`text-sm font-bold ${p.progress >= 70 ? 'text-emerald-400' : p.progress >= 40 ? 'text-blue-400' : 'text-amber-400'}`}>{p.progress}% completado</span>
            </div>
            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-4">
              <div className={`h-full rounded-full transition-all ${progressColor(p.sla)}`} style={{ width: `${p.progress}%` }} />
            </div>
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Completadas', value: p.hechas },
                { label: 'En curso', value: Math.max(1, Math.floor(p.pendientes / 2)) },
                { label: 'Pendientes', value: p.pendientes },
                { label: 'Bloqueadas', value: p.bloqueadas },
              ].map((s, i) => (
                <div key={i}>
                  <p className="text-xs text-white/40">{s.label}</p>
                  <p className="text-xl font-bold text-white">{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Two columns: Tasks + AI Actions */}
          <div className="grid grid-cols-2 gap-6">
            {/* Tasks */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-white">Tareas pendientes</h2>
                <button className="text-xs text-white/40 hover:text-white/60 transition-colors">Ver todas →</button>
              </div>
              <div className="space-y-3">
                {p.tasks.length > 0 ? p.tasks.map(task => (
                  <div key={task.id} className="bg-[#161625] rounded-xl p-4 border border-white/5">
                    <div className="flex items-start gap-3">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          const newStatus = task.status === 'completed' ? 'pending' : 'completed'
                          try {
                            await api.put(`/api/tasks/${task.id}`, { status: newStatus })
                            const res = await api.get('/api/projects')
                            setProjects(res.data)
                          } catch (err) { console.error(err) }
                        }}
                        className={`w-5 h-5 rounded border-2 mt-0.5 flex-shrink-0 transition-all cursor-pointer hover:scale-110 ${
                          task.status === 'completed' ? 'border-emerald-400 bg-emerald-500/30' :
                          task.status === 'blocked' ? 'border-red-400 bg-red-500/10' :
                          task.status === 'in_progress' ? 'border-blue-400 bg-blue-500/10' :
                          'border-white/20 hover:border-emerald-400'
                        }`}
                      >
                        {task.status === 'completed' && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 -mt-0.5 -ml-0.5" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">{task.text}</p>
                        <p className="text-xs text-white/40 mt-1">
                          <span className={`font-bold ${
                            task.status === 'blocked' ? 'text-red-400' :
                            task.status === 'in_progress' ? 'text-blue-400' :
                            task.status === 'waiting' ? 'text-amber-400' :
                            'text-orange-400'
                          }`}>
                            {task.status === 'blocked' ? 'BLOQUEADA:' :
                             task.status === 'in_progress' ? 'EN CURSO:' :
                             task.status === 'waiting' ? 'EN ESPERA:' : 'PENDIENTE:'}
                          </span>{' '}
                          {task.description}
                        </p>
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-2">
                            {task.tags.map((tag, i) => (
                              <span key={i} className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                                tag === 'Bloqueada' ? 'bg-red-500/20 text-red-400' :
                                tag === 'Alta prioridad' ? 'bg-red-500/20 text-red-400' :
                                tag === 'En curso' ? 'bg-blue-500/20 text-blue-400' :
                                tag === 'En espera' ? 'bg-amber-500/20 text-amber-400' :
                                tag === 'Partner' ? 'bg-purple-500/20 text-purple-400' :
                                'bg-orange-500/20 text-orange-400'
                              }`}>{tag}</span>
                            ))}
                          </div>
                          <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${task.assignedTo.color} flex items-center justify-center text-[10px] text-white font-bold`}>
                            {task.assignedTo.iniciales}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="bg-[#161625] rounded-xl p-8 border border-white/5 text-center">
                    <p className="text-white/30 text-sm">No hay tareas definidas para este proyecto</p>
                  </div>
                )}
              </div>
            </div>

            {/* AI Actions */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-white">Acciones ejecutadas por la IA</h2>
                <button className="text-xs text-white/40 hover:text-white/60 transition-colors">Ver historial →</button>
              </div>
              <div className="space-y-3">
                {p.aiActions.length > 0 ? p.aiActions.map(action => (
                  <div key={action.id} className="bg-[#161625] rounded-xl p-4 border border-white/5">
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0">DETECTÓ</span>
                        <p className="text-sm text-white/80">{action.detected}</p>
                      </div>
                      <div className="pl-4 border-l-2 border-white/10 ml-1">
                        <div className="flex items-start gap-2">
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0">EJECUTÓ</span>
                          <p className="text-sm text-white/60">{action.executed}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1.5 px-2 py-0.5 bg-white/5 rounded text-[10px] text-white/50">
                            <ChannelIcon type={action.channelIcon} className="w-3 h-3" />
                            {action.channel}
                          </span>
                        </div>
                        <span className="text-[11px] text-white/30">{action.time}</span>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="bg-[#161625] rounded-xl p-8 border border-white/5 text-center">
                    <Sparkles className="w-8 h-8 text-white/10 mx-auto mb-2" />
                    <p className="text-white/30 text-sm">Sin acciones IA registradas aún</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notifications sent */}
          {(p as any).notifications && (p as any).notifications.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-violet-400" />
                  <h2 className="text-base font-bold text-white">Notificaciones enviadas</h2>
                  <span className="text-xs text-white/30 ml-1">WhatsApp · SMS</span>
                </div>
                <span className="text-xs text-white/40">{(p as any).notifications.length} enviadas</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(p as any).notifications.map((notif: any) => (
                  <div key={notif.id} className="bg-[#161625] rounded-xl p-4 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <ChannelIcon type={notif.canal} className="w-4 h-4" />
                        <span className={`text-xs font-bold uppercase ${notif.canal === 'whatsapp' ? 'text-green-400' : 'text-sky-400'}`}>
                          {notif.canal}
                        </span>
                        <span className="text-[10px] text-white/30">→ {notif.destinatario}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        notif.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {notif.status === 'delivered' ? 'Entregado' : 'Enviado'}
                      </span>
                    </div>
                    <p className="text-sm text-white/60 line-clamp-2">{notif.mensaje}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="flex items-center gap-1 text-[10px] text-white/30">
                        <Send className="w-3 h-3" /> Enviado por IA
                      </span>
                      <span className="text-[10px] text-white/30">{notif.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* Right sidebar */}
        <aside className="w-72 border-l border-white/5 bg-[#0E0E1A] flex-shrink-0 overflow-y-auto p-4 space-y-6">
          {/* Team */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider">Equipo del Proyecto</h3>
              {!editingPhones ? (
                <button
                  onClick={() => {
                    const phones: Record<string, string> = {}
                    p.team.forEach(m => { phones[m.nombre] = m.telefono || '' })
                    setPhoneEdits(phones)
                    setEditingPhones(true)
                  }}
                  className="flex items-center gap-1 text-[10px] text-green-400 hover:text-green-300 transition-colors"
                >
                  <Phone className="w-3 h-3" />
                  WhatsApp
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={async () => {
                      setSavingPhones(true)
                      try {
                        const updatedParticipants = p.team.map(m => ({
                          nombre: m.nombre,
                          rol: m.rol,
                          email: m.email || '',
                          telefono: phoneEdits[m.nombre] || '',
                        }))
                        await api.updateParticipants(p.projectId, updatedParticipants, token)
                        const updated = { ...p, team: p.team.map(m => ({ ...m, telefono: phoneEdits[m.nombre] || '' })) }
                        setSelectedProject(updated)
                        setProyectos(prev => prev.map(pr => pr.projectId === p.projectId ? updated : pr))
                      } catch (err) {
                        console.error('Error saving phones:', err)
                      }
                      setSavingPhones(false)
                      setEditingPhones(false)
                    }}
                    disabled={savingPhones}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium"
                  >
                    {savingPhones ? '...' : 'Guardar'}
                  </button>
                  <button
                    onClick={() => setEditingPhones(false)}
                    className="text-[10px] text-white/30 hover:text-white/50"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {p.team.map((member, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${member.color} flex items-center justify-center text-[10px] text-white font-bold`}>
                        {member.iniciales}
                      </div>
                      <div>
                        <p className="text-sm text-white font-medium">{member.nombre}</p>
                        <p className="text-[11px] text-white/40">{member.rol}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {member.telefono && !editingPhones && (
                        <Phone className="w-3 h-3 text-green-400" />
                      )}
                      <span className="text-xs text-white/40">{member.tareas} tarea{member.tareas !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  {editingPhones && (
                    <div className="ml-10 mt-1">
                      <input
                        value={phoneEdits[member.nombre] || ''}
                        onChange={e => setPhoneEdits({ ...phoneEdits, [member.nombre]: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-[#161625] border border-white/10 rounded-lg text-xs text-white/70 placeholder-white/20 focus:border-green-500/40 outline-none transition-all"
                        placeholder="+504 9999-9999"
                      />
                    </div>
                  )}
                </div>
              ))}
              {p.team.length === 0 && <p className="text-xs text-white/30">Sin equipo asignado</p>}
            </div>
          </div>

          {/* Channels */}
          <div>
            <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">Canales Activos</h3>
            <div className="space-y-2">
              {p.channels.map((ch, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <ChannelIcon type={ch.icon} className="w-4 h-4" />
                    <div>
                      <p className="text-sm text-white/80">{ch.nombre}</p>
                      {ch.lastActivity && <p className="text-[10px] text-white/30">{ch.lastActivity}</p>}
                    </div>
                  </div>
                  {ch.unread > 0 && (
                    <span className="bg-violet-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">{ch.unread}</span>
                  )}
                </div>
              ))}
              {p.channels.length === 0 && <p className="text-xs text-white/30">Sin canales configurados</p>}
            </div>
          </div>

          {/* Tags */}
          {p.etiquetas.length > 0 && (
            <div>
              <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">Etiquetas Activas (IA)</h3>
              <div className="flex flex-wrap gap-2">
                {p.etiquetas.map((tag, i) => (
                  <span key={i} className="flex items-center gap-1.5 text-xs text-white/60">
                    <span className={`w-2 h-2 rounded-full ${tag.color}`} />
                    {tag.nombre}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* SLA */}
          <div>
            <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">SLA del Proyecto</h3>
            <div className="space-y-2">
              {[
                { label: 'Respuesta media al cliente', value: p.slaMetrics.respuestaCliente, alert: false },
                { label: 'Tareas sin responsable', value: String(p.slaMetrics.tareasResponsable), alert: p.slaMetrics.tareasResponsable > 0 },
                { label: 'Respuesta pendiente partner', value: p.slaMetrics.respuestaPartner, alert: p.slaMetrics.respuestaPartner === '72h' },
                { label: 'Tareas bloqueadas +24h', value: String(p.slaMetrics.tareasBlockeadas24h), alert: p.slaMetrics.tareasBlockeadas24h > 0 },
              ].map((metric, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-xs text-white/50">{metric.label}</span>
                  <span className={`text-xs font-bold flex items-center gap-1 ${metric.alert ? 'text-red-400' : 'text-white/60'}`}>
                    {metric.value}
                    {metric.alert && <AlertTriangle className="w-3 h-3" />}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* Left sidebar - filters */}
      <aside className="w-56 border-r border-white/5 bg-[#0E0E1A] flex-shrink-0 overflow-y-auto">
        <div className="p-4 space-y-6">
          {/* Estado */}
          <div>
            <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">Estado</h3>
            {[
              { id: 'activos', label: 'Activos', count: sidebarFilters.activos, color: 'bg-emerald-400' },
              { id: 'en_pausa', label: 'En pausa', count: sidebarFilters.en_pausa, color: 'bg-white/30' },
              { id: 'finalizados', label: 'Finalizados', count: sidebarFilters.finalizados, color: 'bg-emerald-400' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFiltroEstado(filtroEstado === f.id ? 'todos' : f.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                  filtroEstado === f.id ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/70 hover:bg-white/5'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${f.color}`} />
                  {f.label}
                </span>
                <span className="text-xs text-white/30">{f.count}</span>
              </button>
            ))}
          </div>

          {/* SLA */}
          <div>
            <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">SLA</h3>
            {[
              { id: 'on_track', label: 'On track', count: sidebarFilters.on_track, color: 'bg-emerald-400' },
              { id: 'en_riesgo', label: 'En riesgo', count: sidebarFilters.en_riesgo, color: 'bg-orange-400' },
              { id: 'vencidos', label: 'Vencido', count: sidebarFilters.vencido, color: 'bg-red-400' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFiltroEstado(filtroEstado === f.id ? 'todos' : f.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                  filtroEstado === f.id ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/70 hover:bg-white/5'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${f.color}`} />
                  {f.label}
                </span>
                <span className="text-xs text-white/30">{f.count}</span>
              </button>
            ))}
          </div>

          {/* Canales activos del usuario */}
          <div>
            <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">Canales activos</h3>
            <div className="flex items-center gap-2.5 px-3 py-2 text-emerald-400 text-sm">
              <ChannelIcon type="email" className="w-4 h-4" />
              Gmail conectado
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Tus proyectos</h1>
            <p className="text-sm text-white/40 mt-1">
              {stats.total} proyectos · {stats.totalTareasBloqueadas} tareas bloqueadas · Datos en tiempo real
            </p>
          </div>
          <div className="flex items-center gap-2">
            {['Todos', 'Activos', 'En riesgo', 'Vencidos', 'En pausa'].map(pill => {
              const pillId = pill === 'Todos' ? 'todos' : pill === 'Activos' ? 'activos' : pill === 'En riesgo' ? 'en_riesgo' : pill === 'Vencidos' ? 'vencidos' : 'en_pausa'
              const isActive = filtroEstado === pillId
              return (
                <button
                  key={pill}
                  onClick={() => setFiltroEstado(pillId)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    isActive
                      ? 'bg-white/10 text-white border-white/20'
                      : 'text-white/40 border-white/5 hover:border-white/10 hover:text-white/60'
                  }`}
                >
                  {pill !== 'Todos' && (
                    <span className={`w-2 h-2 rounded-full ${
                      pill === 'Activos' ? 'bg-emerald-400' :
                      pill === 'En riesgo' ? 'bg-orange-400' :
                      pill === 'Vencidos' ? 'bg-red-400' : 'bg-white/30'
                    }`} />
                  )}
                  {pill}
                </button>
              )
            })}
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          {[
            { icon: FolderKanban, value: stats.total, label: 'Proyectos totales', color: 'text-white/60' },
            { icon: CheckCircle2, value: stats.totalTareasCompletadas, label: 'Tareas completadas', color: 'text-emerald-400' },
            { icon: AlertCircle, value: stats.totalTareasPendientes, label: 'Tareas pendientes', color: 'text-amber-400' },
            { icon: Shield, value: stats.totalTareasBloqueadas, label: 'Tareas bloqueadas', color: 'text-red-400' },
            { icon: Zap, value: stats.totalMensajes, label: 'Mensajes procesados hoy', color: 'text-violet-400' },
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

        {/* Project grid */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-white/40">Cargando proyectos desde DynamoDB...</p>
            </div>
          </div>
        )}
        {!loading && filteredProjects.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <FolderKanban className="w-12 h-12 text-white/10" />
              <p className="text-sm text-white/40">No se encontraron proyectos</p>
              <p className="text-xs text-white/20">Verifica que el backend est&#233; corriendo en localhost:8000</p>
            </div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-4">
          {filteredProjects.map((proyecto, index) => (
            <motion.div
              key={proyecto.projectId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              onClick={() => setSelectedProject(proyecto)}
              className="bg-[#161625] rounded-xl border border-white/5 p-5 hover:border-white/15 hover:bg-[#1a1a2e] transition-all cursor-pointer group"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FolderKanban className="w-4 h-4 text-white/40" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white truncate group-hover:text-violet-300 transition-colors">{proyecto.name}</h3>
                    <p className="text-xs text-white/30">{proyecto.client}</p>
                  </div>
                </div>
                <StatusBadge status={proyecto.status} />
              </div>

              {/* SLA + delivery */}
              <div className="flex items-center justify-between mt-3">
                <SLABadge sla={proyecto.sla} />
                {proyecto.deliveryDate && (
                  <span className="text-[11px] text-white/30">
                    Entrega: {proyecto.deliveryDate} · {proyecto.daysLeft} días
                  </span>
                )}
                {proyecto.status === 'paused' && (
                  <span className="text-[11px] text-white/30">Pausado desde: 20 nov</span>
                )}
                {proyecto.status === 'finished' && (
                  <span className="text-[11px] text-white/30">Cerrado: {proyecto.deliveryDate}</span>
                )}
              </div>

              {/* Progress */}
              <div className="flex items-center gap-3 mt-3">
                <span className="text-[11px] text-white/30">Avance</span>
                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${progressColor(proyecto.sla)}`} style={{ width: `${proyecto.progress}%` }} />
                </div>
                <span className={`text-xs font-bold ${proyecto.progress >= 70 ? 'text-emerald-400' : proyecto.progress >= 40 ? 'text-white/50' : 'text-amber-400'}`}>
                  {proyecto.progress}%
                </span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-2 mt-4">
                {[
                  { value: proyecto.hechas, label: 'Hechas', color: 'text-emerald-400' },
                  { value: proyecto.pendientes, label: 'Pendientes', color: 'text-amber-400' },
                  { value: proyecto.bloqueadas, label: 'Bloqueadas', color: 'text-red-400' },
                  { value: proyecto.mensajesIA, label: 'Mensajes IA', color: 'text-violet-400' },
                ].map((s, i) => (
                  <div key={i} className="bg-white/5 rounded-lg py-2 text-center">
                    <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] text-white/30">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Last AI action */}
              <div className="mt-4 pt-3 border-t border-white/5">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-white/30 uppercase mb-0.5">Última acción IA</p>
                    <p className="text-xs text-white/50 line-clamp-2">
                      <span className="text-amber-400">Detectó</span> {proyecto.lastAction.detected} · <span className="text-emerald-400">
                        {proyecto.lastAction.action.split(' ')[0]}
                      </span> {proyecto.lastAction.action.split(' ').slice(1).join(' ')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                <div className="flex -space-x-2">
                  {proyecto.team.slice(0, 4).map((m, i) => (
                    <div key={i} className={`w-6 h-6 rounded-full bg-gradient-to-br ${m.color} flex items-center justify-center text-[9px] text-white font-bold border-2 border-[#161625]`}>
                      {m.iniciales}
                    </div>
                  ))}
                  {proyecto.team.length > 4 && (
                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[9px] text-white/60 font-bold border-2 border-[#161625]">
                      +{proyecto.team.length - 4}
                    </div>
                  )}
                </div>
                <span className="text-[11px] text-white/30">Inicio: {proyecto.startDate}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  )
}
