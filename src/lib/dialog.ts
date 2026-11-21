/*
 * The app's own questions, in place of the browser's `confirm`, `prompt` and `alert`. Those pop-ups look like a web page
 * (in the Windows app they are titled with the page's address), cannot be styled or worded, and some browsers suppress them.
 * Ask with `confirmDialog`, `promptDialog` or `alertDialog`; each returns a promise that settles when the person answers.
 * `DialogHost` (components/DialogHost.tsx, mounted once in App) shows the current one. Questions asked while one is open
 * wait their turn, so two never stack.
 *
 * Android's Back button: while a question is on screen it has a browser-history entry of its own (like the photo viewer),
 * so Back answers it as canceled instead of leaving the app with the question still open. `connectDialogHistory` turns that on.
 */

export interface DialogOptions {
  /** The main button's words ("Delete", "Rename"); "OK" when not given. */
  confirmLabel?: string
  /** A destructive question: the main button is red and Cancel is what has the focus. */
  danger?: boolean
}

export interface DialogRequest {
  id: number
  kind: 'confirm' | 'prompt' | 'alert'
  message: string
  /** A prompt's starting text. */
  value: string
  confirmLabel: string
  danger: boolean
  /** What an answer is: confirm true/false, prompt the text or null, alert nothing. */
  resolve: (answer: boolean | string | null | undefined) => void
}

type Answer = boolean | string | null | undefined

let nextId = 1
let queue: DialogRequest[] = []
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

/** For `useSyncExternalStore`. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/**
 * The question on screen, or null. The same object until it is answered (`useSyncExternalStore` needs that). With the Back
 * button hooked up, a question shows only once its history entry is in place.
 */
export function currentDialog(): DialogRequest | null {
  if (host && !entryOpen) return null
  return queue[0] ?? null
}

/** True while a question is on screen or waiting: the page's own keyboard shortcuts must stay out of its way. */
export function isDialogOpen(): boolean {
  return queue.length > 0
}

/** What a question's cancel is: false, null or nothing, by kind. */
const canceled = (r: DialogRequest): Answer => (r.kind === 'confirm' ? false : r.kind === 'prompt' ? null : undefined)

/** Answer a question and show the next one, if any. Answering twice does nothing. */
export function settleDialog(req: DialogRequest, answer: Answer): void {
  if (!queue.includes(req)) return
  queue = queue.filter((r) => r !== req)
  req.resolve(answer)
  closeEntry()
  openEntry() // only does anything when no history move is pending
  emit()
}

function ask<T>(kind: DialogRequest['kind'], message: string, value: string, opts: DialogOptions): Promise<T> {
  return new Promise<T>((resolve) => {
    queue = [...queue, {
      id: nextId++, kind, message, value,
      confirmLabel: opts.confirmLabel ?? 'OK',
      danger: !!opts.danger,
      resolve: resolve as DialogRequest['resolve'],
    }]
    openEntry()
    emit()
  })
}

/** A yes/no question. Cancel, Escape, Back and anything but the main button answer false. */
export function confirmDialog(message: string, opts: DialogOptions = {}): Promise<boolean> {
  return ask<boolean>('confirm', message, '', opts)
}

/** A question with a text answer, starting at `value`. Returns the text, or null when canceled. */
export function promptDialog(message: string, value = '', opts: DialogOptions = {}): Promise<string | null> {
  return ask<string | null>('prompt', message, value, opts)
}

/** A message with one OK button. Settles when it is dismissed. */
export function alertDialog(message: string): Promise<void> {
  return ask<void>('alert', message, '', {})
}

/** Forget every question (for tests): each is answered as canceled. Leaves the history hook-up as it is. */
export function clearDialogs(): void {
  const all = queue
  queue = []
  entryOpen = false
  popping = false
  if (popTimer) clearTimeout(popTimer)
  popTimer = null
  for (const r of all) r.resolve(canceled(r))
  emit()
}

// ---- The Back button -------------------------------------------------------------------------------------------------

/** The part of `window` that is used, so a test can stand in for it. */
export interface HistoryHost {
  history: { state: unknown; pushState(state: unknown, title: string): void; back(): void }
  addEventListener(type: 'popstate', listener: () => void): void
  removeEventListener(type: 'popstate', listener: () => void): void
}

/** The mark on the history entry of a question. The entry copies the state under it, so a photo viewer behind stays marked. */
export const DIALOG_STATE_FLAG = 'dialog'

let host: HistoryHost | null = null
let entryOpen = false // the question on screen has its history entry on the stack
let popping = false // our entry is being taken off (we called back() and wait for the browser to finish)
let popTimer: ReturnType<typeof setTimeout> | null = null

const flagged = (state: unknown) => !!state && typeof state === 'object' && DIALOG_STATE_FLAG in state

/** Give the first waiting question a history entry, unless there is one already or the browser is busy taking one off. */
function openEntry(): void {
  if (!host || entryOpen || popping || queue.length === 0) return
  const below = host.history.state && typeof host.history.state === 'object' ? host.history.state : {}
  host.history.pushState({ ...below, [DIALOG_STATE_FLAG]: true }, '')
  entryOpen = true
}

/** The question was answered with a button (or Escape): take its entry off. The next question waits for that to finish. */
function closeEntry(): void {
  if (!host || !entryOpen) return
  entryOpen = false
  popping = true
  host.history.back()
  // Safety net: if the browser never reports it (nothing to go back to), the next question still shows.
  popTimer = setTimeout(finishPop, 400)
}

function finishPop(): void {
  if (!popping) return
  popping = false
  if (popTimer) clearTimeout(popTimer)
  popTimer = null
  openEntry()
  emit()
}

function onPopState(): void {
  if (!host) return
  if (popping) return finishPop() // our own back() arrived
  if (entryOpen && !flagged(host.history.state)) {
    // The Back button took our entry off: the question on screen is answered as canceled. No back() of our own is needed.
    entryOpen = false
    const shown = queue[0]
    if (shown) settleDialog(shown, canceled(shown))
  }
}

/**
 * Hook the question boxes up to the browser history, so Android's Back button (and a browser's Back) cancels the question
 * on screen. Returns a function that undoes it. Call once at startup.
 */
export function connectDialogHistory(win: HistoryHost): () => void {
  host = win
  win.addEventListener('popstate', onPopState)
  return () => {
    win.removeEventListener('popstate', onPopState)
    host = null
    entryOpen = false
    popping = false
    if (popTimer) clearTimeout(popTimer)
    popTimer = null
  }
}
