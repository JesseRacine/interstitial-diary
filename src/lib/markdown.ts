import { type Entry, type ImageRef, entryImages, longDayLabel, parseDayKey, timeLabel, withDerived } from './entry'

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
 *
 * Images: a trailing block of image lines (blank lines allowed between them) after the text, one per image,
 * pointing into the year's images folder. `WxH` in the alt text is optional (0 = not known yet).
 *
 *   ## 09:14 <!-- id:... -->
 *   Finished the sketch #work
 *
 *   ![640x480](images/3f9a2c1b7d04e8aa.jpg)
 *
 * Only that trailing block becomes `images`; any other image syntax stays plain text. A text line that would be
 * read as an image line is escaped with a leading backslash, like headings.
 */

const HEAD_RE = /^## (\d{1,2}):(\d{2})(?:\s*<!--\s*id:(\S+)\s+created:(\d+)\s+updated:(\d+)\s*-->)?\s*$/
const LOOKS_LIKE_HEAD = /^\\*## /
const IMAGE_RE = /^!\[(?:(\d+)x(\d+))?\]\(images\/([0-9a-f]{8,64})\.([a-z0-9]{1,5})\)\s*$/
const LOOKS_LIKE_IMAGE = /^\\*!\[(?:\d+x\d+)?\]\(images\/[0-9a-f]{8,64}\.[a-z0-9]{1,5}\)\s*$/

export function dayFilePath(day: string): string {
  return `${day.slice(0, 4)}/${day}.md`
}

export function imageLine(i: ImageRef): string {
  const size = i.w > 0 && i.h > 0 ? `${i.w}x${i.h}` : ''
  return `![${size}](images/${i.hash}.${i.ext})`
}

const escapeLine = (l: string) => (LOOKS_LIKE_HEAD.test(l) || LOOKS_LIKE_IMAGE.test(l) ? `\\${l}` : l)

export function serializeDay(day: string, entries: Entry[]): string {
  const live = entries.filter((e) => !e.deleted && e.day === day).sort((a, b) => a.createdAt - b.createdAt)
  let out = `# ${longDayLabel(day)}\n`
  for (const e of live) {
    const text = e.text.trim()
    let body = text ? text.split('\n').map(escapeLine).join('\n') : ''
    const images = entryImages(e)
    if (images.length) body += (body ? '\n\n' : '') + images.map(imageLine).join('\n')
    out += `\n## ${timeLabel(e.createdAt)} <!-- id:${e.id} created:${e.createdAt} updated:${e.updatedAt} -->\n${body}\n`
  }
  return out
}

/** Split an entry body into its text and the trailing block of image lines. */
export function splitImages(body: string): { text: string; images: ImageRef[] } {
  const lines = body.split('\n')
  const images: ImageRef[] = []
  let end = lines.length
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i]
    if (!l.trim()) continue
    const m = l.match(IMAGE_RE)
    if (!m) break
    images.unshift({ hash: m[3], ext: m[4], w: Number(m[1] ?? 0), h: Number(m[2] ?? 0) })
    end = i
  }
  const text = lines
    .slice(0, end)
    .map((l) => (l.startsWith('\\') && LOOKS_LIKE_IMAGE.test(l) ? l.slice(1) : l))
    .join('\n')
    .trim()
  return { text, images }
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
    // `full` is the whole body, image lines included. Hand-written ids hash it, so they stay what they were
    // before images existed (stripping first would give an existing entry a new id and a duplicate).
    const full = body.join('\n').trim()
    const { text, images } = splitImages(full)
    const [, hh, mm, id, created, updated] = head
    if (id) {
      out.push(withDerived({ id, createdAt: Number(created), updatedAt: Number(updated), text, images, deleted: 0, dirty: 0 }))
    } else if (full) {
      const d = parseDayKey(day)
      d.setHours(Number(hh), Number(mm), 0, 0)
      const createdAt = d.getTime()
      const genId = `h${day.replace(/-/g, '')}${hh.padStart(2, '0')}${mm}${hash(full)}`
      out.push(withDerived({ id: genId, createdAt, updatedAt: createdAt, text, images, deleted: 0, dirty: 0 }))
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
