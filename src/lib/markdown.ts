import { type Entry, longDayLabel, parseDayKey, timeLabel, withDerived } from './entry'

/*
 * One Markdown file per day, oldest entry first:
 *
 *   # Sunday, 8 November 2026
 *
 *   ## 09:14 <!-- id:01JC... created:1731057240000 updated:1731057240000 -->
 *   Finished email triage. Next: draft report. #work
 *
 * Headings written by hand without the id comment ("## 14:30") are accepted too.
 * Body lines that would look like an entry heading are escaped with a leading backslash.
 */

const HEAD_RE = /^## (\d{1,2}):(\d{2})(?:\s*<!--\s*id:(\S+)\s+created:(\d+)\s+updated:(\d+)\s*-->)?\s*$/
const LOOKS_LIKE_HEAD = /^\\*## /

export function dayFilePath(day: string): string {
  return `${day.slice(0, 4)}/${day}.md`
}

export function serializeDay(day: string, entries: Entry[]): string {
  const live = entries.filter((e) => !e.deleted && e.day === day).sort((a, b) => a.createdAt - b.createdAt)
  let out = `# ${longDayLabel(day)}\n`
  for (const e of live) {
    const body = e.text
      .trim()
      .split('\n')
      .map((l) => (LOOKS_LIKE_HEAD.test(l) ? `\\${l}` : l))
      .join('\n')
    out += `\n## ${timeLabel(e.createdAt)} <!-- id:${e.id} created:${e.createdAt} updated:${e.updatedAt} -->\n${body}\n`
  }
  return out
}

function hash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

export function parseDay(md: string, day: string): Entry[] {
  const out: Entry[] = []
  let head: RegExpMatchArray | null = null
  let body: string[] = []

  const flush = () => {
    if (!head) return
    const text = body.join('\n').trim()
    const [, hh, mm, id, created, updated] = head
    if (id) {
      out.push(withDerived({ id, createdAt: Number(created), updatedAt: Number(updated), text, deleted: 0, dirty: 0 }))
    } else if (text) {
      const d = parseDayKey(day)
      d.setHours(Number(hh), Number(mm), 0, 0)
      const createdAt = d.getTime()
      const genId = `h${day.replace(/-/g, '')}${hh.padStart(2, '0')}${mm}${hash(text)}`
      out.push(withDerived({ id: genId, createdAt, updatedAt: createdAt, text, deleted: 0, dirty: 0 }))
    }
  }

  for (const line of md.replace(/\r\n?/g, '\n').split('\n')) {
    const m = line.match(HEAD_RE)
    if (m) {
      flush()
      head = m
      body = []
    } else if (head) {
      body.push(line.startsWith('\\') && LOOKS_LIKE_HEAD.test(line) ? line.slice(1) : line)
    }
  }
  flush()
  return out
}
