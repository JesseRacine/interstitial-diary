# Progress and next steps

_Last updated: 2026-11-09_

## Done

| Commit | What |
|---|---|
| 3aad18f | Vite + React + TypeScript scaffold in WSL; Dexie, MiniSearch, ulid, Vitest |
| 92f76f8 | Local journal: capture, day timeline, search (full syntax), results histogram, saved/recent searches, calendar heatmap, tags page with rename, settings, export to Markdown zip; Markdown format and merge logic with tests |
| 1e0d668 | Modular storage: sync engine, "Folder on this computer" and "Files inside this browser" modules, auto-sync, status badge |
| 9747fca | Fix: edits made to existing entries directly in the files were overwritten; now they win |
| 05c214a | Chat-style journal: one scrolling chat with the capture bar pinned at the bottom; left-aligned bubbles; two layouts (`Days` = a box per day, `Stream` = one continuous chat), remembered in localStorage; virtualised with `react-virtuoso` so two years (7,300 entries) scroll smoothly (~24 rows in the DOM); jump from calendar/search/date picker; `lib/journalRows.ts` + tests |
| 5d66390 | Images 1.1: `ImageRef` data model, `withDerived` keeps images, Dexie v2 (`thumbs`, `blobs`) |
| 725ab6e | Images 1.2: image lines in day files (backward compatible; hand-written ids unchanged) |
| 82ecaa0 | Images 1.3: sync treats image lines changed by hand as edits |
| d934111 | Images 1.4: hashing, type sniffing, thumbnail worker (EXIF rotation), `attachImage` |
| 8bbe2d7 | Images 1.5: blob methods on `FileStore`; `pushImages` writes originals + thumbnails before day files |
| c7f17cf | Images 1.6: attach photos in the capture box (paste, drop, pick) |
| f1dcd22 | Images 1.7: photos in bubbles, sized before decode; add/remove while editing |
| 0cb6125 | Images 1.8: lightbox (zoom, pan, keys, back button, save, remove) |
| 924391e | Images 1.9: export with photos (streamed zip, per year over 4 GB); then 1.10: docs, phase 1 done |
| 937a468 | Images 2.1: `pullImages` after the text sync: thumbnails to other devices, rebuild missing ones |
| 6e8117c | Images 2.2: originals downloaded when opened; bounded original cache (only safe copies dropped) |
| 811c738 | Images 2.3: "Not synced yet" placeholder for photos the last sync found nowhere |
| 9dadbe1 | Images 2.4: badge shows "N photos waiting" (live); fix: re-attached photo now marked as stored |
| 5a2c729 | Images 2.5: docs (DESIGN.md image sync + storage modules), two-device "done when" test; phase 2 done |
| aba1edd | Images 3.1: `has:image` / `-has:image` search filter, "With photos" chip, help row, DESIGN.md |
| 97b5ff1 | Images 3.2: Photos view (virtualised thumbnail grid by day, tile opens the lightbox, day heading opens the journal) |
| 5e3ccbe | Images 3.3: "Photos on this device" card in Settings (space used, browser estimate, adjustable original-cache limit) |
| 4e9a162 | Images 3.4: "Remove photos of deleted entries" (confirmed, sync-first cleanup; `storage/cleanup.ts`, `removeBlob` on stores) |
| 85df32f | Images 3.5: "only in this browser" warning with photo wording (Settings box, header badge); phase 3 done |
| f4ef4d9 | Documentation pass: CLAUDE.md rewritten (full code map, rules, testing, gotchas, workflow), PROGRESS/DESIGN/images-plan tidied. Backed up to the Windows project folder (`archive/` + zip, snapshot of this commit) |

| afa7135 | PWA 2: installable PWA: manifest + generated icons + "New entry" shortcut, `vite-plugin-pwa` precaching the whole build (image worker included), update banner, theme-color/apple-touch-icon; 6 new tests |

254 tests pass (`npm test`); `npx tsc -b` is clean; lint has 0 errors (5 old warnings, none in recent work).

## Waiting on the user

