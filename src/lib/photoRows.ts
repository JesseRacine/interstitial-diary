import { type Entry, type ImageRef, entryImages } from './entry'

/*
 * The Photos view: every photo of every live entry, newest first, grouped by day. Like the journal it is flattened into
 * rows (a header per day, then rows of square tiles) so it can be virtualised. A row's height only depends on the
 * width of the grid (square tiles), never on what has loaded, so rows don't jump when thumbnails arrive.
 */

export const PHOTO_MIN_TILE = 104 // px; the smallest a tile gets before a column is dropped
export const PHOTO_GAP = 4 // px between tiles
export const PHOTO_MIN_COLUMNS = 2

export interface PhotoTile {
  key: string // unique: entry id + position in the entry
  entry: Entry
  index: number // position in entry.images (what the lightbox opens at)
  image: ImageRef
}

export type PhotoRow =
  | { kind: 'day'; day: string; count: number }
  | { kind: 'tiles'; day: string; tiles: PhotoTile[] }

export interface PhotoRows {
  rows: PhotoRow[]
  photos: number // photos in total
  entries: number // entries that have photos
}

/** How many square tiles of at least PHOTO_MIN_TILE fit across `width` px (never fewer than PHOTO_MIN_COLUMNS). */
export function columnsFor(width: number): number {
  if (!(width > 0)) return PHOTO_MIN_COLUMNS
  return Math.max(PHOTO_MIN_COLUMNS, Math.floor((width + PHOTO_GAP) / (PHOTO_MIN_TILE + PHOTO_GAP)))
}

/**
 * Entries (any order, deleted ones ignored) -> rows, newest day first. Within a day the newest entry comes first and
 * an entry's photos keep their own order. Entries without photos add nothing.
 */
export function buildPhotoRows(entries: Entry[], columns: number): PhotoRows {
  const cols = Math.max(1, Math.floor(columns))
  const withPhotos = entries
    .filter((e) => !e.deleted && entryImages(e).length > 0)
    .sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : -1))

  const rows: PhotoRow[] = []
  let photos = 0
  let i = 0
  while (i < withPhotos.length) {
    const day = withPhotos[i].day
    const tiles: PhotoTile[] = []
    while (i < withPhotos.length && withPhotos[i].day === day) {
      const entry = withPhotos[i++]
      entryImages(entry).forEach((image, index) => tiles.push({ key: `${entry.id}:${index}`, entry, index, image }))
    }
    photos += tiles.length
    rows.push({ kind: 'day', day, count: tiles.length })
    for (let t = 0; t < tiles.length; t += cols) rows.push({ kind: 'tiles', day, tiles: tiles.slice(t, t + cols) })
  }
  return { rows, photos, entries: withPhotos.length }
}
