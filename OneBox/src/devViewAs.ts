/**
 * DEVELOPMENT ONLY: "view as" another user, for manual testing.
 *
 *   ?as=ana@example.com&key=<VIEW_AS_TOKEN>         act as a member (email is enough)
 *   ?as=boss@example.com&uid=<cognito-sub>          act as an owner with a known id
 *   ?as=off                                         back to yourself
 *
 * The key is remembered in this browser (localStorage) after the first use;
 * who you are viewing as is remembered per TAB (sessionStorage), so another
 * tab is still you. Every request to the OneBox API carries x-view-as /
 * x-view-as-uid / x-view-as-token; the backend switches identity only when
 * the token matches its VIEW_AS_TOKEN (api/view_as.py).
 *
 * Active only in `npm run dev` or with VITE_ALLOW_VIEW_AS=true. REMOVE this
 * file (and its two lines in main.tsx) before full production.
 */
export const VIEW_AS_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_ALLOW_VIEW_AS === 'true'

const TAB_KEY = 'onebox_view_as'
const TOKEN_KEY = 'onebox_view_as_token'

export interface ViewAs { email: string; uid: string }

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn() } catch { return fallback }
}

export function getViewAs(): ViewAs | null {
  if (!VIEW_AS_ENABLED) return null
  return safe(() => JSON.parse(sessionStorage.getItem(TAB_KEY) || 'null') as ViewAs | null, null)
}

function token(): string {
  return safe(() => localStorage.getItem(TOKEN_KEY) || '', '')
}

/** Read ?as / ?uid / ?key once, store them, and clean them from the URL. */
function readUrl(): void {
  const url = new URL(window.location.href)
  const as = url.searchParams.get('as')
  const key = url.searchParams.get('key')
  if (as === null && key === null) return
  if (key) safe(() => localStorage.setItem(TOKEN_KEY, key), undefined)
  if (as !== null) {
    if (!as || as === 'off') safe(() => sessionStorage.removeItem(TAB_KEY), undefined)
    else safe(() => sessionStorage.setItem(TAB_KEY, JSON.stringify({
      email: as.trim().toLowerCase(), uid: (url.searchParams.get('uid') || '').trim() })), undefined)
  }
  ;['as', 'uid', 'key'].forEach(p => url.searchParams.delete(p))
  window.history.replaceState({}, document.title, url.pathname + (url.search || '') + url.hash)
}

function isApiCall(target: string): boolean {
  const bases = [import.meta.env.VITE_API_URL, import.meta.env.VITE_AGENT_API, 'http://localhost:8000']
    .filter(Boolean) as string[]
  return bases.some(b => target.startsWith(b))
}

/** Call once, before the app renders. */
export function installViewAs(): void {
  if (!VIEW_AS_ENABLED) return
  readUrl()
  const original = window.fetch.bind(window)
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const who = getViewAs()
    const target = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!who || !isApiCall(target)) return original(input, init)
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined))
    headers.set('x-view-as', who.email)
    if (who.uid) headers.set('x-view-as-uid', who.uid)
    headers.set('x-view-as-token', token())
    return original(input, { ...init, headers })
  }
}

export function exitViewAs(): void {
  safe(() => sessionStorage.removeItem(TAB_KEY), undefined)
  window.location.reload()
}
