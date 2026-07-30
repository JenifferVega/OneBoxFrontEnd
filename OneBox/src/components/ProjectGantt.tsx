// ============================================================================
// ProjectGantt.tsx
// ----------------------------------------------------------------------------
// Vista Gantt simple, custom (SVG + tailwind), para mostrar las tareas de
// UN proyecto en una línea de tiempo horizontal.
//
// Decisiones de diseño:
//  - SIN librería externa (no más npm install) → más liviano, más control de
//    estilos para que encaje con el dark theme.
//  - SVG para las barras (simple y escala bien).
//  - Escala dinámica: el rango de fechas va desde la tarea más temprana hasta
//    la más tardía, con margen. Si no hay rango, default ±15 días desde hoy.
//  - Línea vertical "HOY" para orientación temporal.
//  - Tareas sin fechas → no se muestran en el Gantt (se listan en otra sección
//    del proyecto). Eso lo decide el padre, este componente solo dibuja las
//    que tengan ambas fechas.
//  - Click en una barra → callback al padre (abre modal de la tarea existente).
// ============================================================================

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

export interface GanttTask {
  id: string
  text: string
  status: string             // pending | in_progress | done | blocked
  startDate?: string         // YYYY-MM-DD
  dueDate?: string           // YYYY-MM-DD
  assignedTo?: string        // nombre para tooltip
}

interface Props {
  tasks: GanttTask[]
  onTaskClick?: (taskId: string) => void
}

// Colores por estado — el mismo lenguaje visual que en el resto de la app.
// El label se resuelve con i18n al render (labelKey → gantt.statusLabels.<key>).
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
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

export default function ProjectGantt({ tasks, onTaskClick }: Props) {
  const { t } = useTranslation()
  // Filtro por estado — click en la leyenda toggle ese estado.
  // Arranca con todos activos (comportamiento previo, sin filtro visible).
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(
    () => new Set(Object.keys(STATUS_COLORS))
  )
  // Filtro por participante — click en una fila de la columna izquierda toggle
  // ese participante como filtro único. null = sin filtro (muestra todas).
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

  // Filtrar solo tareas con AMBAS fechas válidas — antes del filtro por estado
  // para saber si el proyecto tiene tareas planificadas (empty state distinto).
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
  // Lista de participantes DERIVADA de las tareas planificadas (deduplicada,
  // conservando orden de aparición). Cada uno con su count de tareas.
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

  // Calcular rango de fechas: desde la más temprana hasta la más tardía, con
  // margen de 3 días a cada lado para que las barras no toquen el borde.
  // Usamos scheduledAll (no scheduled) para que el eje temporal NO se reajuste
  // cuando el usuario toggle un filtro. La ventana visible es estable.
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const minStart = scheduledAll.reduce((m, t) => (t.start < m ? t.start : m), scheduledAll[0].start)
  const maxEnd = scheduledAll.reduce((m, t) => (t.end > m ? t.end : m), scheduledAll[0].end)
  const rangeStart = new Date(minStart)
  rangeStart.setDate(rangeStart.getDate() - 3)
  const rangeEnd = new Date(maxEnd)
  rangeEnd.setDate(rangeEnd.getDate() + 3)
  const totalDays = Math.max(1, daysBetween(rangeStart, rangeEnd))

  // Dimensiones del SVG
  const rowHeight = 36
  const headerHeight = 40
  const dayWidth = Math.max(20, Math.min(60, 900 / totalDays)) // adaptativo
  const width = totalDays * dayWidth
  const height = headerHeight + scheduled.length * rowHeight + 10

  // Generar ticks de fechas para el header — cada N días según el zoom
  const tickEvery = totalDays > 60 ? 7 : totalDays > 30 ? 3 : 1
  const ticks: Array<{ x: number; date: Date }> = []
  for (let i = 0; i <= totalDays; i += tickEvery) {
    const d = new Date(rangeStart)
    d.setDate(d.getDate() + i)
    ticks.push({ x: i * dayWidth, date: d })
  }

  // Posición de la línea "HOY"
  const todayDays = daysBetween(rangeStart, today)
  const todayX = todayDays * dayWidth
  const todayInRange = todayDays >= 0 && todayDays <= totalDays

  return (
    <div className="bg-[#0E0E18] border border-white/5 rounded-2xl overflow-hidden">
      {/* Leyenda de colores arriba — cada chip es un toggle de filtro por estado.
          Click apaga/enciende ese estado. Chip apagado se ve atenuado y
          desaturado; el contador y las barras respetan el filtro. */}
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
      /* Layout de dos columnas:
         - IZQUIERDA (sticky): lista de participantes, cada uno clickeable
           para filtrar el Gantt a sus tareas. Solo aparece si hay al menos
           un participante asignado.
         - DERECHA: SVG con scroll horizontal cuando el proyecto es largo. */
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
          {/* Fondo de grid: líneas verticales en cada tick */}
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

          {/* Header: etiquetas de fecha */}
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

          {/* Línea de HOY (vertical roja punteada) */}
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
                HOY
              </text>
            </>
          )}

          {/* Barras de tareas */}
          {scheduled.map((task, i) => {
            const startDays = daysBetween(rangeStart, task.start)
            const durationDays = Math.max(1, daysBetween(task.start, task.end) + 1)
            const x = startDays * dayWidth
            const y = headerHeight + i * rowHeight + 6
            // Ancho mínimo para que el label SIEMPRE quepa adentro (al menos
            // una palabra + ellipsis). Preferimos leer "Confirmar…" dentro
            // del bar antes que texto flotando por fuera, aunque la barra
            // quede un pelín más ancha de lo que la duración real implicaría.
            // El tooltip nativo sigue mostrando el texto completo.
            const naturalW = durationDays * dayWidth - 4
            const w = Math.max(70, naturalW)
            const h = rowHeight - 12
            const colors = STATUS_COLORS[task.status] || STATUS_COLORS.pending
            // Cálculo grosero de chars visibles a 11px: ~6px por char.
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
                {/* Tooltip nativo del navegador con info completa */}
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
