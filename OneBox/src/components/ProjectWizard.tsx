import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from 'react-oidc-context'
import { api } from '../services/api'
import {
  Check, Search, X, Plus, MessageCircle, Mail, Hash,
  Calendar, ArrowLeft, ArrowRight, AlertTriangle, Users, Phone
} from 'lucide-react'
import { PageType } from '../App'

const TEAM_DIRECTORY = [
  { nombre: 'Jeniffer Fúnez', email: 'jeniffer@agencia.com', telefono: '+50494622817', rol: 'PM', iniciales: 'JF', color: 'from-violet-500 to-indigo-600', projectCount: 5 },
  { nombre: 'Andrés López', email: 'andres@agencia.com', telefono: '', rol: 'Dev Frontend', iniciales: 'AL', color: 'from-blue-500 to-cyan-600', projectCount: 3 },
  { nombre: 'Marta Ruiz', email: 'marta@agencia.com', telefono: '', rol: 'UX / Diseño', iniciales: 'MR', color: 'from-pink-500 to-rose-600', projectCount: 2 },
  { nombre: 'Jesús Vega', email: 'jesus@agencia.com', telefono: '', rol: 'Dev Backend', iniciales: 'JS', color: 'from-emerald-500 to-green-600', projectCount: 2 },
  { nombre: 'Santiago López', email: 'santiago@partner.com', telefono: '', rol: 'Partner Externo', iniciales: 'SL', color: 'from-amber-500 to-orange-600', projectCount: 1 },
  { nombre: 'María Blanco', email: 'maria@agencia.com', telefono: '', rol: 'Dev Backend', iniciales: 'MB', color: 'from-teal-500 to-emerald-600', projectCount: 0 },
  { nombre: 'Carlos García', email: 'carlos@agencia.com', telefono: '', rol: 'DevOps', iniciales: 'CG', color: 'from-orange-500 to-red-600', projectCount: 1 },
]

const ROLES = ['PM', 'Dev Frontend', 'Dev Backend', 'DevOps', 'Diseño', 'QA', 'Partner', 'Cliente']
const PROJECT_TYPES = ['Desarrollo Web', 'Infraestructura', 'Diseño', 'Marketing', 'Ecommerce', 'Consultoría', 'Soporte', 'RRHH', 'Otro']
const CHANNELS = [
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'text-green-400', bgActive: 'bg-green-500/20 border-green-500/30' },
  { id: 'email', label: 'Email', icon: Mail, color: 'text-blue-400', bgActive: 'bg-blue-500/20 border-blue-500/30' },
  { id: 'slack', label: 'Slack', icon: Hash, color: 'text-cyan-400', bgActive: 'bg-cyan-500/20 border-cyan-500/30' },
]

interface TeamMember {
  nombre: string
  email: string
  telefono: string
  rol: string
  iniciales: string
  color: string
  projectCount: number
  isExternal?: boolean
}

interface ProjectsWizardProps {
  onNavigate: (page: PageType) => void
}

