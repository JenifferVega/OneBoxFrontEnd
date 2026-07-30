const API_BASE = import.meta.env.VITE_API_URL

// IMPORTANTE: Leemos siempre del localStorage en cada llamada para evitar

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

export const api = {
  getProjects: (token: string) =>
    fetchAPI('/api/projects', token),
  
  getProject: (id: string, token: string) => 
    fetchAPI(`/api/projects/${id}`, token),
  
  createProject: (data: any, token: string) =>
    fetchAPI('/api/projects', token, { method: 'POST', body: JSON.stringify(data) }),

  /** Edición parcial de proyecto existente. Solo se mandan los campos a cambiar.
   *  Campos válidos: name, description, type, status, deliveryDate, timing.
   *  Backend valida que el caller sea el owner y rechaza con 403 si no.
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

  deleteProject: (projectId: string, token: string) =>
    fetchAPI(`/api/projects/${projectId}`, token, { method: 'DELETE' }),

  /** Miembros de la organización del user logueado.
   *  Excluye al propio user. Usado por el ProjectWizard para poblar el
   *  buscador de team (antes era una lista hardcoded).
   */
  getOrgMembers: (token: string) =>
    fetchAPI('/api/org/members', token) as Promise<{
      members: Array<{
        userId: string
        email: string
        nombre: string
        iniciales: string
        rolGlobal: string
      }>
    }>,

  // ────────────────────────────────────────────────────────────────────
  // Contexto del user logueado (rol global, org, flags)
  // ────────────────────────────────────────────────────────────────────
  /** Devuelve el contexto multi-tenant del user actual:
   *  rolGlobal, orgId, isPlatformAdmin, capabilities. El frontend lo llama
   *  en el mount para decidir qué UI mostrar (ej: tab Plataforma).
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
  // Endpoints de plataforma — SOLO para users con isPlatformAdmin=true.
  // El backend valida con require_capability(ADMINISTRAR_PLATAFORMA)
  // así que aunque alguien pegue a estos endpoints sin permiso, responde
  // 403. El frontend solo los llama desde el panel de super admin.
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

  /** Elimina un miembro de una org. Backend rechaza (400) si es el último
   *  propietario, el último super admin, o el propio actor. */
  removePlatformMember: (orgId: string, userId: string, token: string) =>
    fetchAPI(
      `/api/platform/orgs/${encodeURIComponent(orgId)}/members/${encodeURIComponent(userId)}`,
      token,
      { method: 'DELETE' }
    ) as Promise<{ success: boolean; orgId: string; userId: string; removedAt: string }>,

  /** Cancela / borra una invitación pendiente. */
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

  /** Añade / invita a un participante al proyecto.
   *  - email y/o phone (al menos uno).
   *  - name y role opcionales.
   *  - sendNotification=false → solo registra el contacto sin enviar email/WhatsApp.
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
    fetchAPI(`/api/inbox/${conversationId}/assign`, token, {
      method: 'POST', body: JSON.stringify({ projectId })
    }),

  updateParticipants: (projectId: string, participants: any[], token: string) =>
    fetchAPI(`/api/projects/${projectId}/participants`, token, { method: 'PUT', body: JSON.stringify({ participants }) }),

  /** Elimina un participante del equipo del proyecto.
   *  Identifica por email (preferido) o phone o name.
   *  - Sus tareas asignadas quedan como "Sin asignar".
   *  - Si tenía invitación aceptada, se revoca (pierde acceso).
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
    fetchAPI(`/api/notifications/${notificationId}/read`, token, { method: 'PUT' }),

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
  // ATTACHMENTS / DOCUMENTOS
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
      throw new Error(t || 'Error al subir documento')
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
      throw new Error(t || 'Error al analizar documento')
    }
    return res.json()
  },

  /** Crea el proyecto definitivo a partir de un draft analizado.
   *  `tasks` son las tareas confirmadas por el usuario en el preview
   *  (con `assigned_to` ya propuesto por la IA). Si vienen, el backend
   *  las persiste tal cual y SALTA la regeneración automática que
   *  perdería el `assigned_to`. */
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

  /** Adjunta un documento a un proyecto existente. */
  uploadAttachment: async (projectId: string, file: File, opts: { userId: string; token: string }) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${API_BASE}/api/projects/${projectId}/attachments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${opts.token}`,
        'x-user-id': opts.userId,
      },
      body: formData
    })
    if (!res.ok) {
      const t = await res.text()
      throw new Error(t || 'Error subiendo adjunto')
    }
    return res.json()
  },

  listAttachments: (projectId: string, token: string) =>
    fetchAPI(`/api/projects/${projectId}/attachments`, token),

  getAttachmentDownloadUrl: (projectId: string, attachmentId: string, token: string) =>
    fetchAPI(`/api/attachments/${projectId}/${attachmentId}/download`, token),

  deleteAttachment: (projectId: string, attachmentId: string, token: string) =>
    fetchAPI(`/api/attachments/${projectId}/${attachmentId}`, token, { method: 'DELETE' }),

  /** Crea un proyecto desde texto pegado (conversación WhatsApp/Gmail/notas). */
  createProjectFromText: (data: { text: string; name?: string; channels?: string[]; source?: string }, token: string) =>
    fetchAPI('/api/projects/from-text', token, { method: 'POST', body: JSON.stringify(data) }),

  /** Analiza un texto pegado dentro de un proyecto existente. La IA genera insights. */
  analyzeTextForProject: (projectId: string, data: { text: string; source?: string }, token: string) =>
    fetchAPI(`/api/projects/${projectId}/analyze-text`, token, { method: 'POST', body: JSON.stringify(data) }),
}


