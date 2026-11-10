import { useState } from 'react'
import type { ImageRef } from '../lib/entry'
import { isDisplayable } from '../lib/images'
import { useThumbUrl } from './useThumbUrl'

/**
 * A thumbnail filling its box. The box is sized by the caller (never by the image), so nothing moves when it loads.
 * Shows a placeholder for formats the app can't show and for thumbnails that aren't on this device.
 */
export function Thumb({ image, label }: { image: Pick<ImageRef, 'hash' | 'ext'>; label?: string }) {
  const url = useThumbUrl(image.hash)
  const [loaded, setLoaded] = useState<string | null>(null)
  if (!url) {
    return (
      <span className="thumb-placeholder" aria-label={label}>
        {isDisplayable(image) ? '' : image.ext.toUpperCase()}
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
