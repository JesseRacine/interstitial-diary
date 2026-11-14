# History: what was built, and how each step was checked

_Reference only: **do not read this at the start of a session.** Read [../PROGRESS.md](../PROGRESS.md) first. Open this
file when you need the commit for a feature, the reasoning behind a finished step, or how hosting was set up._

## Done (commit table)

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
| 88d19ea | Docs: record the new archive (step 4.1 finished): `archive-2026-11-10/` + zip in the Windows session folder |
| ec9e90a | Step 4.2: base path: Vite `base` from the `BASE_PATH` variable (`base-path.ts`, `normaliseBase`, 5 new tests); checked on a build under `/interstitial-diary/`; `dist-sub` git-ignored |
| b8df143 | Step 4.3: GitHub Pages deploy workflow `.github/workflows/deploy.yml` (tests, build with `BASE_PATH`, deploy); 5 new tests |
| 6e90356 | Step 4.4/4.5: repo published, site live at https://jesseracine.github.io/interstitial-diary/ (first deploy green; hosted site checked read-only in the Browser pane); docs |
| 512ac61 | Docs: hosted install confirmed by the user; second deploy green |
| 3685037 | Docs: pCloud step 5 started; OAuth facts from pCloud's docs and what the user must register |
| 61235a6 | Docs: Dropbox storage module chosen (step 5a): OAuth PKCE facts and what the user registers |
| 006db68 | People and places 1/6 (local, 2026-11-12): `#tag`, `@person`, `~place` read from text; `lib/tagKinds.ts` (one row per kind); stored keys `work` / `@sarah` / `~home`; Dexie v3 recalculates tags without marking entries changed; fixed rename of a tag containing `-` (invalid regex escape) |
| 8afa9dc | People and places 2/6: shown as "👤 Sarah Jones" / "📍 Blue Door" in their own colours; `@`/`~`/`#` autocomplete offers only its own kind (`tagSegments`, `tagBeingTyped`, `tagLabel`) |
| eb800d3 | People and places 3/6: search `@sarah`, `~home`, `-@sarah`, `@a\|@b`, mixed groups; `~5` / `@3pm` stay plain words |
| e78bbc4 | People and places 4/6: Tags view split into Tags / People / Places; per-kind rename and merge (`parseTagName`) |
| 5bad3f0 | People and places 5/6: a page per person/place (`TagPage.tsx`: counts, first/last, month bars that filter, entries); `first` in `TagStat`, `hasPage` on `TagKind` |
| cf88bea | People and places 6/6: final docs. **Pushed 2026-11-12 (deploy #7 green, live bundle checked)** |
| 16947a9 | Events 1/5 (local, 2026-11-13): `lib/events.ts` reads `!"Title"` markers, groups entries with the same title within 7 days into one event; event titles skipped by `extractTags` / `replaceTag` |
| 9322bf5 | Events 2/5: marker shown as a blue "🎉 title" chip (`--event`); entry-box hint mentions `!"event"` |
| a9bfddf | Events 3/5: Events tab (`EventsView.tsx`, `lib/eventRows.ts`): rows by month, title filter, year, sort, event page; chips open their event via `OpenEventContext`; phone nav tightened for six tabs |
| 457cb9b | Events 4/5: Rename event (`renameEvent` in `db.ts`, `eventAfterRename`) |
| 0995008 | Events 5/5: DESIGN.md "Events", limits and ideas, code map. **Pushed 2026-11-13 (deploy #10 green, live bundle checked)** |
| 03c54dc | Plan step 1 (2026-11-13): Enter adds a line on touch screens (`enterAction` in `lib/dom.ts`); hint lines follow the device |
| ad749ae | Plan step 2: edit an entry's time and date (`lib/retime.ts`, "When" field, local-only `Entry.prevDay` so sync rewrites the old day's file). **Steps 1 and 2 pushed 2026-11-13 (deploy green)** |
| e8119ea | Plan step 3 (local): weekly review in the Calendar tab (`lib/weekReview.ts`, `WeekReview.tsx`) |
| 7f71cb0 | Plan step 4a (local): `event:"Title"` and `has:event` search, "With events" chip, "Search this event" button |
| f7b8c24 | Plan step 4b (local): "Merge into…" on the event page (`mergeTargets` in `lib/eventRows.ts`, reuses `renameEvent`) |
| a65efbc | Plan step 4c: an event's own date `!"Title" (2026-05-12)` (`lib/events.ts`: same title + date = one event; `eventOfMarker`). **Steps 3, 4a, 4b, 4c pushed 2026-11-14 (deploy green)** |
| 160afbf | Plan step 5: photo filters in the Photos tab (`lib/photoFilter.ts`, filter box, chips, year choice) |
| 8cebc29 | Plan step 6: quick capture on Android, stage 1: `?new=1` shortcut, text share target (GET), `lib/launch.ts`, Settings tip; startup measured, unchanged. **Steps 5 and 6 pushed 2026-11-14 (deploy green)** |
| (docs commit after these) | Docs: PROGRESS.md split into a short file plus `docs/` (history, cloud storage, limits and ideas) so a new session reads little; Dropbox set as the next step |

**All hashes above before `f3c682f` are from before the 2026-11-10 history rewrite** (author change plus a scrub of old
doc text); the same commits now have different hashes. Match them by subject (`git log --oneline`). The pre-rewrite
history is only in the local backup bundle `~/interstitial-diary-pre-rewrite.bundle` (outside the repo, private; it still
holds the old identity, so never push or share it) and in the older Windows-folder archive of f4ef4d9.

## Completed steps

### 1. Images in entries: phases 1–3 done; phase 4 comes with the first cloud module (Dropbox, then pCloud)
- Planned in [../images-plan.md](../images-plan.md), which also holds the build log (what each step decided and how it was
  checked). The design is in DESIGN.md ("Photos", "Images in a sync run", "Platform plan and data safety").
- **Phase 1 (2026-11-09):** attach (paste, drop, pick), show in bubbles, open full size, export with photos, originals
  written to the storage folder.
- **Phase 2 (2026-11-09):** images on other devices: thumbnails arrive with the entry (or are rebuilt), originals
  download when opened (hash-checked, bounded cache), "Not synced yet" placeholder, "N photos waiting" in the badge.
- **Phase 3 (2026-11-09):** `has:image` search, a Photos tab, photo storage + cache limit in Settings, a confirmed
  cleanup of photos of deleted entries, and the "only in this browser" warning with photo wording.
- **Phase 4:** images on a cloud module: implement the blob methods in each module.

### 2. Installable PWA: done (2026-11-10)
- `pwa-manifest.ts` (name, short name "Interstitial", standalone, relative `start_url`/`scope`, icons incl. maskable,
  "New entry" shortcut = `./?view=journal`), `vite-plugin-pwa` in `vite.config.ts`, `components/UpdatePrompt.tsx`,
  `scripts/make-icons.mjs` (generated placeholder icons: three journal lines on the accent green; swap the files in
  `public/` for real artwork any time). Details in DESIGN.md "Platform plan".
- Checked in the Browser pane on a production build: manifest served, worker active, 12 files precached (the image
  worker chunk included), app reloads and runs with the server stopped, the shortcut URL focuses the capture box.
- **Confirmed by the user:** installs and works in Edge, and the "New entry" jump-list shortcut works. **Not yet
  verified:** the update banner (PROGRESS.md waiting item 7).
- Still a small polish idea: one ~500 kB JS chunk (Vite warns); code-splitting would shrink the first load.

### 3. Data-safety features: done (2026-11-10)
- **Settings > Data safety** (`DataSafetyCard`): whether the browser has granted persistent storage (granted / not
  granted with an "Ask the browser again" button / can't tell), the date of the last backup (export), and a switch for
  the backup reminder.
- **Header badge:** entries-only users get it too. With no storage chosen it shows "⚠ Only in this browser" as soon as
  there is one entry (or "Photos only in this browser" with photos). It stays quiet until the saved storage has been read
  at startup (the `restored` flag in the storage state), so folder users no longer see a false flash.
- **Backup reminder** (`BackupReminder`, above the search bar): for anyone whose entries are only in the browser (no
  storage, or "Files inside this browser"; this is what Android users are until a cloud module exists). First reminder
  once the oldest entry is 3 days old and there has been no export; afterwards 14 days after the last export. "Back up
  now" opens Settings, "Later" snoozes 7 days, "Stop reminding me" turns it off (the Settings switch turns it back on). A
  finished export records the date. Never shown with the folder module.
- Checked in the Browser pane at 375px. Logic is in `lib/dataSafety.ts` with 18 tests. **Not verified:** the real Export
  buttons recording the date (the pane can't take downloads), and a real Android phone.
- Possible later polish: a "Files inside this browser" user still sees a green "Saved" header badge.

### 4. Hosting on GitHub Pages: done (2026-11-12), except the update-banner test (4.6)
**Decisions (answered 2026-11-10):** GitHub account `JesseRacine` (numeric id 9375408); repo `interstitial-diary`, public;
address `https://jesseracine.github.io/interstitial-diary/` (so `base: '/interstitial-diary/'`); commits use
`JesseRacine <9375408+JesseRacine@users.noreply.github.com>` (the repo's local git identity); branch `main`.

**What the user was told (don't re-explain at length):** the hosted site is public and on the free plan the repo must be
too; their journal is never uploaded (entries and photos stay in their browser or their own folder; a stranger opening
the site gets their own empty journal); an installed copy has its own empty data per address and the address is permanent
in practice (a custom domain later, about $10/year, would be a new origin and installed copies would start empty again).

**What was done:**
1. **Clean-up before publishing (2026-11-10):** personal paths and the user's Gmail address removed from the repo's docs;
   the whole history rewritten with `git filter-branch` to the noreply identity, with the Gmail address also scrubbed from
   old doc versions (a scan of the full history for personal strings is clean; `Co-Authored-By` trailers kept);
   `master` renamed to `main`; `junior-plan.md` deleted; a new dated archive made in the Windows session folder
   (`archive-2026-11-10/` + zip, snapshot of 8ec4067, restore tested from the bundle).
2. **Base path:** `vite.config.ts` sets `base` from the `BASE_PATH` environment variable through `normaliseBase`
   (`base-path.ts`, tested in `src/basePath.test.ts`): unset means `/`, so `dev`, `preview` and a plain `npm run build` are
   unchanged; a malformed value fails the build. Checked on a build under `/interstitial-diary/` (launch config
   `interstitial-preview-sub`, port 4174, builds into the git-ignored `dist-sub`): assets, manifest scope, icons, the
   shortcut, the service worker scope and the offline reload all work under the sub-path.
3. **Deploy workflow:** `.github/workflows/deploy.yml`, on push to `main` (and manual): checkout, setup-node (Node 26, as in
   WSL), `npm ci`, `npm test`, `npm run build` with `BASE_PATH=/interstitial-diary/`, two `grep` checks that the build uses
   the sub-path, `configure-pages`, `upload-pages-artifact`, then a second job `deploy-pages`; permissions
   `contents: read`, `pages: write`, `id-token: write`; concurrency group `pages`. Action versions (looked up 2026-11-10):
   checkout v7, setup-node v7, configure-pages v6, upload-pages-artifact v5, deploy-pages v5 (all first-party, pinned to a
   major version; re-check if a run warns about a deprecated version). `src/deployWorkflow.test.ts` guards trigger, order,
   base path, permissions and pinning. Both runs so far were green (about 40 s). GitHub's only warning: `ubuntu-latest`
   is moving to Ubuntu 26.
4. **Repo and push:** created public and empty with `gh repo create`, `main` pushed (45 commits at the time, all under the
   noreply identity, history scanned first); the user set Settings > Pages > Source: GitHub Actions.
5. **Hosted site checked (read-only, Browser pane, 2026-11-12):** HTTPS; assets/icons/manifest/service worker (scope
   `/interstitial-diary/`) fine; 12 files precached, image worker included; `?view=journal` focuses the capture box; no
   console errors; the JS file name is identical to the local sub-path build. Offline reload on the hosted origin was not
   checked from the pane. Test data from the check was removed.

**How to push (Claude):** `gh` 2.103.3 lives in the WSL home at `~/.local/bin/gh` (not on PATH; installed in user space,
checksum-verified, no sudo). The user signed in themself with `gh auth login` (token scopes gist, read:org, repo,
workflow); Claude never sees the token. No git config was changed: push with
`git -c credential.helper= -c "credential.helper=!$HOME/.local/bin/gh auth git-credential" push origin main`, and check
runs with `~/.local/bin/gh run list --repo JesseRacine/interstitial-diary` (do not poll in a loop). Scan before every push:
`git grep -n -I -i -E "@gmail|/home/[a-z]|C:.Users|wsl.localhost" -- . ':!package-lock.json'` must print only generic
mentions like this one (no real paths or addresses), and `git log --format='%an <%ae>' | sort | uniq -c` must show only
the noreply address. Never write the user's personal email address or machine username into a file in this repo.
