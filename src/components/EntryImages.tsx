import type { ImageRef } from '../lib/entry'
import { GRID_TILE, imageLayout } from '../lib/imageLayout'
import { Thumb } from './Thumb'

/**
 * An entry's photos under its text: 1 photo at its natural ratio (up to about 260 px tall), 2–4 in a 2-column grid of
 * squares, 5 or more as the first 4 with "+N" on the last. Every box is sized from the stored w/h before decoding.
 */
export function EntryImages({ images, onOpen }: { images: ImageRef[]; onOpen?: (index: number) => void }) {
  const layout = imageLayout(images)
  if (layout.kind === 'none') return null

  const tile = (img: ImageRef, i: number, style: React.CSSProperties, overlay?: string) => (
    <button
      key={`${img.hash}-${i}`}
      type="button"
      className="entry-image"
      style={style}
      onClick={() => onOpen?.(i)}
      aria-label={overlay ? `Open photo ${i + 1} of ${images.length} (${overlay} more)` : `Open photo ${i + 1} of ${images.length}`}
    >
      <Thumb image={img} />
      {overlay && <span className="more">{overlay}</span>}
    </button>
  )

  if (layout.kind === 'single') {
    return (
      <div className="entry-images single">
        {tile(layout.image, 0, { width: layout.width, aspectRatio: `${layout.width} / ${layout.height}` })}
      </div>
    )
  }
  return (
    <div className="entry-images grid" style={{ gridTemplateColumns: `repeat(2, ${GRID_TILE}px)` }}>
      {layout.shown.map((img, i) =>
        tile(img, i, { width: GRID_TILE, height: GRID_TILE }, i === layout.shown.length - 1 && layout.more ? `+${layout.more}` : undefined),
      )}
    </div>
  )
}
