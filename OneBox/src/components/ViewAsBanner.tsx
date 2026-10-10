import { exitViewAs, getViewAs } from '../devViewAs'

/** DEVELOPMENT ONLY: a bar you cannot miss while viewing as someone else. */
export default function ViewAsBanner() {
  const who = getViewAs()
  if (!who) return null
  return (
    <div className="fixed top-0 inset-x-0 z-[200] bg-red-600 text-white text-xs px-3 py-1.5 flex items-center justify-center gap-3 shadow-lg">
      <span>
        Viewing as <b>{who.email}</b>{who.uid ? ` (${who.uid.slice(0, 8)}…)` : ''} · dev only.
        Names shown from your login are still yours.
      </span>
      <button onClick={exitViewAs} className="px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 font-medium">
        Exit
      </button>
    </div>
  )
}
