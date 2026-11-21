import { useMemo, useState } from 'react'
import { renameTag } from '../lib/db'
import { alertDialog, confirmDialog, promptDialog } from '../lib/dialog'
import { type Entry, dayKey, shortDayLabel } from '../lib/entry'
import { TAG_KINDS, type TagKind, displayName, parseTagName, tagKey, tagKindOf, tagLabel, tagName } from '../lib/tagKinds'
import type { Note } from '../lib/notes'
import type { SearchIndex, TagStat } from '../search/engine'
import { TagPage } from './TagPage'

type Sort = 'count' | 'name' | 'recent'

export function TagsView({ tagStats, entries, notes, index, selected, onSelect, onSearch, onOpenDay, onOpenImage }: {
  tagStats: TagStat[]
  entries: Entry[] // journal entries only (no notes)
  notes: Map<string, Note[]> // notes on people and places, by key (lib/notes.ts)
  index: SearchIndex
  selected: string | null // the person or place whose page is open (App holds it, so "Open" after saving a note can set it)
  onSelect: (key: string | null) => void
  onSearch: (tag: string) => void
  onOpenDay: (e: Entry) => void
  onOpenImage: (e: Pick<Entry, 'id'>, index: number) => void
}) {
  const [kind, setKind] = useState<TagKind>(() => (selected ? tagKindOf(selected) : TAG_KINDS[0]))
  const setSelected = onSelect
  const [filter, setFilter] = useState('')
  const [sort, setSort] = useState<Sort>('count')

  const counts = useMemo(() => new Map(TAG_KINDS.map((k) => [k.id, tagStats.filter((t) => tagKindOf(t.tag) === k).length])), [tagStats])
  const ofKind = useMemo(() => tagStats.filter((t) => tagKindOf(t.tag) === kind), [tagStats, kind])

  const list = useMemo(() => {
    let f = filter.trim().toLowerCase()
    if (f.startsWith(kind.sigil)) f = f.slice(kind.sigil.length)
    const l = ofKind.filter((t) => !f || tagName(t.tag).includes(f) || displayName(t.tag).toLowerCase().includes(f))
    if (sort === 'name') return [...l].sort((a, b) => displayName(a.tag).localeCompare(displayName(b.tag)))
    if (sort === 'recent') return [...l].sort((a, b) => b.last - a.last)
    return l
  }, [ofKind, kind, filter, sort])

  const rename = async (t: TagStat) => {
    const input = await promptDialog(`Rename ${tagLabel(t.tag)} to:`, tagName(t.tag), { confirmLabel: 'Continue' })
    if (input === null) return
    const parsed = parseTagName(kind, input)
    if ('error' in parsed) return alertDialog(parsed.error)
    const to = tagKey(kind, parsed.name)
    if (to === t.tag) return
    const merging = tagStats.some((s) => s.tag === to)
    const msg = merging
      ? `${tagLabel(to)} already exists. Merge ${tagLabel(t.tag)} into it? This changes ${t.count + t.notes} entries.`
      : `Rename ${tagLabel(t.tag)} to ${tagLabel(to)} in ${t.count + t.notes} entries?`
    if (await confirmDialog(msg, { confirmLabel: merging ? 'Merge' : 'Rename' })) await renameTag(t.tag, to)
  }

  const noun = kind.plural.toLowerCase()
  if (selected !== null) {
    return (
      <TagPage key={selected} tag={selected} stat={tagStats.find((s) => s.tag === selected)} entries={entries} notes={notes.get(selected) ?? []} index={index}
        backLabel={tagKindOf(selected).plural} onBack={() => { setKind(tagKindOf(selected)); setSelected(null) }} onSearch={onSearch} onOpenDay={onOpenDay} onOpenImage={onOpenImage} />
    )
  }
  return (
    <section className="tags">
      <div className="seg kind-tabs" role="group" aria-label="Kind">
        {TAG_KINDS.map((k) => (
          <button key={k.id} type="button" className={kind === k ? 'on' : ''} aria-pressed={kind === k} onClick={() => setKind(k)}>
            {k.plural} <span className="muted">{counts.get(k.id)}</span>
          </button>
        ))}
      </div>
      <div className="day-nav">
        <h2>{kind.plural}</h2>
        <input type="search" autoComplete="off" placeholder={`Filter ${noun}`} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label={`Filter ${noun}`} />
        <div className="seg">
          {(['count', 'name', 'recent'] as Sort[]).map((s) => (
            <button key={s} type="button" className={sort === s ? 'on' : ''} onClick={() => setSort(s)}>
              {s === 'count' ? 'Most used' : s === 'name' ? 'A–Z' : 'Recent'}
            </button>
          ))}
        </div>
      </div>
      {list.length === 0 ? (
        <p className="empty">{ofKind.length ? `No ${noun} match.` : `No ${noun} yet. Type ${kind.sigil} in an entry, for example ${kind.sigil}${kind.letterFirst ? 'sarah_jones' : 'work'}.`}</p>
      ) : (
        <table className="tag-table">
          <thead><tr><th>{kind.label}</th><th>Entries</th><th>Last used</th><th /></tr></thead>
          <tbody>
            {list.map((t) => (
              <tr key={t.tag}>
                <td><button type="button" className={kind.className} onClick={() => (kind.hasPage ? setSelected(t.tag) : onSearch(t.tag))}>{tagLabel(t.tag)}</button></td>
                <td>{t.count}{notes.get(t.tag)?.length ? <span className="muted"> · {notes.get(t.tag)!.length} {notes.get(t.tag)!.length === 1 ? 'note' : 'notes'}</span> : null}</td>
                <td className="muted">{t.count ? shortDayLabel(dayKey(t.last)) : '—'}</td>
                <td><button type="button" className="ghost" onClick={() => rename(t)}>Rename</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