export default function ProjectWizard({ onNavigate }: ProjectsWizardProps) {
  const auth = useAuth()
  const token = auth.user?.access_token || ''

  const [step, setStep] = useState(1)
  const [creating, setCreating] = useState(false)

  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState('')
  const [descripcion, setDescripcion] = useState('')

  const [teamSearch, setTeamSearch] = useState('')
  const [selectedTeam, setSelectedTeam] = useState<TeamMember[]>([
    { ...TEAM_DIRECTORY[0], rol: 'PM' },
  ])
  const [teamRoles, setTeamRoles] = useState<Record<string, string>>({ 'jeniffer@agencia.com': 'PM' })
  const [teamPhones, setTeamPhones] = useState<Record<string, string>>({ 'jeniffer@agencia.com': '+50494622817' })
  const [externalEmail, setExternalEmail] = useState('')

  const [selectedChannels, setSelectedChannels] = useState<string[]>(['email'])
  const [deliveryDate, setDeliveryDate] = useState('')

  const searchResults = teamSearch.length >= 2
    ? TEAM_DIRECTORY.filter(p =>
        p.nombre.toLowerCase().includes(teamSearch.toLowerCase()) &&
        !selectedTeam.some(s => s.email === p.email)
      )
    : []

  const addTeamMember = (member: TeamMember) => {
    setSelectedTeam([...selectedTeam, member])
    setTeamRoles({ ...teamRoles, [member.email]: member.rol })
    if (member.telefono) setTeamPhones({ ...teamPhones, [member.email]: member.telefono })
    setTeamSearch('')
  }

  const removeTeamMember = (email: string) => {
    if (email === 'jeniffer@agencia.com') return
    setSelectedTeam(selectedTeam.filter(m => m.email !== email))
    const newRoles = { ...teamRoles }
    delete newRoles[email]
    setTeamRoles(newRoles)
    const newPhones = { ...teamPhones }
    delete newPhones[email]
    setTeamPhones(newPhones)
  }

  const updateRole = (email: string, rol: string) => {
    setTeamRoles({ ...teamRoles, [email]: rol })
  }

  const addExternal = () => {
    if (!externalEmail.includes('@')) return
    const name = externalEmail.split('@')[0]
    const initials = name.slice(0, 2).toUpperCase()
    const newMember: TeamMember = {
      nombre: name.charAt(0).toUpperCase() + name.slice(1),
      email: externalEmail,
      telefono: '',
      rol: 'Partner',
      iniciales: initials,
      color: 'from-gray-500 to-gray-600',
      projectCount: 0,
      isExternal: true,
    }
    setSelectedTeam([...selectedTeam, newMember])
    setTeamRoles({ ...teamRoles, [externalEmail]: 'Partner' })
    setExternalEmail('')
  }

  const toggleChannel = (id: string) => {
    setSelectedChannels(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  const canAdvance = () => {
    if (step === 1) return nombre.trim().length > 0 && tipo.length > 0
    if (step === 2) return selectedTeam.length > 0
    return true
  }

  const handleCreate = async () => {
    setCreating(true)
    try {
      await api.createProject({
        name: nombre,
        description: descripcion,
        type: tipo,
        participants: selectedTeam.map(m => ({ nombre: m.nombre, rol: teamRoles[m.email] || m.rol, email: m.email, telefono: teamPhones[m.email] || '' })),
        channels: selectedChannels,
        deliveryDate,
      }, token)
      onNavigate('proyectos')
    } catch (err) {
      console.error('Error creating project:', err)
      onNavigate('proyectos')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-56px)]">
      <aside className="w-64 border-r border-white/5 bg-[#0E0E1A] flex-shrink-0 flex flex-col justify-between">
        <div className="p-6">
          <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-6">Nuevo Proyecto</h3>

          <div className="space-y-2">
            {[
              { num: 1, label: 'Proyecto', sub: 'Nombre y tipo' },
              { num: 2, label: 'Equipo', sub: 'PM y participantes' },
              { num: 3, label: 'Canales y timing', sub: 'Comunicación y fechas' },
            ].map(s => (
              <div key={s.num} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step > s.num ? 'bg-emerald-500 text-white' :
                  step === s.num ? 'bg-violet-600 text-white' :
                  'bg-white/10 text-white/30'
                }`}>
                  {step > s.num ? <Check className="w-4 h-4" /> : s.num}
                </div>
                <div>
                  <p className={`text-sm font-medium ${step >= s.num ? 'text-white' : 'text-white/30'}`}>{s.label}</p>
                  <p className="text-[11px] text-white/30">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {nombre && (
          <div className="p-4">
            <div className="bg-[#161625] rounded-xl p-4 border border-white/5">
              <p className="text-[10px] font-bold text-white/30 uppercase mb-2">Vista Previa</p>
              <h4 className="text-sm font-bold text-white">{nombre}</h4>
              {tipo && <p className="text-xs text-violet-400 mt-0.5">{tipo}</p>}
              {selectedTeam.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] text-white/30 mb-1">PM</p>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${selectedTeam[0].color} flex items-center justify-center text-[8px] text-white font-bold`}>
                      {selectedTeam[0].iniciales}
                    </div>
                    <span className="text-xs text-white/60">{selectedTeam[0].nombre}</span>
                  </div>
                </div>
              )}
              {selectedTeam.length > 1 && (
                <div className="mt-2">
                  <p className="text-[10px] text-white/30 mb-1">Equipo</p>
                  <div className="flex -space-x-1.5">
                    {selectedTeam.slice(1).map((m, i) => (
                      <div key={i} className={`w-5 h-5 rounded-full bg-gradient-to-br ${m.color} flex items-center justify-center text-[8px] text-white font-bold border border-[#161625]`}>
                        {m.iniciales}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedChannels.length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] text-white/30 mb-1">Canales</p>
                  <div className="flex gap-1">
                    {selectedChannels.map(ch => {
                      const channel = CHANNELS.find(c => c.id === ch)
                      if (!channel) return null
                      const Icon = channel.icon
                      return <Icon key={ch} className={`w-4 h-4 ${channel.color}`} />
                    })}
                  </div>
                </div>
              )}
              {deliveryDate ? (
                <div className="mt-2">
                  <p className="text-[10px] text-white/30">Entrega</p>
                  <p className="text-xs text-white/60">{deliveryDate}</p>
                </div>
              ) : (
                <div className="mt-2">
                  <p className="text-[10px] text-white/30">Entrega</p>
                  <p className="text-xs text-white/30">— por definir</p>
                </div>
              )}
            </div>
          </div>
        )}
      </aside>

      <main className="flex-1 overflow-y-auto flex flex-col">
        <div className="flex-1 max-w-2xl mx-auto w-full px-8 py-10">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-2xl font-bold text-white mb-2">¿Cómo se llama tu proyecto?</h2>
                <p className="text-sm text-white/40 mb-8">Define el nombre, tipo y descripción del proyecto.</p>

                <div className="space-y-6">
                  <div>
                    <label className="text-sm text-white/60 block mb-2">Nombre del proyecto</label>
                    <input
                      value={nombre}
                      onChange={e => setNombre(e.target.value)}
                      className="w-full px-4 py-3 bg-[#161625] border border-white/10 rounded-xl text-white placeholder-white/20 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 outline-none transition-all"
                      placeholder="Ej: Rediseño Portal Web"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-white/60 block mb-2">Tipo de proyecto</label>
                    <div className="grid grid-cols-3 gap-2">
                      {PROJECT_TYPES.map(t => (
                        <button
                          key={t}
                          onClick={() => setTipo(t)}
                          className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                            tipo === t
                              ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
                              : 'bg-white/5 border-white/5 text-white/50 hover:border-white/10 hover:text-white/70'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-white/60 block mb-2">Descripción (opcional)</label>
                    <textarea
                      value={descripcion}
                      onChange={e => setDescripcion(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 bg-[#161625] border border-white/10 rounded-xl text-white placeholder-white/20 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 outline-none transition-all resize-none"
                      placeholder="Describe brevemente el alcance del proyecto..."
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-2xl font-bold text-white mb-2">¿Quién trabaja en este proyecto?</h2>
                <p className="text-sm text-white/40 mb-8">Busca por nombre. El sistema detecta si alguien ya está añadido.</p>

                <div className="relative mb-4">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                  <input
                    value={teamSearch}
                    onChange={e => setTeamSearch(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-[#161625] border border-white/10 rounded-xl text-white placeholder-white/20 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 outline-none transition-all"
                    placeholder="Buscar por nombre..."
                  />
                </div>

                {searchResults.length > 0 && (
                  <div className="bg-[#161625] border border-white/10 rounded-xl mb-4 overflow-hidden">
                    {searchResults.map(person => (
                      <div key={person.email} className="flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${person.color} flex items-center justify-center text-[10px] text-white font-bold`}>
                            {person.iniciales}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{person.nombre}</p>
                            <p className="text-xs text-white/30">{person.rol} · {person.email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => addTeamMember(person)}
                          className="text-xs text-violet-400 hover:text-violet-300 font-medium transition-colors"
                        >
                          + Añadir
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {selectedTeam.some(m => m.projectCount >= 3 && m.email !== 'jeniffer@agencia.com') && (
                  <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-4">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <p className="text-xs text-amber-400">
                      <span className="font-bold">{selectedTeam.find(m => m.projectCount >= 3 && m.email !== 'jeniffer@agencia.com')?.nombre}</span> ya participa en {selectedTeam.find(m => m.projectCount >= 3)?.projectCount} proyectos activos. Puedes añadirlo igualmente.
                    </p>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">Equipo Seleccionado</h3>
                  <div className="space-y-2">
                    {selectedTeam.map(member => (
                      <div key={member.email} className="bg-[#161625] rounded-xl px-4 py-3 border border-white/5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${member.color} flex items-center justify-center text-[10px] text-white font-bold`}>
                              {member.iniciales}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white">{member.nombre}</p>
                              <p className="text-xs text-white/30">{member.email}{member.isExternal ? ' · externo' : ''}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {member.email === 'jeniffer@agencia.com' ? (
                              <span className="px-3 py-1 bg-violet-600/20 text-violet-400 text-xs font-bold rounded-lg">PM</span>
                            ) : (
                              <>
                                <select
                                  value={teamRoles[member.email] || member.rol}
                                  onChange={e => updateRole(member.email, e.target.value)}
                                  className="bg-[#0E0E1A] border border-white/10 rounded-lg px-2 py-1 text-xs text-white/70 outline-none"
                                >
                                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                                <button
                                  onClick={() => removeTeamMember(member.email)}
                                  className="p-1 text-white/20 hover:text-red-400 transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2 ml-11">
                          <Phone className="w-3.5 h-3.5 text-white/20" />
                          <input
                            value={teamPhones[member.email] || ''}
                            onChange={e => setTeamPhones({ ...teamPhones, [member.email]: e.target.value })}
                            className="flex-1 px-3 py-1.5 bg-[#0E0E1A] border border-white/10 rounded-lg text-xs text-white/70 placeholder-white/20 focus:border-green-500/40 outline-none transition-all"
                            placeholder="+504 9999-9999"
                          />
                          {teamPhones[member.email] && (
                            <span className="text-[10px] text-green-400 font-medium">WhatsApp</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    value={externalEmail}
                    onChange={e => setExternalEmail(e.target.value)}
                    className="flex-1 px-4 py-3 bg-[#161625] border border-white/10 rounded-xl text-white placeholder-white/20 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 outline-none transition-all"
                    placeholder="Invitar externo por email..."
                    onKeyDown={e => e.key === 'Enter' && addExternal()}
                  />
                  <button
                    onClick={addExternal}
                    disabled={!externalEmail.includes('@')}
                    className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-medium text-white/60 hover:bg-white/10 transition-all disabled:opacity-30"
                  >
                    + Invitar
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h2 className="text-2xl font-bold text-white mb-2">Canales y timing</h2>
                <p className="text-sm text-white/40 mb-8">Selecciona los canales de comunicación y la fecha estimada de entrega.</p>

                <div className="mb-8">
                  <label className="text-sm text-white/60 block mb-3">Canales de comunicación</label>
                  <div className="grid grid-cols-3 gap-3">
                    {CHANNELS.map(ch => {
                      const Icon = ch.icon
                      const isActive = selectedChannels.includes(ch.id)
                      return (
                        <button
                          key={ch.id}
                          onClick={() => toggleChannel(ch.id)}
                          className={`flex items-center gap-3 px-4 py-4 rounded-xl border transition-all ${
                            isActive
                              ? `${ch.bgActive} border`
                              : 'bg-white/5 border-white/5 hover:border-white/10'
                          }`}
                        >
                          <Icon className={`w-5 h-5 ${ch.color}`} />
                          <span className={`text-sm font-medium ${isActive ? 'text-white' : 'text-white/50'}`}>{ch.label}</span>
                          {isActive && <Check className="w-4 h-4 text-emerald-400 ml-auto" />}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="mb-8">
                  <label className="text-sm text-white/60 block mb-3">Fecha estimada de entrega</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={e => setDeliveryDate(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-[#161625] border border-white/10 rounded-xl text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="bg-[#161625] rounded-xl p-6 border border-white/5">
                  <h3 className="text-sm font-bold text-white mb-4">Resumen del proyecto</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-white/30 uppercase">Nombre</p>
                      <p className="text-sm text-white font-medium">{nombre}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/30 uppercase">Tipo</p>
                      <p className="text-sm text-white font-medium">{tipo}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/30 uppercase">Equipo</p>
                      <div className="flex -space-x-2 mt-1">
                        {selectedTeam.map((m, i) => (
                          <div key={i} className={`w-7 h-7 rounded-full bg-gradient-to-br ${m.color} flex items-center justify-center text-[9px] text-white font-bold border-2 border-[#161625]`}>
                            {m.iniciales}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/30 uppercase">Canales</p>
                      <div className="flex gap-2 mt-1">
                        {selectedChannels.map(ch => {
                          const channel = CHANNELS.find(c => c.id === ch)
                          if (!channel) return null
                          const Icon = channel.icon
                          return (
                            <span key={ch} className="flex items-center gap-1 text-xs text-white/50">
                              <Icon className={`w-3.5 h-3.5 ${channel.color}`} />
                              {channel.label}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                    {deliveryDate && (
                      <div>
                        <p className="text-[10px] text-white/30 uppercase">Entrega</p>
                        <p className="text-sm text-white font-medium">{new Date(deliveryDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                      </div>
                    )}
                    {descripcion && (
                      <div className="col-span-2">
                        <p className="text-[10px] text-white/30 uppercase">Descripción</p>
                        <p className="text-sm text-white/60">{descripcion}</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="border-t border-white/5 px-8 py-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <button
              onClick={() => step === 1 ? onNavigate('proyectos') : setStep(step - 1)}
              className="flex items-center gap-2 px-4 py-2.5 border border-white/10 rounded-xl text-sm text-white/60 hover:text-white hover:border-white/20 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              {step === 1 ? 'Cancelar' : 'Atrás'}
            </button>

            <span className="text-sm text-white/30">Paso {step} de 3</span>

            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canAdvance()}
                className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-violet-600"
              >
                Siguiente
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-50"
              >
                {creating ? 'Creando...' : 'Crear proyecto'}
                {!creating && <Check className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
