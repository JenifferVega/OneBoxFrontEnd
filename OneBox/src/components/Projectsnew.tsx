import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FolderKanban,
  Plus,
  Search,
  MoreVertical,
  MessageSquare,
  Users,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Mail,
  Hash,
  Send,
  ArrowRight,
  Zap,
  ChevronRight,
  Activity
} from 'lucide-react'
import type { PageType } from '../App'

interface ProjectsProps {
  onNavigate: (page: PageType) => void
  gmailConectado: boolean
}

const mockProjects = [
  {
    id: '1',
    name: 'OneBox Project',
    description: 'Desarrollo de la plataforma multi-agente',
    participants: ['Santiago Lorente', 'Jesus Vega', 'Jeniffer Fúnez'],
    channels: ['email', 'slack'],
    status: 'active',
    stats: {
      conversations: 17,
      actionsExecuted: 8,
      pending: 3,
      blockers: 1
    },
    recentActions: [
      { type: 'task', text: 'Tarea creada: Implementar sistema multi-agente', time: 'Hace 2h', status: 'done' },
      { type: 'notify', text: 'Equipo notificado en Slack', time: 'Hace 3h', status: 'done' },
      { type: 'blocker', text: 'Bloqueador: Esperando diseño del chat', time: 'Hace 1d', status: 'pending' },
    ],
    lastActivity: '2026-02-07T14:30:00'
  },
  {
    id: '2',
    name: 'Cliente Alpha',
    description: 'Propuesta comercial y seguimiento',
    participants: ['Santiago Lorente', 'María García'],
    channels: ['email', 'whatsapp'],
    status: 'active',
    stats: {
      conversations: 8,
      actionsExecuted: 5,
      pending: 2,
      blockers: 0
    },
    recentActions: [
      { type: 'followup', text: 'Seguimiento programado: En 3 días', time: 'Hace 1h', status: 'scheduled' },
      { type: 'task', text: 'Tarea creada: Enviar cotización revisada', time: 'Hace 4h', status: 'done' },
    ],
    lastActivity: '2026-02-07T10:15:00'
  },
  {
    id: '3',
    name: 'Migración Backend',
    description: 'Migración de servicios a AWS',
    participants: ['Jesus Vega', 'Carlos Dev'],
    channels: ['slack'],
    status: 'completed',
    stats: {
      conversations: 23,
      actionsExecuted: 15,
      pending: 0,
      blockers: 0
    },
    recentActions: [
      { type: 'task', text: 'Proyecto completado', time: 'Hace 3d', status: 'done' },
    ],
    lastActivity: '2026-02-04T16:00:00'
  }
]

