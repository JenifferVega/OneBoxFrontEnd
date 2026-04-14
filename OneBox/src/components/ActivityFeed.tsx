import { useState } from 'react'
import { 
  TrendingUp, 
  Sparkles, 
  AlertTriangle,
  CheckCircle2,
  Plus,
  Send,
  Clock
} from 'lucide-react'

interface Activity {
  id: string
  type: 'bloqueo' | 'tarea_creada' | 'tarea_completada' | 'decision' | 'seguimiento'
  title: string
  project: string
  projectColor: string
  actor: string
  time: string
}

const mockActivities: Activity[] = [
  {
    id: '1',
    type: 'bloqueo',
    title: 'Falta aprobación de seguridad para deploy',
    project: 'Migración Cloud AWS',
    projectColor: 'bg-violet-600',
    actor: 'OneBox IA',
    time: 'Hace 30 min'
  },
  {
    id: '2',
    type: 'tarea_creada',
    title: 'Tests de carga en staging',
    project: 'Migración Cloud AWS',
    projectColor: 'bg-violet-600',
    actor: 'OneBox IA',
    time: 'Hace 1 hora'
  },
  {
    id: '3',
    type: 'tarea_completada',
    title: 'Configurar contenedores Docker en ECS',
    project: 'Migración Cloud AWS',
    projectColor: 'bg-violet-600',
    actor: 'Luis Rodríguez',
    time: 'Hace 2 horas'
  },
  {
    id: '4',
    type: 'decision',
    title: 'Mockups aprobados, iniciar desarrollo',
    project: 'Rediseño Portal Web',
    projectColor: 'bg-cyan-600',
    actor: 'OneBox IA',
    time: 'Hace 3 horas'
  },
  {
    id: '5',
    type: 'seguimiento',
    title: 'Seguimiento enviado a Carlos Méndez sobre migración RDS',
    project: 'Migración Cloud AWS',
    projectColor: 'bg-violet-600',
    actor: 'OneBox IA',
    time: 'Hace 5 horas'
  },
  {
    id: '6',
    type: 'tarea_completada',
    title: 'Implementar webhook de confirmación',
    project: 'Integración API Pagos',
    projectColor: 'bg-emerald-600',
    actor: 'Luis Rodríguez',
    time: 'Ayer'
  },
  {
    id: '7',
    type: 'tarea_creada',
    title: 'Implementar nuevo sistema de navegación',
    project: 'Rediseño Portal Web',
    projectColor: 'bg-cyan-600',
    actor: 'Ana García',
    time: 'Ayer'
  },
  {
    id: '8',
    type: 'tarea_completada',
    title: 'Entregar mockups finales',
    project: 'Rediseño Portal Web',
    projectColor: 'bg-cyan-600',
    actor: 'María Torres',
    time: 'Ayer'
  }
]

const getActivityIcon = (type: Activity['type']) => {
  switch (type) {
    case 'bloqueo':
      return <AlertTriangle className="w-4 h-4" />
    case 'tarea_creada':
      return <Plus className="w-4 h-4" />
    case 'tarea_completada':
      return <CheckCircle2 className="w-4 h-4" />
    case 'decision':
      return <Sparkles className="w-4 h-4" />
    case 'seguimiento':
      return <Send className="w-4 h-4" />
    default:
      return <Clock className="w-4 h-4" />
  }
}

const getActivityStyles = (type: Activity['type']) => {
  switch (type) {
    case 'bloqueo':
      return {
        iconBg: 'bg-red-100 border-red-300',
        iconColor: 'text-red-600',
        label: 'text-red-700 font-semibold'
      }
    case 'tarea_creada':
      return {
        iconBg: 'bg-emerald-100 border-emerald-300',
        iconColor: 'text-emerald-600',
        label: 'text-emerald-700 font-semibold'
      }
    case 'tarea_completada':
      return {
        iconBg: 'bg-emerald-100 border-emerald-300',
        iconColor: 'text-emerald-600',
        label: 'text-emerald-700 font-semibold'
      }
    case 'decision':
      return {
        iconBg: 'bg-violet-100 border-violet-300',
        iconColor: 'text-violet-600',
        label: 'text-violet-700 font-semibold'
      }
    case 'seguimiento':
      return {
        iconBg: 'bg-amber-100 border-amber-300',
        iconColor: 'text-amber-600',
        label: 'text-amber-700 font-semibold'
      }
    default:
      return {
        iconBg: 'bg-slate-100 border-slate-300',
        iconColor: 'text-slate-600',
        label: 'text-slate-700 font-semibold'
      }
  }
}

