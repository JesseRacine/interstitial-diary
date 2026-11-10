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

| daa2fb8 | Data safety 3: Settings "Data safety" card (persistent-storage state, last backup, reminder switch), header badge for entries-only users, backup reminder, `restored` startup flag; 18 new tests |

| f3c682f | Docs: handoff for step 4 (GitHub Pages): open decisions, user tasks, pre-publish cleanup, checklist |

| d1594c0 | Step 4.1: pre-publish cleanup: personal paths/email removed from the docs; whole history rewritten to the GitHub noreply identity (and old doc versions scrubbed); branch renamed `master` to `main` |

| 8ec4067 | Step 4.1b: deleted the superseded `junior-plan.md` |

| 88d19ea | Docs: record the new archive (step 4.1 finished) |

| (this commit) | Step 4.2: base path: Vite `base` from the `BASE_PATH` variable (`base-path.ts`, `normaliseBase`, 5 new tests); checked on a build under `/interstitial-diary/`; `dist-sub` git-ignored |

**All hashes above, except f3c682f and the ones after it, are from before the 2026-11-10 history rewrite** (author change plus a scrub of
old doc text); the same commits now have different hashes. Match them by subject (`git log --oneline`). The pre-rewrite
history is only in the local backup bundle `~/interstitial-diary-pre-rewrite.bundle` (outside the repo, private; it still
holds the old identity, so never push or share it) and in the older Windows-folder archive of f4ef4d9.

