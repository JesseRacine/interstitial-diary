import { describe, expect, it } from 'vitest'
import { TAG_KINDS, displayName, kindForSigil, tagKey, tagKindOf, parseTagName, tagLabel, tagName, tagToken } from './tagKinds'

describe('tag kinds', () => {
  it('tells the kind from the stored key', () => {
    expect(tagKindOf('work').id).toBe('tag')
    expect(tagKindOf('@sarah').id).toBe('person')
    expect(tagKindOf('~home').id).toBe('place')
  })
  it('turns keys into what is typed', () => {
    expect(tagToken('work')).toBe('#work')
    expect(tagToken('@sarah')).toBe('@sarah')
    expect(tagToken('~home')).toBe('~home')
    expect(tagName('@sarah_jones')).toBe('sarah_jones')
  })
  it('builds keys from a kind and a name', () => {
    expect(tagKey(kindForSigil('@')!, 'Sarah')).toBe('@sarah')
    expect(tagKey(kindForSigil('#')!, 'Work')).toBe('work')
  })
  it('shows people and places as names, plain tags as written', () => {
    expect(displayName('@sarah_jones')).toBe('Sarah Jones')
    expect(displayName('~blue_door')).toBe('Blue Door')
    expect(displayName('@tom')).toBe('Tom')
    expect(displayName('deep_work')).toBe('deep_work')
  })
  it('checks a name typed for a rename', () => {
    const [tag, person, place] = TAG_KINDS
    expect(parseTagName(tag, ' #Deep-Focus ')).toEqual({ name: 'deep-focus' })
    expect(parseTagName(tag, '2026')).toEqual({ name: '2026' }) // plain tags may start with a digit
    expect(parseTagName(person, 'Sarah Jones')).toEqual({ name: 'sarah_jones' })
    expect(parseTagName(person, '@Sarah   Jones')).toEqual({ name: 'sarah_jones' })
    expect(parseTagName(place, '~Blue Door')).toEqual({ name: 'blue_door' })
    expect(parseTagName(tag, 'Sarah Jones')).toHaveProperty('error') // a space is not allowed in a plain tag
    expect(parseTagName(person, '3pm')).toHaveProperty('error') // people and places start with a letter
    expect(parseTagName(place, '5min')).toHaveProperty('error')
    expect(parseTagName(tag, '#')).toHaveProperty('error')
    expect(parseTagName(tag, '   ')).toHaveProperty('error')
    expect(parseTagName(tag, 'a-')).toHaveProperty('error') // a trailing - or / is not part of a tag name
    expect(parseTagName(person, 'sarah/')).toHaveProperty('error')
    expect(parseTagName(person, '#work')).toHaveProperty('error') // another kind's symbol is not a name
  })
  it('labels tags for lists', () => {
    expect(tagLabel('work')).toBe('#work')
    expect(tagLabel('@sarah_jones')).toBe('👤 Sarah Jones')
    expect(tagLabel('~home')).toBe('📍 Home')
  })
  it('gives every kind its own symbol and prefix', () => {
    expect(new Set(TAG_KINDS.map((k) => k.sigil)).size).toBe(TAG_KINDS.length)
    expect(new Set(TAG_KINDS.map((k) => k.prefix)).size).toBe(TAG_KINDS.length)
  })
})
