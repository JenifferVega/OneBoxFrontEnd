/**
 * Trello connection API + token capture.
 *
 * Trello's flow differs from Gmail's: there is no code exchange. Trello
 * redirects back with the token in the URL FRAGMENT (#token=...), which the
 * browser never sends to the server. So the frontend has to read it from
 * window.location.hash and hand it to the backend itself.
 */
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function headers() {
  return {
    'Content-Type': 'application/json',
    'x-user-id': localStorage.getItem('onebox_user_id') || '',
  }
}

export interface TrelloStatus {
  connected: boolean
  username?: string
  connectedAt?: string
}

export async function getTrelloStatus(): Promise<TrelloStatus> {
  try {
    const r = await fetch(`${API_URL}/api/trello/status`, { headers: headers() })
    if (!r.ok) return { connected: false }
    return await r.json()
  } catch {
    return { connected: false }
  }
}

/** Sends the user to Trello to approve access. */
export async function startTrelloConnect(): Promise<void> {
  const r = await fetch(`${API_URL}/api/trello/auth`, { headers: headers() })
  const data = await r.json()
  if (!r.ok || !data.authUrl) {
    throw new Error(data.detail || 'Could not build the Trello authorization URL')
  }
  window.location.href = data.authUrl
}

export async function disconnectTrello(): Promise<void> {
  await fetch(`${API_URL}/api/trello/disconnect`, {
    method: 'DELETE',
    headers: headers(),
  })
}

/**
 * Finishes the connection when Trello redirects back.
 *
 * Call it ONCE on app startup, before any routing decision: the token arrives
 * in the fragment of whatever URL Trello was told to return to, so it can land
 * on any screen.
 *
 * Returns the connected username, or null when there was no token to capture.
 */
export async function captureTrelloToken(): Promise<string | null> {
  const hash = window.location.hash || ''
  const match = hash.match(/token=([0-9a-zA-Z]+)/)
  if (!match) return null

  const token = match[1]
  // Clear the fragment IMMEDIATELY: a Trello token grants full access to the
  // user's account and must not survive in the address bar, in history, or in
  // a link the user might copy and share.
  window.history.replaceState(null, '', window.location.pathname + window.location.search)

  const r = await fetch(`${API_URL}/api/trello/token`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ token }),
  })
  const data = await r.json()
  if (!r.ok || !data.success) {
    throw new Error(data.detail || 'Trello rejected the token')
  }
  return data.username || ''
}
