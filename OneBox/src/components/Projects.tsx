import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from 'react-oidc-context'
import { api } from '../services/api'
import {
  Search, ArrowLeft, CheckCircle2, AlertTriangle, Clock, Settings,
  MessageCircle, Mail, Users, Hash, ChevronRight, Sparkles, X,
  FolderKanban, Zap, Eye, Shield, TrendingUp, AlertCircle,
  Phone, Send, Bell, Trash2, Loader2, UserPlus, Ban, Unlock, Plus, Pencil, Calendar
} from 'lucide-react'
import { PageType } from '../App'
import ChannelsPanel from './ChannelsPanel'
import ProjectInsightsSidebar from './ProjectInsightsSidebar'
import ProjectAttachments from './ProjectAttachments'

interface ProjectTeamMember {
  nombre: string; iniciales: string; rol: string; email: string; telefono: string; color: string; tareas: number;
}
interface ProjectChannel {
  nombre: string; icon: string; lastActivity: string; unread: number;
}
interface ProjectTask {
  id: string; text: string; status: string; description: string;
  assignedTo: { nombre: string; iniciales: string; color: string };
  overdue?: boolean;
  blockedReason?: string;
  startDate?: string;
  dueDate?: string;
  tags?: string[];
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
  deliveryDate: string; daysLeft: number; progress: number; progressBlockedReason?: string; timing?: string;
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
  /** Cuando se incrementa, el componente vuelve al listado (sale de un proyecto si está dentro). */
  resetSignal?: number
}

