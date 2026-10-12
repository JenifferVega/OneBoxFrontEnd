// ============================================================================
// localized.ts — show a backend text in the viewer's language.
// ----------------------------------------------------------------------------
// The API sends records with an `i18n` map next to the plain fields:
//   { title: "Tarea creada", i18n: { es: { title: "Tarea creada" }, en: { title: "Task created" } } }
// loc(record, 'title', lang) returns the version for the app language and
// falls back to the plain field (not translated yet, or translation pending).
// Switching language in the top bar re-renders with the other version: no
// request to the server.
// ============================================================================
export type I18nVersions = Partial<Record<'es' | 'en', Record<string, string>>>

export function loc(record: any, field: string, lang: string | undefined): string {
  const l: 'es' | 'en' = (lang || '').startsWith('es') ? 'es' : 'en'
  const v = record?.i18n?.[l]?.[field]
  return (typeof v === 'string' && v) ? v : (record?.[field] ?? '')
}
