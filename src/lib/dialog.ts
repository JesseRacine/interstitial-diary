/*
 * The app's own questions, in place of the browser's `confirm`, `prompt` and `alert`. Those pop-ups look like a web page
 * (in the Windows app they are titled with the page's address), cannot be styled or worded, and some browsers suppress them.
 * Ask with `confirmDialog`, `promptDialog` or `alertDialog`; each returns a promise that settles when the person answers.
 * `DialogHost` (components/DialogHost.tsx, mounted once in App) shows the current one. Questions asked while one is open
 * wait their turn, so two never stack.
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

let nextId = 1
let queue: DialogRequest[] = []
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

/** For `useSyncExternalStore`. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** The question on screen, or null. The same object until it is answered (`useSyncExternalStore` needs that). */
export function currentDialog(): DialogRequest | null {
  return queue[0] ?? null
}

/** True while a question is on screen: the page's own keyboard shortcuts must stay out of its way. */
export function isDialogOpen(): boolean {
  return queue.length > 0
}

/** Answer a question and show the next one, if any. Answering twice does nothing. */
export function settleDialog(req: DialogRequest, answer: boolean | string | null | undefined): void {
  if (!queue.includes(req)) return
  queue = queue.filter((r) => r !== req)
  req.resolve(answer)
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
    emit()
  })
}

/** A yes/no question. Cancel, Escape and anything but the main button answer false. */
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

/** Forget every question (for tests): each is answered as canceled. */
export function clearDialogs(): void {
  const all = queue
  queue = []
  for (const r of all) r.resolve(r.kind === 'confirm' ? false : r.kind === 'prompt' ? null : undefined)
  emit()
}
