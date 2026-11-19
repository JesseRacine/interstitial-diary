/** True when the event target is somewhere the user types, so single-key shortcuts must stay out of the way. */
export function isTyping(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
}

/**
 * True when the element is a text field of the new-entry box (`.capture`: the entry text, a tracked item's name, a note's
 * person) or of an entry being edited (`.edit`). Focus there opens the phone keyboard, and the page makes room for it
 * (typing mode, see useTypingMode). The search box is deliberately not one: hiding it while it is used would end the search.
 */
export function isEntryField(el: Element | null): boolean {
  if (!el || typeof el.closest !== 'function') return false
  const input = el as HTMLInputElement
  const text = el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && (input.type === 'text' || input.type === 'search'))
  return text && isInEntryBox(el)
}

/** True when the element is anywhere inside the new-entry box or an entry being edited (its buttons included). */
export function isInEntryBox(el: Element | null): boolean {
  return !!el && typeof el.closest === 'function' && !!el.closest('.capture, .edit')
}

/**
 * Whether typing mode is on after the focus moved to `active`. A text field of the entry box turns it on. While it is
 * on, focus on a button of the same box (Photo, Track, Note) keeps it on, so the page does not jump back to its full
 * header while the photo picker is open; focus anywhere outside the box ends it.
 */
export function typingAfterFocus(active: Element | null, wasTyping: boolean, coarse: boolean): boolean {
  if (!coarse) return false
  return isEntryField(active) || (wasTyping && isInEntryBox(active))
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
