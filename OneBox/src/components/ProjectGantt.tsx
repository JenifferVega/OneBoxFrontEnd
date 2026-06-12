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

import { useMemo } from 'react'

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

// Colores por estado — el mismo lenguaje visual que en el resto de la app
// (cards de COMPLETADAS/PENDIENTES/BLOQUEADAS).
const STATUS_COLORS: Record<string, { fill: string; stroke: string; label: string }> = {
  pending:     { fill: 'rgb(245, 158, 11)',  stroke: 'rgb(217, 119, 6)',  label: 'Pendiente'  },  // amber
  in_progress: { fill: 'rgb(56, 189, 248)',  stroke: 'rgb(14, 165, 233)', label: 'En curso'   },  // sky
  done:        { fill: 'rgb(16, 185, 129)',  stroke: 'rgb(5, 150, 105)',  label: 'Completada' },  // emerald
  blocked:     { fill: 'rgb(239, 68, 68)',   stroke: 'rgb(220, 38, 38)',  label: 'Bloqueada'  },  // red
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
  // Filtrar solo tareas con AMBAS fechas válidas
  const scheduled = useMemo(() => {
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

  if (scheduled.length === 0) {
    return (
      <div className="bg-[#0E0E18] border border-white/5 rounded-2xl p-8 text-center">
        <div className="text-4xl mb-3 opacity-30">📊</div>
        <p className="text-sm text-white/50">No hay tareas con fechas asignadas todavía.</p>
        <p className="text-xs text-white/30 mt-1">
          Edita cualquier tarea y asígnale fecha de inicio y fin para verla aquí.
        </p>
      </div>
    )
  }

  // Calcular rango de fechas: desde la más temprana hasta la más tardía, con
  // margen de 3 días a cada lado para que las barras no toquen el borde.
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const minStart = scheduled.reduce((m, t) => (t.start < m ? t.start : m), scheduled[0].start)
  const maxEnd = scheduled.reduce((m, t) => (t.end > m ? t.end : m), scheduled[0].end)
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
      {/* Leyenda de colores arriba */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-b border-white/5 text-[11px] text-white/60">
        {Object.entries(STATUS_COLORS).map(([key, val]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-sm"
              style={{ background: val.fill }}
            />
            {val.label}
          </div>
        ))}
        <span className="ml-auto text-white/30">
          {scheduled.length} tarea{scheduled.length !== 1 ? 's' : ''} en timeline
        </span>
      </div>

      {/* Contenedor con scroll horizontal cuando el proyecto es largo */}
      <div className="overflow-x-auto">
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
            const w = durationDays * dayWidth - 4
            const h = rowHeight - 12
            const colors = STATUS_COLORS[task.status] || STATUS_COLORS.pending
            // Texto: si la barra es muy estrecha, omitirlo (se ve en tooltip)
            const labelMaxChars = Math.floor(w / 6)
            const label = task.text.length > labelMaxChars
              ? task.text.slice(0, Math.max(0, labelMaxChars - 1)) + '…'
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
                {w > 30 && (
                  <text
                    x={x + 6}
                    y={y + h / 2 + 4}
                    fill="white"
                    fontSize={11}
                    fontWeight={500}
                    fontFamily="system-ui, -apple-system, sans-serif"
                  >
                    {label}
                  </text>
                )}
                {/* Tooltip nativo del navegador con info completa */}
                <title>
                  {`${task.text}\n${colors.label}\n${formatDate(task.start)} → ${formatDate(task.end)}${task.assignedTo ? `\nAsignada a: ${task.assignedTo}` : ''}`}
                </title>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