export default function Projects({ onNavigate, gmailConectado }: ProjectsProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [showNewProject, setShowNewProject] = useState(false)

  const filteredProjects = mockProjects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const activeProjects = filteredProjects.filter(p => p.status === 'active')
  const completedProjects = filteredProjects.filter(p => p.status === 'completed')

  const totalActions = mockProjects.reduce((acc, p) => acc + p.stats.actionsExecuted, 0)
  const totalPending = mockProjects.reduce((acc, p) => acc + p.stats.pending, 0)
  const totalBlockers = mockProjects.reduce((acc, p) => acc + p.stats.blockers, 0)

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email': return <Mail className="w-3.5 h-3.5" />
      case 'slack': return <Hash className="w-3.5 h-3.5" />
      case 'whatsapp': return <MessageSquare className="w-3.5 h-3.5" />
      default: return <Send className="w-3.5 h-3.5" />
    }
  }

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'task': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      case 'notify': return <Send className="w-4 h-4 text-blue-500" />
      case 'blocker': return <AlertTriangle className="w-4 h-4 text-amber-500" />
      case 'followup': return <Clock className="w-4 h-4 text-violet-500" />
      default: return <Zap className="w-4 h-4 text-slate-500" />
    }
  }

  return (
    <div className="p-6 lg:p-8 bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tus Proyectos</h1>
          <p className="text-slate-500 mt-1">Proyectos activos y sus acciones ejecutadas</p>
        </div>
        
        <button
          onClick={() => setShowNewProject(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Nuevo Proyecto
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
              <FolderKanban className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{activeProjects.length}</p>
              <p className="text-sm text-slate-500">Proyectos activos</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{totalActions}</p>
              <p className="text-sm text-slate-500">Acciones ejecutadas</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{totalPending}</p>
              <p className="text-sm text-slate-500">Pendientes</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{totalBlockers}</p>
              <p className="text-sm text-slate-500">Bloqueadores</p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar proyectos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all"
        />
      </div>

      {!gmailConectado && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-gradient-to-r from-violet-500 to-indigo-500 rounded-xl flex items-center justify-between text-white"
        >
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5" />
            <div>
              <p className="font-medium">Conecta tu Gmail para empezar</p>
              <p className="text-sm text-white/80">OneBox detectará acciones en tus conversaciones</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('conectar-gmail')}
            className="px-4 py-2 bg-white text-violet-600 font-medium rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-2"
          >
            Conectar <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      <div className="space-y-6">
        {activeProjects.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
              Proyectos Activos
            </h2>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {activeProjects.map((project) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -2 }}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden cursor-pointer group"
                  onClick={() => setSelectedProject(project.id)}
                >
                  <div className="p-5 border-b border-slate-100">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center">
                          <FolderKanban className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900 group-hover:text-violet-600 transition-colors">
                            {project.name}
                          </h3>
                          <p className="text-sm text-slate-500 truncate max-w-[200px]">
                            {project.description}
                          </p>
                        </div>
                      </div>
                      <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-4 mt-4">
                      <div className="flex items-center gap-1.5">
                        {project.channels.map((channel, i) => (
                          <span key={i} className="w-6 h-6 bg-slate-100 rounded flex items-center justify-center text-slate-500">
                            {getChannelIcon(channel)}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-slate-500">
                        <Users className="w-4 h-4" />
                        {project.participants.length} participantes
                      </div>
                    </div>
                  </div>

                  <div className="px-5 py-3 bg-slate-50 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1.5 text-emerald-600">
                        <CheckCircle2 className="w-4 h-4" />
                        {project.stats.actionsExecuted} ejecutadas
                      </span>
                      {project.stats.pending > 0 && (
                        <span className="flex items-center gap-1.5 text-blue-600">
                          <Clock className="w-4 h-4" />
                          {project.stats.pending} pendientes
                        </span>
                      )}
                      {project.stats.blockers > 0 && (
                        <span className="flex items-center gap-1.5 text-amber-600">
                          <AlertTriangle className="w-4 h-4" />
                          {project.stats.blockers}
                        </span>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-violet-500 transition-colors" />
                  </div>

                  <div className="p-4 space-y-2">
                    <p className="text-xs font-medium text-slate-400 uppercase">Últimas acciones</p>
                    {project.recentActions.slice(0, 2).map((action, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        {getActionIcon(action.type)}
                        <span className="text-slate-700 truncate flex-1">{action.text}</span>
                        <span className="text-xs text-slate-400">{action.time}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {completedProjects.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
              Completados
            </h2>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {completedProjects.map((project) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{project.name}</h3>
                      <p className="text-sm text-slate-500">{project.stats.actionsExecuted} acciones completadas</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {filteredProjects.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FolderKanban className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700">No se encontraron proyectos</h3>
            <p className="text-slate-500 mt-2">Crea tu primer proyecto para empezar</p>
            <button
              onClick={() => setShowNewProject(true)}
              className="mt-4 px-4 py-2 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 transition-colors"
            >
              Crear Proyecto
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showNewProject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowNewProject(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-slate-900 mb-4">Nuevo Proyecto</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del proyecto</label>
                  <input
                    type="text"
                    placeholder="Ej: Lanzamiento Q1"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                  <textarea
                    placeholder="Breve descripción del proyecto"
                    rows={2}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Canales a conectar</label>
                  <div className="flex gap-2">
                    {[
                      { id: 'email', icon: Mail, label: 'Email' },
                      { id: 'slack', icon: Hash, label: 'Slack' },
                      { id: 'whatsapp', icon: MessageSquare, label: 'WhatsApp' },
                    ].map((channel) => (
                      <button
                        key={channel.id}
                        className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg hover:border-violet-500 hover:bg-violet-50 transition-colors text-sm"
                      >
                        <channel.icon className="w-4 h-4" />
                        {channel.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowNewProject(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => setShowNewProject(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors"
                >
                  Crear Proyecto
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}