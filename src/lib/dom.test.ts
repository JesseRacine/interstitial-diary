import { expect, it } from 'vitest'
import { type EnterKey, enterAction } from './dom'

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