277 tests pass (`npm test`); `npx tsc -b` is clean; lint has 0 errors (5 old warnings, none in recent work).

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
   preview`), and the jump-list "New entry" shortcut works. Not reported, so unchecked: Lighthouse (recent Lighthouse
   versions have no separate PWA score; DevTools > Application > Manifest shows installability instead).
   Note: an install from `localhost:<port>` is tied to that address and its own empty data; the real install comes after
   hosting (step 4).
7. **The update banner.** Install, then change something and rebuild: the open app should show "A new version is ready"
   with Reload/Later. (The banner code is untested in the browser: it needs two builds in a row.)
8. **Data safety on your real setup.** In the installed Edge app, open Settings > Data safety: it should say whether the
   browser granted persistent storage (installing usually gets it granted). Do one real export (Settings > Your data)
   and check "Last backup" changes to today. With the folder module connected, no "Only in this browser" badge or
   backup reminder should appear, not even for a moment after opening the app.

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
- **Confirmed by the user:** installs and works in Edge, and the "New entry" jump-list shortcut works. **Not yet
  verified:** the update banner (waiting list item 7).
- Still a small polish idea: one ~500 kB JS chunk (Vite warns); code-splitting would shrink the first load.

### 3. Data-safety features: done (2026-11-10)
- **Settings > Data safety** (`DataSafetyCard`): whether the browser has granted persistent storage (granted / not
  granted with an "Ask the browser again" button / can't tell), the date of the last backup (export), and a switch for
  the backup reminder.
- **Header badge:** decided: entries-only users get it too. With no storage chosen it shows "⚠ Only in this browser" as
  soon as there is one entry (or "Photos only in this browser" with photos). It stays quiet until the saved storage has
  been read at startup (new `restored` flag in the storage state), so folder users no longer see a false flash.
- **Backup reminder** (`BackupReminder`, above the search bar): for anyone whose entries are only in the browser (no
  storage, or "Files inside this browser"; this is what Android users are until pCloud exists). First reminder once the
  oldest entry is 3 days old and there has been no export; afterwards 14 days after the last export. "Back up now" opens
  Settings, "Later" snoozes 7 days, "Stop reminding me" turns it off (the Settings switch turns it back on). A finished
  export records the date. Never shown with the folder module.
- Checked in the Browser pane at 375px (badge, reminder, Later, Stop, stale/recent backup dates, Settings card, Ask
  again). Logic is in `lib/dataSafety.ts` with 18 new tests. **Not verified:** the real Export buttons recording the
  date (the pane can't take downloads; the code path is two `setMeta` calls), and a real Android phone.
- Possible later polish: a "Files inside this browser" user still sees a green "Saved" header badge (the Settings card
  and the reminder do say it isn't a backup).

### 4. Hosting on GitHub Pages: NEXT (decided 2026-11-10: GitHub Pages, not Cloudflare)
**Status (2026-11-10): decisions made; checklist sub-step 1 (clean-up) done, including the new dated archive in the
Windows session folder (`archive-2026-11-10/` + zip, snapshot of 8ec4067; restore tested from the bundle). Still local: no
remote, nothing pushed. Sub-step 2 (base path) done. Next: the deploy workflow (sub-step 3), then `gh` sign-in/repo
creation and the first push.** Work through the checklist in order, one sub-step per turn.

**Decisions (answered 2026-11-10):** GitHub account `JesseRacine` (numeric id 9375408; looked up from GitHub's public
profile API); repo `interstitial-diary`, public; address `https://jesseracine.github.io/interstitial-diary/` (so
`base: '/interstitial-diary/'`); commits use `JesseRacine <9375408+JesseRacine@users.noreply.github.com>` (set as the
repo's local git identity); branch `main`. The superseded `junior-plan.md` was deleted (it stays in the git history, which holds no personal data).

**What the user has already been told (don't re-explain at length):**
- The hosted site is **public**; on GitHub's free plan the repo must be public too (Pages from a private repo needs a
  paid plan, and even then the site is public; only Enterprise can restrict it). Cloudflare Pages + Access was the
  private alternative; the user chose GitHub Pages anyway.
- Their **journal is never uploaded**: entries and photos stay in their browser or their own folder; the site is only the
  app's code, and a stranger opening it gets their own empty journal.
- An app installed from the hosted address has its **own empty data**, separate from the `localhost:4173` test install
  (bring a journal across with Export, or a shared folder).
- The address is permanent in practice (browser data belongs to the exact address). Changing it later starts the
  installed app empty (files in a folder or pCloud carry over).

**The four decisions that were asked (answers above; the options and reasoning are kept for the record):**
1. **Address:** `https://<username>.github.io/<repo>/` (default; needs `base: '/<repo>/'`), or a repo named exactly
   `<username>.github.io` (address with no sub-path, `base: '/'`), or later a custom domain (about $10/year, survives
   a change of host). Recommend one of the first two; custom domain only if they want long-term permanence.
2. **Public repo OK?** Required on the free plan.
3. **Commit email.** All 40 commits were authored with the user's personal Gmail address; a public repo would show it
   (also in the text of two doc commits). Recommend rewriting the author email to their GitHub noreply address
   (`<id>+<username>@users.noreply.github.com`, shown at github.com > Settings > Emails) before the first push, and
   switching on "Keep my email addresses private" and "Block command line pushes that expose my email". Alternative:
   accept the exposure. A rewrite changes every commit hash (see cleanup below).
4. **Default branch:** the repo's branch is `master` and there is no remote. Recommend renaming it to `main` (what
   GitHub and most workflow examples assume).

