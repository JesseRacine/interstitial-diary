import { useEffect, useState } from 'react'
import { db } from '../lib/db'
import { UrlCache } from '../lib/urlCache'

/** One cache for every thumbnail on screen (journal, search results, capture chips). */
export const thumbUrls = new UrlCache({
  load: async (hash) => (await db.thumbs.get(hash))?.blob ?? null,
  create: (b) => URL.createObjectURL(b),
  revoke: (u) => URL.revokeObjectURL(u),
})

/** The thumbnail's object URL; null while loading or when there is none. Ignores results after unmount. */
export function useThumbUrl(hash: string | undefined): string | null {
  const [url, setUrl] = useState<{ hash: string; url: string | null } | null>(null)
  useEffect(() => {
    if (!hash) return
    let live = true
    void thumbUrls.acquire(hash).then((u) => { if (live) setUrl({ hash, url: u }) })
    return () => {
      live = false
      thumbUrls.release(hash)
    }
  }, [hash])
  return url && url.hash === hash ? url.url : null
}
