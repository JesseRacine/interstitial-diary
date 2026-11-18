import { expect, it } from 'vitest'
import { TAG_KINDS, displayName, kindForSigil, tagKey, tagKindOf, parseTagName, tagLabel, tagToken } from './tagKinds'

it('tag, person and place keys: kind, typed token, shown name and label', () => {
  expect(['work', '@sarah', '~home'].map((k) => tagKindOf(k).id)).toEqual(['tag', 'person', 'place'])
  expect(['work', '@sarah', '~home'].map(tagToken)).toEqual(['#work', '@sarah', '~home'])
  expect(tagKey(kindForSigil('@')!, 'Sarah')).toBe('@sarah')
  expect(displayName('@sarah_jones')).toBe('Sarah Jones')
  expect(displayName('deep_work')).toBe('deep_work')
  expect(tagLabel('~home')).toBe('📍 Home')
})

it('checks a name typed for a rename', () => {
  const [tag, person, place] = TAG_KINDS
  expect(parseTagName(tag, ' #Deep-Focus ')).toEqual({ name: 'deep-focus' })
  expect(parseTagName(tag, '2026')).toEqual({ name: '2026' }) // plain tags may start with a digit
  expect(parseTagName(person, '@Sarah   Jones')).toEqual({ name: 'sarah_jones' })
  expect(parseTagName(place, '~Blue Door')).toEqual({ name: 'blue_door' })
  expect(parseTagName(tag, 'Sarah Jones')).toHaveProperty('error') // a space is not allowed in a plain tag
  expect(parseTagName(person, '3pm')).toHaveProperty('error') // people and places start with a letter
  expect(parseTagName(tag, '   ')).toHaveProperty('error')
  expect(parseTagName(tag, 'a-')).toHaveProperty('error') // a trailing - or / is not part of a tag name
  expect(parseTagName(person, '#work')).toHaveProperty('error') // another kind's symbol is not a name
})
