import { useState } from 'react'
import { 
  Mail, 
  Search, 
  RefreshCw, 
  Clock, 
  MailOpen,
  Tag,
  FolderOpen
} from 'lucide-react'

interface Email {
  id: string
  sender: string
  initials: string
  subject: string
  preview: string
  time: string
  status: 'sin_asignar' | 'asignado' | 'analizado'
  project?: string
  avatarColor: string
}

const mockEmails: Email[] = [
  {
    id: '1',
    sender: 'Marketing Team',
    initials: 'MT',
    subject: 'Resultados Campaña Q1 - Informe Final',
    preview: 'Adjunto encontrarás el informe completo de la campaña...',
    time: 'Hace 3 horas',
    status: 'sin_asignar',
    project: 'Campaña Marketing Q2',
    avatarColor: 'bg-blue-600'
  },
  {
    id: '2',
    sender: 'Pedro Sánchez',
    initials: 'PS',
    subject: 'Auditoría de Seguridad - Hallazgos Críticos',
    preview: 'Hemos identificado varios puntos que requieren atención inmediata...',
    time: 'Hace 4 horas',
    status: 'sin_asignar',
    project: 'Auditoría Seguridad',
    avatarColor: 'bg-violet-600'
  },
  {
    id: '3',
    sender: 'Roberto Gómez',
    initials: 'RG',
    subject: 'Propuesta de servicios cloud - Cotización',
    preview: 'Gracias por la reunión de ayer. Como acordamos...',
    time: 'Ayer',
    status: 'sin_asignar',
    project: 'Migración Cloud AWS',
    avatarColor: 'bg-emerald-600'
  },
  {
    id: '4',
    sender: 'RR.HH.',
    initials: 'R',
    subject: 'Recordatorio: Evaluaciones de desempeño Q1',
    preview: 'Les recordamos que las evaluaciones deben completarse antes del...',
    time: 'Ayer',
    status: 'analizado',
    avatarColor: 'bg-rose-600'
  },
  {
    id: '5',
    sender: 'Newsletter Tech',
    initials: 'NT',
    subject: 'AWS re:Invent 2024 - Resumen de novedades',
    preview: 'Las principales novedades anunciadas en el evento...',
    time: 'Hace 2 días',
    status: 'analizado',
    avatarColor: 'bg-cyan-600'
  }
]

export default function Inbox() {
  const [emails] = useState<Email[]>(mockEmails)
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const pendingCount = emails.filter(e => e.status === 'sin_asignar' && e.project).length
  const unanalyzedCount = emails.filter(e => e.status === 'analizado').length

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Container con mismo padding que Projects */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Bandeja</h1>
            <p className="text-slate-600 mt-1">Conversaciones pendientes de asignar a un proyecto</p>
          </div>
          <button className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-semibold shadow-sm">
            <RefreshCw className="w-4 h-4" />
            Sincronizar
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl p-5 text-white shadow-lg">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-violet-200" />
              <span className="text-3xl font-bold">{pendingCount}</span>
            </div>
            <p className="text-violet-100 mt-1 font-medium">Por asignar a proyecto</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-slate-500" />
              <span className="text-3xl font-bold text-slate-900">{unanalyzedCount}</span>
            </div>
            <p className="text-slate-700 mt-1 font-medium">Sin analizar</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar en bandeja..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 text-slate-900 placeholder-slate-400"
          />
        </div>

        {/* Content Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Email List */}
          <div className="space-y-3">
            {emails.map((email) => (
              <div
                key={email.id}
                onClick={() => setSelectedEmail(email)}
                className={`bg-white rounded-xl p-4 border cursor-pointer transition-all ${
                  selectedEmail?.id === email.id 
                    ? 'border-violet-500 shadow-md' 
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className={`w-12 h-12 ${email.avatarColor} rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                    {email.initials}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-bold text-slate-900 truncate">{email.sender}</h3>
                      <span className="text-sm text-slate-500 flex-shrink-0 ml-2">{email.time}</span>
                    </div>
                    <p className="text-slate-800 font-semibold truncate mb-1">{email.subject}</p>
                    <p className="text-slate-600 text-sm truncate">{email.preview}</p>
                    
                    {/* Tags */}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {email.status === 'sin_asignar' && email.project ? (
                        <>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-800 rounded-md text-xs font-bold border border-amber-200">
                            <Tag className="w-3 h-3" />
                            Sin asignar
                          </span>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-violet-100 text-violet-800 rounded-md text-xs font-bold border border-violet-200">
                            <FolderOpen className="w-3 h-3" />
                            {email.project}
                          </span>
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-bold border border-slate-200">
                          <Clock className="w-3 h-3" />
                          Sin analizar
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Email Detail / Empty State */}
          <div className="bg-white rounded-xl border border-slate-200 min-h-[500px] flex items-center justify-center">
            {selectedEmail ? (
              <div className="p-6 w-full">
                <div className="flex items-start gap-4 mb-6">
                  <div className={`w-16 h-16 ${selectedEmail.avatarColor} rounded-full flex items-center justify-center text-white font-bold text-xl`}>
                    {selectedEmail.initials}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{selectedEmail.sender}</h2>
                    <p className="text-slate-600">{selectedEmail.time}</p>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-4">{selectedEmail.subject}</h3>
                <p className="text-slate-700 leading-relaxed text-base">{selectedEmail.preview}</p>
                
                {/* Actions */}
                <div className="mt-8 flex flex-wrap gap-3">
                  <button className="px-5 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-semibold">
                    Analizar con IA
                  </button>
                  <button className="px-5 py-2.5 bg-white text-slate-800 rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors font-semibold">
                    Asignar a proyecto
                  </button>
                  <button className="px-5 py-2.5 bg-white text-slate-800 rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors font-semibold">
                    Marcar como leído
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center p-8">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MailOpen className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Selecciona un mensaje</h3>
                <p className="text-slate-600">para ver el análisis y las acciones disponibles</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}