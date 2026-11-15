/** Which page the app opens on, read from the address (`?view=`). Kept out of App.tsx so it can be tested. */

export type View = 'journal' | 'calendar' | 'photos' | 'tags' | 'tracking' | 'settings'
/** The four ways to look at the calendar; `events` is the Events page (it used to be a header tab of its own). */
export type CalMode = 'month' | 'year' | 'week' | 'events'

const VIEW_NAMES: readonly View[] = ['journal', 'calendar', 'photos', 'tags', 'tracking', 'settings']

/** An unknown word opens the journal; the old `events` tab opens Calendar > Events. */
export function viewFromAddress(search: string): { view: View; calMode: CalMode } {
  const v = new URLSearchParams(search).get('view')
  if (v === 'events') return { view: 'calendar', calMode: 'events' }
  const view = VIEW_NAMES.find((n) => n === v)
  return { view: view ?? 'journal', calMode: 'month' }
}
