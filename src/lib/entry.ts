import { ulid } from 'ulid'
import { TAG_KINDS, type TagKind, kindForSigil, tagKey, tagKindOf, tagName, tagToken } from './tagKinds'

/** A photo attached to an entry. Only this small reference lives on the entry; the bytes live elsewhere. */
export interface ImageRef {
  hash: string // first 16 hex chars of the SHA-256 of the original bytes; also the file name stem
  ext: string // from the sniffed file type: 'jpg' | 'png' | 'webp' | 'gif' | 'heic' | ...
  w: number // width after EXIF rotation, 0 if not known yet
  h: number // height after EXIF rotation, 0 if not known yet
}

export interface Entry {
  id: string
  createdAt: number // ms epoch
  updatedAt: number // ms epoch, bumped on every edit/delete
  text: string
  tags: string[] // stored keys, lowercase: plain tags without '#' (`work`), people/places with their symbol (`@sarah`, `~home`)
  day: string // YYYY-MM-DD, local time
  hour: number // 0-23
  minute: number // minutes since local midnight
  weekday: number // 0 = Sunday
  deleted: 0 | 1
  dirty: 0 | 1 // changed since last sync
  images?: ImageRef[] // missing means none (old rows and files have no images)
}

type CoreFields = Pick<Entry, 'id' | 'createdAt' | 'updatedAt' | 'text' | 'deleted' | 'dirty' | 'images'>

/** An entry's images; treats a missing field as none. */
export const entryImages = (e: Pick<Entry, 'images'>): ImageRef[] => e.images ?? []

/** Same images in the same order (a missing field equals none). */
export function sameImages(a: Pick<Entry, 'images'>, b: Pick<Entry, 'images'>): boolean {
  const x = entryImages(a)
  const y = entryImages(b)
  return x.length === y.length && x.every((i, n) => i.hash === y[n].hash && i.ext === y[n].ext && i.w === y[n].w && i.h === y[n].h)
}

// '-' is not special outside a character class, and the 'u' flag rejects `\-` there (renaming #deep-focus used to throw).
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

/** Characters that may not come right before a tag symbol: a word (so "bob@example.com" is no tag), "&", or any symbol. */
const SIGILS = TAG_KINDS.map((k) => escapeRe(k.sigil)).join('')
const NOT_BEFORE = `(?<![\\p{L}\\p{N}_&${SIGILS}])`
const NAME_REST = '[\\p{L}\\p{N}_\\-/]*'
const nameStart = (k: TagKind) => (k.letterFirst ? '\\p{L}' : '\\p{L}\\p{N}_')

/** One alternative per kind, in TAG_KINDS order, each with one capture group holding the name. */
const ANY_TAG_RE = new RegExp(
  NOT_BEFORE + '(?:' + TAG_KINDS.map((k) => `${escapeRe(k.sigil)}([${nameStart(k)}]${NAME_REST})`).join('|') + ')',
  'gu',
)

const cleanName = (t: string) => t.replace(/[-/]+$/, '').toLowerCase()

/** The stored keys of every tag in text (see tagKinds.ts), in the order they first appear. */
export function extractTags(text: string): string[] {
  const out = new Set<string>()
  for (const m of text.matchAll(ANY_TAG_RE)) {
    const i = m.slice(1).findIndex((g) => g !== undefined)
    out.add(tagKey(TAG_KINDS[i], cleanName(m[i + 1])))
  }
  return [...out]
}

export interface TagSegment {
  text: string // exactly as written
  key?: string // set when the segment is a tag: its stored key
}

/**
 * Cut text into plain pieces and tags, in order, so the pieces join back into the text. A tag's trailing `-` or `/`
 * is left in the plain text after it, because it is not part of the name (`#wip-` is the tag `wip`).
 */
export function tagSegments(text: string): TagSegment[] {
  const out: TagSegment[] = []
  let last = 0
  for (const m of text.matchAll(ANY_TAG_RE)) {
    const i = m.slice(1).findIndex((g) => g !== undefined)
    const start = m.index
    const end = start + m[0].length - (m[0].match(/[-/]+$/)?.[0].length ?? 0)
    if (start > last) out.push({ text: text.slice(last, start) })
    out.push({ text: text.slice(start, end), key: tagKey(TAG_KINDS[i], cleanName(m[i + 1])) })
    last = end
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out
}

const PARTIAL_RE = new RegExp(`${NOT_BEFORE}([${SIGILS}])([\\p{L}\\p{N}_\\-/]*)$`, 'u')

/** The tag being typed at the end of `beforeCaret` (a symbol and what follows it so far), if there is one. */
export function tagBeingTyped(beforeCaret: string): { kind: TagKind; partial: string; start: number } | null {
  const m = PARTIAL_RE.exec(beforeCaret)
  const kind = m && kindForSigil(m[1])
  return m && kind ? { kind, partial: m[2].toLowerCase(), start: m.index } : null
}

/**
 * Replace every `from` tag in text with `to` (case-insensitive, whole tag only). Both are stored keys of the same kind:
 * `work`/`job`, or `@sarah`/`@sara`. A key of another kind for `to` writes that kind's symbol.
 */
export function replaceTag(text: string, from: string, to: string): string {
  const kind = tagKindOf(from)
  const re = new RegExp(`${NOT_BEFORE}${escapeRe(kind.sigil)}${escapeRe(tagName(from))}(?![\\p{L}\\p{N}_\\-/])`, 'giu')
  return text.replace(re, () => tagToken(to))
}

export const pad = (n: number) => String(n).padStart(2, '0')

export function dayKey(d: Date | number): string {
  const x = new Date(d)
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
}

export function parseDayKey(k: string): Date {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(k: string, n: number): string {
  const d = parseDayKey(k)
  d.setDate(d.getDate() + n)
  return dayKey(d)
}

export function timeLabel(ts: number): string {
  const d = new Date(ts)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function longDayLabel(k: string): string {
  const d = parseDayKey(k)
  return `${WEEKDAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
}

export function shortDayLabel(k: string): string {
  const d = parseDayKey(k)
  return `${WEEKDAY_NAMES[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`
}

/**
 * Fill in the fields that are derived from text and createdAt.
 * Every field of CoreFields must be copied here: anything left out is silently dropped on edit, tag rename and parse.
 * `images` is only set when there are some, so entries without images look exactly as they did before images existed.
 */
export function withDerived(e: CoreFields): Entry {
  const d = new Date(e.createdAt)
  const out: Entry = {
    id: e.id,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    text: e.text,
    deleted: e.deleted,
    dirty: e.dirty,
    tags: extractTags(e.text),
    day: dayKey(d),
    hour: d.getHours(),
    minute: d.getHours() * 60 + d.getMinutes(),
    weekday: d.getDay(),
  }
  if (e.images?.length) out.images = e.images.map((i) => ({ hash: i.hash, ext: i.ext, w: i.w, h: i.h }))
  return out
}

export function makeEntry(text: string, createdAt = Date.now(), id = ulid(createdAt), images: ImageRef[] = []): Entry {
  return withDerived({ id, createdAt, updatedAt: createdAt, text, deleted: 0, dirty: 1, images })
}

export function formatGap(minutes: number): string {
  const m = Math.round(minutes)
  if (m < 60) return `+${m} min`
  const h = Math.floor(m / 60)
  return `+${h} h ${pad(m % 60)} min`
}
