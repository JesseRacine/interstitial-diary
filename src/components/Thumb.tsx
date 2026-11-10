import { useState } from 'react'
import type { ImageRef } from '../lib/entry'
import { isDisplayable } from '../lib/images'
import { useImageMissing } from '../storage/manager'
import { useThumbUrl } from './useThumbUrl'

/**
 * A thumbnail filling its box. The box is sized by the caller (never by the image), so nothing moves when it loads.
 * Without a thumbnail it shows a placeholder: the format's name for formats the app can't show, "Not synced yet" for
 * photos the last sync found nowhere (the device that added them hasn't synced), otherwise an empty box.
 */
export function Thumb({ image, label }: { image: Pick<ImageRef, 'hash' | 'ext'>; label?: string }) {
  const url = useThumbUrl(image.hash)
  const missing = useImageMissing(image.hash)
  const [loaded, setLoaded] = useState<string | null>(null)
  if (!url) {
    const displayable = isDisplayable(image)
    return (
      <span
        className={`thumb-placeholder${displayable && missing ? ' missing' : ''}`}
        aria-label={label}
        title={displayable && missing ? 'This photo will appear once the device that added it has synced.' : undefined}
      >
        {!displayable ? image.ext.toUpperCase() : missing ? 'Not synced yet' : ''}
      </span>
    )
  }
  return (
    <img
      src={url}
      alt={label ?? ''}
      decoding="async"
      draggable={false}
      className={loaded === url ? 'loaded' : undefined}
      onLoad={() => setLoaded(url)}
    />
  )
}