const getActivityLabel = (type: Activity['type']) => {
  switch (type) {
    case 'bloqueo':
      return 'Bloqueo detectado:'
    case 'tarea_creada':
      return 'Tarea creada:'
    case 'tarea_completada':
      return 'Tarea completada:'
    case 'decision':
      return 'Decisión detectada:'
    case 'seguimiento':
      return 'Seguimiento enviado:'
    default:
      return 'Actividad:'
  }
}

export default function ActivityFeed() {
  const [filter, setFilter] = useState<'all' | 'acciones' | 'bloqueos'>('all')
  
  const eventsToday = mockActivities.filter(a => a.time.includes('hora') || a.time.includes('min')).length
  const aiActions = mockActivities.filter(a => a.actor === 'OneBox IA').length
  const blockers = mockActivities.filter(a => a.type === 'bloqueo').length

  const filteredActivities = mockActivities.filter(activity => {
    if (filter === 'all') return true
    if (filter === 'acciones') return activity.actor === 'OneBox IA'
    if (filter === 'bloqueos') return activity.type === 'bloqueo'
    return true
  })

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header - mismo padding que Projects */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Actividad</h1>
          <p className="text-slate-600 mt-1">Timeline de acciones ejecutadas en tus proyectos</p>
        </div>

        {/* Stats Cards - colores más sólidos */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl p-5 text-white shadow-lg">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-violet-200" />
              <span className="text-3xl font-bold">{eventsToday}</span>
            </div>
            <p className="text-violet-100 mt-1 font-medium">Eventos hoy</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-violet-600" />
              <span className="text-3xl font-bold text-violet-600">{aiActions}</span>
            </div>
            <p className="text-slate-700 mt-1 font-medium">Acciones de IA</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span className="text-3xl font-bold text-red-600">{blockers}</span>
            </div>
            <p className="text-slate-700 mt-1 font-medium">Bloqueos</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              filter === 'all'
                ? 'bg-violet-600 text-white shadow-md'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilter('acciones')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              filter === 'acciones'
                ? 'bg-slate-800 text-white shadow-md'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            Acciones
          </button>
          <button
            onClick={() => setFilter('bloqueos')}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              filter === 'bloqueos'
                ? 'bg-slate-800 text-white shadow-md'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            Bloqueos
          </button>
        </div>

        {/* Activity Timeline */}
        <div className="space-y-0">
          {filteredActivities.map((activity, index) => {
            const styles = getActivityStyles(activity.type)
            
            return (
              <div key={activity.id} className="flex items-start gap-4">
                {/* Timeline Line */}
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full ${styles.iconBg} border-2 flex items-center justify-center ${styles.iconColor}`}>
                    {getActivityIcon(activity.type)}
                  </div>
                  {index < filteredActivities.length - 1 && (
                    <div className="w-0.5 h-14 bg-slate-300 mt-1" />
                  )}
                </div>

                {/* Content - TEXTOS OSCUROS */}
                <div className="flex-1 pb-4">
                  <p className="text-base">
                    <span className={styles.label}>{getActivityLabel(activity.type)}</span>
                    {' '}
                    <span className="text-slate-900 font-medium">"{activity.title}"</span>
                  </p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className={`inline-flex items-center px-2.5 py-1 ${activity.projectColor} text-white rounded-md text-xs font-bold`}>
                      {activity.project}
                    </span>
                    <span className="text-slate-700 text-sm font-medium">{activity.actor}</span>
                    <span className="flex items-center gap-1 text-slate-500 text-sm">
                      <Clock className="w-3.5 h-3.5" />
                      {activity.time}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}