import { expect, it } from 'vitest'
import { extractTags, replaceTag, tagBeingTyped, tagSegments } from './entry'
import { TAG_KINDS, displayName, kindForSigil, tagKey, tagKindOf, parseTagName, tagLabel, tagToken } from './tagKinds'

it('tag, person and place keys: kind, typed token, shown name and label', () => {
  expect(['work', '@sarah', '~home'].map((k) => tagKindOf(k).id)).toEqual(['tag', 'person', 'place'])
  expect(['work', '@sarah', '~home'].map(tagToken)).toEqual(['#work', '@sarah', '~home'])
  expect(tagKey(kindForSigil('@')!, 'Sarah')).toBe('@sarah')
  expect(displayName('@sarah_jones')).toBe('Sarah Jones')
  expect(displayName('deep_work')).toBe('deep_work')
  expect(tagLabel('~home')).toBe('📍 Home')
})

it('restaurants: key, token, label, and what is not a restaurant', () => {
  expect(tagKindOf('$blue_door').id).toBe('restaurant')
  expect(tagToken('$blue_door')).toBe('$blue_door')
  expect(tagLabel('$blue_door')).toBe('🍽️ Blue Door')
  expect(tagKey(kindForSigil('$')!, 'Blue_Door')).toBe('$blue_door')
  expect(parseTagName(TAG_KINDS[3], '$Blue Door')).toEqual({ name: 'blue_door' })
  expect(parseTagName(TAG_KINDS[3], '$20')).toHaveProperty('error') // a price is not a restaurant name
  // In text: prices, a word glued to a $ and a $ inside an event or tracking title are not restaurants.
  expect(extractTags('Paid $20 at $Blue_Door, US$5, a$b, $$x, ~home')).toEqual(['$blue_door', '~home'])
  expect(extractTags('Went to !"Dinner at $nobu" then $nobu')).toEqual(['$nobu'])
  expect(tagSegments('at $blue_door-').map((s) => s.key)).toEqual([undefined, '$blue_door', undefined])
  expect(tagBeingTyped('Lunch at $bl')).toMatchObject({ partial: 'bl', kind: { id: 'restaurant' } })
  expect(tagBeingTyped('it cost $')).toMatchObject({ partial: '', kind: { id: 'restaurant' } })
  expect(replaceTag('$nobu and ~nobu and $nobu_two', '$nobu', '$nobu_sf')).toBe('$nobu_sf and ~nobu and $nobu_two')
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