Things that can only be checked on the real Windows folder, a real export dialog, or a second device (the folder picker
and Save dialog can't be driven from the Browser pane). Until confirmed they are **not verified**:

1. **Photos reach the real folder.** On `localhost:5173` with the folder module, attach a photo and check that
   `<folder>\2026\images\` and `<folder>\.thumbs\` get the files after the next save.
2. **One real export with photos** through the Save dialog (Chrome/Edge).
3. **The original-cache limit** (Settings > Photos on this device): lower it and check that originals leave the browser
   only once they are saved to the folder (and are downloaded again when opened).
4. **"Photos of deleted entries"** (same card): delete an entry that has a photo, run it, and check the files leave
   `<folder>\<year>\images\` and `.thumbs\`, and that a photo still used by another entry stays.
5. **A real second device** (needs hosting, or a shared folder such as pCloud Drive between two browsers): a photo added
   on one device shows as a thumbnail on the other within one sync, and its original downloads when opened.
6. **PWA install in Edge: confirmed working by the user (2026-11-10)** on `localhost:4173` (`npm run build && npm run
   preview`). Not individually reported, so still unchecked: the jump-list "New entry" shortcut and Lighthouse (recent
   Lighthouse versions have no separate PWA score; DevTools > Application > Manifest shows installability instead).
   Note: an install from `localhost:<port>` is tied to that address and its own empty data; the real install comes after
   hosting (step 4).
7. **The update banner.** Install, then change something and rebuild: the open app should show "A new version is ready"
   with Reload/Later. (The banner code is untested in the browser: it needs two builds in a row.)

## Next steps (in order)

### 1. Images in entries: phases 1–3 done; phase 4 comes with pCloud
- Planned in [images-plan.md](images-plan.md), which also holds the build log (what each step decided and how it was
  checked). The design is in DESIGN.md ("Photos", "Images in a sync run", "Platform plan and data safety").
- **Phase 1 (2026-11-09):** attach (paste, drop, pick), show in bubbles, open full size, export with photos, originals
  written to the storage folder.
- **Phase 2 (2026-11-09):** images on other devices: thumbnails arrive with the entry (or are rebuilt), originals
  download when opened (hash-checked, bounded cache), "Not synced yet" placeholder, "N photos waiting" in the badge.
- **Phase 3 (2026-11-09):** `has:image` search, a Photos tab, photo storage + cache limit in Settings, a confirmed
  cleanup of photos of deleted entries, and the "only in this browser" warning with photo wording.
- **Phase 4:** images on pCloud. Implement `readBlob`/`writeBlob`/`hasBlob`/`removeBlob` in the pCloud module (step 5).

### 2. Installable PWA: done (2026-11-10); user confirmed install works in Edge
- `pwa-manifest.ts` (name, short name "Interstitial", standalone, relative `start_url`/`scope`, icons incl. maskable,
  "New entry" shortcut = `./?view=journal`), `vite-plugin-pwa` in `vite.config.ts`, `components/UpdatePrompt.tsx`,
  `scripts/make-icons.mjs` (generated placeholder icons: three journal lines on the accent green; swap the files in
  `public/` for real artwork any time). Details in DESIGN.md "Platform plan".
- Checked in the Browser pane on a production build: manifest served, worker active, 12 files precached (the image
  worker chunk included), app reloads and runs with the server stopped, the shortcut URL focuses the capture box.
- **Confirmed by the user:** installs and works in Edge. **Not yet verified:** the "New entry" jump-list shortcut, the
  update banner (waiting list items 6 and 7).
- Still a small polish idea: one ~500 kB JS chunk (Vite warns); code-splitting would shrink the first load.

### 3. Data-safety features
- Settings shows whether persistent storage was granted (`navigator.storage.persisted()`).
- A warning when no file storage is set up ("Entries are only in this browser"). **Partly done (images 3.5):** the
  Settings storage card shows it (also for "Files inside this browser", which isn't a backup), worded for photos when
  the device holds any; the header badge shows "Photos only in this browser" once there are photos. Still to do: decide
  whether entries-only users should also get the header badge.
- On platforms without the folder module (Android), a periodic export/backup reminder until pCloud exists.
- **Done when:** each state is visible in Settings and tested at phone width.

### 4. Hosting (needs the user)
- **Open decision:** GitHub Pages (recommended: the same GitHub account later covers native builds in Actions and a
  possible GitHub storage module) or Cloudflare Pages.
- The user needs to create the account/repo; then add a deploy workflow and set Vite `base` if the site is served
  from a sub-path.
- Note: browser data belongs to the exact address, so pick the final address early (moving later starts the
  installed app empty, though files in a folder or pCloud carry over).
- **Done when:** the app is installed on both Windows and Android from the hosted address.

### 5. pCloud storage module
- See DESIGN.md "pCloud notes". The user registers an app in pCloud's developer console (needs the hosted address
  for the OAuth redirect) and provides the client id.
- Implement `storage/backends/pcloud.ts`; handle the US/EU region; token stored in the backend config. Include the
  image methods (phase 4) so photos sync too.
- **Done when:** an entry written on Windows appears on Android and vice versa, including offline edits on both.

### 6. Native apps (Tauri)
- The user wants a "real app", with the PWA first. Wrap the same build with Tauri 2; build the Windows `.exe` and
  Android `.apk` in GitHub Actions (keeps Rust/Android SDK off the user's machine).
- Native extras: global hotkey + tray on Windows; a native-folder storage module for Android.
- Android quick capture (home-screen widget, pop-up entry box): planned in [android-capture-plan.md](android-capture-plan.md).
  Its stage 1 (open straight to capture, share target) belongs with the PWA and hosting steps.

## Known limitations
- Unsaved edits to an existing entry are lost if you scroll far enough that its row leaves the screen (the journal is virtualised).
- Removing an entry from a file by hand doesn't delete it (by design; see DESIGN.md).
- The folder module needs Chrome/Edge on desktop and usually needs "Reconnect folder" after a browser restart.
- On Android there is currently no copy outside the browser (the app warns about this in Settings).
- No import of existing notes from other apps yet (export only).
- Export with photos only includes originals currently on the device; on a computer with the folder module, photos
  dropped from the browser cache (over the cache limit, 1 GB by default) are left out of the zip (they are still in the folder).
- A photo file deleted by hand from the storage folder after it was saved there is not written back.
- An unsaved edit's photo references can be lost like its text (see the first point), but the photo bytes are already
  saved in the browser and are never lost.
- Photo files are only ever deleted by "Photos of deleted entries". A photo removed from a *live* entry (lightbox
  "Remove") keeps its file, and the cleanup only knows entries deleted on (or synced to) this device, so such files stay.
- "Photos of deleted entries" syncs first and refuses to run if that sync fails; with no storage connected it only
  cleans this device.
- Photos in HEIC/AVIF are stored but can't be shown (placeholder with Save); there is no HEIC conversion.

## Ideas backlog
- Restyle search results to match the chat look (they still use cards).
- Idle nudge ("you haven't logged in 90 minutes").
- Weekly review page: entries per day, top tags, time-of-day patterns.
- Edit an entry's time.
- Incremental search indexing if the journal gets very large.
- GitHub storage module.
- Photos view: filter by tag/date range; jump to the entry from the lightbox.
- Clean up photos removed from live entries (needs a way to know nothing else uses the file).
