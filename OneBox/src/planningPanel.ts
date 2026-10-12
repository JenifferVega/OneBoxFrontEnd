// ============================================================================
// planningPanel.ts — open the planning side panel from anywhere.
// ----------------------------------------------------------------------------
// The planning chat (replan with context, ask about the plan, approve
// proposals) is a side panel mounted once in App.tsx (PlanningPanel.tsx).
// Any screen opens it with openPlanning():
//   openPlanning()                                  → project selector (from the chat)
//   openPlanning({ projectId, lock: true })         → that project only (upload, project header)
// planningChanged() tells badges ("proposal waiting") to refresh.
// ============================================================================
export interface PlanningOpen { projectId?: string; lock?: boolean }

export const PLANNING_OPEN_EVENT = 'onebox:open-planning'
export const PLANNING_CHANGED_EVENT = 'onebox:planning-changed'

export function openPlanning(opts: PlanningOpen = {}) {
  window.dispatchEvent(new CustomEvent<PlanningOpen>(PLANNING_OPEN_EVENT, { detail: opts }))
}

export function planningChanged() {
  window.dispatchEvent(new Event(PLANNING_CHANGED_EVENT))
}
