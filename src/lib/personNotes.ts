import type { Entry, ImageRef } from './entry'
import { NAME_REST, TAG_KINDS, nameStart, tagKey, tagKindOf, tagToken } from './tagKinds'

/**
 * Person notes: facts about someone that do not belong to a day ("allergic to shellfish"). Written as an entry whose text
 * starts with `=` and a person tag:
 *
 *   =@sam_jones Allergic to shellfish
 *
 * Like events and tracking, nothing new is stored: a note is an ordinary entry and the marker stays in its text as typed.
 * The `@sam_jones` after the `=` is an ordinary person tag of the entry (it is not blanked like an event title), so search
 * finds the note and renaming or merging the person rewrites it. The app never shows a note's day and keeps notes out of
 * the journal stream (see person-notes-plan.md).
 *
 * Rules: the marker must start the text (spaces and line breaks before it are fine), so `=@sam` anywhere else is plain
 * text and an ordinary entry cannot become a note by accident. One note is about one person: another `@name` in its text
 * is an ordinary mention. The note's text is what follows the marker, without the spaces and one `:` right after it.
 * A marker with nothing after it is still a note (an empty one).
 *
 * This file only imports types from `entry.ts`, so `entry.ts` may import it later without a cycle.
 */

const PERSON = TAG_KINDS.find((k) => k.id === 'person')!

/** `=@`, a person name (the same characters as a person tag), and nothing that could continue the name. */
const NOTE_RE = new RegExp(`^\\s*=@([${nameStart(PERSON)}]${NAME_REST})`, 'u')

/** The marker of a note and where it ends. `key` is the person's stored key, e.g. `@sam_jones`. */
export interface PersonNoteMarker {
  key: string
  end: number // exclusive: the end of `=@name` in the text (a trailing `-` or `/` belongs to it, as in a tag)
  note: string // the text after the marker, see the rules above
}

/** The note marker that starts the text, if there is one. */
export function personNoteOf(text: string): PersonNoteMarker | null {
  const m = NOTE_RE.exec(text)
  if (!m) return null
  const name = m[1].replace(/[-/]+$/, '').toLowerCase()
  const end = m[0].length
  const note = text.slice(end).replace(/^[ \t]*(?::[ \t]*)?/, '').replace(/^\s+/, '').trimEnd()
  return { key: tagKey(PERSON, name), end, note }
}

/** Whether the entry is a person note (its text starts with the marker). */
export const isPersonNote = (e: Pick<Entry, 'text'>): boolean => personNoteOf(e.text) !== null

/**
 * The text of a new note (the Add note button): `=@sam_jones Allergic to shellfish`. `key` must be a person's stored key;
 * the note is trimmed.
 */
export function personNoteText(key: string, note: string): string {
  if (tagKindOf(key) !== PERSON) throw new Error(`Not a person: ${key}`)
  const n = note.trim()
  return `=${tagToken(key)}${n ? ` ${n}` : ''}`
}

/** One note on a person's page. */
export interface PersonNote {
  id: string // the entry's id
  key: string // the person, e.g. `@sam_jones`
  note: string
  createdAt: number
  images?: ImageRef[] // the entry's photos, if a note written another way has some
}

type NoteSource = Pick<Entry, 'id' | 'text' | 'createdAt' | 'deleted' | 'images'>

/** Every person's notes, newest first, by person key. Deleted entries are ignored. */
export function computePersonNotes(entries: readonly NoteSource[]): Map<string, PersonNote[]> {
  const out = new Map<string, PersonNote[]>()
  for (const e of entries) {
    if (e.deleted) continue
    const m = personNoteOf(e.text)
    if (!m) continue
    const list = out.get(m.key) ?? []
    list.push({ id: e.id, key: m.key, note: m.note, createdAt: e.createdAt, ...(e.images?.length ? { images: e.images } : {}) })
    out.set(m.key, list)
  }
  for (const list of out.values()) list.sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
  return out
}
