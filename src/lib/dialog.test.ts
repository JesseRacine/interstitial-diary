import { readFileSync, readdirSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DIALOG_STATE_FLAG, type HistoryHost, alertDialog, clearDialogs, confirmDialog, connectDialogHistory, currentDialog, isDialogOpen,
  promptDialog, settleDialog, subscribe,
} from './dialog'

let disconnect: (() => void) | null = null
afterEach(() => {
  clearDialogs()
  disconnect?.()
  disconnect = null
  vi.useRealTimers()
})

describe('confirmDialog', () => {
  it('asks, and answers true or false', async () => {
    const yes = confirmDialog('Delete this entry?', { confirmLabel: 'Delete', danger: true })
    const shown = currentDialog()!
    expect(shown).toMatchObject({ kind: 'confirm', message: 'Delete this entry?', confirmLabel: 'Delete', danger: true })
    settleDialog(shown, true)
    await expect(yes).resolves.toBe(true)

    const no = confirmDialog('Merge?')
    expect(currentDialog()).toMatchObject({ confirmLabel: 'OK', danger: false }) // the defaults
    settleDialog(currentDialog()!, false)
    await expect(no).resolves.toBe(false)
  })

  it('a question that is canceled by clearing answers false, not true', async () => {
    const q = confirmDialog('Sure?')
    clearDialogs()
    await expect(q).resolves.toBe(false)
  })
})

describe('promptDialog', () => {
  it('starts at the given text and answers with the typed text', async () => {
    const q = promptDialog('Rename this event to:', 'Jack 40th', { confirmLabel: 'Continue' })
    expect(currentDialog()).toMatchObject({ kind: 'prompt', value: 'Jack 40th', confirmLabel: 'Continue' })
    settleDialog(currentDialog()!, "Jack's 40th")
    await expect(q).resolves.toBe("Jack's 40th")
  })

  it('answers null when canceled', async () => {
    const q = promptDialog('Rename to:', 'x')
    settleDialog(currentDialog()!, null)
    await expect(q).resolves.toBeNull()
  })

  it('an empty answer is an answer: "" is not null', async () => {
    const q = promptDialog('Rename to:', 'x')
    settleDialog(currentDialog()!, '')
    await expect(q).resolves.toBe('')
  })
})

describe('alertDialog', () => {
  it('settles when dismissed', async () => {
    const q = alertDialog('A title cannot be empty.')
    expect(currentDialog()).toMatchObject({ kind: 'alert', message: 'A title cannot be empty.' })
    settleDialog(currentDialog()!, undefined)
    await expect(q).resolves.toBeUndefined()
  })
})

describe('the queue', () => {
  it('shows one question at a time, in the order asked', async () => {
    const a = confirmDialog('first')
    const b = confirmDialog('second')
    expect(currentDialog()?.message).toBe('first')
    expect(isDialogOpen()).toBe(true)
    settleDialog(currentDialog()!, true)
    await expect(a).resolves.toBe(true)
    expect(currentDialog()?.message).toBe('second')
    settleDialog(currentDialog()!, false)
    await expect(b).resolves.toBe(false)
    expect(currentDialog()).toBeNull()
    expect(isDialogOpen()).toBe(false)
  })

  it('answering a question twice does nothing the second time', async () => {
    const q = confirmDialog('once')
    const shown = currentDialog()!
    settleDialog(shown, true)
    settleDialog(shown, false)
    await expect(q).resolves.toBe(true)
  })

  it('keeps the same object on screen until it is answered, and tells subscribers about each change', () => {
    let calls = 0
    const off = subscribe(() => { calls++ })
    void confirmDialog('x')
    const first = currentDialog()
    expect(currentDialog()).toBe(first) // useSyncExternalStore needs a stable value
    settleDialog(first!, true)
    off()
    expect(calls).toBe(2)
  })
})

/**
 * A browser history that behaves like the real one: pushState adds an entry on top, back() goes down one and tells the page
 * a moment later (popstate is asynchronous), and `pressBack()` is the person's Back button.
 */
function fakeHistory(initial: unknown = null, opts: { backDoesNothing?: boolean } = {}) {
  const stack: unknown[] = [initial]
  let at = 0
  const listeners = new Set<() => void>()
  const fire = () => [...listeners].forEach((l) => l())
  const host: HistoryHost = {
    history: {
      get state() { return stack[at] },
      pushState(s: unknown) { stack.splice(at + 1); stack.push(s); at++ },
      back() { if (!opts.backDoesNothing && at > 0) { at--; setTimeout(fire, 0) } }, // popstate is a task, later than any promise continuation
    },
    addEventListener: (_t, l) => { listeners.add(l) },
    removeEventListener: (_t, l) => { listeners.delete(l) },
  }
  return { host, depth: () => at, state: () => stack[at], pressBack: () => { if (at > 0) { at--; fire() } }, listeners }
}
const flush = () => new Promise<void>((r) => setTimeout(r, 0))
const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')