export default function Projects({ onNavigate, gmailConectado, resetSignal }: ProjectsProps) {
  const auth = useAuth()
  const token = auth.user?.access_token || ''

  const [proyectos, setProyectos] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  // Filtro global: muestra todas las tareas de todos los proyectos en un estado específico
  const [globalTaskFilter, setGlobalTaskFilter] = useState<'completed' | 'pending' | 'blocked' | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingPhones, setEditingPhones] = useState(false)
  const [phoneEdits, setPhoneEdits] = useState<Record<string, string>>({})
  const [savingPhones, setSavingPhones] = useState(false)
  const [taskFilter, setTaskFilter] = useState<'all' | 'completed' | 'pending' | 'blocked'>('all')
  const [showAllTasks, setShowAllTasks] = useState(false)
  const [projectSearch, setProjectSearch] = useState('')
  const [showAllActions, setShowAllActions] = useState(false)
  const [deletingProject, setDeletingProject] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null)
  // Alta de participante (fix #11)
  const [addingMember, setAddingMember] = useState(false)
  const [newMember, setNewMember] = useState({ nombre: '', email: '', telefono: '', rol: '' })
  const [savingMember, setSavingMember] = useState(false)
  // Bloqueo manual de tareas (con motivo)
  const [blockingTaskId, setBlockingTaskId] = useState<string | null>(null)
  const [blockReason, setBlockReason] = useState('')
  const [savingBlock, setSavingBlock] = useState(false)
  // CRUD de tareas (crear/editar/borrar)
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)  // null = crear, string = editar
  const [taskForm, setTaskForm] = useState({ text: '', description: '', status: 'pending', assignedTo: '', startDate: '', dueDate: '' })
  const [savingTask, setSavingTask] = useState(false)
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<ProjectTask | null>(null)
  const [deletingTask, setDeletingTask] = useState(false)
  // Invitar usuarios al proyecto
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [sendingInvite, setSendingInvite] = useState(false)
  const [inviteResultMsg, setInviteResultMsg] = useState('')
  const [inviteError, setInviteError] = useState('')

  const userId = auth.user?.profile?.sub || ''

  // Resetear la vista cuando el navbar manda señal (usuario hace click en "Proyectos" desde dentro de uno)
  useEffect(() => {
    if (resetSignal !== undefined && resetSignal > 0) {
      setSelectedProject(null)
      setTaskFilter('all')
      setShowAllTasks(false)
      setShowAllActions(false)
      setBusqueda('')
      setFiltroEstado('todos')
      setProjectSearch('')
      setGlobalTaskFilter(null)
    }
  }, [resetSignal])

  useEffect(() => {
    if (!token || !userId) return
    const fetchProjects = async () => {
      try {
        setLoading(true)
        // Cargamos los proyectos primero para mostrar la UI rápido
        const data = await api.getProjects(token)
        if (Array.isArray(data)) {
          setProyectos(data)
        }
        // Luego, en background, sincronizamos Gmail (no bloquea la UI)
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
        fetch(`${API_URL}/api/scheduled/gmail-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': userId }
        }).catch(() => {})
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

  const progressColor = (sla: string) => {
    if (sla === 'sla_vencido') return 'bg-red-500'
    if (sla === 'en_riesgo') return 'bg-orange-500'
    return 'bg-emerald-500'
  }

  // Handler de borrado de proyecto
  const handleDeleteProject = async (projectId: string) => {
    if (!token) return
    try {
      setDeletingProject(projectId)
      await api.deleteProject(projectId, token)
      // Refrescar lista
      const data = await api.getProjects(token)
      if (Array.isArray(data)) setProyectos(data)
      // Volver a la lista
      setSelectedProject(null)
      setConfirmDelete(null)
    } catch (err) {
      console.error('[Projects] Error eliminando proyecto:', err)
      alert('No se pudo eliminar el proyecto. Intenta de nuevo.')
    } finally {
      setDeletingProject(null)
    }
  }

  if (selectedProject) {
    const p = selectedProject
    const totalTareas = p.hechas + p.pendientes + p.bloqueadas
    const projectChannels = (p.channels || []).map(c => typeof c === 'string' ? c : (c as any).nombre).filter(Boolean)

    // Búsqueda dentro del proyecto: filtra tareas + acciones IA por término
    const searchTerm = projectSearch.trim().toLowerCase()
    const isSearching = searchTerm.length > 0
    const isDone = (s: string) => s === 'done' || s === 'completed'
    const taskMatches = (t: typeof p.tasks[number]) => {
      if (!isSearching) return true
      const haystack = `${t.text || ''} ${t.description || ''} ${(t.tags || []).join(' ')}`.toLowerCase()
      return haystack.includes(searchTerm)
    }
    const matchingTasks = p.tasks.filter(taskMatches)
    const matchingDone = matchingTasks.filter(t => isDone(t.status)).length
    const matchingPending = matchingTasks.filter(t => !isDone(t.status) && t.status !== 'blocked').length
    const matchingBlocked = matchingTasks.filter(t => t.status === 'blocked').length

    const actionMatches = (a: any) => {
      if (!isSearching) return true
      const haystack = `${a.detected || ''} ${a.action || ''}`.toLowerCase()
      return haystack.includes(searchTerm)
    }
    const matchingActions = p.aiActions.filter(actionMatches)
    return (
      <div className="flex h-[calc(100vh-56px)]">
        {/* Modal confirmación de borrado */}
        {confirmDelete && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !deletingProject && setConfirmDelete(null)}
          >
            <div
              className="bg-[#12121E] border border-white/10 rounded-2xl p-6 max-w-md w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Eliminar proyecto</h3>
                  <p className="text-sm text-white/60 mt-1">
                    ¿Seguro que quieres eliminar <strong className="text-white">{confirmDelete.name}</strong>? Esta acción borrará también sus insights, tareas y notificaciones. <strong className="text-red-400">No se puede deshacer.</strong>
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 mt-6">
                <button
                  onClick={() => setConfirmDelete(null)}
                  disabled={!!deletingProject}
                  className="px-4 py-2 text-sm text-white/70 hover:text-white rounded-lg hover:bg-white/5 transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDeleteProject(confirmDelete.projectId)}
                  disabled={!!deletingProject}
                  className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {deletingProject ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Sí, eliminar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Nueva/Editar tarea */}
        {taskModalOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !savingTask && setTaskModalOpen(false)}
          >
            <div className="bg-[#12121E] border border-white/10 rounded-2xl p-6 max-w-lg w-full" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-white mb-4">{editingTaskId ? 'Editar tarea' : 'Nueva tarea'}</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-white/60">Título *</label>
                  <input type="text" value={taskForm.text} onChange={e => setTaskForm({ ...taskForm, text: e.target.value })}
                    placeholder="¿Qué hay que hacer?" autoFocus
                    className="w-full mt-1 px-3 py-2 bg-[#0E0E18] border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500" />
                </div>
                <div>
                  <label className="text-xs text-white/60">Descripción</label>
                  <textarea value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })}
                    rows={2} placeholder="Detalles, contexto..."
                    className="w-full mt-1 px-3 py-2 bg-[#0E0E18] border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/60">Estado</label>
                    <select value={taskForm.status} onChange={e => setTaskForm({ ...taskForm, status: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-[#0E0E18] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500">
                      <option value="pending">Pendiente</option>
                      <option value="in_progress">En curso</option>
                      <option value="blocked">Bloqueada</option>
                      <option value="done">Completada</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-white/60">Asignar a</label>
                    <select value={taskForm.assignedTo} onChange={e => setTaskForm({ ...taskForm, assignedTo: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-[#0E0E18] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500">
                      <option value="">Sin asignar</option>
                      {(selectedProject?.team || []).map((m, i) => (
                        <option key={i} value={m.nombre}>{m.nombre}{m.rol ? ` (${m.rol})` : ''}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/60 flex items-center gap-1"><Calendar className="w-3 h-3" /> Fecha inicio</label>
                    <input type="date" value={taskForm.startDate} onChange={e => setTaskForm({ ...taskForm, startDate: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-[#0E0E18] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500" />
                  </div>
                  <div>
                    <label className="text-xs text-white/60 flex items-center gap-1"><Calendar className="w-3 h-3" /> Fecha fin</label>
                    <input type="date" value={taskForm.dueDate} onChange={e => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-[#0E0E18] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500" />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setTaskModalOpen(false)} disabled={savingTask}
                  className="px-4 py-2 text-sm text-white/70 hover:text-white rounded-lg hover:bg-white/5 disabled:opacity-50">Cancelar</button>
                <button
                  disabled={savingTask || !taskForm.text.trim()}
                  onClick={async () => {
                    setSavingTask(true)
                    try {
                      const payload: any = {
                        text: taskForm.text.trim(),
                        description: taskForm.description,
                        status: taskForm.status,
                        assigned_to: taskForm.assignedTo,
                        start_date: taskForm.startDate || null,
                        due_date: taskForm.dueDate || null,
                      }
                      if (editingTaskId) {
                        await api.updateTask(editingTaskId, { ...payload, projectId: p.projectId }, token)
                      } else {
                        await api.createTask(p.projectId, payload, token)
                      }
                      const data = await api.getProjects(token)
                      if (Array.isArray(data)) {
                        setProyectos(data)
                        const updated = data.find((proj: Project) => proj.projectId === p.projectId)
                        if (updated) setSelectedProject(updated)
                      }
                      setTaskModalOpen(false)
                    } catch (err) { console.error('Error guardando tarea:', err) }
                    finally { setSavingTask(false) }
                  }}
                  className="px-4 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {savingTask && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingTaskId ? 'Guardar cambios' : 'Crear tarea'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmar borrado de tarea */}
        {confirmDeleteTask && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !deletingTask && setConfirmDeleteTask(null)}>
            <div className="bg-[#12121E] border border-white/10 rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Borrar tarea</h3>
                  <p className="text-sm text-white/60 mt-1">
                    ¿Seguro que quieres borrar <strong className="text-white">"{confirmDeleteTask.text}"</strong>? <strong className="text-red-400">No se puede deshacer.</strong>
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setConfirmDeleteTask(null)} disabled={deletingTask}
                  className="px-4 py-2 text-sm text-white/70 hover:text-white rounded-lg hover:bg-white/5 disabled:opacity-50">Cancelar</button>
                <button
                  disabled={deletingTask}
                  onClick={async () => {
                    if (!confirmDeleteTask) return
                    setDeletingTask(true)
                    try {
                      await api.deleteTask(confirmDeleteTask.id, token)
                      const data = await api.getProjects(token)
                      if (Array.isArray(data)) {
                        setProyectos(data)
                        const updated = data.find((proj: Project) => proj.projectId === p.projectId)
                        if (updated) setSelectedProject(updated)
                      }
                      setConfirmDeleteTask(null)
                    } catch (err) { console.error('Error borrando tarea:', err) }
                    finally { setDeletingTask(false) }
                  }}
                  className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {deletingTask ? (<><Loader2 className="w-4 h-4 animate-spin" /> Borrando...</>) : (<><Trash2 className="w-4 h-4" /> Sí, borrar</>)}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Invitar usuario al proyecto */}
        {inviteModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !sendingInvite && setInviteModalOpen(false)}>
            <div className="bg-[#12121E] border border-white/10 rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <Send className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Invitar usuario al proyecto</h3>
                  <p className="text-sm text-white/60 mt-1">
                    Le llegará un correo con una contraseña temporal. Al primer login se unirá automáticamente a <strong className="text-white">{p.name}</strong>.
                  </p>
                </div>
              </div>
              <div>
                <label className="text-xs text-white/60">Correo del invitado</label>
                <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  placeholder="alguien@ejemplo.com" autoFocus disabled={sendingInvite}
                  className="w-full mt-1 px-3 py-2 bg-[#0E0E18] border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-500 disabled:opacity-50" />
              </div>
              {inviteError && (
                <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-sm text-red-400">{inviteError}</p>
                </div>
              )}
              {inviteResultMsg && (
                <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <p className="text-sm text-emerald-400">{inviteResultMsg}</p>
                </div>
              )}
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setInviteModalOpen(false)} disabled={sendingInvite}
                  className="px-4 py-2 text-sm text-white/70 hover:text-white rounded-lg hover:bg-white/5 disabled:opacity-50">
                  {inviteResultMsg ? 'Cerrar' : 'Cancelar'}
                </button>
                {!inviteResultMsg && (
                  <button
                    disabled={sendingInvite || !inviteEmail.trim() || !inviteEmail.includes('@')}
                    onClick={async () => {
                      setSendingInvite(true); setInviteError(''); setInviteResultMsg('')
                      try {
                        const res = await api.inviteUserToProject(p.projectId, inviteEmail.trim().toLowerCase(), token)
                        setInviteResultMsg(res?.message || 'Invitación enviada con éxito.')
                        setInviteEmail('')
                      } catch (err: any) {
                        setInviteError(err?.message?.substring(0, 200) || 'Error enviando la invitación')
                      } finally { setSendingInvite(false) }
                    }}
                    className="px-4 py-2 text-sm font-medium bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
                  >
                    {sendingInvite ? (<><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>) : (<><Send className="w-4 h-4" /> Enviar invitación</>)}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Left sidebar - insights de la IA + canales del proyecto */}
        <ProjectInsightsSidebar
          projectId={p.projectId}
          projectName={p.name}
          channels={projectChannels}
          onBack={() => setSelectedProject(null)}
          searchQuery={projectSearch}
        />

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
                <button
                  onClick={() => setConfirmDelete(p)}
                  disabled={deletingProject === p.projectId}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:border-red-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Eliminar proyecto"
                >
                  {deletingProject === p.projectId ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  Eliminar
                </button>
              </div>
            </div>
          </div>

          {/* Buscador dentro del proyecto */}
          <div className="mb-5">
            <div className="relative">
              <Search className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={projectSearch}
                onChange={e => setProjectSearch(e.target.value)}
                placeholder="Buscar en este proyecto: tareas, riesgos, decisiones, insights..."
                className="w-full pl-10 pr-10 py-2.5 bg-[#161625] border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
              />
              {isSearching && (
                <button
                  onClick={() => setProjectSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white/80 transition-colors"
                  title="Limpiar búsqueda"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {isSearching && (
              <div className="mt-2 flex items-center gap-3 text-xs text-white/50 flex-wrap">
                <span>
                  Buscando: <strong className="text-violet-300">"{projectSearch}"</strong>
                </span>
                <span>·</span>
                <span>
                  <strong className="text-emerald-400">{matchingDone}</strong> completadas
                </span>
                <span>·</span>
                <span>
                  <strong className="text-amber-400">{matchingPending}</strong> pendientes
                </span>
                <span>·</span>
                <span>
                  <strong className="text-red-400">{matchingBlocked}</strong> bloqueadas
                </span>
                <span>·</span>
                <span>
                  <strong className="text-violet-400">{matchingActions.length}</strong> acciones IA
                </span>
              </div>
            )}
          </div>

          {/* Stats row clickeables (filtro de tareas) */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { id: 'all', label: 'COMPLETADAS', value: isSearching ? matchingDone : p.hechas, sub: isSearching ? `de ${matchingTasks.length} coincidencias` : `de ${totalTareas} tareas totales`, color: 'text-emerald-400', filterValue: 'completed' },
              { id: 'pending', label: 'PENDIENTES', value: isSearching ? matchingPending : p.pendientes, sub: isSearching ? 'que coinciden con la búsqueda' : `${p.tasks.filter(t => t.tags?.includes('Alta prioridad')).length || 0} con fecha límite hoy`, color: 'text-amber-400', filterValue: 'pending' },
              { id: 'blocked', label: 'BLOQUEADAS', value: isSearching ? matchingBlocked : p.bloqueadas, sub: isSearching ? 'que coinciden con la búsqueda' : 'Requieren acción', color: 'text-red-400', filterValue: 'blocked' },
              { id: 'mensajes', label: 'MENSAJES PROCESADOS IA', value: isSearching ? matchingActions.length : p.mensajesIA, sub: isSearching ? 'acciones IA que coinciden' : '100% clasificados · ' + (p.channels.length || 4) + ' canales', color: 'text-violet-400', filterValue: null },
            ].map((stat, i) => {
              const isClickable = stat.filterValue !== null
              const isActive = stat.filterValue && taskFilter === stat.filterValue
              return (
                <button
                  key={i}
                  onClick={() => {
                    if (!isClickable) return
                    const newFilter = taskFilter === stat.filterValue ? 'all' : stat.filterValue as any
                    setTaskFilter(newFilter)
                  }}
                  disabled={!isClickable}
                  className={`text-left bg-[#161625] rounded-xl p-4 border transition-all ${
                    isActive
                      ? 'border-white/30 ring-2 ring-white/10 bg-[#1a1a2e]'
                      : isClickable
                        ? 'border-white/5 hover:border-white/15 hover:bg-[#1a1a2e] cursor-pointer'
                        : 'border-white/5 cursor-default'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-white/40 uppercase tracking-wider">{stat.label}</p>
                    {isActive && <span className="text-[10px] font-bold text-white/60">FILTRADO</span>}
                  </div>
                  <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-white/30 mt-1">{stat.sub}</p>
                  {isClickable && !isActive && (
                    <p className="text-[10px] text-white/30 mt-1.5 italic">Click para filtrar</p>
                  )}
                </button>
              )
            })}
          </div>

          {taskFilter !== 'all' && (
            <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-violet-500/10 border border-violet-500/20 rounded-lg">
              <span className="text-xs text-violet-300">
                Filtrando tareas: <strong className="font-semibold capitalize">{taskFilter === 'completed' ? 'Completadas' : taskFilter === 'pending' ? 'Pendientes' : 'Bloqueadas'}</strong>
              </span>
              <button
                onClick={() => setTaskFilter('all')}
                className="ml-auto text-xs text-violet-300 hover:text-white flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Quitar filtro
              </button>
            </div>
          )}

          {/* Progress bar */}
          <div className="bg-[#161625] rounded-xl p-4 border border-white/5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-white flex items-center gap-2">
                Progreso global del proyecto
                {p.timing && (
                  <span className="text-[10px] font-medium text-white/40 bg-white/5 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {p.timing}
                  </span>
                )}
              </span>
              <span className={`text-sm font-bold ${
                p.progressBlockedReason ? 'text-red-400' :
                p.progress >= 70 ? 'text-emerald-400' :
                p.progress >= 40 ? 'text-blue-400' :
                'text-amber-400'
              }`}>{p.progress}% completado</span>
            </div>
            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-3">
              <div className={`h-full rounded-full transition-all ${
                p.progressBlockedReason ? 'bg-red-500' : progressColor(p.sla)
              }`} style={{ width: `${p.progress}%` }} />
            </div>
            {p.progressBlockedReason && (
              <div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-300">
                  <strong>Avance bloqueado:</strong> {p.progressBlockedReason}
                </p>
              </div>
            )}
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
                <h2 className="text-base font-bold text-white">
                  Tareas {taskFilter === 'completed' ? 'completadas' : taskFilter === 'blocked' ? 'bloqueadas' : taskFilter === 'pending' ? 'pendientes' : ''}
                </h2>
                <div className="flex items-center gap-3">
                  {p.tasks.length > 3 && (
                    <button
                      onClick={() => setShowAllTasks(!showAllTasks)}
                      className="text-xs text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1"
                    >
                      {showAllTasks ? 'Ver menos' : `Ver todas (${p.tasks.length})`} →
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditingTaskId(null)
                      setTaskForm({ text: '', description: '', status: 'pending', assignedTo: '', startDate: '', dueDate: '' })
                      setTaskModalOpen(true)
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 border border-violet-500/30 rounded-md transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Nueva tarea
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {(() => {
                  // Combinar filtro de estado + búsqueda de texto
                  const baseTasks = isSearching ? matchingTasks : p.tasks
                  const filteredTasks = taskFilter === 'all'
                    ? baseTasks
                    : baseTasks.filter(t => {
                        if (taskFilter === 'completed') return isDone(t.status)
                        if (taskFilter === 'blocked') return t.status === 'blocked'
                        if (taskFilter === 'pending') return !isDone(t.status) && t.status !== 'blocked'
                        return true
                      })
                  const visibleTasks = showAllTasks ? filteredTasks : filteredTasks.slice(0, 3)
                  return visibleTasks.length > 0 ? visibleTasks.map(task => (
                  <div key={task.id} className="bg-[#161625] rounded-xl p-4 border border-white/5">
                    <div className="flex items-start gap-3">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          // Ciclo: pending → in_progress → done → pending
                          const newStatus =
                            isDone(task.status) ? 'pending' :
                            task.status === 'in_progress' ? 'done' :
                            task.status === 'pending' ? 'in_progress' :
                            'pending'
                          try {
                            await api.updateTask(task.id, { status: newStatus, projectId: p.projectId }, token)
                            // Actualizar el proyecto seleccionado en memoria
                            const data = await api.getProjects(token)
                            if (Array.isArray(data)) {
                              setProyectos(data)
                              const updated = data.find((proj: Project) => proj.projectId === p.projectId)
                              if (updated) setSelectedProject(updated)
                            }
                          } catch (err) { console.error('Error actualizando tarea:', err) }
                        }}
                        title={isDone(task.status) ? 'Click para marcar como pendiente' :
                               task.status === 'blocked' ? 'Tarea bloqueada' :
                               task.status === 'in_progress' ? 'Click para marcar como completada' :
                               'Click para marcar como completada'}
                        className={`w-5 h-5 rounded border-2 mt-0.5 flex-shrink-0 transition-all cursor-pointer hover:scale-110 group/checkbox relative ${
                          isDone(task.status) ? 'border-emerald-400 bg-emerald-500/30' :
                          task.status === 'blocked' ? 'border-red-400 bg-red-500/10' :
                          task.status === 'in_progress' ? 'border-blue-400 bg-blue-500/10' :
                          'border-white/20 hover:border-emerald-400 hover:bg-emerald-500/10'
                        }`}
                      >
                        {isDone(task.status) && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 -mt-0.5 -ml-0.5" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${isDone(task.status) ? 'text-white/60 line-through' : 'text-white'}`}>{task.text}</p>
                        <p className="text-xs text-white/40 mt-1">
                          <span className={`font-bold ${
                            isDone(task.status) ? 'text-emerald-400' :
                            task.status === 'blocked' ? 'text-red-400' :
                            task.status === 'in_progress' ? 'text-blue-400' :
                            task.status === 'waiting' ? 'text-amber-400' :
                            'text-orange-400'
                          }`}>
                            {isDone(task.status) ? 'COMPLETADA:' :
                             task.status === 'blocked' ? 'BLOQUEADA:' :
                             task.status === 'in_progress' ? 'EN CURSO:' :
                             task.status === 'waiting' ? 'EN ESPERA:' : 'PENDIENTE:'}
                          </span>{' '}
                          {task.description}
                        </p>
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-2">
                            {/* Tag dinámico según el estado real (no el tag estático del backend) */}
                            {(() => {
                              const dynamicTag = isDone(task.status) ? { label: 'Completada', color: 'bg-emerald-500/20 text-emerald-400' } :
                                                 task.status === 'blocked' ? { label: 'Bloqueada', color: 'bg-red-500/20 text-red-400' } :
                                                 task.status === 'in_progress' ? { label: 'En curso', color: 'bg-blue-500/20 text-blue-400' } :
                                                 { label: 'Pendiente', color: 'bg-orange-500/20 text-orange-400' }
                              return (
                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${dynamicTag.color}`}>
                                  {dynamicTag.label}
                                </span>
                              )
                            })()}
                            {/* Otros tags del backend que NO sean de estado */}
                            {(task.tags || []).filter(t => !['Pendiente', 'Completada', 'Bloqueada', 'En curso'].includes(t)).map((tag, i) => (
                              <span key={i} className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                                tag === 'Alta prioridad' ? 'bg-red-500/20 text-red-400' :
                                tag === 'En espera' ? 'bg-amber-500/20 text-amber-400' :
                                tag === 'Partner' ? 'bg-purple-500/20 text-purple-400' :
                                tag === 'Recordatorio' ? 'bg-violet-500/20 text-violet-400' :
                                tag === 'Vencida' ? 'bg-red-500/20 text-red-400' :
                                'bg-white/10 text-white/50'
                              }`}>{tag}</span>
                            ))}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingTaskId(task.id)
                                setTaskForm({
                                  text: task.text,
                                  description: task.description || '',
                                  status: task.status,
                                  assignedTo: task.assignedTo.nombre === 'Sin asignar' ? '' : (task.assignedTo.nombre || ''),
                                  startDate: task.startDate || '',
                                  dueDate: task.dueDate || '',
                                })
                                setTaskModalOpen(true)
                              }}
                              title="Editar tarea"
                              className="w-6 h-6 rounded-md bg-white/5 hover:bg-violet-500/20 hover:text-violet-300 text-white/40 flex items-center justify-center transition-colors"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteTask(task) }}
                              title="Borrar tarea"
                              className="w-6 h-6 rounded-md bg-white/5 hover:bg-red-500/20 hover:text-red-400 text-white/40 flex items-center justify-center transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                            <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${task.assignedTo.color} flex items-center justify-center text-[10px] text-white font-bold`}>
                              {task.assignedTo.iniciales}
                            </div>
                          </div>
                        </div>

                        {/* Bloquear / Desbloquear (con motivo) */}
                        {blockingTaskId === task.id ? (
                          <div className="mt-3 flex gap-2 items-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={blockReason}
                              onChange={(e) => setBlockReason(e.target.value)}
                              placeholder="Motivo del bloqueo..."
                              className="flex-1 px-3 py-1.5 bg-[#0E0E18] border border-red-500/40 rounded-md text-xs text-white placeholder-white/30 focus:outline-none focus:border-red-500"
                              autoFocus
                            />
                            <button
                              disabled={savingBlock || !blockReason.trim()}
                              onClick={async (e) => {
                                e.stopPropagation()
                                setSavingBlock(true)
                                try {
                                  await api.updateTask(task.id, { status: 'blocked', blocked_reason: blockReason.trim(), projectId: p.projectId }, token)
                                  const data = await api.getProjects(token)
                                  if (Array.isArray(data)) {
                                    setProyectos(data)
                                    const updated = data.find((proj: Project) => proj.projectId === p.projectId)
                                    if (updated) setSelectedProject(updated)
                                  }
                                  setBlockingTaskId(null); setBlockReason('')
                                } catch (err) { console.error('Error bloqueando tarea:', err) }
                                finally { setSavingBlock(false) }
                              }}
                              className="px-3 py-1.5 text-xs bg-red-500/80 hover:bg-red-500 text-white rounded-md disabled:opacity-50 flex items-center gap-1"
                            >
                              {savingBlock && <Loader2 className="w-3 h-3 animate-spin" />} Bloquear
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setBlockingTaskId(null); setBlockReason('') }}
                              className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-white/70 rounded-md"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : task.status === 'blocked' ? (
                          <div className="mt-3 flex items-center gap-2">
                            {task.blockedReason && (
                              <span className="flex-1 text-[11px] text-red-300/70 italic truncate" title={task.blockedReason}>
                                Motivo: {task.blockedReason}
                              </span>
                            )}
                            <button
                              onClick={async (e) => {
                                e.stopPropagation()
                                try {
                                  await api.updateTask(task.id, { status: 'pending', blocked_reason: '', projectId: p.projectId }, token)
                                  const data = await api.getProjects(token)
                                  if (Array.isArray(data)) {
                                    setProyectos(data)
                                    const updated = data.find((proj: Project) => proj.projectId === p.projectId)
                                    if (updated) setSelectedProject(updated)
                                  }
                                } catch (err) { console.error('Error desbloqueando tarea:', err) }
                              }}
                              className="ml-auto px-2.5 py-1 text-[11px] bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-md flex items-center gap-1"
                            >
                              <Unlock className="w-3 h-3" /> Desbloquear
                            </button>
                          </div>
                        ) : (
                          <div className="mt-3 flex justify-end">
                            <button
                              onClick={(e) => { e.stopPropagation(); setBlockingTaskId(task.id); setBlockReason('') }}
                              className="flex items-center gap-1 px-2.5 py-1 text-[11px] bg-white/5 hover:bg-red-500/15 hover:text-red-400 text-white/40 border border-white/10 hover:border-red-500/30 rounded-md transition-colors"
                            >
                              <Ban className="w-3 h-3" /> Bloquear
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="bg-[#161625] rounded-xl p-8 border border-white/5 text-center">
                    <p className="text-white/30 text-sm">
                      {taskFilter !== 'all'
                        ? `No hay tareas ${taskFilter === 'completed' ? 'completadas' : taskFilter === 'blocked' ? 'bloqueadas' : 'pendientes'}`
                        : 'No hay tareas definidas para este proyecto'}
                    </p>
                  </div>
                )
                })()}
              </div>
            </div>

            {/* AI Actions */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-white">Acciones ejecutadas por la IA</h2>
                {matchingActions.length > 3 && (
                  <button
                    onClick={() => setShowAllActions(!showAllActions)}
                    className="text-xs text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1"
                  >
                    {showAllActions ? 'Ver menos' : `Ver historial (${matchingActions.length})`} →
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {matchingActions.length > 0 ? (showAllActions ? matchingActions : matchingActions.slice(0, 3)).map(action => (
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
                    <p className="text-white/30 text-sm">
                      {isSearching ? 'Ninguna acción IA coincide con tu búsqueda' : 'Sin acciones IA registradas aún'}
                    </p>
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

          {/* Adjuntos del proyecto */}
          <div className="mt-6">
            <ProjectAttachments
              projectId={p.projectId}
              projectName={p.name}
              onInsightsGenerated={() => {
                // Refrescar el proyecto para ver los nuevos insights
                api.getProjects(token).then(data => {
                  if (Array.isArray(data)) {
                    setProyectos(data)
                    const updated = data.find((proj: Project) => proj.projectId === p.projectId)
                    if (updated) setSelectedProject(updated)
                  }
                }).catch(() => {})
              }}
            />
          </div>
        </main>

        {/* Right sidebar */}
        <aside className="w-72 border-l border-white/5 bg-[#0E0E1A] flex-shrink-0 overflow-y-auto p-4 space-y-6">
          {/* Team */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider">Equipo del Proyecto</h3>
              {!editingPhones ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setNewMember({ nombre: '', email: '', telefono: '', rol: '' }); setAddingMember(true) }}
                    className="flex items-center gap-1 text-[10px] text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    <UserPlus className="w-3 h-3" />
                    Añadir
                  </button>
                  <button
                    onClick={() => { setInviteEmail(''); setInviteResultMsg(''); setInviteError(''); setInviteModalOpen(true) }}
                    className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
                    title="Invitar por correo con cuenta"
                  >
                    <Send className="w-3 h-3" />
                    Invitar
                  </button>
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
                </div>
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
            {addingMember && (
              <div className="mb-3 p-3 bg-[#161625] border border-violet-500/20 rounded-xl space-y-2">
                <input
                  value={newMember.nombre}
                  onChange={e => setNewMember({ ...newMember, nombre: e.target.value })}
                  placeholder="Nombre *"
                  className="w-full px-2.5 py-1.5 bg-[#0E0E1A] border border-white/10 rounded-lg text-xs text-white placeholder-white/30 focus:border-violet-500/40 outline-none"
                />
                <input
                  value={newMember.rol}
                  onChange={e => setNewMember({ ...newMember, rol: e.target.value })}
                  placeholder="Rol (ej: Desarrollador)"
                  className="w-full px-2.5 py-1.5 bg-[#0E0E1A] border border-white/10 rounded-lg text-xs text-white placeholder-white/30 focus:border-violet-500/40 outline-none"
                />
                <input
                  value={newMember.email}
                  onChange={e => setNewMember({ ...newMember, email: e.target.value })}
                  placeholder="Email (canal Gmail)"
                  className="w-full px-2.5 py-1.5 bg-[#0E0E1A] border border-white/10 rounded-lg text-xs text-white placeholder-white/30 focus:border-violet-500/40 outline-none"
                />
                <input
                  value={newMember.telefono}
                  onChange={e => setNewMember({ ...newMember, telefono: e.target.value })}
                  placeholder="+34 600 000 000 (canal WhatsApp)"
                  className="w-full px-2.5 py-1.5 bg-[#0E0E1A] border border-white/10 rounded-lg text-xs text-white placeholder-white/30 focus:border-violet-500/40 outline-none"
                />
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={async () => {
                      if (!newMember.nombre.trim()) return
                      setSavingMember(true)
                      try {
                        const existing = p.team.map(m => ({
                          nombre: m.nombre, rol: m.rol, email: m.email || '', telefono: m.telefono || ''
                        }))
                        const toAdd = {
                          nombre: newMember.nombre.trim(),
                          rol: newMember.rol.trim() || 'Participante',
                          email: newMember.email.trim(),
                          telefono: newMember.telefono.trim(),
                        }
                        await api.updateParticipants(p.projectId, [...existing, toAdd], token)
                        const ini = toAdd.nombre.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'
                        const updated = {
                          ...p,
                          team: [...p.team, { ...toAdd, iniciales: ini, color: 'from-violet-500 to-indigo-600', tareas: 0 }]
                        }
                        setSelectedProject(updated)
                        setProyectos(prev => prev.map(pr => pr.projectId === p.projectId ? updated : pr))
                        setNewMember({ nombre: '', email: '', telefono: '', rol: '' })
                        setAddingMember(false)
                      } catch (err) {
                        console.error('Error añadiendo participante:', err)
                      }
                      setSavingMember(false)
                    }}
                    disabled={savingMember || !newMember.nombre.trim()}
                    className="flex-1 px-2.5 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-medium rounded-lg transition-colors"
                  >
                    {savingMember ? 'Guardando...' : 'Añadir participante'}
                  </button>
                  <button
                    onClick={() => { setAddingMember(false); setNewMember({ nombre: '', email: '', telefono: '', rol: '' }) }}
                    className="px-2.5 py-1.5 text-white/40 hover:text-white/70 text-[11px]"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
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
                      {!editingPhones && (
                        <div className="flex items-center gap-1">
                          {member.email && (
                            <span title={`Email: ${member.email}`}>
                              <Mail className="w-3 h-3 text-sky-400" />
                            </span>
                          )}
                          {member.telefono && (
                            <span title={`WhatsApp: ${member.telefono}`}>
                              <MessageCircle className="w-3 h-3 text-green-400" />
                            </span>
                          )}
                          {!member.email && !member.telefono && (
                            <span className="text-[9px] text-white/20">sin canal</span>
                          )}
                        </div>
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
                        placeholder="+34 600 000 000"
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
      {/* Left sidebar - SOLO canales (filtros movidos al header como pills) */}
      <aside className="w-64 border-r border-white/5 bg-[#0E0E1A] flex-shrink-0 overflow-y-auto">
        <div className="p-4">
          <ChannelsPanel
            onNavigate={onNavigate}
            gmailConnected={gmailConectado}
          />
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

        {/* Stats bar — cards clickeables que filtran tareas globalmente */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          {[
            { icon: FolderKanban, value: stats.total, label: 'Proyectos totales', color: 'text-white/60', filterValue: null as 'completed' | 'pending' | 'blocked' | null },
            { icon: CheckCircle2, value: stats.totalTareasCompletadas, label: 'Tareas completadas', color: 'text-emerald-400', filterValue: 'completed' as const },
            { icon: AlertCircle, value: stats.totalTareasPendientes, label: 'Tareas pendientes', color: 'text-amber-400', filterValue: 'pending' as const },
            { icon: Shield, value: stats.totalTareasBloqueadas, label: 'Tareas bloqueadas', color: 'text-red-400', filterValue: 'blocked' as const },
            { icon: Zap, value: stats.totalMensajes, label: 'Mensajes procesados hoy', color: 'text-violet-400', filterValue: null as 'completed' | 'pending' | 'blocked' | null },
          ].map((stat, i) => {
            const Icon = stat.icon
            const isClickable = stat.filterValue !== null
            const isActive = stat.filterValue && globalTaskFilter === stat.filterValue
            return (
              <button
                key={i}
                onClick={() => {
                  if (!isClickable) return
                  setGlobalTaskFilter(globalTaskFilter === stat.filterValue ? null : stat.filterValue)
                }}
                disabled={!isClickable}
                className={`text-left bg-[#161625] rounded-xl p-4 border transition-all ${
                  isActive
                    ? 'border-white/30 ring-2 ring-white/10 bg-[#1a1a2e]'
                    : isClickable
                      ? 'border-white/5 hover:border-white/15 hover:bg-[#1a1a2e] cursor-pointer'
                      : 'border-white/5 cursor-default'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${stat.color}`} />
                    <span className={`text-2xl font-bold ${stat.color}`}>{stat.value}</span>
                  </div>
                  {isActive && <span className="text-[9px] font-bold text-white/60">FILTRADO</span>}
                </div>
                <p className="text-[11px] text-white/30">{stat.label}</p>
                {isClickable && !isActive && (
                  <p className="text-[10px] text-white/20 mt-1 italic">Click para ver detalle</p>
                )}
              </button>
            )
          })}
        </div>

        {/* Vista detallada de tareas filtradas globalmente */}
        {globalTaskFilter && (() => {
          const isDone = (s: string) => s === 'done' || s === 'completed'
          const matchesGlobal = (t: any) => {
            if (globalTaskFilter === 'completed') return isDone(t.status)
            if (globalTaskFilter === 'blocked') return t.status === 'blocked'
            if (globalTaskFilter === 'pending') return !isDone(t.status) && t.status !== 'blocked'
            return false
          }
          // Agrupar tareas por proyecto
          const groups = proyectos
            .map(p => ({
              project: p,
              tasks: (p.tasks || []).filter(matchesGlobal),
            }))
            .filter(g => g.tasks.length > 0)
          const totalMatchingTasks = groups.reduce((s, g) => s + g.tasks.length, 0)
          const filterLabel = globalTaskFilter === 'completed' ? 'completadas' :
                              globalTaskFilter === 'pending' ? 'pendientes' : 'bloqueadas'
          const filterColor = globalTaskFilter === 'completed' ? 'text-emerald-400' :
                              globalTaskFilter === 'pending' ? 'text-amber-400' : 'text-red-400'
          const filterBgColor = globalTaskFilter === 'completed' ? 'bg-emerald-500/10 border-emerald-500/20' :
                                globalTaskFilter === 'pending' ? 'bg-amber-500/10 border-amber-500/20' :
                                'bg-red-500/10 border-red-500/20'

          return (
            <div className="mb-6">
              <div className={`rounded-xl border p-4 ${filterBgColor}`}>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div>
                    <h2 className={`text-base font-bold ${filterColor}`}>
                      Todas las tareas {filterLabel}
                    </h2>
                    <p className="text-xs text-white/40 mt-0.5">
                      {totalMatchingTasks} tarea{totalMatchingTasks !== 1 ? 's' : ''} en {groups.length} proyecto{groups.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => setGlobalTaskFilter(null)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-3.5 h-3.5" /> Cerrar
                  </button>
                </div>
                {groups.length === 0 ? (
                  <p className="text-sm text-white/40 text-center py-6">
                    No hay tareas {filterLabel} en ningún proyecto.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {groups.map(g => (
                      <div key={g.project.projectId} className="bg-[#0E0E1A] rounded-lg p-3 border border-white/5">
                        <button
                          onClick={() => { setSelectedProject(g.project); setGlobalTaskFilter(null) }}
                          className="flex items-center gap-2 mb-2 group"
                        >
                          <FolderKanban className="w-3.5 h-3.5 text-white/40" />
                          <span className="text-sm font-bold text-white group-hover:text-violet-300 transition-colors">
                            {g.project.name}
                          </span>
                          <span className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded">
                            {g.tasks.length} tarea{g.tasks.length !== 1 ? 's' : ''}
                          </span>
                          <span className="text-[10px] text-violet-400 group-hover:text-violet-300">→ ver proyecto</span>
                        </button>
                        <div className="space-y-1.5 ml-5">
                          {g.tasks.map(t => (
                            <div key={t.id} className="text-xs text-white/70 flex items-start gap-2">
                              <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                globalTaskFilter === 'completed' ? 'bg-emerald-400' :
                                globalTaskFilter === 'pending' ? 'bg-amber-400' :
                                'bg-red-400'
                              }`} />
                              <span className="leading-relaxed">{t.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })()}

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
              {proyectos.length === 0 ? (
                <>
                  <p className="text-sm text-white/40">Aún no tienes proyectos</p>
                  <p className="text-xs text-white/20">Crea tu primer proyecto con el botón "Nuevo proyecto"</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-white/40">No hay proyectos que coincidan</p>
                  <p className="text-xs text-white/20">Prueba con otro filtro o cambia la búsqueda</p>
                </>
              )}
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
                <div className="flex items-center gap-2">
                  <StatusBadge status={proyecto.status} />
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setConfirmDelete(proyecto)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    title="Eliminar proyecto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
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

      {/* Modal confirmación de borrado (vista de lista) */}
      {confirmDelete && !selectedProject && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => !deletingProject && setConfirmDelete(null)}
        >
          <div
            className="bg-[#12121E] border border-white/10 rounded-2xl p-6 max-w-md w-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Eliminar proyecto</h3>
                <p className="text-sm text-white/60 mt-1">
                  ¿Seguro que quieres eliminar <strong className="text-white">{confirmDelete.name}</strong>? Esta acción borrará también sus insights, tareas y notificaciones. <strong className="text-red-400">No se puede deshacer.</strong>
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={!!deletingProject}
                className="px-4 py-2 text-sm text-white/70 hover:text-white rounded-lg hover:bg-white/5 transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteProject(confirmDelete.projectId)}
                disabled={!!deletingProject}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {deletingProject ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Sí, eliminar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
