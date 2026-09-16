// ============================================================================
// ProjectGantt.tsx
// ----------------------------------------------------------------------------
// Simple, custom Gantt view (SVG + tailwind) to display the tasks of a
// SINGLE project on a horizontal timeline.
//
// Design decisions:
//  - NO external library (no more npm install) → lighter, more control over
//    styles to fit with the dark theme.
//  - SVG for the bars (simple and scales well).
//  - Dynamic scale: the date range spans from the earliest task to the
//    latest one, with margin. If there's no range, defaults to ±15 days from today.
//  - "TODAY" vertical line for temporal orientation.
//  - Tasks without dates → not shown in the Gantt (they're listed in another
//    section of the project). The parent decides that; this component only
//    draws the ones that have both dates.
//  - Click on a bar → callback to the parent (opens the existing task's modal).
// ============================================================================

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

export interface GanttTask {
  id: string
  text: string
  status: string             // pending | in_progress | done | blocked
  startDate?: string         // YYYY-MM-DD
  dueDate?: string           // YYYY-MM-DD
  assignedTo?: string        // name for tooltip
}

interface Props {
  tasks: GanttTask[]
  onTaskClick?: (taskId: string) => void
}

// Colors by status — the same visual language as the rest of the app.
// The label is resolved with i18n at render (labelKey → gantt.statusLabels.<key>).
const STATUS_COLORS: Record<string, { fill: string; stroke: string; labelKey: string }> = {
  pending:     { fill: 'rgb(245, 158, 11)',  stroke: 'rgb(217, 119, 6)',  labelKey: 'pending' },      // amber
  in_progress: { fill: 'rgb(56, 189, 248)',  stroke: 'rgb(14, 165, 233)', labelKey: 'in_progress' },  // sky
  done:        { fill: 'rgb(16, 185, 129)',  stroke: 'rgb(5, 150, 105)',  labelKey: 'done' },         // emerald
  blocked:     { fill: 'rgb(239, 68, 68)',   stroke: 'rgb(220, 38, 38)',  labelKey: 'blocked' },      // red
}

function parseDate(s?: string): Date | null {
  if (!s) return null
  const d = new Date(s + 'T00:00:00')
  return isNaN(d.getTime()) ? null : d
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' })
}

