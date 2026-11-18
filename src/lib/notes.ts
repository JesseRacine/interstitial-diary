import type { Entry, ImageRef } from './entry'
import { NAME_REST, TAG_KINDS, type TagKind, nameStart, tagKey, tagKindOf, tagToken } from './tagKinds'

/**
 * Notes on people and places: facts that do not belong to a day ("allergic to shellfish", "closed on Mondays"). Written
 * as an entry whose text starts with `=` and a person or place tag:
 *
 *   =@sam_jones Allergic to shellfish
 *   =~blue_door Closed on Mondays
 *
 * Like events and tracking, nothing new is stored: a note is an ordinary entry and the marker stays in its text as typed.
 * The `@sam_jones` or `~blue_door` after the `=` is an ordinary tag of the entry (it is not blanked like an event title),
 * so search finds the note and renaming or merging the person or place rewrites it. The app never shows a note's day and
 * keeps notes out of the journal stream (see person-notes-plan.md). Events and plain `#tags` have no notes.
 *
 * Rules: the marker must start the text (spaces and line breaks before it are fine), so `=@sam` anywhere else is plain
 * text and an ordinary entry cannot become a note by accident. One note is about one person or place: another `@name` or
 * `~name` in its text is an ordinary mention. The note's text is what follows the marker, without the spaces and one `:`
 * right after it. A marker with nothing after it is still a note (an empty one).
 *
 * This file only imports types from `entry.ts`, so `entry.ts` may import it later without a cycle.
 */

/** The kinds that can have notes: people and places (the kinds with their own page, except plain tags). */
export const NOTE_KINDS: readonly TagKind[] = TAG_KINDS.filter((k) => k.id === 'person' || k.id === 'place')

/** Whether a stored key (`@sam`, `~home`, `work`) can have notes. */
export const canHaveNotes = (key: string): boolean => NOTE_KINDS.includes(tagKindOf(key))

/** `=`, a person or place symbol and a name (the same characters as that kind of tag). One capture group per kind. */
const NOTE_RE = new RegExp(`^\\s*=(?:${NOTE_KINDS.map((k) => `${k.sigil}([${nameStart(k)}]${NAME_REST})`).join('|')})`, 'u')

/** The marker of a note and where it ends. `key` is the stored key of the person or place, e.g. `@sam_jones`, `~blue_door`. */
export interface NoteMarker {
  key: string
  end: number // exclusive: the end of `=@name` in the text (a trailing `-` or `/` belongs to it, as in a tag)
  note: string // the text after the marker, see the rules above
}

/** The note marker that starts the text, if there is one. */
export function noteOf(text: string): NoteMarker | null {
  const m = NOTE_RE.exec(text)
  if (!m) return null
  const i = m.slice(1).findIndex((g) => g !== undefined)
  const name = m[i + 1].replace(/[-/]+$/, '').toLowerCase()
  const end = m[0].length
  const note = text.slice(end).replace(/^[ \t]*(?::[ \t]*)?/, '').replace(/^\s+/, '').trimEnd()
  return { key: tagKey(NOTE_KINDS[i], name), end, note }
}

/** Whether the entry is a note (its text starts with the marker). */
export const isNote = (e: Pick<Entry, 'text'>): boolean => noteOf(e.text) !== null

/** The entries the journal shows: everything but notes (calendar, week review, photos, events, tracking, tag pages). */
export const journalEntries = <T extends Pick<Entry, 'text'>>(entries: readonly T[]): T[] => entries.filter((e) => !isNote(e))

/**
 * The text of a new note (the Note form and Add note): `=@sam_jones Allergic to shellfish`. `key` must be a person's or a
 * place's stored key; the note is trimmed.
 */
export function noteText(key: string, note: string): string {
  if (!canHaveNotes(key)) throw new Error(`Only people and places have notes: ${key}`)
  const n = note.trim()
  return `=${tagToken(key)}${n ? ` ${n}` : ''}`
}

/** One note on a person's or a place's page. */
export interface Note {
  id: string // the entry's id
  key: string // the person or place, e.g. `@sam_jones`
  note: string
  createdAt: number
  images?: ImageRef[] // the entry's photos, if a note written another way has some
}

type NoteSource = Pick<Entry, 'id' | 'text' | 'createdAt' | 'deleted' | 'images'>

/** Every person's and place's notes, newest first, by stored key. Deleted entries are ignored. */
export function computeNotes(entries: readonly NoteSource[]): Map<string, Note[]> {
  const out = new Map<string, Note[]>()
  for (const e of entries) {
    if (e.deleted) continue
    const m = noteOf(e.text)
    if (!m) continue
    const list = out.get(m.key) ?? []
    list.push({ id: e.id, key: m.key, note: m.note, createdAt: e.createdAt, ...(e.images?.length ? { images: e.images } : {}) })
    out.set(m.key, list)
  }
  for (const list of out.values()) list.sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
  return out
}
