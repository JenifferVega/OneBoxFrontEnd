const API_BASE = import.meta.env.VITE_API_URL

// IMPORTANT: We always read from localStorage on each call to avoid stale values.

function readUserCreds() {
  let userId = ''
  let userEmail = ''
  try {
    userId = localStorage.getItem('onebox_user_id') || ''
    userEmail = localStorage.getItem('onebox_user_email') || ''
  } catch { /* SSR / private mode */ }
  return { userId, userEmail }
}

export function setUserId(id: string) {
  try { localStorage.setItem('onebox_user_id', id) } catch {}
}
export function setUserEmail(email: string) {
  try { localStorage.setItem('onebox_user_email', email) } catch {}
}
export function getUserId() { return readUserCreds().userId }
export function getUserEmail() { return readUserCreds().userEmail }

export function clearUserSession() {
  try {
    localStorage.removeItem('onebox_user_id')
    localStorage.removeItem('onebox_user_email')
    localStorage.removeItem('onebox_user_name')
    localStorage.removeItem('onebox_pending_project')
  } catch {}
}

export async function fetchAPI(path: string, token: string, options?: RequestInit) {
  const { userId, userEmail } = readUserCreds()
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-user-id': userId,
      'x-user-email': userEmail,
      ...options?.headers,
    }
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// IDs that go in a URL path MUST be encoded. Attachment, notification and
// conversation ids contain '#' (e.g. "2026-07-14T15:41:31.053721#19e6710d"),
// and an unencoded '#' starts the URL fragment: the browser silently dropped
// everything after it, so download/delete hit a truncated, non-existent id.
export interface UserSettings {
  /** IANA name ("America/Bogota"); null when the user never saved one. */
  timezone: string | null
  language: 'es' | 'en' | null
  defaults?: { timezone: string; language: string }
}

/** Someone the user already works with (a participant of one of their projects). */
export interface Contact {
  name: string
  email: string
  phone: string
  role: string
  /** Names of the projects this person is in. */
  projects: string[]
}

/** Planning chat (Intelligence > Replanificación). */
export interface PlanningOperation {
  op: 'create' | 'update' | 'close' | 'reopen' | 'delete' | 'link' | 'block'
  task_id: string; text?: string; status?: string; assigned_to?: string
  start_date?: string; due_date?: string; date_status?: string
  depends_on?: string[]; duplicate_of?: string; reason?: string; confidence?: string
}
export interface PlanningProposal {
  proposalId: string
  status: 'pending' | 'applied' | 'partially_applied' | 'rejected' | 'reverted' | 'stale' | 'superseded'
  source: string; createdAt: string; summary: string; counts: Record<string, number>
  operations: PlanningOperation[]
  questions: { id: string; text: string; options?: string[] }[]
  notes: { kind: string; text: string; date?: string }[]
  approved?: number[]
}
export interface PlanningMessage {
  itemId: string; role: 'user' | 'assistant'; content: string; createdAt: string
  userEmail?: string; proposalId?: string; sources?: string[]; error?: boolean
  /** 'updates_digest' = the daily summary of the members' updates */
  kind?: string
  /** On a conversational reply: the leader's message, to replan with it if they press the button */
  replanText?: string
}
export interface SystemNode {
  node: string; what: string; provider?: string; model?: string; source?: string
  fallbacks?: string[]; warning?: string | null; error?: string
  /** 'fallback' | 'missing_key' | '' -- translated in the interface */
  warningCode?: string; wanted?: string
}
export interface SystemInfo {
  environment: string; startedAt: string; python: string
  nodes: SystemNode[]; keys: Record<string, boolean>; providers: Record<string, boolean>
  env: Record<string, string>
}
export interface PlanningState {
  messages: PlanningMessage[]; proposals: PlanningProposal[]
  revertible: string | null; job: { jobId: string; step: string } | null
  trello: boolean; planVersion: number
  /** Text of the existing tasks the proposals mention (operations only carry the id). */
  taskTexts: Record<string, string>
}
export interface PlanningJob {
  jobId: string; status: 'running' | 'done' | 'error'; step: string; steps: string[]
  error: string; seconds: number; proposalId?: string
}

/** Projects where the member owes an update (blocking chat on login). */
export interface CheckinTask {
  taskId: string; text: string; status: string; startDate: string; dueDate: string; blockedReason: string
}
export interface CheckinProject {
  projectId: string; projectName: string; person: string; urgent: boolean; lastReportAt: string
  /** The owner may postpone their own update; members may not. */
  isOwner?: boolean
  tasks: CheckinTask[]
}

