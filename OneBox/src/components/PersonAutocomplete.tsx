// ============================================================================
// PersonAutocomplete — a name or email input that suggests known people.
// ----------------------------------------------------------------------------
// Drop-in for the plain <input> fields where a participant is typed: it keeps
// the caller's className, value and onChange, and adds a dropdown of people
// from the user's other projects. Picking one calls onPick with the whole
// contact, so the caller can fill name AND email at once.
//
// `suggestFor`: a name to match even while the field is empty. Used where the
// AI detected a person ("Laura Gómez") and only their email is missing.
// ============================================================================
import { KeyboardEvent, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Contact } from '../services/api'
import { matchContacts, useContacts } from '../hooks/useContacts'

interface Props {
  value: string
  onChange: (value: string) => void
  onPick: (contact: Contact) => void
  /** Emails already in the team: never suggested again. */
  exclude?: string[]
  suggestFor?: string
  /** Only suggest contacts that have an email (when the email is what is missing). */
  requireEmail?: boolean
  className?: string
  wrapperClassName?: string
  placeholder?: string
  disabled?: boolean
  type?: string
  autoFocus?: boolean
  maxLength?: number
  /** Enter with no suggestion highlighted (e.g. submit the form). */
  onEnter?: () => void
}

export default function PersonAutocomplete({
  value, onChange, onPick, exclude = [], suggestFor, requireEmail,
  className, wrapperClassName = 'relative', placeholder, disabled, type = 'text',
  autoFocus, maxLength, onEnter,
}: Props) {
  const { t } = useTranslation()
  const contacts = useContacts()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)

  const matches = useMemo(() => {
    const pool = requireEmail ? contacts.filter(c => c.email) : contacts
    const query = value.trim() || suggestFor || ''
    return matchContacts(pool, query, exclude)
  }, [contacts, value, suggestFor, exclude, requireEmail])

  // Nothing to suggest when the field already holds exactly a match.
  const exact = matches.length === 1 &&
    (matches[0].email === value.trim().toLowerCase() || matches[0].name === value.trim())
  const show = open && !disabled && matches.length > 0 && !exact

  const pick = (c: Contact) => {
    onPick(c)
    setOpen(false)
    setActive(-1)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (show && e.key === 'ArrowDown') {
      e.preventDefault(); setActive(i => Math.min(i + 1, matches.length - 1))
    } else if (show && e.key === 'ArrowUp') {
      e.preventDefault(); setActive(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      if (show && active >= 0) { e.preventDefault(); pick(matches[active]) }
      else onEnter?.()
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className={wrapperClassName}>
      <input
        type={type}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); setActive(-1) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        className={className}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        maxLength={maxLength}
        autoComplete="off"
      />
      {show && (
        <ul className="absolute left-0 right-0 top-full mt-1 z-50 max-h-64 overflow-y-auto bg-[#161625] border border-white/10 rounded-xl shadow-2xl py-1">
          {!value.trim() && suggestFor && (
            <li className="px-3 pt-1.5 pb-1 text-[10px] uppercase tracking-wider text-white/30">
              {t('autocomplete.knownAs', 'Already in your projects')}
            </li>
          )}
          {matches.map((c, i) => (
            <li key={`${c.email}|${c.name}`}>
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); pick(c) }}
                onMouseEnter={() => setActive(i)}
                className={`w-full text-left px-3 py-2 transition-colors ${i === active ? 'bg-violet-500/15' : 'hover:bg-white/5'}`}
              >
                <div className="text-sm text-white truncate">{c.name || c.email}</div>
                <div className="text-[11px] text-white/40 truncate">
                  {c.email || t('autocomplete.noEmail', 'no email')}
                  {c.projects.length > 0 && ` · ${c.projects.slice(0, 2).join(', ')}${c.projects.length > 2 ? ` +${c.projects.length - 2}` : ''}`}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
