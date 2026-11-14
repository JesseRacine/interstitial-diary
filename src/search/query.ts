import { addDays, dayKey, pad } from '../lib/entry'
import { eventKey } from '../lib/events'
import { kindForSigil, tagKey } from '../lib/tagKinds'

export interface ParsedQuery {
  terms: string[] // keywords, all must match (prefix + fuzzy)
  phrases: string[] // exact substrings
  excludeTerms: string[] // words or phrases that must not appear
  tags: string[] // all required; stored keys: `work`, `@sarah`, `~home` (see lib/tagKinds.ts)
  anyTags: string[][] // each group: at least one required (#a|#b, @a|@b)
  excludeTags: string[]
  from?: string // YYYY-MM-DD inclusive
  to?: string // YYYY-MM-DD inclusive
  timeFrom?: number // minutes since midnight, inclusive
  timeTo?: number // minutes since midnight, exclusive; < timeFrom means wraps past midnight
  weekdays?: number[]
  hasImages?: boolean // true: only entries with photos (has:image); false: only entries without (-has:image)
  events: string[] // event:"Jack's 40th": all required; each is an eventKey (cleaned title, lowercase), the WHOLE title must match
  hasEvent?: boolean // true: only entries that name an event (has:event); false: only entries that do not (-has:event)
  errors: string[]
}

const IMAGE_WORDS = new Set(['image', 'images', 'photo', 'photos'])
const EVENT_WORDS = new Set(['event', 'events'])

const DAY_ALIASES: Record<string, number[]> = {
  sun: [0], mon: [1], tue: [2], wed: [3], thu: [4], fri: [5], sat: [6],
  weekday: [1, 2, 3, 4, 5], weekdays: [1, 2, 3, 4, 5], weekend: [0, 6], weekends: [0, 6],
}

function weekdaysFor(word: string): number[] | null {
  const w = word.toLowerCase()
  return DAY_ALIASES[w] ?? DAY_ALIASES[w.slice(0, 3)] ?? null
}

/** "9", "09", "9:30", "21:00", "24" -> minutes since midnight */
export function parseTime(s: string): number | null {
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?$/)
  if (!m) return null
  const h = Number(m[1])
  const min = m[2] ? Number(m[2]) : 0
  if (h > 24 || min > 59 || (h === 24 && min > 0)) return null
  return h * 60 + min
}

const lastDayOfMonth = (y: number, m: number) => new Date(y, m, 0).getDate() // m is 1-based

/** "2026", "2026-11", "2026-11-08" -> [first day, last day] */
function dateRange(s: string): [string, string] | null {
  let m = s.match(/^(\d{4})$/)
  if (m) return [`${m[1]}-01-01`, `${m[1]}-12-31`]
  m = s.match(/^(\d{4})-(\d{1,2})$/)
  if (m) {
    const y = Number(m[1])
    const mo = Number(m[2])
    if (mo < 1 || mo > 12) return null
    return [`${y}-${pad(mo)}-01`, `${y}-${pad(mo)}-${pad(lastDayOfMonth(y, mo))}`]
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) {
    const d = `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}`
    return [d, d]
  }
  return null
}

function relativeFrom(today: string, n: number, unit: string): string | null {
  if (unit === 'd') return addDays(today, -(n - 1))
  if (unit === 'w') return addDays(today, -(n * 7 - 1))
  const [y, m, d] = today.split('-').map(Number)
  if (unit === 'm') return addDays(dayKey(new Date(y, m - 1 - n, d)), 1)
  if (unit === 'y') return addDays(dayKey(new Date(y - n, m - 1, d)), 1)
  return null
}

/**
 * Split on whitespace, keeping "quoted phrases" (optionally prefixed with -) together, and a filter whose value is quoted
 * (`event:"Jack's 40th"`, straight or curly quotes) as one token.
 */
export function tokenize(input: string): string[] {
  const out: string[] = []
  for (const m of input.matchAll(/(-?)"([^"]*)"?|(-?[A-Za-z]+:["“”][^"“”]*["“”]?)|(\S+)/g)) out.push(m[3] ?? m[4] ?? `${m[1]}"${m[2]}"`)
  return out
}

/**
 * The stored key of a tag token (`#work` gives `work`, `@Sarah` gives `@sarah`, `~home` gives `~home`), or null when
 * it is not one: no symbol, nothing after it, or a name that cannot be a tag of that kind (`~5`, `@3pm`).
 */
function tagKeyOfToken(t: string): string | null {
  const kind = kindForSigil(t.charAt(0))
  const name = t.slice(1)
  if (!kind || !name || (kind.letterFirst && !/^\p{L}/u.test(name))) return null
  return tagKey(kind, name)
}