/** Member updates: the member tells how it is going in a chat; the AI asks and records items. */
export interface UpdateItem {
  type: string; task_id: string; text: string; owner: string; due_date: string; certainty: string
  depends_on: string; about_person: string; decision_for_owner: boolean; urgent: boolean; quote: string
}
export interface UpdateTurnResult { reply: string; finished: boolean; items: UpdateItem[]; sessionId: string }
export interface UpdateSession {
  sessionId: string | null; items: UpdateItem[]; messages: { role: 'member' | 'assistant'; content: string }[]
}

export const api = {
  /** People from all the user's projects, deduplicated — for autocomplete. */
  getContacts: (token: string) =>
    fetchAPI('/api/user/contacts', token) as Promise<{ contacts: Contact[]; count: number }>,

  /** The user's preferences (table onebox-users). */
  /** Settings > System details: models per node, key presence (never values). */
  getSystemInfo: (token: string) =>
    fetchAPI('/api/system/info', token) as Promise<SystemInfo>,

  getUserSettings: (token: string) =>
    fetchAPI('/api/user/settings', token) as Promise<UserSettings>,

  /** Partial update: only the fields sent are changed. */
  updateUserSettings: (
    updates: Partial<{ timezone: string; language: 'es' | 'en' }>,
    token: string,
  ) =>
    fetchAPI('/api/user/settings', token, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }) as Promise<UserSettings>,

  getProjects: (token: string) =>
    fetchAPI('/api/projects', token),
  
  getProject: (id: string, token: string) => 
    fetchAPI(`/api/projects/${id}`, token),
  
  createProject: (data: any, token: string) =>
    fetchAPI('/api/projects', token, { method: 'POST', body: JSON.stringify(data) }),

  /** Partial edit of an existing project. Only the fields to change are sent.
   *  Valid fields: name, description, type, status, deliveryDate, timing.
   *  The backend validates that the caller is the owner and rejects with 403 otherwise.
   */
  updateProject: (
    projectId: string,
    updates: Partial<{
      name: string
      description: string
      type: string
      status: 'active' | 'paused' | 'finished'
      deliveryDate: string
      timing: string
    }>,
    token: string,
  ) =>
    fetchAPI(`/api/projects/${projectId}`, token, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  /** Owner only: close a discontinued project, with the reason. Reversible with reopenProject. */
  closeProject: (projectId: string, note: string, token: string) =>
    fetchAPI(`/api/projects/${projectId}/close`, token, { method: 'POST', body: JSON.stringify({ note }) }),

  /** Owner only: reactivate a closed project with the status it had before. */
  reopenProject: (projectId: string, token: string) =>
    fetchAPI(`/api/projects/${projectId}/reopen`, token, { method: 'POST' }),

  deleteProject: (projectId: string, token: string) =>
    fetchAPI(`/api/projects/${projectId}`, token, { method: 'DELETE' }),

  /** Everything stored about one project as a single JSON document
   *  (tasks, insights, attachments with full text, conversations, notifications).
   *  Read-only. Owner and participants. */
  exportProject: (projectId: string, token: string) =>
    fetchAPI(`/api/projects/${projectId}/export`, token),

  /** Members of the logged-in user's organization.
   *  Excludes the user themselves. Used by the ProjectWizard to populate the
   *  team search (previously a hardcoded list).
   */
  getOrgMembers: (token: string) =>
    fetchAPI('/api/org/members', token) as Promise<{
      members: Array<{
        userId: string
        email: string
        name: string
        initials: string
        rolGlobal: string
      }>
    }>,

  // ────────────────────────────────────────────────────────────────────
  // Context of the logged-in user (global role, org, flags)
  // ────────────────────────────────────────────────────────────────────
  /** Returns the multi-tenant context of the current user:
   *  rolGlobal, orgId, isPlatformAdmin, capabilities. The frontend calls it
   *  on mount to decide which UI to show (e.g. the Platform tab).
   */
  getMe: (token: string) =>
    fetchAPI('/api/me', token) as Promise<{
      uid: string
      email: string
      orgId: string | null
      rolGlobal: string | null
      isPlatformAdmin: boolean
      joinedAt?: string
      org?: {
        orgId: string
        name: string
        domain: string
        plan: string
        status: string
      } | null
      capabilities?: string[]
      warning?: string
    }>,

  // ────────────────────────────────────────────────────────────────────
  // Platform endpoints — ONLY for users with isPlatformAdmin=true.
  // The backend validates with require_capability(ADMINISTRAR_PLATAFORMA)
  // so even if someone hits these endpoints without permission, it responds
  // 403. The frontend only calls them from the super admin panel.
  // ────────────────────────────────────────────────────────────────────
  listPlatformOrgs: (token: string, statusFilter?: string) => {
    const q = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : ''
    return fetchAPI(`/api/platform/orgs${q}`, token) as Promise<{
      count: number
      orgs: Array<{
        orgId: string
        name: string
        domain: string
        plan: string
        status: string
        createdAt: string
        propietarioEmail: string
        memberCount: number
      }>
    }>
  },

  getPlatformOrgDetail: (orgId: string, token: string) =>
    fetchAPI(`/api/platform/orgs/${encodeURIComponent(orgId)}`, token) as Promise<{
      org: Record<string, any>
      members: Array<Record<string, any>>
      memberCount: number
      pendingInvitations: Array<Record<string, any>>
      pendingInvitationsCount: number
    }>,

  createPlatformOrg: (
    data: { name: string; propietarioEmail: string; domain?: string; plan?: string },
    token: string,
  ) =>
    fetchAPI('/api/platform/orgs', token, {
      method: 'POST',
      body: JSON.stringify(data),
    }) as Promise<{
      success: boolean
      orgId: string
      name: string
      propietarioEmail: string
      emailDelivery?: any
      message: string
    }>,

  updatePlatformOrgStatus: (orgId: string, newStatus: string, token: string) =>
    fetchAPI(`/api/platform/orgs/${encodeURIComponent(orgId)}/status`, token, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus }),
    }) as Promise<{
      success: boolean
      orgId: string
      previousStatus: string
      newStatus: string
      updatedAt: string
    }>,

  getPlatformMetrics: (token: string) =>
    fetchAPI('/api/platform/metrics', token) as Promise<{
      orgsTotal: number
      orgsActive: number
      membersTotal: number
      pendingInvitationsTotal: number
    }>,

  /** Removes a member from an org. The backend rejects (400) if it is the last
   *  owner, the last super admin, or the actor themselves. */
  removePlatformMember: (orgId: string, userId: string, token: string) =>
    fetchAPI(
      `/api/platform/orgs/${encodeURIComponent(orgId)}/members/${encodeURIComponent(userId)}`,
      token,
      { method: 'DELETE' }
    ) as Promise<{ success: boolean; orgId: string; userId: string; removedAt: string }>,

  /** Cancels / deletes a pending invitation. */
  cancelPlatformInvitation: (invitationId: string, token: string) =>
    fetchAPI(
      `/api/platform/invitations/${encodeURIComponent(invitationId)}`,
      token,
      { method: 'DELETE' }
    ) as Promise<{ success: boolean; invitationId: string; email?: string; cancelledAt: string }>,

  getConversations: (projectId: string, token: string) =>
    fetchAPI(`/api/projects/${projectId}/conversations`, token),

  getTasks: (projectId: string, token: string) =>
    fetchAPI(`/api/projects/${projectId}/tasks`, token),
  
  createTask: (projectId: string, data: any, token: string) =>
    fetchAPI(`/api/projects/${projectId}/tasks`, token, { method: 'POST', body: JSON.stringify(data) }),
  
  updateTask: (taskId: string, data: any, token: string) =>
    fetchAPI(`/api/tasks/${taskId}`, token, { method: 'PUT', body: JSON.stringify(data) }),

  deleteTask: (taskId: string, token: string, cascade: boolean = false) =>
    fetchAPI(`/api/tasks/${taskId}?cascade=${cascade ? 'true' : 'false'}`, token, { method: 'DELETE' }),

  /** Adds / invites a participant to the project.
   *  - email and/or phone (at least one).
   *  - name and role optional.
   *  - sendNotification=false → only records the contact without sending email/WhatsApp.
   */
  inviteUserToProject: (
    projectId: string,
    data: { email?: string; phone?: string; name?: string; role?: string; sendNotification?: boolean },
    token: string,
  ) =>
    fetchAPI(`/api/projects/${projectId}/invite`, token, {
      method: 'POST',
      body: JSON.stringify({
        email: data.email || '',
        phone: data.phone || '',
        name: data.name || '',
        role: data.role || '',
        send_notification: data.sendNotification !== false,
      }),
    }),

  getInsights: (token: string, type?: string) =>
    fetchAPI(`/api/insights${type ? `?type=${type}` : ''}`, token),

  getInbox: (token: string) =>
    fetchAPI('/api/inbox', token),
  
  assignToProject: (conversationId: string, projectId: string, token: string) =>
    fetchAPI(`/api/inbox/${encodeURIComponent(conversationId)}/assign`, token, {
      method: 'POST', body: JSON.stringify({ projectId })
    }),

  updateParticipants: (projectId: string, participants: any[], token: string) =>
    fetchAPI(`/api/projects/${projectId}/participants`, token, { method: 'PUT', body: JSON.stringify({ participants }) }),

  /** Removes a participant from the project team.
   *  Identified by email (preferred) or phone or name.
   *  - Their assigned tasks become "Unassigned".
   *  - If they had an accepted invitation, it is revoked (they lose access).
   */
  removeParticipant: (
    projectId: string,
    target: { email?: string; phone?: string; name?: string },
    token: string,
  ) =>
    fetchAPI(`/api/projects/${projectId}/participants`, token, {
      method: 'DELETE',
      body: JSON.stringify({
        email: target.email || '',
        phone: target.phone || '',
        name: target.name || '',
      }),
    }),

  getNotifications: (token: string, projectId?: string) =>
    fetchAPI(`/api/notifications${projectId ? `?projectId=${projectId}` : ''}`, token),

  markNotificationRead: (notificationId: string, token: string) =>
    fetchAPI(`/api/notifications/${encodeURIComponent(notificationId)}/read`, token, { method: 'PUT' }),

  markAllNotificationsRead: (token: string) =>
    fetchAPI('/api/notifications/mark-all-read', token, { method: 'POST' }),

  getGmailStatus: async (userId: string) => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
    const res = await fetch(`${API_URL}/api/gmail/status`, {
      headers: { 'x-user-id': userId }
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  // ============================================================
  // ATTACHMENTS / DOCUMENTS
  // ============================================================

  createProjectFromDocument: async (file: File, opts: { name?: string; channels?: string[]; userId: string; token: string }) => {
    const formData = new FormData()
    formData.append('file', file)
    if (opts.name) formData.append('name', opts.name)
    if (opts.channels && opts.channels.length) formData.append('channels', opts.channels.join(','))
    const res = await fetch(`${API_BASE}/api/projects/from-document`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${opts.token}`,
        'x-user-id': opts.userId,
      },
      body: formData
    })
    if (!res.ok) {
      const t = await res.text()
      throw new Error(t || 'Error uploading document')
    }
    return res.json()
  },

  analyzeTextPreview: (data: { text: string; source?: string }, token: string) =>
    fetchAPI('/api/text/analyze', token, { method: 'POST', body: JSON.stringify(data) }),

  analyzeDocumentPreview: async (file: File, opts: { userId: string; token: string }) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${API_BASE}/api/documents/analyze`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${opts.token}`,
        'x-user-id': opts.userId,
      },
      body: formData
    })
    if (!res.ok) {
      const t = await res.text()
      throw new Error(t || 'Error analyzing document')
    }
    return res.json()
  },

  /** Creates the final project from an analyzed draft.
   *  `tasks` are the tasks confirmed by the user in the preview
   *  (with `assigned_to` already proposed by the AI). If provided, the backend
   *  persists them as-is and SKIPS the automatic regeneration that
   *  would lose the `assigned_to`. */
  createProjectFromDraft: (data: {
    draftId: string;
    name: string;
    type?: string;
    description: string;
    channels: string[];
    emails?: string[];
    phones?: string[];
    timing?: string;
    deliveryDate?: string;
    detectedParticipants?: Array<{
      name: string;
      email: string;
      phone: string;
      role: string;
    }>;
    tasks?: Array<{
      text: string;
      assigned_to?: string;
      start_date?: string;
      due_date?: string;
      status?: string;
    }>;
  }, token: string) =>
    fetchAPI('/api/projects/from-document-draft', token, { method: 'POST', body: JSON.stringify(data) }),

  // ── Member updates (chat) ──
  getUpdatesPending: (token: string, name = '') =>
    fetchAPI(`/api/updates/pending?name=${encodeURIComponent(name)}`, token) as Promise<{ projects: CheckinProject[]; checkinDays: number }>,

  getUpdateSession: (projectId: string, token: string, name = '') =>
    fetchAPI(`/api/updates/${encodeURIComponent(projectId)}/session?name=${encodeURIComponent(name)}`, token) as Promise<UpdateSession>,

  sendUpdateMessage: (projectId: string, messages: string[], token: string, name = '') =>
    fetchAPI(`/api/updates/${encodeURIComponent(projectId)}/message`, token,
      { method: 'POST', body: JSON.stringify({ messages, name }) }) as Promise<UpdateTurnResult>,

  consolidateUpdates: (projectId: string, token: string) =>
    fetchAPI(`/api/projects/${encodeURIComponent(projectId)}/updates/consolidate`, token, { method: 'POST' }) as
      Promise<{ status: string; sessions?: number; proposalId?: string | null; digest?: string }>,

  // ── Planning chat ──
  getPlanning: (projectId: string, token: string) =>
    fetchAPI(`/api/projects/${encodeURIComponent(projectId)}/planning`, token) as Promise<PlanningState>,

  /** Multipart: the instruction plus optional context (text, a file, Trello). Returns the background job. */
  sendPlanningMessage: async (projectId: string, data: {
    message: string; context?: string; file?: File | null; includeTrello?: boolean; rereadAll?: boolean
    /** true = replan with the message as context, no classification */
    replan?: boolean
  }, token: string) => {
    const { userId, userEmail } = readUserCreds()
    const form = new FormData()
    form.append('message', data.message || '')
    form.append('context', data.context || '')
    form.append('includeTrello', String(!!data.includeTrello))
    form.append('rereadAll', String(!!data.rereadAll))
    form.append('replan', String(!!data.replan))
    if (data.file) form.append('file', data.file)
    const res = await fetch(`${API_BASE}/api/projects/${encodeURIComponent(projectId)}/planning/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'x-user-id': userId, 'x-user-email': userEmail },
      body: form,
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json() as Promise<{ jobId: string; messageId: string }>
  },

  getPlanningJob: (projectId: string, jobId: string, token: string) =>
    fetchAPI(`/api/projects/${encodeURIComponent(projectId)}/planning/jobs/${encodeURIComponent(jobId)}`, token) as Promise<PlanningJob>,

  decidePlanningProposal: (projectId: string, proposalId: string,
                           decision: 'approve_all' | 'approve_some' | 'reject_all', opIndexes: number[], token: string) =>
    fetchAPI(`/api/projects/${encodeURIComponent(projectId)}/planning/proposals/${encodeURIComponent(proposalId)}/decision`,
      token, { method: 'POST', body: JSON.stringify({ decision, opIndexes }) }),

  revertPlanningProposal: (projectId: string, proposalId: string, token: string) =>
    fetchAPI(`/api/projects/${encodeURIComponent(projectId)}/planning/proposals/${encodeURIComponent(proposalId)}/revert`,
      token, { method: 'POST' }),

  /** Attaches a document to an existing project. */
  uploadAttachment: async (projectId: string, file: File, opts: { userId: string; token: string }) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${API_BASE}/api/projects/${projectId}/attachments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${opts.token}`,
        'x-user-id': opts.userId,
        // Without the email the backend cannot recognise an invited member,
        // so members' uploads were refused with 403.
        'x-user-email': getUserEmail(),
      },
      body: formData
    })
    if (!res.ok) {
      const t = await res.text()
      throw new Error(t || 'Error uploading attachment')
    }
    return res.json()
  },

  listAttachments: (projectId: string, token: string) =>
    fetchAPI(`/api/projects/${projectId}/attachments`, token),

  getAttachmentDownloadUrl: (projectId: string, attachmentId: string, token: string) =>
    fetchAPI(`/api/attachments/${projectId}/${encodeURIComponent(attachmentId)}/download`, token),

  /** Owner only: update the task plan with this attachment (runs in the background). */
  replanFromAttachment: (projectId: string, attachmentId: string, token: string) =>
    fetchAPI(`/api/attachments/${projectId}/${encodeURIComponent(attachmentId)}/replan`, token, { method: 'POST' }) as
      Promise<{ started: boolean; fileName: string }>,

  deleteAttachment: (projectId: string, attachmentId: string, token: string) =>
    fetchAPI(`/api/attachments/${projectId}/${encodeURIComponent(attachmentId)}`, token, { method: 'DELETE' }),

  /** Creates a project from pasted text (WhatsApp/Gmail conversation/notes). */
  createProjectFromText: (data: { text: string; name?: string; channels?: string[]; source?: string }, token: string) =>
    fetchAPI('/api/projects/from-text', token, { method: 'POST', body: JSON.stringify(data) }),

  /** Analyzes pasted text within an existing project. The AI generates insights. */
  analyzeTextForProject: (projectId: string, data: { text: string; source?: string }, token: string) =>
    fetchAPI(`/api/projects/${projectId}/analyze-text`, token, { method: 'POST', body: JSON.stringify(data) }),
}


