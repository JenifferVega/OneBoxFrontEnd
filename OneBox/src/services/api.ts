const API_BASE = import.meta.env.VITE_API_URL

let _userId = ''
let _userEmail = ''
export function setUserId(id: string) { _userId = id }
export function setUserEmail(email: string) { _userEmail = email }
export function getUserId() { return _userId }
export function getUserEmail() { return _userEmail }

export async function fetchAPI(path: string, token: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-user-id': _userId,
      'x-user-email': _userEmail,
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

  getConversations: (projectId: string, token: string) =>
    fetchAPI(`/api/projects/${projectId}/conversations`, token),

  getTasks: (projectId: string, token: string) =>
    fetchAPI(`/api/projects/${projectId}/tasks`, token),
  
  createTask: (projectId: string, data: any, token: string) =>
    fetchAPI(`/api/projects/${projectId}/tasks`, token, { method: 'POST', body: JSON.stringify(data) }),
  
  updateTask: (taskId: string, data: any, token: string) =>
    fetchAPI(`/api/tasks/${taskId}`, token, { method: 'PUT', body: JSON.stringify(data) }),

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

  getNotifications: (token: string, projectId?: string) =>
    fetchAPI(`/api/notifications${projectId ? `?projectId=${projectId}` : ''}`, token),
}


