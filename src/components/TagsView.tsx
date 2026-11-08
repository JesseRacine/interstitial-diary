import { useMemo, useState } from 'react'
import { renameTag } from '../lib/db'
import { dayKey, shortDayLabel } from '../lib/entry'
import type { TagStat } from '../search/engine'

type Sort = 'count' | 'name' | 'recent'

export function TagsView({ tagStats, onSearch }: { tagStats: TagStat[]; onSearch: (tag: string) => void }) {
  const [filter, setFilter] = useState('')
  const [sort, setSort] = useState<Sort>('count')

  const list = useMemo(() => {
    const f = filter.trim().replace(/^#/, '').toLowerCase()
    const l = tagStats.filter((t) => t.tag.includes(f))
    if (sort === 'name') return [...l].sort((a, b) => a.tag.localeCompare(b.tag))
    if (sort === 'recent') return [...l].sort((a, b) => b.last - a.last)
    return l
  }, [tagStats, filter, sort])

  const rename = async (t: TagStat) => {
    const input = prompt(`Rename #${t.tag} to:`, t.tag)
    const to = input?.trim().replace(/^#/, '').toLowerCase()
    if (!to || to === t.tag) return
    if (!/^[\p{L}\p{N}_][\p{L}\p{N}_\-/]*$/u.test(to)) return alert('Tags can contain letters, numbers, _ - and /')
    const merging = tagStats.some((s) => s.tag === to)
    const msg = merging
      ? `#${to} already exists. Merge #${t.tag} into it? This changes ${t.count} entries.`
      : `Rename #${t.tag} to #${to} in ${t.count} entries?`
    if (confirm(msg)) await renameTag(t.tag, to)
  }

  return (
    <section className="tags">
      <div className="day-nav">
        <h2>Tags</h2>
        <input type="search" placeholder="Filter tags" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter tags" />
        <div className="seg">
          {(['count', 'name', 'recent'] as Sort[]).map((s) => (
            <button key={s} type="button" className={sort === s ? 'on' : ''} onClick={() => setSort(s)}>
              {s === 'count' ? 'Most used' : s === 'name' ? 'A–Z' : 'Recent'}
            </button>
          ))}
        </div>
      </div>
      {list.length === 0 ? (
        <p className="empty">{tagStats.length ? 'No tags match.' : 'No tags yet. Add #tags anywhere in an entry.'}</p>
      ) : (
        <table className="tag-table">
          <thead><tr><th>Tag</th><th>Entries</th><th>Last used</th><th /></tr></thead>
          <tbody>
            {list.map((t) => (
              <tr key={t.tag}>
                <td><button type="button" className="tag" onClick={() => onSearch(t.tag)}>#{t.tag}</button></td>
                <td>{t.count}</td>
                <td className="muted">{shortDayLabel(dayKey(t.last))}</td>
                <td><button type="button" className="ghost" onClick={() => rename(t)}>Rename</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
