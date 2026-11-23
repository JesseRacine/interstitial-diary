import { describe, expect, it } from 'vitest'
import type { TagStat } from '../search/engine'
import { noteTargetSuggestions, resolveNoteTarget } from './noteTarget'

const stat = (tag: string, count = 1): TagStat => ({ tag, count, notes: 0, first: 1, last: 1 })
const STATS = [stat('@sam_jones', 9), stat('~salt_bar', 5), stat('@sarah', 3), stat('work', 8), stat('@jo', 1), stat('~jo', 1)]
const KNOWN = STATS.map((s) => s.tag).filter((t) => t !== 'work')

describe('resolveNoteTarget', () => {
  it('finds a known person or place by name, shown name or token', () => {
    expect(resolveNoteTarget('Sam Jones', KNOWN)).toEqual({ key: '@sam_jones', isNew: false })
    expect(resolveNoteTarget(' sam_jones ', KNOWN)).toEqual({ key: '@sam_jones', isNew: false })
    expect(resolveNoteTarget('@sam_jones', KNOWN)).toEqual({ key: '@sam_jones', isNew: false })
    expect(resolveNoteTarget('Salt Bar', KNOWN)).toEqual({ key: '~salt_bar', isNew: false })
  })
  it('a new name is a new person, or a new place with ~ in front', () => {
    expect(resolveNoteTarget('Maria Lopez', KNOWN)).toEqual({ key: '@maria_lopez', isNew: true })
    expect(resolveNoteTarget('~corner cafe', KNOWN)).toEqual({ key: '~corner_cafe', isNew: true })
  })
  it('asks for the symbol when a person and a place share the name', () => {
    expect(resolveNoteTarget('Jo', KNOWN)).toHaveProperty('error')
    expect(resolveNoteTarget('~jo', KNOWN)).toEqual({ key: '~jo', isNew: false })
  })
  it('nothing typed is nothing; a bad name is an error; plain tags are never a target', () => {
    expect(resolveNoteTarget('  ', KNOWN)).toBeNull()
    expect(resolveNoteTarget('3pm', KNOWN)).toHaveProperty('error')
    expect(resolveNoteTarget('#work', KNOWN)).toHaveProperty('error')
  })
})

describe('restaurants as a note target', () => {
  const stats = [...STATS, stat('$salt_bar', 4), stat('$nobu', 2)]
  const known = [...KNOWN, '$salt_bar', '$nobu']
  it('$ in front makes or finds a restaurant; a bare known name finds it', () => {
    expect(resolveNoteTarget('$corner cafe', known)).toEqual({ key: '$corner_cafe', isNew: true })
    expect(resolveNoteTarget('$Salt Bar', known)).toEqual({ key: '$salt_bar', isNew: false })
    expect(resolveNoteTarget('Nobu', known)).toEqual({ key: '$nobu', isNew: false })
    expect(resolveNoteTarget('$20', known)).toHaveProperty('error')
  })
  it('asks for the symbol when a place and a restaurant share the name, and names both', () => {
    expect(resolveNoteTarget('Salt Bar', known)).toEqual({ error: 'A place and a restaurant are both called Salt Bar: type ~ or $ in front.' })
  })
  it('suggests restaurants, and a typed $ keeps to them', () => {
    expect(noteTargetSuggestions('nob', stats)).toEqual(['$nobu'])
    expect(noteTargetSuggestions('$s', stats)).toEqual(['$salt_bar'])
    expect(noteTargetSuggestions('~s', stats)).toEqual(['~salt_bar'])
  })
})

describe('noteTargetSuggestions', () => {
  it('suggests people and places by the start of the name or of a shown word, most used first', () => {
    expect(noteTargetSuggestions('sa', STATS)).toEqual(['@sam_jones', '~salt_bar', '@sarah'])
    expect(noteTargetSuggestions('jon', STATS)).toEqual(['@sam_jones'])
    expect(noteTargetSuggestions('wo', STATS)).toEqual([])
  })
  it('a typed symbol keeps to that kind', () => {
    expect(noteTargetSuggestions('~s', STATS)).toEqual(['~salt_bar'])
    expect(noteTargetSuggestions('@', STATS)).toEqual([])
  })
})
