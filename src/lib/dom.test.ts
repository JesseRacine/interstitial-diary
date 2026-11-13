import { describe, expect, it } from 'vitest'
import { type EnterKey, enterAction } from './dom'

const key = (over: Partial<EnterKey> = {}): EnterKey => ({
  key: 'Enter', shiftKey: false, ctrlKey: false, metaKey: false, isComposing: false, ...over,
})

describe('enterAction', () => {
  it('saves on a plain Enter with a computer keyboard', () => {
    expect(enterAction(key(), false)).toBe('save')
  })

  it('adds a line on a plain Enter on a touch screen (its keyboard has no Shift+Enter)', () => {
    expect(enterAction(key(), true)).toBe('default')
  })

  it('adds a line on Shift+Enter on both', () => {
    expect(enterAction(key({ shiftKey: true }), false)).toBe('default')
    expect(enterAction(key({ shiftKey: true }), true)).toBe('default')
  })

  it('saves on Ctrl+Enter and Cmd+Enter on both', () => {
    for (const coarse of [false, true]) {
      expect(enterAction(key({ ctrlKey: true }), coarse)).toBe('save')
      expect(enterAction(key({ metaKey: true }), coarse)).toBe('save')
    }
  })

  it('never saves while an input method is composing', () => {
    for (const coarse of [false, true]) {
      expect(enterAction(key({ isComposing: true }), coarse)).toBe('default')
      expect(enterAction(key({ isComposing: true, ctrlKey: true }), coarse)).toBe('default')
    }
  })

  it('ignores other keys', () => {
    expect(enterAction(key({ key: 'a' }), false)).toBe('default')
    expect(enterAction(key({ key: 'a', ctrlKey: true }), true)).toBe('default')
  })
})
