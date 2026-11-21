import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Every place the user types text must say autoComplete="off": the web view (Edge's engine on Windows) would otherwise
 * offer its own saved-text suggestions on top of the app's own (tags, people, search). Checkboxes, dates and the hidden
 * file picker are not text. This reads the component source, so a new text box that forgets it fails here.
 */
describe('text boxes turn the browser autofill off', () => {
  const dir = new URL('./components/', import.meta.url)
  const NOT_TEXT = /type="(checkbox|radio|date|datetime-local|file|hidden|button|range)"/

  const boxes: { file: string; tag: string }[] = []
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx'))) {
    const src = readFileSync(new URL(file, dir), 'utf8')
    for (const m of src.matchAll(/<(input|textarea)\b[\s\S]*?\/>/g)) {
      if (!NOT_TEXT.test(m[0])) boxes.push({ file, tag: m[0] })
    }
  }

  it('finds the text boxes it is meant to check', () => {
    const files = new Set(boxes.map((b) => b.file))
    for (const f of ['Capture.tsx', 'SearchBar.tsx', 'EntryItem.tsx', 'NotesSection.tsx']) expect(files.has(f), f).toBe(true)
    expect(boxes.length).toBeGreaterThanOrEqual(10)
  })

  it('every one has autoComplete="off"', () => {
    const missing = boxes.filter((b) => !b.tag.includes('autoComplete="off"')).map((b) => `${b.file}: ${b.tag.slice(0, 60).replace(/\s+/g, ' ')}`)
    expect(missing).toEqual([])
  })
})