**What the user must do (Claude can't):**
- Create the GitHub account (and make the privacy settings above), then give Claude the username and the numeric id
  from the noreply address; create the empty repo (no README/licence) or let `gh repo create` do it.
- Sign in from WSL once. `gh` is **not installed** in WSL: Claude asks before installing it there (installs stay in
  WSL), then the user runs `gh auth login` themselves (Claude never handles the password/token). Alternative: an SSH key
  or a personal access token the user sets up.
- Repo **Settings > Pages > Source: GitHub Actions** (one click, after the first push).
- Test the installs: Edge on Windows, Chrome on Android (needs the hosted HTTPS address).

**Checklist for Claude (in order):**
1. **Clean up before anything is public.**
   - Re-run the scan (all 2026-11-10 results are listed here; there are no keys, tokens or secrets in the repo):
     `git grep -n -I -E "gmail|C:\\\\Users|/home/|wsl.localhost" -- . ':!package-lock.json'` and
     `git log --format='%an <%ae>' | sort | uniq -c`. Findings: the repo's `CLAUDE.md` lines 23, 24 and 53 hold the
     WSL/Windows paths, the user's name and their Gmail address (in the commit command). Move the machine-specific
     paths into the Windows session folder's own `CLAUDE.md` (outside the repo) and use the noreply address in the
     commit command. (`junior-plan.md`: deleted, see above.)
   - If the history is rewritten (decision 3): use `git filter-branch --env-filter` (or `git-filter-repo`, which is not
     installed: ask first), keep the `Co-Authored-By: Claude ... <noreply@anthropic.com>` trailers, check
     `git log --format='%an <%ae>' | sort -u` shows only the noreply address, and note in PROGRESS.md that the hashes in
     the "Done" table predate the rewrite. Then make a **new dated archive** in the Windows folder (the existing
     `archive/` snapshot is of f4ef4d9 and is read-only; never edit it).
   - Rename `master` to `main` if chosen; add the remote; first push.
2. **Base path: DONE (2026-11-10).** `vite.config.ts` sets `base` from the `BASE_PATH` environment variable through
   `normaliseBase` (`base-path.ts`, tested in `src/basePath.test.ts`): unset means `/`, so `dev`, `preview` and a plain
   `npm run build` are unchanged; the deploy workflow will set `BASE_PATH=/interstitial-diary/`. A malformed value (a full
   URL, a query, `..`) makes the build fail rather than ship a broken site. Checked in the Browser pane on a build under
   `/interstitial-diary/` served on 127.0.0.1:4174 (new launch config `interstitial-preview-sub`, builds into the
   git-ignored `dist-sub`): the page, CSS, JS, favicon and apple-touch-icon load from the sub-path; the manifest resolves
   `start_url`/`scope` to `/interstitial-diary/` and its three icons return 200; the "New entry" shortcut URL resolves to
   `/interstitial-diary/?view=journal` and focuses the capture box; the service worker scope is `/interstitial-diary/`,
   12 files precached (the image worker chunk included); with the server stopped the app still reloads from the worker.
   A plain build still emits root-absolute paths. **Not verified until it is hosted:** the real GitHub Pages address
   (HTTPS, Pages' own 404 behaviour), and the Android install.
3. **Deploy workflow** `.github/workflows/deploy.yml`: on push to `main` (and manual): checkout, setup-node (match
   the Node version in WSL: check `node -v`; pin it), `npm ci`, `npm test`, `npm run build` (runs `tsc -b`),
   `actions/configure-pages`, `actions/upload-pages-artifact` (path `dist`), `actions/deploy-pages`; permissions
   `contents: read`, `pages: write`, `id-token: write`; a `concurrency` group. Look up the current major versions of those
   actions rather than trusting memory. Tests run with `TZ=UTC` already via the npm script.
4. **Push and watch** the first run (`gh run watch`, or the user's Actions tab; do not poll in a loop). Pages can take a
   minute or two to start serving.
5. **Verify the hosted site** in the Browser pane (read-only checks: manifest, service worker active and its scope, precache
   list, offline reload on the hosted origin, icons load) and ask the user to install it in Edge and on Android.
6. **Close the loop on the update banner** (waiting-list item 7): make a visible change, deploy a second time, and the
   installed app should show "A new version is ready".
7. **Docs:** add the live URL to README, CLAUDE.md (status, commands, code map: `.github/workflows/deploy.yml`, the
   `BASE_PATH` variable) and DESIGN.md ("Platform plan"); move the done items into the "Done" table; update the memory
   note `interstitial-diary-project`.

**Things to remember afterwards:**
- Step 5 (pCloud) needs this address for the OAuth redirect URI; the pCloud app is registered in their developer console.
- The Android folder module is still unsupported there, so Android users depend on the export reminder until pCloud or
  native exists.
- A custom domain later means a new origin: installed apps start empty again (plan it before many installs).

**Done when:** the app is installed on both Windows and Android from the hosted address, and a second deploy shows the
update banner.

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
- On Android there is currently no copy outside the browser (the app warns about this in the header and Settings, and
  reminds you to export every couple of weeks).
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
