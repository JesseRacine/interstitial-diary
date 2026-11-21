import { readFileSync, readdirSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { alertDialog, clearDialogs, confirmDialog, currentDialog, isDialogOpen, promptDialog, settleDialog, subscribe } from './dialog'

afterEach(() => clearDialogs())

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

describe('the app uses them', () => {
  const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')

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
