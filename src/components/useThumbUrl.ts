import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { db } from '../lib/db'
import { UrlCache } from '../lib/urlCache'

/** One cache for every thumbnail on screen (journal, search results, capture chips). */
export const thumbUrls = new UrlCache({
  load: async (hash) => (await db.thumbs.get(hash))?.blob ?? null,
  create: (b) => URL.createObjectURL(b),
  revoke: (u) => URL.revokeObjectURL(u),
})

/**
 * The thumbnail's object URL; null while loading or when there is none. Ignores results after unmount.
 * While there is none, it watches the thumbs table, so a thumbnail that sync brings in later shows up in place.
 */
export function useThumbUrl(hash: string | undefined): string | null {
  const [url, setUrl] = useState<{ hash: string; url: string | null } | null>(null)
  useEffect(() => {
    if (!hash) return
    let live = true
    let watch: { unsubscribe(): void } | undefined
    void thumbUrls.acquire(hash).then((u) => {
      if (!live) return
      setUrl({ hash, url: u })
      if (u) return
      watch = liveQuery(() => db.thumbs.where('hash').equals(hash).count()).subscribe({
        next: (n) => {
          if (!n || !live) return
          watch?.unsubscribe()
          void thumbUrls.retry(hash).then((v) => { if (live) setUrl({ hash, url: v }) })
        },
      })
    })
    return () => {
      live = false
      watch?.unsubscribe()
      thumbUrls.release(hash)
    }
  }, [hash])
  return url && url.hash === hash ? url.url : null
}
