import { expect, it } from 'vitest'
import { type EnterKey, enterAction, isEntryField, typingAfterFocus } from './dom'

// A stand-in for a DOM element: the tests run in Node, which has none. `inside` lists the container classes it sits in.
const field = (tagName: string, inside: string[], type = 'text') =>
  ({ tagName, type, closest: (sel: string) => (inside.some((c) => sel.split(',').map((s) => s.trim()).includes(`.${c}`)) ? {} : null) }) as unknown as Element

it('typing mode: only the text fields of the entry box and of an entry being edited count', () => {
  expect(isEntryField(field('TEXTAREA', ['capture']))).toBe(true)
  expect(isEntryField(field('INPUT', ['capture']))).toBe(true) // the Track form's name, the Note form's person
  expect(isEntryField(field('TEXTAREA', ['edit']))).toBe(true)
  expect(isEntryField(field('INPUT', [], 'search'))).toBe(false) // the search box: hiding it would end the search
  expect(isEntryField(field('TEXTAREA', []))).toBe(false) // e.g. a note's text box elsewhere
  expect(isEntryField(field('INPUT', ['capture'], 'file'))).toBe(false)
  expect(isEntryField(field('BUTTON', ['capture']))).toBe(false)
  expect(isEntryField(null)).toBe(false)
})

it('typing mode: a button of the same box keeps it on, anything outside ends it, a mouse never starts it', () => {
  const textarea = field('TEXTAREA', ['capture'])
  const photoButton = field('BUTTON', ['capture'])
  const outside = field('BUTTON', [])
  expect(typingAfterFocus(textarea, false, true)).toBe(true)
  expect(typingAfterFocus(photoButton, true, true)).toBe(true) // the Photo button: the picker opens, the header must not flash back
  expect(typingAfterFocus(photoButton, false, true)).toBe(false) // a button alone never starts it
  expect(typingAfterFocus(outside, true, true)).toBe(false)
  expect(typingAfterFocus(null, true, true)).toBe(false) // focus lost (the keyboard was dismissed and the box blurred)
  expect(typingAfterFocus(textarea, false, false)).toBe(false) // computer with a mouse
})

const key = (over: Partial<EnterKey> = {}): EnterKey => ({
  key: 'Enter', shiftKey: false, ctrlKey: false, metaKey: false, isComposing: false, ...over,
})

it('Enter saves on a computer and adds a line on a touch screen; Shift adds a line, Ctrl/Cmd saves, never while composing', () => {
  expect(enterAction(key(), false)).toBe('save')
  expect(enterAction(key(), true)).toBe('default')
  for (const touch of [false, true]) {
    expect(enterAction(key({ shiftKey: true }), touch)).toBe('default')
    expect(enterAction(key({ ctrlKey: true }), touch)).toBe('save')
    expect(enterAction(key({ metaKey: true }), touch)).toBe('save')
    expect(enterAction(key({ isComposing: true, ctrlKey: true }), touch)).toBe('default')
    expect(enterAction(key({ key: 'a', ctrlKey: true }), touch)).toBe('default')
  }
})
