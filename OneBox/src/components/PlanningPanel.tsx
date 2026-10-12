// ============================================================================
// PlanningPanel.tsx — the planning chat as a right-side panel (replaces the
// old Intelligence > Replanning tab). Mounted once in App.tsx; opened with
// openPlanning() from the chat (project selector), the project header and
// after an upload replan (project fixed). The page stays visible behind it.
// Old links (?tab=replan&planProject=…) open it on that project.
// ============================================================================
import { useEffect, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import PlanningChat from './PlanningChat'
import { PLANNING_OPEN_EVENT, PlanningOpen } from '../planningPanel'

export default function PlanningPanel() {
  const auth = useAuth()
  const token = auth.user?.access_token || ''
  const [open, setOpen] = useState<PlanningOpen | null>(null)
  const [seq, setSeq] = useState(0)          // remount the chat for each opening

  useEffect(() => {
    const onOpen = (e: Event) => {
      setOpen((e as CustomEvent<PlanningOpen>).detail || {})
      setSeq(s => s + 1)
    }
    window.addEventListener(PLANNING_OPEN_EVENT, onOpen)
    // Links from before the panel existed: Intelligence?tab=replan&planProject=X
    try {
      const url = new URL(window.location.href)
      const pid = url.searchParams.get('planProject')
      if (pid || url.searchParams.get('tab') === 'replan') {
        setOpen({ projectId: pid || undefined, lock: !!pid })
        url.searchParams.delete('planProject'); url.searchParams.delete('tab')
        window.history.replaceState(window.history.state, '', url.toString())
      }
    } catch { /* ignore */ }
    return () => window.removeEventListener(PLANNING_OPEN_EVENT, onOpen)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open || !token) return null
  return (
    <div className="fixed inset-0 z-[90] flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(null)} />
      <div className="relative h-full w-full md:w-[min(880px,72vw)] bg-[#0B0B16] border-l border-white/10 shadow-2xl flex flex-col">
        <PlanningChat key={seq} token={token} initialProjectId={open.projectId}
                      lockProject={!!open.lock && !!open.projectId} onClose={() => setOpen(null)} />
      </div>
    </div>
  )
}