export default function ProjectGantt({ tasks, onTaskClick }: Props) {
  const { t } = useTranslation()
  // Status filter — clicking the legend toggles that status.
  // Starts with all active (previous behavior, no visible filter).
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(
    () => new Set(Object.keys(STATUS_COLORS))
  )
  // Assignee filter — clicking a row in the left column toggles that
  // participant as a single filter. null = no filter (shows all).
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null)
  const toggleStatus = (key: string) => {
    setActiveStatuses(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const resetFilter = () => {
    setActiveStatuses(new Set(Object.keys(STATUS_COLORS)))
    setAssigneeFilter(null)
  }

  // Filter only tasks with BOTH valid dates — before the status filter,
  // to know if the project has scheduled tasks at all (different empty state).
  const scheduledAll = useMemo(() => {
    return tasks
      .map(t => ({
        ...t,
        start: parseDate(t.startDate),
        end: parseDate(t.dueDate),
      }))
      .filter(t => t.start && t.end && t.end! >= t.start!) as Array<
        GanttTask & { start: Date; end: Date }
      >
  }, [tasks])
  const scheduled = useMemo(
    () => scheduledAll.filter(t =>
      activeStatuses.has(t.status) &&
      (!assigneeFilter || (t.assignedTo || '') === assigneeFilter)
    ),
    [scheduledAll, activeStatuses, assigneeFilter]
  )
  // Participants list DERIVED from the scheduled tasks (deduplicated,
  // preserving order of appearance). Each with their task count.
  const participants = useMemo(() => {
    const seen = new Map<string, number>()
    for (const t of scheduledAll) {
      const name = (t.assignedTo || '').trim()
      if (!name) continue
      seen.set(name, (seen.get(name) || 0) + 1)
    }
    return Array.from(seen.entries()).map(([name, count]) => ({ name, count }))
  }, [scheduledAll])

  if (scheduledAll.length === 0) {
    return (
      <div className="bg-[#0E0E18] border border-white/5 rounded-2xl p-8 text-center">
        <div className="text-4xl mb-3 opacity-30">📊</div>
        <p className="text-sm text-white/50">{t('gantt.emptyTitle')}</p>
        <p className="text-xs text-white/30 mt-1">
          {t('gantt.emptyHint')}
        </p>
      </div>
    )
  }

  // Compute the date range: from the earliest to the latest, with a 3-day
  // margin on each side so the bars don't touch the edge.
  // We use scheduledAll (not scheduled) so the time axis does NOT re-adjust
  // when the user toggles a filter. The visible window is stable.
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const minStart = scheduledAll.reduce((m, t) => (t.start < m ? t.start : m), scheduledAll[0].start)
  const maxEnd = scheduledAll.reduce((m, t) => (t.end > m ? t.end : m), scheduledAll[0].end)
  const rangeStart = new Date(minStart)
  rangeStart.setDate(rangeStart.getDate() - 3)
  const rangeEnd = new Date(maxEnd)
  rangeEnd.setDate(rangeEnd.getDate() + 3)
  const totalDays = Math.max(1, daysBetween(rangeStart, rangeEnd))

  // SVG dimensions
  const rowHeight = 36
  const headerHeight = 40
  const dayWidth = Math.max(20, Math.min(60, 900 / totalDays)) // adaptive
  const width = totalDays * dayWidth
  const height = headerHeight + scheduled.length * rowHeight + 10

  // Generate date ticks for the header — every N days depending on zoom
  const tickEvery = totalDays > 60 ? 7 : totalDays > 30 ? 3 : 1
  const ticks: Array<{ x: number; date: Date }> = []
  for (let i = 0; i <= totalDays; i += tickEvery) {
    const d = new Date(rangeStart)
    d.setDate(d.getDate() + i)
    ticks.push({ x: i * dayWidth, date: d })
  }

  // Position of the "TODAY" line
  const todayDays = daysBetween(rangeStart, today)
  const todayX = todayDays * dayWidth
  const todayInRange = todayDays >= 0 && todayDays <= totalDays

  return (
    <div className="bg-[#0E0E18] border border-white/5 rounded-2xl overflow-hidden">
      {/* Color legend on top — each chip is a status filter toggle.
          Click turns that status on/off. A disabled chip is dimmed and
          desaturated; the counter and bars respect the filter. */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 text-[11px] text-white/60">
        {Object.entries(STATUS_COLORS).map(([key, val]) => {
          const isActive = activeStatuses.has(key)
          const label = t(`gantt.statusLabels.${val.labelKey}`)
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleStatus(key)}
              title={isActive
                ? t('gantt.hideLabel', { label: label.toLowerCase() })
                : t('gantt.showLabel', { label: label.toLowerCase() })}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md border transition-all ${
                isActive
                  ? 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                  : 'border-white/5 bg-transparent opacity-40 hover:opacity-70'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-sm"
                style={{ background: val.fill }}
              />
              <span className={isActive ? '' : 'line-through'}>{label}</span>
            </button>
          )
        })}
        <span className="ml-auto text-white/30">
          {t('gantt.countSummary', { shown: scheduled.length, total: scheduledAll.length, count: scheduledAll.length })}
        </span>
      </div>

      {scheduled.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-white/50">
            {t('gantt.noneMatch')}
          </p>
          <button
            type="button"
            onClick={resetFilter}
            className="mt-3 px-3 py-1.5 text-xs text-white/70 border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
          >
            {t('gantt.showAll')}
          </button>
        </div>
      ) : (
      /* Two-column layout:
         - LEFT (sticky): participants list, each clickable to filter the
           Gantt down to their tasks. Only appears if there's at least one
           assigned participant.
         - RIGHT: SVG with horizontal scroll when the project is long. */
      <div className="flex">
        {participants.length > 0 && (
          <div className="w-44 flex-shrink-0 border-r border-white/5 bg-[#0B0B14]">
            <div
              className="text-[10px] font-bold text-white/40 uppercase tracking-wider px-3 flex items-center"
              style={{ height: headerHeight }}
            >
              {t('gantt.participantsHeader')}
            </div>
            <div>
              {participants.map(p => {
                const isActive = assigneeFilter === p.name
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setAssigneeFilter(prev => prev === p.name ? null : p.name)}
                    title={isActive
                      ? t('gantt.clearAssigneeFilter')
                      : t('gantt.filterByAssignee', { name: p.name })}
                    className={`w-full text-left px-3 flex items-center justify-between gap-2 transition-colors border-b border-white/[0.03] ${
                      isActive
                        ? 'bg-violet-500/15 text-violet-200'
                        : 'text-white/70 hover:bg-white/[0.03]'
                    }`}
                    style={{ height: rowHeight }}
                  >
                    <span className="text-xs truncate">{p.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-violet-500/30 text-violet-100' : 'bg-white/5 text-white/40'
                    }`}>
                      {p.count}
                    </span>
                  </button>
                )
              })}
              {assigneeFilter && (
                <button
                  type="button"
                  onClick={() => setAssigneeFilter(null)}
                  className="w-full text-center text-[11px] text-violet-300/80 hover:text-violet-200 py-2 border-b border-white/[0.03]"
                >
                  {t('gantt.clearAssigneeFilter')}
                </button>
              )}
            </div>
          </div>
        )}
      <div className="overflow-x-auto flex-1">
        <svg width={width} height={height} className="block min-w-full">
          {/* Grid background: vertical lines at each tick */}
          {ticks.map((t, i) => (
            <line
              key={`grid-${i}`}
              x1={t.x}
              x2={t.x}
              y1={headerHeight}
              y2={height}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth={1}
            />
          ))}

          {/* Header: date labels */}
          {ticks.map((t, i) => (
            <text
              key={`tick-${i}`}
              x={t.x + 2}
              y={20}
              fill="rgba(255,255,255,0.4)"
              fontSize={10}
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {formatDate(t.date)}
            </text>
          ))}
          <line
            x1={0}
            x2={width}
            y1={headerHeight - 1}
            y2={headerHeight - 1}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={1}
          />

          {/* TODAY line (vertical dashed) */}
          {todayInRange && (
            <>
              <line
                x1={todayX}
                x2={todayX}
                y1={headerHeight - 6}
                y2={height}
                stroke="rgba(139, 92, 246, 0.6)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
              <text
                x={todayX + 3}
                y={headerHeight - 8}
                fill="rgb(167, 139, 250)"
                fontSize={9}
                fontWeight={700}
              >
                TODAY
              </text>
            </>
          )}

          {/* Task bars */}
          {scheduled.map((task, i) => {
            const startDays = daysBetween(rangeStart, task.start)
            const durationDays = Math.max(1, daysBetween(task.start, task.end) + 1)
            const x = startDays * dayWidth
            const y = headerHeight + i * rowHeight + 6
            // Minimum width so the label ALWAYS fits inside (at least one
            // word + ellipsis). We prefer reading "Confirm…" inside the
            // bar over text floating outside, even if the bar ends up a
            // little wider than the real duration would imply.
            // The native tooltip still shows the full text.
            const naturalW = durationDays * dayWidth - 4
            const w = Math.max(70, naturalW)
            const h = rowHeight - 12
            const colors = STATUS_COLORS[task.status] || STATUS_COLORS.pending
            // Rough estimate of visible chars at 11px: ~6px per char.
            const labelMaxChars = Math.max(4, Math.floor((w - 12) / 6))
            const label = task.text.length > labelMaxChars
              ? task.text.slice(0, Math.max(1, labelMaxChars - 1)) + '…'
              : task.text

            return (
              <g
                key={task.id}
                onClick={() => onTaskClick?.(task.id)}
                style={{ cursor: onTaskClick ? 'pointer' : 'default' }}
              >
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  rx={4}
                  fill={colors.fill}
                  stroke={colors.stroke}
                  strokeWidth={1}
                  opacity={0.85}
                />
                <text
                  x={x + 6}
                  y={y + h / 2 + 4}
                  fill="white"
                  fontSize={11}
                  fontWeight={500}
                  fontFamily="system-ui, -apple-system, sans-serif"
                  style={{ pointerEvents: 'none' }}
                >
                  {label}
                </text>
                {/* Native browser tooltip with full info */}
                <title>
                  {`${task.text}\n${t(`gantt.statusLabels.${colors.labelKey}`)}\n${formatDate(task.start)} → ${formatDate(task.end)}${task.assignedTo ? `\n${t('gantt.assignedTo', { name: task.assignedTo })}` : ''}`}
                </title>
              </g>
            )
          })}
        </svg>
      </div>
      </div>
      )}
    </div>
  )
}
