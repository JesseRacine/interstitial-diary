import type { Entry } from './entry'

/** id -> time it was deleted (ms). Stored remotely in .meta/tombstones.json */
export type Tombstones = Record<string, number>

export interface MergeResult {
  entries: Entry[] // one winning version per id (may include deleted ones)
  tombstones: Tombstones
}

/**
 * Union local and remote entries by id. The version with the newest updatedAt wins;
 * on a tie, a deletion wins. A tombstone beats any version not edited after it.
 */
export function merge(local: Entry[], remote: Entry[], remoteTombstones: Tombstones): MergeResult {
  const byId = new Map<string, Entry>()
  const consider = (e: Entry) => {
    const cur = byId.get(e.id)
    if (!cur || e.updatedAt > cur.updatedAt || (e.updatedAt === cur.updatedAt && e.deleted && !cur.deleted)) {
      byId.set(e.id, e)
    }
  }
  local.forEach(consider)
  remote.forEach(consider)

  for (const [id, at] of Object.entries(remoteTombstones)) {
    const cur = byId.get(id)
    if (cur && !cur.deleted && at >= cur.updatedAt) byId.set(id, { ...cur, deleted: 1, updatedAt: at })
  }

  const tombstones: Tombstones = { ...remoteTombstones }
  for (const e of byId.values()) {
    if (e.deleted) tombstones[e.id] = Math.max(tombstones[e.id] ?? 0, e.updatedAt)
  }
  return { entries: [...byId.values()], tombstones }
}
