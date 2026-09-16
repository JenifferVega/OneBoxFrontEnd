import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from 'react-oidc-context'
import { useTranslation } from 'react-i18next'
import { api } from '../services/api'
import {
  Search, ArrowLeft, CheckCircle2, AlertTriangle, Clock, Settings,
  MessageCircle, Mail, Users, Hash, ChevronRight, Sparkles, X,
  FolderKanban, Zap, Eye, Shield, TrendingUp, AlertCircle,
  Phone, Send, Bell, Trash2, Loader2, UserPlus, Ban, Unlock, Plus, Pencil, Calendar
} from 'lucide-react'
import { PageType } from '../App'
// ChannelsPanel — import commented out. The component still lives in
// src/components/ ready to enable from 'Settings / Integrations' when
// Gmail/WhatsApp go into real use. See note in the dashboard sidebar.
// import ChannelsPanel from './ChannelsPanel'
import ProjectInsightsSidebar from './ProjectInsightsSidebar'
import ProjectGantt from './ProjectGantt'
import ProjectAttachments from './ProjectAttachments'

interface ProjectTeamMember {
  name: string; initials: string; role: string; email: string; phone: string; color: string; tasks: number;
}
interface ProjectChannel {
  name: string; icon: string; lastActivity: string; unread: number;
}
interface ProjectTask {
  id: string; text: string; status: string; description: string;
  assignedTo: { name: string; initials: string; color: string };
  overdue?: boolean;
  blockedReason?: string;
  startDate?: string;
  dueDate?: string;
  // Subtasks (1 level)
  parentTaskId?: string;       // '' or missing = root
  subtasksCount?: number;      // only on parents
  subtasksDone?: number;       // only on parents
  tags?: string[];
}
interface ProjectAction {
  id: string; detected: string; executed: string; channel: string; channelIcon: string; time: string;
}
interface ProjectNotification {
  id: string; channel: string; recipient: string; message: string; status: string; time: string;
}
interface Project {
  projectId: string; name: string; client: string; description: string;
  status: string; sla: string; type: string;
  deliveryDate: string; daysLeft: number; progress: number; progressBlockedReason?: string; timing?: string;
  done: number; pending: number; blocked: number; aiMessages: number;
  lastAction: { detected: string; action: string };
  team: ProjectTeamMember[]; channels: ProjectChannel[];
  labels: { name: string; color: string }[];
  slaMetrics: { clientResponse: string; unassignedTasks: number; partnerResponse: string; tasksBlocked24h: number };
  startDate: string; tasks: ProjectTask[]; aiActions: ProjectAction[];
  notifications?: ProjectNotification[];
  // Permissions computed by the backend:
  isOwner?: boolean;            // true → owner; false → invited
  role?: 'owner' | 'invitedByEmail' | 'invitedByLink' | 'collaborator';
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

// Badges: only the visual classes live in the static config. The label is
// resolved by `t()` to respect the current language without duplicating the map.
const SLA_STYLES: Record<string, { color: string; dot: string; key: string }> = {
  on_track:    { color: 'text-emerald-400', dot: 'bg-emerald-400', key: 'onTrack' },
  at_risk:     { color: 'text-orange-400',  dot: 'bg-orange-400',  key: 'atRisk' },
  sla_overdue: { color: 'text-red-400',     dot: 'bg-red-400',     key: 'overdue' },
  paused:      { color: 'text-white/40',    dot: 'bg-white/40',    key: 'paused' },
  delivered:   { color: 'text-emerald-400', dot: 'bg-emerald-400', key: 'delivered' },
}

const SLABadge = ({ sla }: { sla: string }) => {
  const { t } = useTranslation()
  const c = SLA_STYLES[sla] || SLA_STYLES.on_track
  return (
    <span className={`flex items-center gap-1.5 text-xs font-semibold ${c.color}`}>
      <span className={`w-2 h-2 rounded-full ${c.dot}`} />
      {t(`projects.sla.${c.key}`)}
    </span>
  )
}

const STATUS_STYLES: Record<string, { color: string; bg: string; border: string; key: string }> = {
  active:   { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', key: 'active' },
  paused:   { color: 'text-white/50',    bg: 'bg-white/5',        border: 'border-white/10',       key: 'paused' },
  finished: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', key: 'finished' },
}

const StatusBadge = ({ status }: { status: string }) => {
  const { t } = useTranslation()
  const c = STATUS_STYLES[status] || STATUS_STYLES.active
  return (
    <span className={`flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${c.color} ${c.bg} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'active' ? 'bg-emerald-400' : status === 'finished' ? 'bg-emerald-400' : 'bg-white/40'}`} />
      {t(`projects.status.${c.key}`)}
    </span>
  )
}

interface ProjectsProps {
  onNavigate: (page: PageType) => void
  gmailConnected: boolean
  /** When it increments, the component returns to the list (leaves a project if it's inside one). */
  resetSignal?: number
}

export default function Projects({ onNavigate, gmailConnected, resetSignal }: ProjectsProps) {
  const auth = useAuth()
  const { t } = useTranslation()
  const token = auth.user?.access_token || ''

  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  // Global filter: shows all tasks from every project in a specific state
  const [globalTaskFilter, setGlobalTaskFilter] = useState<'completed' | 'pending' | 'blocked' | null>(null)
  const [loading, setLoading] = useState(true)
  // Bulk edit of team contacts (email + phone).
  // Previously only phones could be edited. Now both fields per member.
  const [editingPhones, setEditingPhones] = useState(false)
  const [phoneEdits, setPhoneEdits] = useState<Record<string, string>>({})
  const [emailEdits, setEmailEdits] = useState<Record<string, string>>({})
  const [savingPhones, setSavingPhones] = useState(false)
  const [taskFilter, setTaskFilter] = useState<'all' | 'completed' | 'pending' | 'blocked'>('all')
  // Assignee filter: when set, the project task list is filtered by
  // assignedTo.name === assigneeFilter. Activated by clicking a row of the
  // team panel (right). Turned off by clicking the same row or the "Clear
  // filter" button that appears above the list.
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null)
  // Expand of the sidebar summary mini-panel when the person has >8 tasks.
  // Collapsed (default) shows 8; expanded shows all.
  const [assigneeSummaryExpanded, setAssigneeSummaryExpanded] = useState(false)
  const [showAllTasks, setShowAllTasks] = useState(false)
  const [projectSearch, setProjectSearch] = useState('')
  const [showAllActions, setShowAllActions] = useState(false)
  const [deletingProject, setDeletingProject] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null)
  // "Edit project" modal — UPDATE of basic fields (name, description,
  // type, status, deliveryDate, timing). Only accessible for the owner.
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [projectEditForm, setProjectEditForm] = useState({
    name: '', description: '', type: '', status: 'active' as 'active' | 'paused' | 'finished',
    deliveryDate: '', timing: '',
  })
  const [savingProjectEdit, setSavingProjectEdit] = useState(false)
  const [projectEditError, setProjectEditError] = useState('')
  // Add participant (fix #11)
  // (state addingMember/newMember/savingMember removed — the flow to add a
  // participant now lives in the unified inviteModalOpen modal)
  // Manual task blocking (with reason)
  const [blockingTaskId, setBlockingTaskId] = useState<string | null>(null)
  const [blockReason, setBlockReason] = useState('')
  const [savingBlock, setSavingBlock] = useState(false)
  // Task CRUD (create/edit/delete)
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)  // null = create, string = edit
  const [taskForm, setTaskForm] = useState({ text: '', description: '', status: 'pending', assignedTo: '', startDate: '', dueDate: '', parentTaskId: '' })
  const [savingTask, setSavingTask] = useState(false)
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<ProjectTask | null>(null)
  const [deletingTask, setDeletingTask] = useState(false)
  // Unified add/invite modal (replaces the 3 old buttons).
  // The form asks for name, role, email and/or phone, and a checkbox to send the invitation.
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteForm, setInviteForm] = useState({
    name: '',
    role: '',
    email: '',
    phone: '',
    sendNotification: true,
  })
  const [sendingInvite, setSendingInvite] = useState(false)
  const [inviteResultMsg, setInviteResultMsg] = useState('')
  const [inviteError, setInviteError] = useState('')
  // share_url returned by the backend when Cognito did NOT send an automatic
  // email (the invitee already exists as EXTERNAL_PROVIDER or CONFIRMED).
  // The inviter copies this link and sends it manually via WhatsApp / Slack / etc.
  const [inviteShareUrl, setInviteShareUrl] = useState('')
  const [shareUrlCopied, setShareUrlCopied] = useState(false)
  // Participant removal: stores the ProjectTeamMember to confirm
  const [removeMemberTarget, setRemoveMemberTarget] = useState<ProjectTeamMember | null>(null)
  const [removingMember, setRemovingMember] = useState(false)

  const userId = auth.user?.profile?.sub || ''

  // Reset the view when the navbar sends a signal (user clicks "Projects" from within one)
  useEffect(() => {
    if (resetSignal !== undefined && resetSignal > 0) {
      setSelectedProject(null)
      setTaskFilter('all')
      setShowAllTasks(false)
      setShowAllActions(false)
      setSearch('')
      setStatusFilter('all')
      setProjectSearch('')
      setGlobalTaskFilter(null)
    }
  }, [resetSignal])

  useEffect(() => {
    if (!token || !userId) return
    const fetchProjects = async () => {
      try {
        setLoading(true)
        // Load projects first to show the UI quickly
        const data = await api.getProjects(token)
        if (Array.isArray(data)) {
          setProjects(data)
        }
        // Then, in the background, sync Gmail (does not block the UI)
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
        fetch(`${API_URL}/api/scheduled/gmail-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-id': userId }
        }).catch(() => {})
      } catch (err) {
        console.warn('[Projects] Error loading projects from the API:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchProjects()
  }, [token, userId])

  const stats = useMemo(() => {
    const active = projects.filter(p => p.status === 'active').length
    const totalTasksCompleted = projects.reduce((s, p) => s + p.done, 0)
    const totalTasksPending = projects.reduce((s, p) => s + p.pending, 0)
    const totalTasksBlocked = projects.reduce((s, p) => s + p.blocked, 0)
    const totalMessages = projects.reduce((s, p) => s + p.aiMessages, 0)
    return { total: projects.length, active, totalTasksCompleted, totalTasksPending, totalTasksBlocked, totalMessages }
  }, [projects])

  const filteredProjects = useMemo(() => {
    let result = projects
    if (search) result = result.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.client.toLowerCase().includes(search.toLowerCase()))
    switch (statusFilter) {
      case 'active': result = result.filter(p => p.status === 'active'); break
      case 'at_risk': result = result.filter(p => p.sla === 'at_risk'); break
      case 'overdue': result = result.filter(p => p.sla === 'sla_overdue'); break
      case 'paused': result = result.filter(p => p.status === 'paused'); break
    }
    return result
  }, [projects, statusFilter, search])

  const progressColor = (sla: string) => {
    if (sla === 'sla_overdue') return 'bg-red-500'
    if (sla === 'at_risk') return 'bg-orange-500'
    return 'bg-emerald-500'
  }

  // Project delete handler
  const handleDeleteProject = async (projectId: string) => {
    if (!token) return
    try {
      setDeletingProject(projectId)
      await api.deleteProject(projectId, token)
      // Refresh list
      const data = await api.getProjects(token)
      if (Array.isArray(data)) setProjects(data)
      // Return to the list
      setSelectedProject(null)
      setConfirmDelete(null)
    } catch (err) {
      console.error('[Projects] Error deleting project:', err)
      alert('Could not delete the project. Please try again.')
    } finally {
      setDeletingProject(null)
    }
  }

  if (selectedProject) {
    const p = selectedProject
    const totalTasks = p.done + p.pending + p.blocked
    const projectChannels = (p.channels || []).map(c => typeof c === 'string' ? c : (c as any).name).filter(Boolean)

    // Search within the project: filters tasks + AI actions by term
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
        {/* Delete confirmation modal */}
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
                  <h3 className="text-lg font-bold text-white">{t('projects.modals.delete.title')}</h3>
                  <p className="text-sm text-white/60 mt-1">
                    {(() => {
                      const raw = t('projects.modals.delete.prompt', { name: confirmDelete.name })
                      const parts = raw.split(/<1>|<\/1>|<2>|<\/2>/)
                      // parts: [before, name, middle, warning, after]
                      return (
                        <>
                          {parts[0]}
                          <strong className="text-white">{parts[1]}</strong>
                          {parts[2]}
                          <strong className="text-red-400">{parts[3]}</strong>
                          {parts[4]}
                        </>
                      )
                    })()}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 mt-6">
                <button
                  onClick={() => setConfirmDelete(null)}
                  disabled={!!deletingProject}
                  className="px-4 py-2 text-sm text-white/70 hover:text-white rounded-lg hover:bg-white/5 transition-all disabled:opacity-50"
                >
                  {t('projects.modals.cancel')}
                </button>
                <button
                  onClick={() => handleDeleteProject(confirmDelete.projectId)}
                  disabled={!!deletingProject}
                  className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {deletingProject ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('projects.modals.delete.deleting')}
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      {t('projects.modals.delete.confirm')}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: edit project (owner-only).
            Allows changing: name, description, type, status, deliveryDate, timing.
            Calls PUT /api/projects/{id} with ONLY the modified fields. */}
        {editingProject && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !savingProjectEdit && setEditingProject(null)}>
            <div className="bg-[#12121E] border border-white/10 rounded-2xl p-6 max-w-lg w-full" onClick={e => e.stopPropagation()}>
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <Pencil className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{t('projects.modals.edit.title')}</h3>
                  <p className="text-sm text-white/60 mt-1">
                    {t('projects.modals.edit.subtitle')}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-white/60">{t('projects.modals.edit.name')}</label>
                  <input
                    type="text"
                    value={projectEditForm.name}
                    onChange={e => setProjectEditForm({ ...projectEditForm, name: e.target.value })}
                    disabled={savingProjectEdit}
                    autoFocus
                    className="w-full mt-1 px-3 py-2 bg-[#0E0E18] border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/60">{t('projects.modals.edit.description')}</label>
                  <textarea
                    value={projectEditForm.description}
                    onChange={e => setProjectEditForm({ ...projectEditForm, description: e.target.value })}
                    rows={3}
                    disabled={savingProjectEdit}
                    className="w-full mt-1 px-3 py-2 bg-[#0E0E18] border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500 disabled:opacity-50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/60">{t('projects.modals.edit.type')}</label>
                    <input
                      type="text"
                      value={projectEditForm.type}
                      onChange={e => setProjectEditForm({ ...projectEditForm, type: e.target.value })}
                      disabled={savingProjectEdit}
                      placeholder={t('projects.modals.edit.typePlaceholder')}
                      className="w-full mt-1 px-3 py-2 bg-[#0E0E18] border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/60">{t('projects.modals.edit.status')}</label>
                    <select
                      value={projectEditForm.status}
                      onChange={e => setProjectEditForm({ ...projectEditForm, status: e.target.value as any })}
                      disabled={savingProjectEdit}
                      className="w-full mt-1 px-3 py-2 bg-[#0E0E18] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500 disabled:opacity-50"
                    >
                      <option value="active">{t('projects.modals.edit.statusActive')}</option>
                      <option value="paused">{t('projects.modals.edit.statusPaused')}</option>
                      <option value="finished">{t('projects.modals.edit.statusFinished')}</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/60 flex items-center gap-1"><Calendar className="w-3 h-3" /> {t('projects.modals.edit.deliveryDate')}</label>
                    <input
                      type="date"
                      value={projectEditForm.deliveryDate}
                      onChange={e => setProjectEditForm({ ...projectEditForm, deliveryDate: e.target.value })}
                      disabled={savingProjectEdit}
                      className="w-full mt-1 px-3 py-2 bg-[#0E0E18] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/60">{t('projects.modals.edit.timing')}</label>
                    <input
                      type="text"
                      value={projectEditForm.timing}
                      onChange={e => setProjectEditForm({ ...projectEditForm, timing: e.target.value })}
                      disabled={savingProjectEdit}
                      placeholder={t('projects.modals.edit.timingPlaceholder')}
                      className="w-full mt-1 px-3 py-2 bg-[#0E0E18] border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500 disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>

              {projectEditError && (
                <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-sm text-red-400">{projectEditError}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setEditingProject(null)}
                  disabled={savingProjectEdit}
                  className="px-4 py-2 text-sm text-white/70 hover:text-white rounded-lg hover:bg-white/5 disabled:opacity-50"
                >
                  {t('projects.modals.cancel')}
                </button>
                <button
                  disabled={savingProjectEdit || !projectEditForm.name.trim()}
                  onClick={async () => {
                    if (!editingProject) return
                    setSavingProjectEdit(true)
                    setProjectEditError('')
                    try {
                      // Only send fields that CHANGED relative to the original
                      // project. This avoids unnecessary writes to DDB and
                      // lets the endpoint behave as a de-facto PATCH.
                      const orig = editingProject
                      const updates: any = {}
                      if (projectEditForm.name.trim() !== (orig.name || '').trim())
                        updates.name = projectEditForm.name.trim()
                      if (projectEditForm.description.trim() !== (orig.description || '').trim())
                        updates.description = projectEditForm.description.trim()
                      if (projectEditForm.type.trim() !== (orig.type || '').trim())
                        updates.type = projectEditForm.type.trim()
                      if (projectEditForm.status !== orig.status)
                        updates.status = projectEditForm.status
                      if (projectEditForm.deliveryDate !== (orig.deliveryDate || ''))
                        updates.deliveryDate = projectEditForm.deliveryDate
                      if (projectEditForm.timing.trim() !== (orig.timing || '').trim())
                        updates.timing = projectEditForm.timing.trim()

                      if (Object.keys(updates).length === 0) {
                        setEditingProject(null)
                        return
                      }

                      await api.updateProject(editingProject.projectId, updates, token)
                      // Refresh the list to reflect the change in the UI.
                      const data = await api.getProjects(token)
                      if (Array.isArray(data)) {
                        setProjects(data)
                        const updated = data.find((proj: Project) => proj.projectId === editingProject.projectId)
                        if (updated) setSelectedProject(updated)
                      }
                      setEditingProject(null)
                    } catch (err: any) {
                      setProjectEditError(err?.message?.substring(0, 200) || t('projects.modals.edit.error'))
                    } finally {
                      setSavingProjectEdit(false)
                    }
                  }}
                  className="px-4 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {savingProjectEdit && <Loader2 className="w-4 h-4 animate-spin" />}
                  {savingProjectEdit ? t('projects.modals.edit.saving') : t('projects.modals.edit.save')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* New/Edit task modal */}
        {taskModalOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !savingTask && setTaskModalOpen(false)}
          >
            <div className="bg-[#12121E] border border-white/10 rounded-2xl p-6 max-w-lg w-full" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-white mb-4">{editingTaskId ? t('projects.modals.task.titleEdit') : t('projects.modals.task.titleNew')}</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-white/60">{t('projects.modals.task.text')}</label>
                  <input type="text" value={taskForm.text} onChange={e => setTaskForm({ ...taskForm, text: e.target.value })}
                    placeholder={t('projects.modals.task.textPlaceholder')} autoFocus
                    className="w-full mt-1 px-3 py-2 bg-[#0E0E18] border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500" />
                </div>
                <div>
                  <label className="text-xs text-white/60">{t('projects.modals.task.description')}</label>
                  <textarea value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })}
                    rows={2} placeholder={t('projects.modals.task.descriptionPlaceholder')}
                    className="w-full mt-1 px-3 py-2 bg-[#0E0E18] border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/60">{t('projects.modals.task.status')}</label>
                    <select value={taskForm.status} onChange={e => setTaskForm({ ...taskForm, status: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-[#0E0E18] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500">
                      <option value="pending">{t('projects.modals.task.statusPending')}</option>
                      <option value="in_progress">{t('projects.modals.task.statusInProgress')}</option>
                      <option value="blocked">{t('projects.modals.task.statusBlocked')}</option>
                      <option value="done">{t('projects.modals.task.statusDone')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-white/60">{t('projects.modals.task.assignTo')}</label>
                    <select value={taskForm.assignedTo} onChange={e => setTaskForm({ ...taskForm, assignedTo: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-[#0E0E18] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500">
                      <option value="">{t('projects.modals.task.unassigned')}</option>
                      {(selectedProject?.team || []).map((m, i) => (
                        <option key={i} value={m.name}>{m.name}{m.role ? ` (${m.role})` : ''}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/60 flex items-center gap-1"><Calendar className="w-3 h-3" /> {t('projects.modals.task.startDate')}</label>
                    <input type="date" value={taskForm.startDate} onChange={e => setTaskForm({ ...taskForm, startDate: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-[#0E0E18] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500" />
                  </div>
                  <div>
                    <label className="text-xs text-white/60 flex items-center gap-1"><Calendar className="w-3 h-3" /> {t('projects.modals.task.endDate')}</label>
                    <input type="date" value={taskForm.dueDate} onChange={e => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-[#0E0E18] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500" />
                  </div>
                </div>
                {/* Subtask of: dropdown with the project's root tasks (1 level). */}
                <div>
                  <label className="text-xs text-white/60">{t('projects.modals.task.parentTask')}</label>
                  <select
                    value={taskForm.parentTaskId}
                    onChange={e => setTaskForm({ ...taskForm, parentTaskId: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-[#0E0E18] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500"
                  >
                    <option value="">{t('projects.modals.task.noParent')}</option>
                    {(selectedProject?.tasks || [])
                      .filter(t => !t.parentTaskId && t.id !== editingTaskId)
                      .map(t => (
                        <option key={t.id} value={t.id}>{t.text}</option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setTaskModalOpen(false)} disabled={savingTask}
                  className="px-4 py-2 text-sm text-white/70 hover:text-white rounded-lg hover:bg-white/5 disabled:opacity-50">{t('projects.modals.cancel')}</button>
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
                        parent_task_id: taskForm.parentTaskId || '',
                      }
                      if (editingTaskId) {
                        await api.updateTask(editingTaskId, { ...payload, projectId: p.projectId }, token)
                      } else {
                        await api.createTask(p.projectId, payload, token)
                      }
                      const data = await api.getProjects(token)
                      if (Array.isArray(data)) {
                        setProjects(data)
                        const updated = data.find((proj: Project) => proj.projectId === p.projectId)
                        if (updated) setSelectedProject(updated)
                      }
                      setTaskModalOpen(false)
                    } catch (err) { console.error('Error saving task:', err) }
                    finally { setSavingTask(false) }
                  }}
                  className="px-4 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {savingTask && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingTaskId ? t('projects.modals.task.save') : t('projects.modals.task.create')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm task deletion */}
        {confirmDeleteTask && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !deletingTask && setConfirmDeleteTask(null)}>
            <div className="bg-[#12121E] border border-white/10 rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white">{t('projects.modals.deleteTask.title')}</h3>
                  <p className="text-sm text-white/60 mt-1">
                    {(() => {
                      const raw = t('projects.modals.deleteTask.prompt', { text: confirmDeleteTask.text })
                      const parts = raw.split(/<1>|<\/1>|<2>|<\/2>/)
                      return (
                        <>
                          {parts[0]}
                          <strong className="text-white">{parts[1]}</strong>
                          {parts[2]}
                          <strong className="text-red-400">{parts[3]}</strong>
                          {parts[4]}
                        </>
                      )
                    })()}
                  </p>
                  {(confirmDeleteTask.subtasksCount || 0) > 0 && (
                    <p className="text-xs text-amber-300/80 mt-3 bg-amber-500/10 border border-amber-500/20 rounded-md p-2">
                      {(() => {
                        const raw = t('projects.modals.deleteTask.subtasksWarning', { count: confirmDeleteTask.subtasksCount })
                        const parts = raw.split(/<1>|<\/1>/)
                        return (
                          <>
                            {parts[0]}
                            <strong>{parts[1]}</strong>
                            {parts[2]}
                          </>
                        )
                      })()}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6 flex-wrap">
                <button onClick={() => setConfirmDeleteTask(null)} disabled={deletingTask}
                  className="px-4 py-2 text-sm text-white/70 hover:text-white rounded-lg hover:bg-white/5 disabled:opacity-50">{t('projects.modals.cancel')}</button>
                {(confirmDeleteTask.subtasksCount || 0) > 0 && (
                  <button
                    disabled={deletingTask}
                    onClick={async () => {
                      if (!confirmDeleteTask) return
                      setDeletingTask(true)
                      try {
                        await api.deleteTask(confirmDeleteTask.id, token, false)  // cascade=false: orphans get promoted to root
                        const data = await api.getProjects(token)
                        if (Array.isArray(data)) {
                          setProjects(data)
                          const updated = data.find((proj: Project) => proj.projectId === p.projectId)
                          if (updated) setSelectedProject(updated)
                        }
                        setConfirmDeleteTask(null)
                      } catch (err) { console.error('Error deleting task (no cascade):', err) }
                      finally { setDeletingTask(false) }
                    }}
                    className="px-3 py-2 text-sm font-medium bg-amber-600/80 hover:bg-amber-600 text-white rounded-lg disabled:opacity-50"
                  >
                    {t('projects.modals.deleteTask.keepSubtasks')}
                  </button>
                )}
                <button
                  disabled={deletingTask}
                  onClick={async () => {
                    if (!confirmDeleteTask) return
                    setDeletingTask(true)
                    try {
                      // cascade=true when there are subtasks → delete the whole tree.
                      const hasChildren = (confirmDeleteTask.subtasksCount || 0) > 0
                      await api.deleteTask(confirmDeleteTask.id, token, hasChildren)
                      const data = await api.getProjects(token)
                      if (Array.isArray(data)) {
                        setProjects(data)
                        const updated = data.find((proj: Project) => proj.projectId === p.projectId)
                        if (updated) setSelectedProject(updated)
                      }
                      setConfirmDeleteTask(null)
                    } catch (err) { console.error('Error deleting task:', err) }
                    finally { setDeletingTask(false) }
                  }}
                  className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {deletingTask ? (<><Loader2 className="w-4 h-4 animate-spin" /> {t('projects.modals.deleteTask.deleting')}</>) : (
                    <><Trash2 className="w-4 h-4" /> {(confirmDeleteTask.subtasksCount || 0) > 0 ? t('projects.modals.deleteTask.confirmAll') : t('projects.modals.deleteTask.confirmSingle')}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirm participant removal modal */}
        {removeMemberTarget && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !removingMember && setRemoveMemberTarget(null)}>
            <div className="bg-[#12121E] border border-white/10 rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <X className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{t('projects.modals.removeMember.title', { name: removeMemberTarget.name })}</h3>
                  <p className="text-sm text-white/60 mt-1">
                    {(() => {
                      const raw = t('projects.modals.removeMember.subtitle', { project: p.name })
                      const parts = raw.split(/<1>|<\/1>/)
                      return (<>{parts[0]}<strong className="text-white">{parts[1]}</strong>{parts[2]}</>)
                    })()}
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-sm text-white/70 mb-6 pl-2">
                <div className="flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">·</span>
                  <span>{(() => {
                    const raw = t('projects.modals.removeMember.bullet1')
                    const parts = raw.split(/<1>|<\/1>/)
                    return (<>{parts[0]}<strong>{parts[1]}</strong>{parts[2]}</>)
                  })()}</span>
                </div>
                {removeMemberTarget.email && (
                  <div className="flex items-start gap-2">
                    <span className="text-amber-400 mt-0.5">·</span>
                    <span>{(() => {
                      const raw = t('projects.modals.removeMember.bullet2')
                      const parts = raw.split(/<1>|<\/1>/)
                      return (<>{parts[0]}<strong>{parts[1]}</strong>{parts[2]}</>)
                    })()}</span>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <span className="text-white/40 mt-0.5">·</span>
                  <span className="text-white/40">{t('projects.modals.removeMember.bullet3')}</span>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setRemoveMemberTarget(null)} disabled={removingMember}
                  className="px-4 py-2 text-sm text-white/70 hover:text-white rounded-lg hover:bg-white/5 disabled:opacity-50">
                  {t('projects.modals.cancel')}
                </button>
                <button
                  disabled={removingMember}
                  onClick={async () => {
                    if (!removeMemberTarget) return
                    setRemovingMember(true)
                    try {
                      await api.removeParticipant(p.projectId, {
                        email: removeMemberTarget.email || '',
                        phone: removeMemberTarget.phone || '',
                        name: removeMemberTarget.name || '',
                      }, token)
                      // Refresh projects
                      const data = await api.getProjects(token)
                      if (Array.isArray(data)) {
                        setProjects(data)
                        const updated = data.find((proj: Project) => proj.projectId === p.projectId)
                        if (updated) setSelectedProject(updated)
                      }
                      setRemoveMemberTarget(null)
                    } catch (err) {
                      console.error('Error removing participant:', err)
                    } finally {
                      setRemovingMember(false)
                    }
                  }}
                  className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {removingMember ? (<><Loader2 className="w-4 h-4 animate-spin" /> {t('projects.modals.removeMember.removing')}</>) : (<><Trash2 className="w-4 h-4" /> {t('projects.modals.removeMember.confirm')}</>)}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Unified modal: Add + Invite (email/WhatsApp).
            Replaces the 3 buttons that used to exist (Add / Invite / WhatsApp).
            - email and/or phone (at least one).
            - checkbox to send notification (email + WhatsApp) or just register the contact.
        */}
        {inviteModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !sendingInvite && setInviteModalOpen(false)}>
            <div className="bg-[#12121E] border border-white/10 rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <UserPlus className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{t('projects.modals.invite.title')}</h3>
                  <p className="text-sm text-white/60 mt-1">
                    {t('projects.modals.invite.subtitle')}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/60">{t('projects.modals.invite.name')}</label>
                    <input type="text" value={inviteForm.name} onChange={e => setInviteForm({ ...inviteForm, name: e.target.value })}
                      placeholder={t('projects.modals.invite.namePlaceholder')} autoFocus disabled={sendingInvite}
                      className="w-full mt-1 px-3 py-2 bg-[#0E0E18] border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500 disabled:opacity-50" />
                  </div>
                  <div>
                    <label className="text-xs text-white/60">{t('projects.modals.invite.role')}</label>
                    <input type="text" value={inviteForm.role} onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })}
                      placeholder={t('projects.modals.invite.rolePlaceholder')} disabled={sendingInvite}
                      className="w-full mt-1 px-3 py-2 bg-[#0E0E18] border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet-500 disabled:opacity-50" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white/60 flex items-center gap-1.5"><Mail className="w-3 h-3 text-sky-400" /> Email</label>
                  <input type="email" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                    placeholder={t('projects.modals.invite.emailPlaceholder')} disabled={sendingInvite}
                    className="w-full mt-1 px-3 py-2 bg-[#0E0E18] border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-sky-500 disabled:opacity-50" />
                  <p className="text-[10px] text-white/30 mt-0.5">{t('projects.modals.invite.emailHint')}</p>
                </div>
                {/* WhatsApp hidden — we only work with email for now. */}
                <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer select-none pt-1">
                  <input type="checkbox" checked={inviteForm.sendNotification}
                    onChange={e => setInviteForm({ ...inviteForm, sendNotification: e.target.checked })}
                    disabled={sendingInvite}
                    className="w-4 h-4 rounded border-white/20 bg-[#0E0E18] text-violet-500 focus:ring-violet-500 focus:ring-offset-0" />
                  {t('projects.modals.invite.sendNow')}
                  <span className="text-[10px] text-white/40">{t('projects.modals.invite.sendNowHint')}</span>
                </label>
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
              {/* "Share link" box — appears ONLY when the backend detects
                  that Cognito did not send an email (because the invitee
                  already had an account as EXTERNAL_PROVIDER from Google
                  or CONFIRMED). We give the inviter the direct link so
                  they can notify the person themselves via WhatsApp /
                  Slack / manual email. */}
              {inviteShareUrl && (
                <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-2">
                  <p className="text-xs text-amber-200/90 font-medium">
                    {t('projects.modals.invite.sharePrompt')}
                  </p>
                  <div className="flex items-stretch gap-2">
                    <input
                      readOnly
                      value={inviteShareUrl}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      className="flex-1 min-w-0 px-2.5 py-1.5 bg-[#0E0E18] border border-amber-500/20 rounded-md text-xs text-white/80 font-mono outline-none"
                    />
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(inviteShareUrl)
                          setShareUrlCopied(true)
                          setTimeout(() => setShareUrlCopied(false), 2000)
                        } catch {
                          // Fallback: manual selection
                        }
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        shareUrlCopied
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {shareUrlCopied ? t('projects.modals.invite.copied') : t('projects.modals.invite.copy')}
                    </button>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setInviteModalOpen(false)} disabled={sendingInvite}
                  className="px-4 py-2 text-sm text-white/70 hover:text-white rounded-lg hover:bg-white/5 disabled:opacity-50">
                  {inviteResultMsg ? t('projects.modals.close') : t('projects.modals.cancel')}
                </button>
                {!inviteResultMsg && (
                  <button
                    disabled={
                      sendingInvite ||
                      !inviteForm.name.trim() ||
                      (!inviteForm.email.trim() && !inviteForm.phone.trim())
                    }
                    onClick={async () => {
                      setSendingInvite(true); setInviteError(''); setInviteResultMsg('')
                      try {
                        const res = await api.inviteUserToProject(p.projectId, {
                          email: inviteForm.email.trim().toLowerCase(),
                          phone: inviteForm.phone.trim(),
                          name: inviteForm.name.trim(),
                          role: inviteForm.role.trim() || t('projects.modals.invite.defaultRole'),
                          sendNotification: inviteForm.sendNotification,
                        }, token)
                        // Compose message according to what was done
                        const parts: string[] = []
                        if (res?.notified) {
                          if (res?.email?.success === false) parts.push(t('projects.modals.invite.resultEmailFailed', { error: res.email.error }))
                          else if (inviteForm.email) {
                            // The backend sets needs_manual_share=true when SES
                            // could not deliver (bounce, invalid domain, temporary error).
                            if (res?.email?.needs_manual_share) {
                              parts.push(t('projects.modals.invite.resultEmailUndelivered'))
                            } else {
                              parts.push(t('projects.modals.invite.resultEmailSent'))
                            }
                          }
                          /* WhatsApp hidden — we don't show result messages
                             even if the backend eventually sends something. */
                        } else {
                          parts.push(t('projects.modals.invite.resultNoNotify'))
                        }
                        setInviteResultMsg(parts.join(' · ') || t('projects.modals.invite.resultDone'))
                        // Save share_url if the backend sends it
                        if (res?.email?.share_url) {
                          setInviteShareUrl(res.email.share_url)
                          setShareUrlCopied(false)
                        } else {
                          setInviteShareUrl('')
                        }
                        // Refresh list
                        const data = await api.getProjects(token)
                        if (Array.isArray(data)) {
                          setProjects(data)
                          const updated = data.find((proj: Project) => proj.projectId === p.projectId)
                          if (updated) setSelectedProject(updated)
                        }
                      } catch (err: any) {
                        setInviteError(err?.message?.substring(0, 200) || t('projects.modals.invite.errorSaving'))
                      } finally { setSendingInvite(false) }
                    }}
                    className="px-4 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
                  >
                    {sendingInvite ? (<><Loader2 className="w-4 h-4 animate-spin" /> {t('projects.modals.invite.saving')}</>) : (<><UserPlus className="w-4 h-4" /> {inviteForm.sendNotification ? t('projects.modals.invite.addAndInvite') : t('projects.modals.invite.onlyAdd')}</>)}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Left sidebar - AI insights + project channels */}
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
              <button onClick={() => setSelectedProject(null)} className="hover:text-white/70 transition-colors">{t('nav.projects')}</button>
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
                    <Clock className="w-3.5 h-3.5" /> {t('projects.detail.daysLeft', { count: p.daysLeft })}
                  </span>
                )}
                {/* Owner-only: edit project (name, description, type,
                    status, dates). Appears next to delete and shares the
                    isOwner check. */}
                {p.isOwner !== false && (
                  <button
                    onClick={() => {
                      setProjectEditForm({
                        name: p.name || '',
                        description: p.description || '',
                        type: p.type || '',
                        status: (p.status === 'paused' || p.status === 'finished'
                          ? p.status : 'active') as 'active' | 'paused' | 'finished',
                        deliveryDate: p.deliveryDate || '',
                        timing: p.timing || '',
                      })
                      setProjectEditError('')
                      setEditingProject(p)
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 hover:bg-violet-500/20 hover:border-violet-500/40 transition-all"
                    title={t('projects.detail.editTooltip')}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
                {/* Owner-only: only the project owner can delete it. */}
                {p.isOwner !== false && (
                  <button
                    onClick={() => setConfirmDelete(p)}
                    disabled={deletingProject === p.projectId}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:border-red-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title={t('projects.detail.deleteTooltip')}
                  >
                    {deletingProject === p.projectId ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    {t('projects.detail.delete')}
                  </button>
                )}
                {/* "Invited" badge so the role is visible at a glance. */}
                {p.isOwner === false && (
                  <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300" title={t('projects.detail.invitedTooltip')}>
                    👤 {t('projects.detail.invitedBadge')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* In-project search */}
          <div className="mb-5">
            <div className="relative">
              <Search className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={projectSearch}
                onChange={e => setProjectSearch(e.target.value)}
                placeholder={t('projects.detail.searchPlaceholder')}
                className="w-full pl-10 pr-10 py-2.5 bg-[#161625] border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition"
              />
              {isSearching && (
                <button
                  onClick={() => setProjectSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white/80 transition-colors"
                  title={t('projects.detail.clearSearch')}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {isSearching && (
              <div className="mt-2 flex items-center gap-3 text-xs text-white/50 flex-wrap">
                <span>{t('projects.detail.searching', { query: projectSearch })}</span>
                <span>·</span>
                <span><strong className="text-emerald-400">{matchingDone}</strong> {t('projects.detail.searchCompletedSuffix')}</span>
                <span>·</span>
                <span><strong className="text-amber-400">{matchingPending}</strong> {t('projects.detail.searchPendingSuffix')}</span>
                <span>·</span>
                <span><strong className="text-red-400">{matchingBlocked}</strong> {t('projects.detail.searchBlockedSuffix')}</span>
                <span>·</span>
                <span><strong className="text-violet-400">{matchingActions.length}</strong> {t('projects.detail.searchActionsSuffix')}</span>
              </div>
            )}
          </div>

          {/* GANTT VIEW — the first thing you see when entering the project.
              Switches automatically when you pick another project (each
              detail loads its own tasks). Click on a bar → opens the edit
              modal for that task (reuses the existing flow). */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                {t('projects.detail.ganttTitle')}
                <span className="text-[10px] font-normal text-white/40 px-2 py-0.5 bg-white/5 rounded-full">
                  {t('projects.detail.ganttSubtitle')}
                </span>
              </h2>
            </div>
            <ProjectGantt
              tasks={(p.tasks || []).map(t => ({
                id: t.id,
                text: t.text,
                status: t.status,
                startDate: t.startDate,
                dueDate: t.dueDate,
                assignedTo: typeof t.assignedTo === 'string'
                  ? t.assignedTo
                  : (t.assignedTo as any)?.name || '',
              }))}
              onTaskClick={(taskId) => {
                const task = (p.tasks || []).find(x => x.id === taskId)
                if (!task) return
                setEditingTaskId(taskId)
                setTaskForm({
                  text: task.text,
                  description: task.description || '',
                  status: task.status,
                  assignedTo: typeof task.assignedTo === 'string'
                    ? task.assignedTo
                    : (task.assignedTo as any)?.name || '',
                  startDate: task.startDate || '',
                  dueDate: task.dueDate || '',
                  parentTaskId: task.parentTaskId || '',
                })
                setTaskModalOpen(true)
              }}
            />
          </div>

          {/* Clickable stats row (task filter) */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { id: 'all',      label: t('projects.detail.stats.completed'),  value: isSearching ? matchingDone : p.done,             sub: isSearching ? t('projects.detail.stats.subOfMatches', { total: matchingTasks.length }) : t('projects.detail.stats.subOfTotal', { total: totalTasks }), color: 'text-emerald-400', filterValue: 'completed' },
              { id: 'pending',  label: t('projects.detail.stats.pending'),    value: isSearching ? matchingPending : p.pending,      sub: isSearching ? t('projects.detail.stats.subMatching') : t('projects.detail.stats.subDueToday', { count: p.tasks.filter(x => x.tags?.includes('Alta prioridad')).length || 0 }), color: 'text-amber-400', filterValue: 'pending' },
              { id: 'blocked',  label: t('projects.detail.stats.blocked'),    value: isSearching ? matchingBlocked : p.blocked,      sub: isSearching ? t('projects.detail.stats.subMatching') : t('projects.detail.stats.subRequireAction'), color: 'text-red-400', filterValue: 'blocked' },
              { id: 'messages', label: t('projects.detail.stats.aiMessages'), value: isSearching ? matchingActions.length : p.aiMessages, sub: isSearching ? t('projects.detail.stats.subAiActionsMatching') : t('projects.detail.stats.subChannels', { count: p.channels.length || 4 }), color: 'text-violet-400', filterValue: null },
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
                    {isActive && <span className="text-[10px] font-bold text-white/60">{t('projects.detail.stats.filtered')}</span>}
                  </div>
                  <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-white/30 mt-1">{stat.sub}</p>
                  {isClickable && !isActive && (
                    <p className="text-[10px] text-white/30 mt-1.5 italic">{t('projects.detail.stats.clickToFilter')}</p>
                  )}
                </button>
              )
            })}
          </div>

          {taskFilter !== 'all' && (
            <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-violet-500/10 border border-violet-500/20 rounded-lg">
              <span className="text-xs text-violet-300">
                {t('projects.detail.filterBarPrefix')}
                <strong className="font-semibold capitalize">
                  {t(`projects.detail.filterStatuses.${taskFilter}`)}
                </strong>
              </span>
              <button
                onClick={() => setTaskFilter('all')}
                className="ml-auto text-xs text-violet-300 hover:text-white flex items-center gap-1"
              >
                <X className="w-3 h-3" /> {t('projects.detail.removeFilter')}
              </button>
            </div>
          )}

          {assigneeFilter && (
            <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-violet-500/10 border border-violet-500/20 rounded-lg">
              <span className="text-xs text-violet-300">
                {t('projects.detail.tasks.filterByAssignee', { name: assigneeFilter })}
              </span>
              <button
                onClick={() => setAssigneeFilter(null)}
                className="ml-auto text-xs text-violet-300 hover:text-white flex items-center gap-1"
              >
                <X className="w-3 h-3" /> {t('projects.detail.team.clearAssigneeFilter')}
              </button>
            </div>
          )}

          {/* Progress bar */}
          <div className="bg-[#161625] rounded-xl p-4 border border-white/5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-white flex items-center gap-2">
                {t('projects.detail.progressTitle')}
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
              }`}>{t('projects.detail.progressPct', { value: p.progress })}</span>
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
                  <strong>{t('projects.detail.progressBlocked')}</strong> {p.progressBlockedReason}
                </p>
              </div>
            )}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: t('projects.detail.progressStats.done'),        value: p.done },
                { label: t('projects.detail.progressStats.inProgress'),  value: Math.max(1, Math.floor(p.pending / 2)) },
                { label: t('projects.detail.progressStats.pending'),     value: p.pending },
                { label: 'Blocked', value: p.blocked },
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
            <div id="project-tasks-section" style={{ scrollMarginTop: 24 }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-white">
                  {taskFilter === 'completed' ? t('projects.detail.tasks.headerCompleted') :
                   taskFilter === 'blocked'   ? t('projects.detail.tasks.headerBlocked') :
                   taskFilter === 'pending'   ? t('projects.detail.tasks.headerPending') :
                   t('projects.detail.tasks.header')}
                </h2>
                <div className="flex items-center gap-3">
                  {p.tasks.length > 3 && (
                    <button
                      onClick={() => setShowAllTasks(!showAllTasks)}
                      className="text-xs text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1"
                    >
                      {showAllTasks ? t('projects.detail.tasks.viewLess') : t('projects.detail.tasks.viewAll', { count: p.tasks.length })} →
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditingTaskId(null)
                      setTaskForm({ text: '', description: '', status: 'pending', assignedTo: '', startDate: '', dueDate: '', parentTaskId: '' })
                      setTaskModalOpen(true)
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 border border-violet-500/30 rounded-md transition-colors"
                  >
                    <Plus className="w-3 h-3" /> {t('projects.detail.tasks.newTask')}
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {(() => {
                  // Combine status filter + text search + assignee filter
                  const baseTasks = isSearching ? matchingTasks : p.tasks
                  const statusFiltered = taskFilter === 'all'
                    ? baseTasks
                    : baseTasks.filter(t => {
                        if (taskFilter === 'completed') return isDone(t.status)
                        if (taskFilter === 'blocked') return t.status === 'blocked'
                        if (taskFilter === 'pending') return !isDone(t.status) && t.status !== 'blocked'
                        return true
                      })
                  // Assignee filter: match by assignedTo name
                  const filteredTasks = assigneeFilter
                    ? statusFiltered.filter(t => {
                        const a: any = (t as any).assignedTo
                        const name = typeof a === 'string' ? a : a?.name
                        return name === assigneeFilter
                      })
                    : statusFiltered
                  // If there's NO filter or search, group hierarchically:
                  // [root1, child1.1, child1.2, root2, child2.1, ...].
                  // With filter/search, render flat so we don't hide matches.
                  const isFilteringOrSearching = taskFilter !== 'all' || isSearching || !!assigneeFilter
                  const orderedTasks: ProjectTask[] = isFilteringOrSearching
                    ? filteredTasks
                    : (() => {
                        const roots = filteredTasks.filter(t => !t.parentTaskId)
                        const result: ProjectTask[] = []
                        for (const root of roots) {
                          result.push(root)
                          result.push(...filteredTasks.filter(t => t.parentTaskId === root.id))
                        }
                        // Don't forget the "orphans" (with a parentTaskId not in the filtered set)
                        for (const t of filteredTasks) {
                          if (t.parentTaskId && !roots.find(r => r.id === t.parentTaskId) && !result.includes(t)) {
                            result.push(t)
                          }
                        }
                        return result
                      })()
                  const visibleTasks = showAllTasks ? orderedTasks : orderedTasks.slice(0, 4)
                  return visibleTasks.length > 0 ? visibleTasks.map((task, idx) => {
                    const isSubtask = !!task.parentTaskId
                    const nextTask = visibleTasks[idx + 1]
                    // Show "+ Subtask" button after the last row of a root's group.
                    const showAddSubtaskButton = !isFilteringOrSearching && !isSubtask
                      && (!nextTask || nextTask.parentTaskId !== task.id)
                    return (
                    <div key={task.id} className={isSubtask ? 'ml-6 pl-3 border-l-2 border-white/10' : ''}>
                      <div className={`bg-[#161625] rounded-xl border border-white/5 ${isSubtask ? 'p-3' : 'p-4'}`}>
                        <div className="flex items-start gap-3">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          // Full 4-state cycle (English in code):
                          //   pending → in_progress → blocked → done → pending
                          // Note: if it lands on 'blocked' via the quick cycle,
                          // it stays WITHOUT a registered reason. To add a reason,
                          // use the edit modal or the red "Block" button.
                          const newStatus =
                            isDone(task.status) ? 'pending' :
                            task.status === 'blocked' ? 'done' :
                            task.status === 'in_progress' ? 'blocked' :
                            task.status === 'pending' ? 'in_progress' :
                            'pending'
                          try {
                            await api.updateTask(task.id, { status: newStatus, projectId: p.projectId }, token)
                            // Update the selected project in memory
                            const data = await api.getProjects(token)
                            if (Array.isArray(data)) {
                              setProjects(data)
                              const updated = data.find((proj: Project) => proj.projectId === p.projectId)
                              if (updated) setSelectedProject(updated)
                            }
                          } catch (err) { console.error('Error updating task:', err) }
                        }}
                        title={isDone(task.status) ? t('projects.detail.tasks.clickToUnmark') :
                               task.status === 'blocked' ? t('projects.detail.tasks.blockedTooltip') :
                               t('projects.detail.tasks.clickToComplete')}
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
                        <p className={`text-sm font-semibold break-words ${isDone(task.status) ? 'text-white/60 line-through' : 'text-white'}`}>{task.text}</p>
                        <p className="text-xs text-white/40 mt-1 break-words">
                          <span className={`font-bold ${
                            isDone(task.status) ? 'text-emerald-400' :
                            task.status === 'blocked' ? 'text-red-400' :
                            task.status === 'in_progress' ? 'text-blue-400' :
                            task.status === 'waiting' ? 'text-amber-400' :
                            'text-orange-400'
                          }`}>
                            {isDone(task.status) ? t('projects.detail.tasks.statusLabels.done') :
                             task.status === 'blocked' ? t('projects.detail.tasks.statusLabels.blocked') :
                             task.status === 'in_progress' ? t('projects.detail.tasks.statusLabels.in_progress') :
                             task.status === 'waiting' ? t('projects.detail.tasks.statusLabels.waiting') :
                             t('projects.detail.tasks.statusLabels.pending')}
                          </span>{' '}
                          {task.description}
                        </p>
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-2">
                            {/* Dynamic tag based on the real status (not the static backend tag) */}
                            {(() => {
                              const dynamicTag = isDone(task.status)             ? { label: t('projects.detail.tasks.statusTags.done'),        color: 'bg-emerald-500/20 text-emerald-400' } :
                                                 task.status === 'blocked'      ? { label: t('projects.detail.tasks.statusTags.blocked'),     color: 'bg-red-500/20 text-red-400' } :
                                                 task.status === 'in_progress'  ? { label: t('projects.detail.tasks.statusTags.in_progress'), color: 'bg-blue-500/20 text-blue-400' } :
                                                                                  { label: t('projects.detail.tasks.statusTags.pending'),     color: 'bg-orange-500/20 text-orange-400' }
                              return (
                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${dynamicTag.color}`}>
                                  {dynamicTag.label}
                                </span>
                              )
                            })()}
                            {/* Subtasks indicator: only on parents (root with children). */}
                            {!isSubtask && (task.subtasksCount || 0) > 0 && (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-violet-500/10 text-violet-300 border border-violet-500/20" title={t('projects.detail.tasks.subtasksTooltip', { done: task.subtasksDone || 0, total: task.subtasksCount })}>
                                {task.subtasksDone || 0}/{task.subtasksCount} {t('projects.detail.tasks.subtasksAbbrev')}
                              </span>
                            )}
                            {/* Other backend tags that are NOT status tags */}
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
                                  assignedTo: task.assignedTo.name === 'Sin asignar' ? '' : (task.assignedTo.name || ''),
                                  startDate: task.startDate || '',
                                  dueDate: task.dueDate || '',
                                  parentTaskId: task.parentTaskId || '',
                                })
                                setTaskModalOpen(true)
                              }}
                              title={t('projects.detail.tasks.editTooltip')}
                              className="w-6 h-6 rounded-md bg-white/5 hover:bg-violet-500/20 hover:text-violet-300 text-white/40 flex items-center justify-center transition-colors"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteTask(task) }}
                              title={t('projects.detail.tasks.deleteTooltip')}
                              className="w-6 h-6 rounded-md bg-white/5 hover:bg-red-500/20 hover:text-red-400 text-white/40 flex items-center justify-center transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                            <div className="relative group">
                              <div
                                className={`w-7 h-7 rounded-full bg-gradient-to-br ${task.assignedTo.color} flex items-center justify-center text-[10px] text-white font-bold cursor-default`}
                              >
                                {task.assignedTo.initials}
                              </div>
                              {/* Custom tooltip: appears instantly on hover.
                                  pointer-events-none prevents the tooltip
                                  from intercepting the hover and flickering. */}
                              <div className="pointer-events-none absolute bottom-full right-0 mb-2 px-2 py-1 bg-black/90 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
                                {task.assignedTo.name || t('projects.detail.tasks.unassigned')}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Block / Unblock (with reason) */}
                        {blockingTaskId === task.id ? (
                          <div className="mt-3 flex gap-2 items-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={blockReason}
                              onChange={(e) => setBlockReason(e.target.value)}
                              placeholder={t('projects.detail.tasks.blockReasonPlaceholder')}
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
                                    setProjects(data)
                                    const updated = data.find((proj: Project) => proj.projectId === p.projectId)
                                    if (updated) setSelectedProject(updated)
                                  }
                                  setBlockingTaskId(null); setBlockReason('')
                                } catch (err) { console.error('Error blocking task:', err) }
                                finally { setSavingBlock(false) }
                              }}
                              className="px-3 py-1.5 text-xs bg-red-500/80 hover:bg-red-500 text-white rounded-md disabled:opacity-50 flex items-center gap-1"
                            >
                              {savingBlock && <Loader2 className="w-3 h-3 animate-spin" />} {t('projects.detail.tasks.block')}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setBlockingTaskId(null); setBlockReason('') }}
                              className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-white/70 rounded-md"
                            >
                              {t('projects.detail.tasks.cancel')}
                            </button>
                          </div>
                        ) : task.status === 'blocked' ? (
                          <div className="mt-3 flex items-center gap-2">
                            {task.blockedReason && (
                              <span className="flex-1 text-[11px] text-red-300/70 italic truncate" title={task.blockedReason}>
                                {t('projects.detail.tasks.blockedReasonPrefix')} {task.blockedReason}
                              </span>
                            )}
                            <button
                              onClick={async (e) => {
                                e.stopPropagation()
                                try {
                                  await api.updateTask(task.id, { status: 'pending', blocked_reason: '', projectId: p.projectId }, token)
                                  const data = await api.getProjects(token)
                                  if (Array.isArray(data)) {
                                    setProjects(data)
                                    const updated = data.find((proj: Project) => proj.projectId === p.projectId)
                                    if (updated) setSelectedProject(updated)
                                  }
                                } catch (err) { console.error('Error unblocking task:', err) }
                              }}
                              className="ml-auto px-2.5 py-1 text-[11px] bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-md flex items-center gap-1"
                            >
                              <Unlock className="w-3 h-3" /> {t('projects.detail.tasks.unblock')}
                            </button>
                          </div>
                        ) : (
                          <div className="mt-3 flex justify-end">
                            <button
                              onClick={(e) => { e.stopPropagation(); setBlockingTaskId(task.id); setBlockReason('') }}
                              className="flex items-center gap-1 px-2.5 py-1 text-[11px] bg-white/5 hover:bg-red-500/15 hover:text-red-400 text-white/40 border border-white/10 hover:border-red-500/30 rounded-md transition-colors"
                            >
                              <Ban className="w-3 h-3" /> {t('projects.detail.tasks.block')}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* "+ Subtask" button — only on root tasks, at the end of their group. */}
                  {showAddSubtaskButton && (
                    <div className="ml-6 mt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingTaskId(null)
                          setTaskForm({ text: '', description: '', status: 'pending', assignedTo: '', startDate: '', dueDate: '', parentTaskId: task.id })
                          setTaskModalOpen(true)
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] bg-white/5 hover:bg-violet-500/15 hover:text-violet-300 text-white/40 border border-white/10 hover:border-violet-500/30 rounded-md transition-colors"
                      >
                        <Plus className="w-3 h-3" /> {t('projects.detail.tasks.subtask')}
                      </button>
                    </div>
                  )}
                </div>
                )}) : (
                  <div className="bg-[#161625] rounded-xl p-8 border border-white/5 text-center">
                    <p className="text-white/30 text-sm">
                      {assigneeFilter
                        ? t('projects.detail.tasks.emptyForAssignee', { name: assigneeFilter })
                        : taskFilter !== 'all'
                          ? t('projects.detail.tasks.emptyForFilter', { status: t(`projects.list.globalFilterLabels.${taskFilter}`) })
                          : t('projects.detail.tasks.emptyDefault')}
                    </p>
                  </div>
                )
                })()}
              </div>
            </div>

            {/* AI Actions */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-white">{t('projects.detail.aiActions.header')}</h2>
                {matchingActions.length > 3 && (
                  <button
                    onClick={() => setShowAllActions(!showAllActions)}
                    className="text-xs text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1"
                  >
                    {showAllActions ? 'View less' : `View history (${matchingActions.length})`} →
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {matchingActions.length > 0 ? (showAllActions ? matchingActions : matchingActions.slice(0, 3)).map(action => (
                  <div key={action.id} className="bg-[#161625] rounded-xl p-4 border border-white/5">
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0">{t('projects.detail.aiActions.detected')}</span>
                        <p className="text-sm text-white/80">{action.detected}</p>
                      </div>
                      <div className="pl-4 border-l-2 border-white/10 ml-1">
                        <div className="flex items-start gap-2">
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0">{t('projects.detail.aiActions.executed')}</span>
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
                      {isSearching ? 'No AI action matches your search' : 'No AI actions recorded yet'}
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
                  <h2 className="text-base font-bold text-white">{t('projects.detail.notifications.header')}</h2>
                  <span className="text-xs text-white/30 ml-1">{t('projects.detail.notifications.subheader')}</span>
                </div>
                <span className="text-xs text-white/40">{(p as any).notifications.length} sent</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(p as any).notifications
                  .filter((n: any) => (n.channel || '').toLowerCase() !== 'whatsapp')
                  .map((notif: any) => (
                  <div key={notif.id} className="bg-[#161625] rounded-xl p-4 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <ChannelIcon type={notif.channel} className="w-4 h-4" />
                        <span className={`text-xs font-bold uppercase ${notif.channel === 'whatsapp' ? 'text-green-400' : 'text-sky-400'}`}>
                          {notif.channel}
                        </span>
                        <span className="text-[10px] text-white/30">→ {notif.recipient}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        notif.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {notif.status === 'delivered' ? 'Delivered' : 'Sent'}
                      </span>
                    </div>
                    <p className="text-sm text-white/60 line-clamp-2">{notif.message}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="flex items-center gap-1 text-[10px] text-white/30">
                        <Send className="w-3 h-3" /> Sent by AI
                      </span>
                      <span className="text-[10px] text-white/30">{notif.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Project attachments */}
          <div className="mt-6">
            <ProjectAttachments
              projectId={p.projectId}
              projectName={p.name}
              isOwner={p.isOwner !== false}
              onInsightsGenerated={() => {
                // Refresh the project to see the new insights
                api.getProjects(token).then(data => {
                  if (Array.isArray(data)) {
                    setProjects(data)
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
              <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider">{t('projects.detail.team.header')}</h3>
              {/* Owner-only buttons: add/invite/edit phones. Invited users only see the list. */}
              {!editingPhones && p.isOwner === false ? (
                <span className="text-[10px] text-white/30 italic" title={t('projects.detail.team.readOnlyHint')}>
                  Read only
                </span>
              ) : !editingPhones ? (
                <div className="flex items-center gap-2">
                  {/* SINGLE BUTTON: Add/Invite (replaces the 3 old ones).
                      Opens the unified modal where name, role, email and/or
                      WhatsApp are entered, with a checkbox to send or just save. */}
                  <button
                    onClick={() => {
                      setInviteForm({ name: '', role: '', email: '', phone: '', sendNotification: true })
                      setInviteResultMsg('')
                      setInviteError('')
                      setInviteShareUrl('')
                      setShareUrlCopied(false)
                      setInviteModalOpen(true)
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-violet-300 bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 rounded-md transition-colors"
                    title={t('projects.detail.team.addTooltip')}
                  >
                    <UserPlus className="w-3 h-3" />
                    {t('projects.detail.team.addLabel')}
                  </button>
                  {/* Bulk contact editing (email + phone) — discrete button.
                      Useful when you already have the team and just want to update channels. */}
                  <button
                    onClick={() => {
                      const phones: Record<string, string> = {}
                      const emails: Record<string, string> = {}
                      p.team.forEach(m => {
                        phones[m.name] = m.phone || ''
                        emails[m.name] = m.email || ''
                      })
                      setPhoneEdits(phones)
                      setEmailEdits(emails)
                      setEditingPhones(true)
                    }}
                    className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70 transition-colors"
                    title={t('projects.detail.team.editTooltip')}
                  >
                    <Pencil className="w-3 h-3" />
                    {t('projects.detail.team.editLabel')}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={async () => {
                      setSavingPhones(true)
                      try {
                        // Send updated email AND phone from the edit inputs.
                        // If the user didn't touch a field, we leave it as it was originally.
                        const updatedParticipants = p.team.map(m => ({
                          name: m.name,
                          role: m.role,
                          email: (emailEdits[m.name] ?? m.email ?? '').trim().toLowerCase(),
                          phone: (phoneEdits[m.name] ?? m.phone ?? '').trim(),
                        }))
                        await api.updateParticipants(p.projectId, updatedParticipants, token)
                        const updated = {
                          ...p,
                          team: p.team.map(m => ({
                            ...m,
                            email: (emailEdits[m.name] ?? m.email ?? '').trim().toLowerCase(),
                            phone: (phoneEdits[m.name] ?? m.phone ?? '').trim(),
                          }))
                        }
                        setSelectedProject(updated)
                        setProjects(prev => prev.map(pr => pr.projectId === p.projectId ? updated : pr))
                      } catch (err) {
                        console.error('Error saving contacts:', err)
                      }
                      setSavingPhones(false)
                      setEditingPhones(false)
                    }}
                    disabled={savingPhones}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium"
                  >
                    {savingPhones ? '...' : 'Save'}
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
            {/* The old inline addingMember form was removed.
                The unified modal (inviteModalOpen) replaces it: both cases
                (register without notifying / invite via email/WhatsApp) use
                that single flow with the "Send invitation now" checkbox. */}
            <div className="space-y-2">
              {p.team.map((member, i) => {
                const isAssigneeActive = assigneeFilter === member.name
                return (
                <div
                  key={i}
                  onClick={() => {
                    // Don't filter when the user is in contact edit mode
                    // (could interfere with clicks on inputs).
                    if (editingPhones) return
                    setAssigneeSummaryExpanded(false)
                    setAssigneeFilter(isAssigneeActive ? null : member.name)
                  }}
                  role={editingPhones ? undefined : 'button'}
                  className={`transition-colors rounded-md ${
                    editingPhones
                      ? ''
                      : isAssigneeActive
                        ? 'bg-violet-500/15 border border-violet-500/30 cursor-pointer -mx-1 px-1'
                        : 'hover:bg-white/[0.03] cursor-pointer -mx-1 px-1'
                  }`}
                  title={editingPhones ? undefined : (isAssigneeActive ? t('projects.detail.team.clearAssigneeFilter') : t('projects.detail.team.filterByAssignee', { name: member.name }))}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${member.color} flex items-center justify-center text-[10px] text-white font-bold`}>
                        {member.initials}
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${isAssigneeActive ? 'text-violet-200' : 'text-white'}`}>{member.name}</p>
                        <p className="text-[11px] text-white/40">{member.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 group">
                      {!editingPhones && (
                        <div className="flex items-center gap-1">
                          {member.email && (
                            <span title={`Email: ${member.email}`}>
                              <Mail className="w-3 h-3 text-sky-400" />
                            </span>
                          )}
                          {/* WhatsApp icon hidden — we only show email. */}
                          {!member.email && (
                            <span className="text-[9px] text-white/20">{t('projects.detail.team.noChannel')}</span>
                          )}
                        </div>
                      )}
                      <span className="text-xs text-white/40">{t('projects.detail.team.taskCount', { count: member.tasks })}</span>
                      {/* Remove participant button — owner only, appears on hover.
                          Assigned tasks become "Unassigned", and if the person
                          was invited they lose access to the project. */}
                      {!editingPhones && p.isOwner !== false && (
                        <button
                          onClick={() => setRemoveMemberTarget(member)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 -mr-1 rounded hover:bg-red-500/20 text-white/40 hover:text-red-400"
                          title={`Remove ${member.name} from the project`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  {editingPhones && (
                    <div className="ml-10 mt-1 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3 h-3 text-sky-400 flex-shrink-0" />
                        <input
                          type="email"
                          value={emailEdits[member.name] ?? ''}
                          onChange={e => setEmailEdits({ ...emailEdits, [member.name]: e.target.value })}
                          className="flex-1 px-2.5 py-1.5 bg-[#161625] border border-white/10 rounded-lg text-xs text-white/70 placeholder-white/20 focus:border-sky-500/40 outline-none transition-all"
                          placeholder={t('projects.detail.team.emailPlaceholder')}
                        />
                      </div>
                      {/* WhatsApp input hidden — we only edit email. */}
                    </div>
                  )}
                </div>
                )
              })}
              {p.team.length === 0 && <p className="text-xs text-white/30">{t('projects.detail.team.empty')}</p>}
            </div>
          </div>

          {/* Assignee filter summary mini-panel.
              Appears only when assigneeFilter is active. Shows the compact
              list of that person's tasks (title + status) so the user sees
              the filter result immediately without having to scroll to
              the main task list. */}
          {assigneeFilter && (() => {
            const rows = p.tasks.filter(tsk => {
              const a: any = (tsk as any).assignedTo
              const name = typeof a === 'string' ? a : a?.name
              return name === assigneeFilter
            })
            const statusColor = (st: string) =>
              st === 'blocked'   ? 'text-red-300 bg-red-500/10 border-red-500/20' :
              st === 'done' || st === 'completed' ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' :
              st === 'in_progress' ? 'text-sky-300 bg-sky-500/10 border-sky-500/20' :
                                   'text-amber-300 bg-amber-500/10 border-amber-500/20'
            const statusLabel = (st: string) =>
              t(`projects.detail.tasks.statusTags.${st === 'completed' ? 'done' : st}`, st)
            return (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[11px] font-bold text-violet-300 uppercase tracking-wider">
                    {t('projects.detail.team.filterSummaryHeader', { name: assigneeFilter })}
                  </h3>
                  <button
                    onClick={() => setAssigneeFilter(null)}
                    className="text-[10px] text-white/40 hover:text-violet-300 transition-colors flex items-center gap-1"
                    title={t('projects.detail.team.clearAssigneeFilter')}
                  >
                    <X className="w-3 h-3" /> {t('projects.detail.team.clearAssigneeFilter')}
                  </button>
                </div>
                <div className="bg-violet-500/5 border border-violet-500/20 rounded-lg p-3 space-y-2">
                  <p className="text-[11px] text-white/50">
                    {t('projects.detail.team.filterSummaryCount', { count: rows.length })}
                  </p>
                  {rows.length === 0 ? (
                    <p className="text-xs text-white/30 italic">
                      {t('projects.detail.tasks.emptyForAssignee', { name: assigneeFilter })}
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {(assigneeSummaryExpanded ? rows : rows.slice(0, 8)).map(tsk => (
                        <button
                          key={tsk.id}
                          type="button"
                          onClick={() => {
                            setEditingTaskId(tsk.id)
                            setTaskForm({
                              text: tsk.text,
                              description: tsk.description || '',
                              status: tsk.status,
                              assignedTo: (tsk.assignedTo as any)?.name === 'Sin asignar' ? '' : ((tsk.assignedTo as any)?.name || ''),
                              startDate: tsk.startDate || '',
                              dueDate: tsk.dueDate || '',
                              parentTaskId: tsk.parentTaskId || '',
                            })
                            setTaskModalOpen(true)
                          }}
                          title={t('projects.detail.tasks.editTooltip')}
                          className="w-full text-left flex items-center gap-2 text-xs rounded-md px-1.5 py-1 -mx-1.5 hover:bg-violet-500/10 transition-colors"
                        >
                          <span className={`px-1.5 py-0.5 rounded border text-[9px] uppercase font-semibold flex-shrink-0 ${statusColor(tsk.status)}`}>
                            {statusLabel(tsk.status)}
                          </span>
                          <span className="text-white/70 truncate flex-1">
                            {tsk.text}
                          </span>
                        </button>
                      ))}
                      {rows.length > 8 && (
                        <button
                          type="button"
                          onClick={() => setAssigneeSummaryExpanded(prev => !prev)}
                          className="text-[10px] text-violet-300/80 hover:text-violet-200 underline pt-1"
                        >
                          {assigneeSummaryExpanded
                            ? t('projects.detail.team.filterSummaryLess')
                            : t('projects.detail.team.filterSummaryMore', { count: rows.length - 8 })}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Channels */}
          <div>
            <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">{t('projects.detail.channels.header')}</h3>
            <div className="space-y-2">
              {p.channels.map((ch, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <ChannelIcon type={ch.icon} className="w-4 h-4" />
                    <div>
                      <p className="text-sm text-white/80">{ch.name}</p>
                      {ch.lastActivity && <p className="text-[10px] text-white/30">{ch.lastActivity}</p>}
                    </div>
                  </div>
                  {ch.unread > 0 && (
                    <span className="bg-violet-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">{ch.unread}</span>
                  )}
                </div>
              ))}
              {p.channels.length === 0 && <p className="text-xs text-white/30">{t('projects.detail.channels.empty')}</p>}
            </div>
          </div>

          {/* Tags */}
          {p.labels.length > 0 && (
            <div>
              <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">{t('projects.detail.tags.header')}</h3>
              <div className="flex flex-wrap gap-2">
                {p.labels.map((tag, i) => (
                  <span key={i} className="flex items-center gap-1.5 text-xs text-white/60">
                    <span className={`w-2 h-2 rounded-full ${tag.color}`} />
                    {tag.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* SLA */}
          <div>
            <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-wider mb-3">{t('projects.detail.slaPanel.header')}</h3>
            <div className="space-y-2">
              {[
                { label: t('projects.detail.slaPanel.responseAvg'),     value: p.slaMetrics.clientResponse, alert: false },
                { label: t('projects.detail.slaPanel.unassignedTasks'), value: String(p.slaMetrics.unassignedTasks), alert: p.slaMetrics.unassignedTasks > 0 },
                { label: t('projects.detail.slaPanel.partnerResponse'), value: p.slaMetrics.partnerResponse, alert: p.slaMetrics.partnerResponse === '72h' },
                { label: t('projects.detail.slaPanel.blockedOver24h'),  value: String(p.slaMetrics.tasksBlocked24h), alert: p.slaMetrics.tasksBlocked24h > 0 },
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
      {/* Connected channels sidebar REMOVED from the main dashboard.
          Reason: the Gmail/WhatsApp integration exists in the code but
          in practice nobody has it connected yet, and it took up valuable
          width without adding to the daily workflow. If in the future
          Gmail sees real use, this panel gets re-enabled from a
          'Settings / Integrations' view. ChannelsPanel.tsx stays in the
          repo as dormant code — ready to reactivate. */}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">{t('projects.list.title')}</h1>
            <p className="text-sm text-white/40 mt-1">
              {t('projects.list.subtitle', { total: stats.total, blocked: stats.totalTasksBlocked })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {([
              { id: 'all',      labelKey: 'all',     dot: '' },
              { id: 'active',   labelKey: 'active',  dot: 'bg-emerald-400' },
              { id: 'at_risk',  labelKey: 'atRisk',  dot: 'bg-orange-400' },
              { id: 'overdue',  labelKey: 'overdue', dot: 'bg-red-400' },
              { id: 'paused',   labelKey: 'paused',  dot: 'bg-white/30' },
            ] as const).map(pill => {
              const isActive = statusFilter === pill.id
              return (
                <button
                  key={pill.id}
                  onClick={() => setStatusFilter(pill.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    isActive
                      ? 'bg-white/10 text-white border-white/20'
                      : 'text-white/40 border-white/5 hover:border-white/10 hover:text-white/60'
                  }`}
                >
                  {pill.dot && <span className={`w-2 h-2 rounded-full ${pill.dot}`} />}
                  {t(`projects.list.filters.${pill.labelKey}`)}
                </button>
              )
            })}
          </div>
        </div>

        {/* Stats bar — clickable cards that filter tasks globally.
            The `action` type describes what each card does on click:
              - 'filter'    → toggles the global task filter
              - 'reset'     → clears any active filter
              - null        → decorative, no interaction

            Previously 'Total projects' and 'Messages processed today' were
            dead cards: they visually looked clickable but did nothing. Now
            'Total projects' resets filters (clean UX to return to the "all"
            state), and 'AI insights' is identified as decorative with the
            right label (previously it was misleading: it counted INSIGHTS
            generated by the AI across ALL history, not "messages sent today"). */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          {([
            { icon: FolderKanban, value: stats.total, label: t('projects.list.stats.totalProjects'), color: 'text-white/60', action: 'reset', filterValue: null, hint: globalTaskFilter ? t('projects.list.stats.hintClear') : '' },
            { icon: CheckCircle2, value: stats.totalTasksCompleted, label: t('projects.list.stats.tasksCompleted'), color: 'text-emerald-400', action: 'filter', filterValue: 'completed' as const, hint: t('projects.list.stats.hintDetail') },
            { icon: AlertCircle, value: stats.totalTasksPending, label: t('projects.list.stats.tasksPending'), color: 'text-amber-400', action: 'filter', filterValue: 'pending' as const, hint: t('projects.list.stats.hintDetail') },
            { icon: Shield, value: stats.totalTasksBlocked, label: t('projects.list.stats.tasksBlocked'), color: 'text-red-400', action: 'filter', filterValue: 'blocked' as const, hint: t('projects.list.stats.hintDetail') },
            // "AI insights" = total count of insights generated by the AI
            // when analyzing projects (NOT Twilio-sent messages — those
            // live in onebox-notifications). Decorative for now.
            { icon: Zap, value: stats.totalMessages, label: t('projects.list.stats.aiInsights'), color: 'text-violet-400', action: null, filterValue: null, hint: '' },
          ] as const).map((stat, i) => {
            const Icon = stat.icon
            const isClickable = stat.action !== null
            const isActive = stat.action === 'filter' && globalTaskFilter === stat.filterValue
            return (
              <button
                key={i}
                onClick={() => {
                  if (stat.action === 'filter') {
                    setGlobalTaskFilter(globalTaskFilter === stat.filterValue ? null : stat.filterValue)
                  } else if (stat.action === 'reset') {
                    setGlobalTaskFilter(null)
                  }
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
                  {isActive && <span className="text-[9px] font-bold text-white/60">{t('projects.list.filtered')}</span>}
                </div>
                <p className="text-[11px] text-white/30">{stat.label}</p>
                {isClickable && !isActive && stat.hint && (
                  <p className="text-[10px] text-white/20 mt-1 italic">{stat.hint}</p>
                )}
              </button>
            )
          })}
        </div>

        {/* Detailed view of globally filtered tasks */}
        {globalTaskFilter && (() => {
          const isDone = (s: string) => s === 'done' || s === 'completed'
          const matchesGlobal = (t: any) => {
            if (globalTaskFilter === 'completed') return isDone(t.status)
            if (globalTaskFilter === 'blocked') return t.status === 'blocked'
            if (globalTaskFilter === 'pending') return !isDone(t.status) && t.status !== 'blocked'
            return false
          }
          // Group tasks by project
          const groups = projects
            .map(p => ({
              project: p,
              tasks: (p.tasks || []).filter(matchesGlobal),
            }))
            .filter(g => g.tasks.length > 0)
          const totalMatchingTasks = groups.reduce((s, g) => s + g.tasks.length, 0)
          const filterLabel = t(`projects.list.globalFilterLabels.${globalTaskFilter}`)
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
                      All {filterLabel} tasks
                    </h2>
                    <p className="text-xs text-white/40 mt-0.5">
                      {totalMatchingTasks} task{totalMatchingTasks !== 1 ? 's' : ''} in {groups.length} project{groups.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => setGlobalTaskFilter(null)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-3.5 h-3.5" /> Close
                  </button>
                </div>
                {groups.length === 0 ? (
                  <p className="text-sm text-white/40 text-center py-6">
                    No {filterLabel} tasks in any project.
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
                            {g.tasks.length} task{g.tasks.length !== 1 ? 's' : ''}
                          </span>
                          <span className="text-[10px] text-violet-400 group-hover:text-violet-300">→ view project</span>
                        </button>
                        <div className="space-y-1.5 ml-5">
                          {g.tasks.map(t => (
                            <div key={t.id} className="text-xs text-white/70 flex items-start gap-2">
                              <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                globalTaskFilter === 'completed' ? 'bg-emerald-400' :
                                globalTaskFilter === 'pending' ? 'bg-amber-400' :
                                'bg-red-400'
                              }`} />
                              <span className="leading-relaxed break-words min-w-0">{t.text}</span>
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
              <p className="text-sm text-white/40">{t('projects.list.loading')}</p>
            </div>
          </div>
        )}
        {!loading && filteredProjects.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <FolderKanban className="w-12 h-12 text-white/10" />
              {projects.length === 0 ? (
                <>
                  <p className="text-sm text-white/40">{t('projects.list.emptyNoProjects')}</p>
                  <p className="text-xs text-white/20">{t('projects.list.emptyHint')}</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-white/40">{t('projects.list.emptyNoMatch')}</p>
                  <p className="text-xs text-white/20">{t('projects.list.emptyNoMatchHint')}</p>
                </>
              )}
            </div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-4">
          {filteredProjects.map((project, index) => (
            <motion.div
              key={project.projectId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              onClick={() => setSelectedProject(project)}
              className="bg-[#161625] rounded-xl border border-white/5 p-5 hover:border-white/15 hover:bg-[#1a1a2e] transition-all cursor-pointer group"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FolderKanban className="w-4 h-4 text-white/40" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white truncate group-hover:text-violet-300 transition-colors">{project.name}</h3>
                    <p className="text-xs text-white/30">{project.client}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={project.status} />
                  {/* Owner-only: trash icon on the grid card. */}
                  {project.isOwner !== false && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfirmDelete(project)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      title={t('projects.card.deleteTooltip')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {/* "Invited" badge when the user is not the owner (on the grid card). */}
                  {project.isOwner === false && (
                    <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-300" title={t('projects.card.invitedTooltip')}>
                      👤
                    </span>
                  )}
                </div>
              </div>

              {/* SLA + delivery */}
              <div className="flex items-center justify-between mt-3">
                <SLABadge sla={project.sla} />
                {project.deliveryDate && (
                  <span className="text-[11px] text-white/30">
                    {t('projects.card.delivery', { date: project.deliveryDate, days: project.daysLeft })}
                  </span>
                )}
                {project.status === 'paused' && (
                  <span className="text-[11px] text-white/30">{t('projects.card.pausedSince', { date: 'Nov 20' })}</span>
                )}
                {project.status === 'finished' && (
                  <span className="text-[11px] text-white/30">{t('projects.card.closedOn', { date: project.deliveryDate })}</span>
                )}
              </div>

              {/* Progress */}
              <div className="flex items-center gap-3 mt-3">
                <span className="text-[11px] text-white/30">{t('projects.card.progress')}</span>
                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${progressColor(project.sla)}`} style={{ width: `${project.progress}%` }} />
                </div>
                <span className={`text-xs font-bold ${project.progress >= 70 ? 'text-emerald-400' : project.progress >= 40 ? 'text-white/50' : 'text-amber-400'}`}>
                  {project.progress}%
                </span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-2 mt-4">
                {[
                  { value: project.done,       label: t('projects.card.statsDone'),       color: 'text-emerald-400' },
                  { value: project.pending,    label: t('projects.card.statsPending'),    color: 'text-amber-400' },
                  { value: project.blocked,    label: t('projects.card.statsBlocked'),    color: 'text-red-400' },
                  { value: project.aiMessages, label: t('projects.card.statsAiMessages'), color: 'text-violet-400' },
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
                    <p className="text-[10px] font-bold text-white/30 uppercase mb-0.5">Last AI action</p>
                    <p className="text-xs text-white/50 line-clamp-2">
                      <span className="text-amber-400">Detected</span> {project.lastAction.detected} · <span className="text-emerald-400">
                        {project.lastAction.action.split(' ')[0]}
                      </span> {project.lastAction.action.split(' ').slice(1).join(' ')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                <div className="flex -space-x-2">
                  {project.team.slice(0, 4).map((m, i) => (
                    <div key={i} className="relative group">
                      <div
                        className={`w-6 h-6 rounded-full bg-gradient-to-br ${m.color} flex items-center justify-center text-[9px] text-white font-bold border-2 border-[#161625] cursor-default`}
                      >
                        {m.initials}
                      </div>
                      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
                        {m.name}{m.role ? ` — ${m.role}` : ''}
                      </div>
                    </div>
                  ))}
                  {project.team.length > 4 && (
                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[9px] text-white/60 font-bold border-2 border-[#161625]">
                      +{project.team.length - 4}
                    </div>
                  )}
                </div>
                <span className="text-[11px] text-white/30">Start: {project.startDate}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      {/* Delete confirmation modal (list view) */}
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
                <h3 className="text-lg font-bold text-white">Delete project</h3>
                <p className="text-sm text-white/60 mt-1">
                  Are you sure you want to delete <strong className="text-white">{confirmDelete.name}</strong>? This will also delete its insights, tasks and notifications. <strong className="text-red-400">This cannot be undone.</strong>
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={!!deletingProject}
                className="px-4 py-2 text-sm text-white/70 hover:text-white rounded-lg hover:bg-white/5 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteProject(confirmDelete.projectId)}
                disabled={!!deletingProject}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {deletingProject ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Yes, delete
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
