import type { TagStat } from '../search/engine'
import { NOTE_KINDS, canHaveNotes } from './notes'
import { displayName, parseTagName, tagKey, tagKindOf, tagName } from './tagKinds'

/**
 * The "Note about" field of the Note form (Capture.tsx): who or where a new note is about. The user types part of a
 * name and picks a suggestion, or types a name:
 * - `Sam Jones`, `sam_jones` or `@sam_jones` all mean the person `@sam_jones`; `~blue_door` means the place.
 * - A name without a symbol that is a known person or place is that one. If both a person and a place have that name,
 *   the symbol is needed. A new name without a symbol makes a new **person**; `~` first makes a new place.
 */
export type NoteTarget =
  | { key: string; isNew: boolean } // ready: the stored key, and whether no entry names it yet
  | { error: string }
  | null // nothing typed

export function resolveNoteTarget(input: string, known: readonly string[]): NoteTarget {
  const s = input.trim()
  if (!s) return null
  const byKind = NOTE_KINDS.find((k) => s.startsWith(k.sigil))
  if (byKind) {
    const parsed = parseTagName(byKind, s)
    if ('error' in parsed) return parsed
    const key = tagKey(byKind, parsed.name)
    return { key, isNew: !known.includes(key) }
  }
  const keys = NOTE_KINDS.flatMap((k) => {
    const parsed = parseTagName(k, s)
    return 'error' in parsed ? [] : [tagKey(k, parsed.name)]
  })
  const existing = keys.filter((k) => known.includes(k))
  if (existing.length === 1) return { key: existing[0], isNew: false }
  if (existing.length > 1) {
    return { error: `A person and a place are both called ${displayName(existing[0])}: type @ or ~ in front.` }
  }
  const person = NOTE_KINDS[0]
  const parsed = parseTagName(person, s)
  if ('error' in parsed) return parsed
  return { key: tagKey(person, parsed.name), isNew: true }
}

/**
 * People and places to suggest for what is typed so far, most used first (the order of `stats`): a name that starts with
 * it, or whose shown name has a word starting with it ("jo" finds Sam Jones). A typed `@` or `~` keeps to that kind.
 */
export function noteTargetSuggestions(input: string, stats: readonly TagStat[], n = 6): string[] {
  const s = input.trim().toLowerCase()
  if (!s) return []
  const kind = NOTE_KINDS.find((k) => s.startsWith(k.sigil))
  const q = (kind ? s.slice(kind.sigil.length) : s).replace(/\s+/g, '_')
  if (!q) return []
  const words = q.split('_').filter(Boolean)
  const out: string[] = []
  for (const t of stats) {
    if (!canHaveNotes(t.tag) || (kind && tagKindOf(t.tag) !== kind)) continue
    const name = tagName(t.tag)
    const shown = displayName(t.tag).toLowerCase().split(/\s+/)
    const match = name.startsWith(q) || (words.length === 1 && shown.some((w) => w.startsWith(words[0])))
    if (!match) continue
    out.push(t.tag)
    if (out.length === n) break
  }
  return out
}