describe("the Back button (Android's, a browser's)", () => {
  it('a question has one history entry of its own, and answering it takes the entry off again', async () => {
    const h = fakeHistory()
    disconnect = connectDialogHistory(h.host)
    const q = confirmDialog('Delete?')
    expect(h.depth()).toBe(1)
    expect(h.state()).toEqual({ [DIALOG_STATE_FLAG]: true })
    expect(currentDialog()).not.toBeNull()
    settleDialog(currentDialog()!, true)
    await expect(q).resolves.toBe(true)
    await flush()
    expect(h.depth()).toBe(0)
  })

  it('Back answers the question as canceled, leaves the page where it was, and does not go back twice', async () => {
    const h = fakeHistory()
    disconnect = connectDialogHistory(h.host)
    const q = confirmDialog('Delete?')
    h.pressBack()
    await expect(q).resolves.toBe(false)
    expect(currentDialog()).toBeNull()
    await flush()
    expect(h.depth()).toBe(0) // still on the page that asked, not one entry further back
  })

  it('Back cancels a name question as null and a message as nothing', async () => {
    const h = fakeHistory()
    disconnect = connectDialogHistory(h.host)
    const p = promptDialog('Rename to:', 'x')
    h.pressBack()
    await expect(p).resolves.toBeNull()
    const a = alertDialog('Oops')
    h.pressBack()
    await expect(a).resolves.toBeUndefined()
    expect(h.depth()).toBe(0)
  })

  it('a second question asked right after an answer waits for the first entry to go, then gets one entry of its own', async () => {
    const h = fakeHistory()
    disconnect = connectDialogHistory(h.host)
    const first = promptDialog('Rename to:', 'x')
    settleDialog(currentDialog()!, 'y')
    await expect(first).resolves.toBe('y')
    const second = confirmDialog('Rename in 3 entries?') // the rename flow asks again at once
    expect(currentDialog()).toBeNull() // waits: the browser is still taking the first entry off
    await flush()
    expect(currentDialog()?.message).toBe('Rename in 3 entries?')
    expect(h.depth()).toBe(1) // one entry, not two and not the first one's
    settleDialog(currentDialog()!, true)
    await expect(second).resolves.toBe(true)
    await flush()
    expect(h.depth()).toBe(0)
  })

  it('Back with another question waiting cancels only the one on screen, and the next one then shows', async () => {
    const h = fakeHistory()
    disconnect = connectDialogHistory(h.host)
    const a = confirmDialog('first')
    const b = confirmDialog('second')
    expect(currentDialog()?.message).toBe('first')
    h.pressBack()
    await expect(a).resolves.toBe(false)
    expect(currentDialog()?.message).toBe('second')
    expect(h.depth()).toBe(1)
    settleDialog(currentDialog()!, true)
    await expect(b).resolves.toBe(true)
    await flush()
    expect(h.depth()).toBe(0)
  })

  it('over the photo viewer: the entry keeps the viewer\'s mark, so Back lands on the viewer and does not close it', async () => {
    const h = fakeHistory({ photo: true })
    disconnect = connectDialogHistory(h.host)
    const q = confirmDialog('Remove this photo?')
    expect(h.state()).toEqual({ photo: true, [DIALOG_STATE_FLAG]: true })
    h.pressBack()
    await expect(q).resolves.toBe(false)
    expect(h.state()).toEqual({ photo: true }) // the viewer's own entry is the top again
  })

  it('the viewer closing at once after its question (Remove the last photo) goes back through both entries', async () => {
    const h = fakeHistory({ photo: true })
    disconnect = connectDialogHistory(h.host)
    const q = confirmDialog('Remove this photo?')
    settleDialog(currentDialog()!, true)
    await q
    // what App's closePhoto does when the viewer closes: it still sees the viewer's mark on the entry, so it goes back
    if ((h.state() as { photo?: boolean } | null)?.photo) h.host.history.back()
    await flush()
    expect(h.depth()).toBe(0)
  })

  it('if the browser never reports the entry gone, the next question still shows', async () => {
    vi.useFakeTimers()
    const h = fakeHistory(null, { backDoesNothing: true })
    disconnect = connectDialogHistory(h.host)
    const a = confirmDialog('first')
    settleDialog(currentDialog()!, true)
    await a
    void confirmDialog('second')
    expect(currentDialog()).toBeNull()
    await vi.advanceTimersByTimeAsync(500)
    expect(currentDialog()?.message).toBe('second')
  })

  it('without the hook-up (and after undoing it) nothing touches the history', () => {
    const h = fakeHistory()
    void confirmDialog('plain')
    expect(h.depth()).toBe(0)
    expect(currentDialog()?.message).toBe('plain')
    clearDialogs()
    const off = connectDialogHistory(h.host)
    expect(h.listeners.size).toBe(1)
    off()
    expect(h.listeners.size).toBe(0)
    void confirmDialog('after')
    expect(h.depth()).toBe(0)
  })
})

describe('the app uses them', () => {
  it('main.tsx hooks the Back button up before the page is drawn, and the photo viewer stays when Back lands on its own entry', () => {
    const main = src('../main.tsx')
    expect(main.indexOf('connectDialogHistory(window)')).toBeGreaterThan(-1)
    expect(main.indexOf('connectDialogHistory(window)')).toBeLessThan(main.indexOf('createRoot('))
    expect(src('../App.tsx')).toContain('setPhoto((p) => (history.state?.photo ? p : null))')
  })
})

describe('the app uses them (browser pop-ups)', () => {
  it("no component or module still calls the browser's confirm, prompt or alert", () => {
    const dirs = ['../components/', '../lib/', '../storage/', '../search/', '../']
    const offenders: string[] = []
    for (const d of dirs) {
      for (const f of readdirSync(new URL(d, import.meta.url)).filter((n) => /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n))) {
        const text = src(d + f)
        if (/(?<![\w.$])(confirm|prompt|alert)\(/.test(text)) offenders.push(d + f)
      }
    }
    expect(offenders).toEqual([])
  })

  it('App shows the dialogs once, and the page and photo-viewer shortcuts step aside while one is open', () => {
    expect(src('../App.tsx')).toContain('<DialogHost />')
    for (const f of ['../App.tsx', '../components/JournalView.tsx', '../components/Lightbox.tsx']) expect(src(f), f).toContain('isDialogOpen()')
  })
})
