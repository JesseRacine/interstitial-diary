/** True when the event target is somewhere the user types, so single-key shortcuts must stay out of the way. */
export function isTyping(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
}

/** The parts of a keyboard event that decide what Enter does (a React or a DOM event both fit). */
export interface EnterKey {
  key: string
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  isComposing: boolean
}

/**
 * What a key press does in the new-entry box: `save`, or `default` (leave it alone, so Enter adds a line break).
 * A computer keyboard saves on Enter and adds a line on Shift+Enter. A touch screen's keyboard has no Shift+Enter, so
 * there (`coarse`) a plain Enter adds the line and the Save button saves. Ctrl/Cmd+Enter saves on both, for a tablet
 * with a real keyboard. Enter while an input method is composing text (Japanese, a swipe keyboard's candidate) is never
 * a save.
 */
export function enterAction(e: EnterKey, coarse: boolean): 'save' | 'default' {
  if (e.key !== 'Enter' || e.isComposing) return 'default'
  if (e.ctrlKey || e.metaKey) return 'save'
  if (e.shiftKey) return 'default'
  return coarse ? 'default' : 'save'
}

/** True when the main pointer is a finger (a phone or tablet), where the on-screen keyboard has no Shift+Enter. */
export function hasCoarsePointer(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
}
