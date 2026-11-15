import { eventSpans } from './events'
import { type TrackingState, trackingSpans } from './tracking'

/**
 * An entry's text cut into plain pieces and the two kinds of marker that are shown as chips: events (`!"Jack's party"`,
 * events.ts) and the tracked item (`+"Dyson V15"`, tracking.ts). The pieces join back into the text. Only the **first**
 * tracking marker is a chip, because an entry is one item by its first marker; any other stays plain text. Where two
 * markers overlap (only in strange text) the earlier one wins.
 */
export type MarkerSegment =
  | { text: string; kind?: undefined }
  | { text: string; kind: 'event'; title: string; date?: string }
  | { text: string; kind: 'tracking'; title: string; state: TrackingState; date?: string }

export function markerSegments(text: string): MarkerSegment[] {
  const found: { start: number; end: number; seg: MarkerSegment }[] = [
    ...eventSpans(text).map((s) => ({
      start: s.start,
      end: s.end,
      seg: { text: text.slice(s.start, s.end), kind: 'event' as const, title: s.title, ...(s.date ? { date: s.date } : {}) },
    })),
    ...trackingSpans(text).slice(0, 1).map((s) => ({
      start: s.start,
      end: s.end,
      seg: { text: text.slice(s.start, s.end), kind: 'tracking' as const, title: s.title, state: s.state, ...(s.date ? { date: s.date } : {}) },
    })),
  ].sort((a, b) => a.start - b.start)

  const out: MarkerSegment[] = []
  let last = 0
  for (const f of found) {
    if (f.start < last) continue // overlaps the marker before it
    if (f.start > last) out.push({ text: text.slice(last, f.start) })
    out.push(f.seg)
    last = f.end
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out
}
