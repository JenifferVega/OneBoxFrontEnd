// ============================================================================
// useContacts — people the user already works with, for autocomplete.
// ----------------------------------------------------------------------------
// One request per session, shared by every field that uses it: the wizard,
// the invite modal and the team editor would otherwise each fetch the same
// list. `refreshContacts()` drops the cache after a project's team changes.
// ============================================================================
import { useEffect, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { api, Contact } from '../services/api'

let cache: Promise<Contact[]> | null = null
const listeners = new Set<(c: Contact[]) => void>()

function load(token: string): Promise<Contact[]> {
  if (!cache) {
    cache = api.getContacts(token)
      .then(r => r.contacts || [])
      .catch(() => { cache = null; return [] })   // retry on next mount
  }
  return cache
}

/** Forget the cached list (call after adding/removing participants). */
export function refreshContacts(token?: string) {
  cache = null
  if (token) load(token).then(c => listeners.forEach(fn => fn(c)))
}

export function useContacts(): Contact[] {
  const auth = useAuth()
  const token = auth.user?.access_token || ''
  const [contacts, setContacts] = useState<Contact[]>([])

  useEffect(() => {
    if (!token) return
    let alive = true
    const set = (c: Contact[]) => { if (alive) setContacts(c) }
    listeners.add(set)
    load(token).then(set)
    return () => { alive = false; listeners.delete(set) }
  }, [token])

  return contacts
}

/** Lower case, no accents: "Gómez" matches "gomez". */
export function normalize(s: string): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Contacts matching what was typed, by name or email. Every word must match,
 *  so "laura go" finds "Laura Gómez". */
export function matchContacts(contacts: Contact[], query: string, exclude: string[] = [], limit = 6): Contact[] {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const skip = new Set(exclude.map(e => normalize(e)).filter(Boolean))
  return contacts
    .filter(c => !(c.email && skip.has(normalize(c.email))))
    .filter(c => {
      const hay = `${normalize(c.name)} ${normalize(c.email)}`
      return words.every(w => hay.includes(w))
    })
    .slice(0, limit)
}
