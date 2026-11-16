/*
 * Loaded by the service worker (sw.js, via importScripts; see vite.config.ts).
 *
 * In the Windows and Android apps (served from tauri.localhost, or tauri://) the whole site is inside the app, so a
 * saved copy of it only gets in the way: after a new build is installed, the old saved copy would still be shown until
 * the user found the "Reload" banner. An app that already holds an old saved copy runs that old code, which cannot
 * clean up after itself. But the browser checks sw.js for a newer version every time the app opens, and this file
 * arrives with the new sw.js. So in the native apps the new worker takes over at once, deletes every saved file,
 * removes itself and reloads the open window, which then shows the fresh site straight from the app.
 *
 * On the website (any other address) this file does nothing, so its offline saved copy and the update banner work
 * as before. src/lib/nativeApp.ts keeps the native apps from registering a worker again.
 */
(function () {
  var loc = self.location
  if (loc.hostname !== 'tauri.localhost' && loc.protocol !== 'tauri:') return

  self.addEventListener('install', function () {
    self.skipWaiting()
  })

  self.addEventListener('activate', function (event) {
    event.waitUntil(
      (async function () {
        try { await self.clients.claim() } catch { /* still carry on */ }
        try {
          var names = await caches.keys()
          for (var i = 0; i < names.length; i++) await caches.delete(names[i])
        } catch { /* a cache that will not go is no worse than before */ }
        try { await self.registration.unregister() } catch { /* the app code unregisters it too */ }
        try {
          var windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
          for (var j = 0; j < windows.length; j++) {
            try { await windows[j].navigate(windows[j].url) } catch { /* the next start is clean anyway */ }
          }
        } catch { /* same */ }
      })(),
    )
  })
})()