export function parseQuery(input: string, now: Date = new Date()): ParsedQuery {
  const q: ParsedQuery = { terms: [], phrases: [], excludeTerms: [], tags: [], anyTags: [], excludeTags: [], events: [], errors: [] }
  const today = dayKey(now)
  const narrowFrom = (d: string) => { if (!q.from || d > q.from) q.from = d }
  const narrowTo = (d: string) => { if (!q.to || d < q.to) q.to = d }

  for (const raw of tokenize(input)) {
    const lower = raw.toLowerCase()

    // Phrases
    const phrase = raw.match(/^(-?)"(.*)"$/)
    if (phrase) {
      const p = phrase[2].trim().toLowerCase()
      if (p) (phrase[1] ? q.excludeTerms : q.phrases).push(p)
      continue
    }

    // Tags, people and places: #work  @sarah  ~home  -#work  -@sarah  @sarah|@tom  #work|~home
    const excluded = lower.startsWith('-') ? tagKeyOfToken(lower.slice(1)) : null
    if (excluded) { q.excludeTags.push(excluded); continue }
    if (kindForSigil(lower.charAt(0)) && lower.length > 1) {
      // In a group, a part without a symbol is a plain tag name (`#a|b`); a part that cannot be a tag is dropped.
      const group = lower.split('|').map((part) => tagKeyOfToken(part) ?? (kindForSigil(part.charAt(0)) ? '' : part)).filter(Boolean)
      if (group.length > 1) { q.anyTags.push(group); continue }
      if (group.length === 1) { q.tags.push(group[0]); continue }
      if (lower.includes('|')) continue // a group with no usable tag is ignored
      // otherwise a lone token like "~5" or "@3pm" is not a tag: it falls through and is searched as a word
    }

    // Relative day keywords
    if (lower === 'today') { narrowFrom(today); narrowTo(today); continue }
    if (lower === 'yesterday') { const y = addDays(today, -1); narrowFrom(y); narrowTo(y); continue }

    // key:value filters
    const kv = lower.match(/^(-?)(on|from|to|in|last|time|after|before|day|has|event):(.+)$/)
    if (kv && (!kv[1] || kv[2] === 'has')) { // only has: can be negated (-has:image)
      const [, neg, key, val] = kv
      let ok = true
      if (key === 'has') {
        if (IMAGE_WORDS.has(val)) q.hasImages = !neg
        else if (EVENT_WORDS.has(val)) q.hasEvent = !neg
        else ok = false
      } else if (key === 'event') {
        // The title as in the entry: quotes around it are optional when it is one word (event:party).
        const wanted = eventKey(val.replace(/^["“”]+|["“”]+$/g, ''))
        if (wanted) q.events.push(wanted); else ok = false
      } else if (key === 'on' || key === 'in') {
        const r = dateRange(val)
        if (r) { narrowFrom(r[0]); narrowTo(r[1]) } else ok = false
      } else if (key === 'from') {
        const r = dateRange(val)
        if (r) narrowFrom(r[0]); else ok = false
      } else if (key === 'to') {
        const r = dateRange(val)
        if (r) narrowTo(r[1]); else ok = false
      } else if (key === 'last') {
        const m = val.match(/^(\d+)([dwmy])$/)
        const f = m && Number(m[1]) > 0 ? relativeFrom(today, Number(m[1]), m[2]) : null
        if (f) { narrowFrom(f); narrowTo(today) } else ok = false
      } else if (key === 'time') {
        const [a, b] = val.split('-')
        const ta = parseTime(a)
        const tb = b === undefined ? null : parseTime(b)
        if (ta !== null && tb !== null) { q.timeFrom = ta; q.timeTo = tb } else ok = false
      } else if (key === 'after') {
        const t = parseTime(val)
        if (t !== null) { q.timeFrom = t; q.timeTo = q.timeTo !== undefined && q.timeTo > t ? q.timeTo : 1440 } else ok = false
      } else if (key === 'before') {
        const t = parseTime(val)
        if (t !== null) { q.timeTo = t; q.timeFrom = q.timeFrom !== undefined && q.timeFrom < t ? q.timeFrom : 0 } else ok = false
      } else if (key === 'day') {
        const days = new Set<number>()
        for (const part of val.split(',')) {
          const w = weekdaysFor(part)
          if (w) w.forEach((d) => days.add(d)); else ok = false
        }
        if (ok) q.weekdays = [...days].sort((a, b) => a - b)
      }
      if (!ok) q.errors.push(`Didn't understand "${raw}"`)
      continue
    }

    // Excluded / plain words
    if (lower.startsWith('-') && lower.length > 1) { q.excludeTerms.push(lower.slice(1)); continue }
    if (lower === '-') continue
    q.terms.push(lower)
  }
  return q
}

export function isEmptyQuery(q: ParsedQuery): boolean {
  return !q.terms.length && !q.phrases.length && !q.excludeTerms.length && !q.tags.length && !q.anyTags.length &&
    !q.excludeTags.length && !q.from && !q.to && q.timeFrom === undefined && !q.weekdays &&
    q.hasImages === undefined && !q.events.length && q.hasEvent === undefined
}

/** Add the token if absent, remove it if present (used by filter chips). */
export function toggleToken(query: string, token: string): string {
  const tokens = tokenize(query)
  const i = tokens.findIndex((t) => t.toLowerCase() === token.toLowerCase())
  if (i >= 0) tokens.splice(i, 1)
  else tokens.push(token)
  return tokens.join(' ')
}

export function hasToken(query: string, token: string): boolean {
  return tokenize(query).some((t) => t.toLowerCase() === token.toLowerCase())
}
