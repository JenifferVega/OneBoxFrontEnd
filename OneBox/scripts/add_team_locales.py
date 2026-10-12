"""Adds nav.members/nav.board, members.* and board.* to locales/en.json and es.json (keeps everything else)."""
import json, sys
from pathlib import Path
EN = {
 "nav": {"members": "Members", "board": "Board"},
 "members": {
  "title": "Members", "subtitle": "How each person is doing with their updates, in the projects you own.",
  "allProjects": "All projects", "refresh": "Refresh", "loading": "Loading…", "empty": "Nobody here with this filter.",
  "never": "never", "today": "today", "yesterday": "yesterday",
  "daysAgo_one": "{{count}} day ago", "daysAgo_other": "{{count}} days ago",
  "noEmail": "no email", "lastUpdate": "Last update", "updating": "updating now",
  "openTasks_one": "{{count}} open task", "openTasks_other": "{{count}} open tasks",
  "overdue_one": "{{count}} overdue", "overdue_other": "{{count}} overdue",
  "waitingApproval_one": "Reported done: waiting for your approval", "waitingApproval_other": "{{count}} tasks reported done: waiting for your approval",
  "waitingOther": "Waiting on someone else", "pausedUntil": "until {{date}}",
  "viewUpdates": "See their updates", "resume": "Resume follow-up", "pause": "Pause follow-up",
  "openPlanning": "Open the project in Replanning", "updatesTitle": "Updates from {{name}}",
  "noUpdates": "No updates yet.", "inProgress": "in progress", "consolidated": "in a daily summary",
  "noItems": "Nothing recorded.", "needs": "needs {{who}}",
  "conversation_one": "Conversation ({{count}} message)", "conversation_other": "Conversation ({{count}} messages)",
  "state": {"all": "All", "late": "Late", "due": "Update due", "waiting_you": "Waiting on you", "ok": "Up to date",
            "paused": "Paused", "no_account": "No account", "no_tasks": "No tasks", "owner": "Owner"},
  "itemType": {"done": "Done", "progress": "Progress", "not_started": "Not started", "blocker": "Blocker",
               "date_change": "New date", "plan": "Plan", "idea": "Idea", "question": "Question", "hearsay": "Heard from others"},
 },
 "board": {
  "title": "Board", "subtitle": "Tasks of all your projects", "refresh": "Refresh",
  "allProjects": "All projects", "everyone": "Everyone", "unassigned": "Unassigned",
  "thisWeek": "This week", "nextWeek": "Next week", "lastWeek": "Last week",
  "prevWeek": "Previous week", "nextWeekBtn": "Next week", "allDates": "All dates",
  "noDate": "Include tasks without a date", "overdueNote": "Overdue tasks are shown in this week",
  "loading": "Loading tasks…", "empty": "No tasks", "subtask": "subtask",
  "blockedPrompt": "Why is it blocked?", "moveFailed": "Could not change the status",
  "hint": "Drag a card to another column to change its status.",
  "col": {"pending": "To do", "in_progress": "In progress", "blocked": "Blocked", "done": "Done"},
 },
}
ES = {
 "nav": {"members": "Miembros", "board": "Tablero"},
 "members": {
  "title": "Miembros", "subtitle": "Cómo va cada persona con sus actualizaciones, en los proyectos que lideras.",
  "allProjects": "Todos los proyectos", "refresh": "Actualizar", "loading": "Cargando…", "empty": "No hay nadie con este filtro.",
  "never": "nunca", "today": "hoy", "yesterday": "ayer",
  "daysAgo_one": "hace {{count}} día", "daysAgo_other": "hace {{count}} días",
  "noEmail": "sin email", "lastUpdate": "Última actualización", "updating": "actualizando ahora",
  "openTasks_one": "{{count}} tarea abierta", "openTasks_other": "{{count}} tareas abiertas",
  "overdue_one": "{{count}} vencida", "overdue_other": "{{count}} vencidas",
  "waitingApproval_one": "Reportó una tarea terminada: espera tu aprobación", "waitingApproval_other": "{{count}} tareas reportadas terminadas: esperan tu aprobación",
  "waitingOther": "Esperando a otra persona", "pausedUntil": "hasta {{date}}",
  "viewUpdates": "Ver sus actualizaciones", "resume": "Reanudar seguimiento", "pause": "Pausar seguimiento",
  "openPlanning": "Abrir el proyecto en Replanificación", "updatesTitle": "Actualizaciones de {{name}}",
  "noUpdates": "Aún no hay actualizaciones.", "inProgress": "en curso", "consolidated": "en un resumen diario",
  "noItems": "No se registró nada.", "needs": "necesita a {{who}}",
  "conversation_one": "Conversación ({{count}} mensaje)", "conversation_other": "Conversación ({{count}} mensajes)",
  "state": {"all": "Todos", "late": "Atrasado", "due": "Le toca actualizar", "waiting_you": "Te espera a ti", "ok": "Al día",
            "paused": "En pausa", "no_account": "Sin cuenta", "no_tasks": "Sin tareas", "owner": "Líder"},
  "itemType": {"done": "Terminado", "progress": "Avance", "not_started": "Sin empezar", "blocker": "Bloqueo",
               "date_change": "Nueva fecha", "plan": "Plan", "idea": "Idea", "question": "Pregunta", "hearsay": "Dicho por otros"},
 },
 "board": {
  "title": "Tablero", "subtitle": "Tareas de todos tus proyectos", "refresh": "Actualizar",
  "allProjects": "Todos los proyectos", "everyone": "Todos", "unassigned": "Sin asignar",
  "thisWeek": "Esta semana", "nextWeek": "Próxima semana", "lastWeek": "Semana pasada",
  "prevWeek": "Semana anterior", "nextWeekBtn": "Semana siguiente", "allDates": "Todas las fechas",
  "noDate": "Incluir tareas sin fecha", "overdueNote": "Las tareas vencidas se muestran en esta semana",
  "loading": "Cargando tareas…", "empty": "Sin tareas", "subtask": "subtarea",
  "blockedPrompt": "¿Por qué está bloqueada?", "moveFailed": "No se pudo cambiar el estado",
  "hint": "Arrastra una tarjeta a otra columna para cambiar su estado.",
  "col": {"pending": "Por hacer", "in_progress": "En curso", "blocked": "Bloqueada", "done": "Hecha"},
 },
}
def merge(dst, src):
    for k, v in src.items():
        if isinstance(v, dict):
            merge(dst.setdefault(k, {}), v)
        else:
            dst[k] = v
base = Path(sys.argv[1])
for name, data in (("en.json", EN), ("es.json", ES)):
    p = base / name
    cur = json.loads(p.read_text(encoding="utf-8"))
    merge(cur, data)
    p.write_text(json.dumps(cur, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("updated", p)
