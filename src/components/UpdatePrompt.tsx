import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { dropSavedSiteAndReload, isNativeApp } from '../lib/nativeApp'

const CHECK_EVERY_MS = 60 * 60 * 1000 // an installed app can stay open for days

let started = false
let applyUpdate: ((reload?: boolean) => Promise<void>) | undefined

/**
 * Registers the service worker (production builds only) and shows a small banner when a new version is waiting
 * or the app has just become available offline. A new version is only applied when the user clicks Reload,
 * so a half-written entry is never thrown away.
 */
export function UpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [offlineReady, setOfflineReady] = useState(false)

  useEffect(() => {
    if (started) return // StrictMode runs effects twice in development
    started = true
    if (isNativeApp(location)) {
      // The Windows and Android apps contain the site: no saved copy, so a new build shows as soon as the app opens.
      void dropSavedSiteAndReload()
      return
    }
    applyUpdate = registerSW({
      onNeedRefresh: () => setNeedRefresh(true),
      onOfflineReady: () => setOfflineReady(true),
      onRegisteredSW: (_url, registration) => {
        if (registration) setInterval(() => { void registration.update().catch(() => undefined) }, CHECK_EVERY_MS)
      },
    })
  }, [])

  if (!needRefresh && !offlineReady) return null
  return (
    <div className="pwa-toast" role="status">
      <span>{needRefresh ? 'A new version is ready.' : 'Ready to work offline.'}</span>
      {needRefresh && <button type="button" className="primary" onClick={() => { void applyUpdate?.(true) }}>Reload</button>}
      <button type="button" className="ghost" onClick={() => { setNeedRefresh(false); setOfflineReady(false) }}>
        {needRefresh ? 'Later' : 'OK'}
      </button>
    </div>
  )
}
