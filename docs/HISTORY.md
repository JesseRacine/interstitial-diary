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
| 22c990a | Delete permanently (2026-11-13): Settings > Deleted entries (Restore, Delete permanently, Delete all); `lib/purge.ts` scrubs the row, `.meta/purged.json` makes other devices scrub theirs, `purgeDeleted` in `manager.ts` syncs first and removes only the photos these entries used; 18 new tests |
| ee39282 | Manual (2026-11-13): Settings > Manual card (`ManualCard.tsx`); the search help table moved to `search/syntax.ts` (shared with the `?` help, every example parsed by a test). **Both pushed 2026-11-13 (deploy green)** |
| 0d1bb0b | Focus stays in the entry box after Save (2026-11-14): the Save button no longer takes the focus (`onMouseDown` preventDefault in `Capture.tsx`) and `save()` focuses the box; it stops the keyboard closing on phones. **Pushed 2026-11-14 (deploy green); the user: "definitely better"** |
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

## Finished work from 2026-11-12 to 2026-11-14 (moved out of PROGRESS.md on 2026-11-14, as written then)

The "waiting item" numbers are the ones in PROGRESS.md "Waiting on the user".

### Current plan (agreed 2026-11-13): six improvements, one step per turn, in this order

1. **Enter adds a line on touch screens: built, PUSHED and deployed 2026-11-13** (with step 2, `ad749ae`, deploy green; the
   live bundle was not checked) (`enterAction` in `lib/dom.ts`,
   6 tests; checked in the pane with the phone preset: plain Enter is left to the browser, desktop unchanged). The hint line
   changes on touch. **Not tried on the real phone** (waiting item 14).
2. **Edit an entry's time and date, any date: built, PUSHED and deployed 2026-11-13 (`ad749ae`, deploy green).** A "When" field in the
   entry editor (not in the future). A new backup was made first (`archive-2026-11-13/`, commit 03c54dc, restore tested).
   Because a day change leaves a stale copy in the old day's file, the entry carries a local-only `prevDay` that
   `syncOnce` uses to rewrite that file (DESIGN.md "Editing an entry's time"; `lib/retime.ts`). 434 tests (7 new sync tests,
   mutation-checked, + db and retime tests); checked in the pane, including a real sync to "files inside this browser":
   the moved entry left the old day's file and the other entry stayed. **Not tried on the real Windows folder or with
   Dropbox on two devices** (waiting item 15).
3. **Weekly review inside the Calendar tab (Month | Year | Week): built, PUSHED and deployed 2026-11-14 (with steps 4a to 4c,
   `a65efbc`, deploy green; the live bundle was not checked).**
   `lib/weekReview.ts` + `WeekReview.tsx` (10 tests; 444 total, `tsc` clean, lint unchanged). Checked in the pane with
   seeded weeks (dark and light, 375px, no overflow): the numbers match the data, ‹ › / This week / empty week, a tag chip
   searches, a day bar opens the day, the event link opens the event. Not looked at on the real phone or with real data
   (waiting item 16).
4. **Events/people (4a, 4b, 4c all PUSHED and deployed 2026-11-14, `a65efbc`, deploy green):** **4a `event:` search filter and `has:event`: built 2026-11-13**
   (`search/query.ts` keeps `event:"Title"` together as one token, whole-title match on the markers, plus `-has:event`, a
   "With events" chip, syntax help, and a **Search this event** button on the event page; 459 tests, `tsc` clean, lint
   unchanged; checked in the pane with seeded events; waiting item 17); **4b "Merge into…" on the event page: built 2026-11-13** (pick the right event from a list, nearest in time first; it rewrites the title like Rename, and the
   confirmation warns when the entries are more than 7 days from the target's, so they stay a separate event with the same title;
   464 tests, `tsc` clean, lint unchanged; checked in the pane, near and far cases and at 375px; waiting item 18);
   **4c an event's own date: built 2026-11-13.** The user chose `!"Title" (2026-05-12)`
   (date in brackets, year-month-day only). Same title + date = one event however far apart the entries were written
   (its day is that date); a marker without a date joins the nearest dated event of its title within 7 days; chip shows
   "· 12 May 2026"; Rename/Merge keep the date; search unchanged. 483 tests, `tsc` clean, lint unchanged; checked in the pane
   (waiting item 19).
5. **Photo filters in the Photos tab: built, PUSHED and deployed 2026-11-14 (with step 6, `8cebc29`, deploy green).** A filter box with the search
   syntax (`lib/photoFilter.ts` runs `parseQuery` + `runSearch`, so no second parser), quick chips for the top tags/people/
   places among photos, a year choice, "N of M photos", errors, "No photos match / Clear the filter". 494 tests, `tsc`
   clean, lint unchanged; checked in the pane with seeded photo entries (all, `#trip`, `#trip @sam`, year, event, no match,
   bad word, chips on/off, 375px, no overflow). The grid showed empty tiles because the seeded photos have no files:
   not looked at with real photos (waiting item 20). Not included: jump to the entry from the lightbox.
6. **Quick capture on Android, stage 1 (PWA): built, PUSHED and deployed 2026-11-14 (`8cebc29`, deploy green; live bundle not
   checked)** (all six steps of the plan are now built and live; what remains is the user's device checks, items 14 to 21). `?new=1` (the shortcut) opens the journal on the entry box; Android's Share sheet sends title, text
   and link as a GET (manifest `share_target`) into the box, caret at the end, nothing saved until you save; the address is
   cleaned after reading; a Settings tip explains pinning the icon and sharing. **Startup was measured and left alone**
   (box first, 20,000 entries: ~60 ms read, ~80 ms index; DOMContentLoaded 21 ms with the service worker; details in
   android-capture-plan.md). 504 tests, `tsc` clean, lint unchanged; checked in the pane (dev and production build: manifest
   has the shortcut and share target, share-style address prefills, reload/back start empty, `?view=` still works; the
   hosted sub-path build `/interstitial-diary/`: share action and shortcut resolve inside the scope, prefill works). **Not
   verified:** everything that needs the phone (waiting item 21); the pane cannot test offline navigation at all (even a plain
   reload failed with the server stopped), so offline share rests on reading the service worker's code. Photo sharing is not
   built (needs a POST target and a custom service worker). Stage 2 (native widget) waits for Tauri.
The full plan: the session's plan file; each step ends with tests, a commit and a question before the next.

### Permanent delete and the Manual (agreed 2026-11-13): both built, PUSHED and deployed (`ee39282`, deploy green; live bundle not checked)

1. **Delete permanently + Deleted entries list: built and pushed 2026-11-13 (`22c990a`).** The user chose: Delete
   stays soft; Settings > **Deleted entries** lists soft-deleted entries with **Restore**, **Delete permanently…** (one,
   confirm) and **Delete all permanently…** (type DELETE FOREVER). Erasing scrubs the row (text/photos/tags gone,
   tombstone kept, local `purged: 1`) and lists its id in the new `.meta/purged.json` so other devices scrub theirs at
   their next sync; the manager syncs first, removes the photos only those entries used (keeps shared ones), then
   scrubs (DESIGN.md "Delete permanently"; `lib/purge.ts`, `purgeDeleted`, `DeletedEntriesCard.tsx`). 522 tests (18 new,
   two safeguards mutation-checked), `tsc` clean, lint unchanged; checked in the pane on an empty local copy (restore,
   erase one, erase-all confirm at 375px, text gone from IndexedDB). **Not tried with Dropbox or two devices** (waiting
   item 22).
2. **Manual (Settings card): built and pushed 2026-11-13 (`ee39282`).** A "Manual" card at the top of Settings
   (hidden until "Show the manual"): writing and editing, tags/people/places, events, search, the tabs, your data
   (`ManualCard.tsx`, static text). The search table moved to `search/syntax.ts` (`SEARCH_SYNTAX`), shared with the `?`
   help, with a test that parses every example (524 tests, `tsc` clean, lint unchanged); added the missing `-"phrase"`
   row; the Settings shortcut list now says `t` = "Jump to the latest entry" (it never jumped to today). Checked in the
   pane (desktop and 375px, no overflow). Not read through by the user (waiting item 23).

**23. Manual** (pushed): Settings > Manual > Show the manual: read it; say what is wrong, unclear or missing.

**22. Delete permanently** (pushed; reload both devices to the new version first, an older version ignores `purged.json`): delete an entry, find it in
Settings > Deleted entries, Restore it, delete it again and Delete permanently; with Dropbox its text leaves the day file
(already gone) and `Apps/Interstitial Journal/.meta/purged.json` lists its id; on the other device it vanishes from
Deleted entries after its next sync; a deleted entry with a photo: the photo files leave `images\` and `.thumbs\`.

### Events (`!"Jack's 40th birthday"`): all 5 steps built, PUSHED and live 2026-11-13 (`0995008`, deploy #10 green; live bundle checked)

Not a tag kind: an event is the unique name of something that happened, so it has its own module and its own
top-level **Events** view (timeline by date and title). The user tried it on an empty local copy (no storage connected)
and said **"it works"** (2026-11-13). Decisions: quoted titles with spaces (straight or curly quotes, up to 120 characters, `!` must
follow whitespace/start/an opening bracket), no autocomplete, nothing new stored (the marker stays in the entry text; the
list is computed), same title within 7 days = one event, a longer gap = a new event with the same title (no year in
the title needed).
- **Step 1 done:** `src/lib/events.ts` (`eventSpans`, `eventSegments`, `blankEvents`, `eventKey`, `parseEventTitle`,
  `renameEventInText`, `computeEvents`) + `events.test.ts` (20 tests); `extractTags` and `replaceTag` leave event titles
  alone. 400 tests, `tsc` clean, lint 0 errors (5 old warnings). Nothing visible in the app yet.
- **Step 2 done:** `EntryText` (`text.tsx`) shows a marker as a blue "🎉 Jack's 40th birthday" chip (`--event` colour, light and
  dark; the marker as written is the tooltip); the entry box hint ends with `!"event"`. The chip is **not clickable yet**
  (step 3 makes it open the event). Checked in the browser pane (dark, light, 375px): `#party` inside a title is not in
  Tags, `he said "stop!" and "go"` stays plain. 400 tests, `tsc` clean, lint 0 errors.
- **Step 3 done:** new top-level **Events** tab (after Calendar; the phone nav was tightened so six tabs fit at 375px).
  `EventsView.tsx`: rows by month (date or range, title, entries), filter by title, year select (when more than one
  year), sort Newest / Oldest / A-Z; a row opens the event page (its entries, oldest first). The list logic is in
  `src/lib/eventRows.ts` (+ tests). An event chip anywhere (journal, search, tag pages) opens its event through
  `OpenEventContext` (`components/eventNav.ts`, provided in `App.tsx`, read by `EntryItem`). Checked in the browser pane
  with seeded entries (list, range, same birthday a year apart = two events, chip from the journal opens the right one, filter,
  year, 375px). 407 tests, `tsc` clean, lint 0 errors. The journal list was blank on first load in the emulated phone
  view until scrolled (not looked into; JournalView untouched, probably old).
- **Step 4 done:** a **Rename event** button on the event page (prompt, then a confirm that says how many entries).
  `renameEvent(entryIds, key, newTitle)` in `db.ts` rewrites the markers only in that event's entries (a same-titled event
  months away is untouched), keeps the quote marks the person typed, bumps `updatedAt` and marks them dirty so it syncs;
  `eventAfterRename` (`events.ts`) lets the page follow the event to its new id (it may join a neighbour with the same
  new title). Tests: 2 in `db.test.ts`, 2 in `events.test.ts`; 411 total, `tsc` clean, lint 0 errors. Checked in the
  browser pane (prompt/confirm stubbed): both entries and the page updated, `#trip` untouched.
- **Step 5 done:** DESIGN.md "Events" (+ Events view bullet), docs/HISTORY.md rows, docs/LIMITS-AND-IDEAS.md (limits and
  ideas), CLAUDE.md (code map, six tabs, the rule "events are not tags", now rule 12).
- **Next:** nothing in progress. **Not verified on the user's real devices** (item 13 below; reload until both devices
  have the new version).

### People and place tags: all 6 steps built, PUSHED and live 2026-11-12 (`cf88bea`, deploy #7 green; live bundle checked)

`#tag`, `@person`, `~place`; names with spaces use `_` (`@sarah_jones` is shown as "Sarah Jones"); `@`/`~` need a letter
first; more kinds later = one row in `src/lib/tagKinds.ts`. Stored keys: `work`, `@sarah`, `~home`. Markdown files are
unchanged; Dexie v3 recalculates tags on each device without marking anything changed. Done: reading (`entry.ts`),
showing/typing (`text.tsx`), search (`query.ts`), Tags / People / Places switch with per-kind rename (`TagsView.tsx`),
a page per person/place (`TagPage.tsx`). Details: DESIGN.md "Tags" and its Tags UI bullet; commits `006db68`..`5bad3f0` in
docs/HISTORY.md. 380 tests, `tsc` clean, lint unchanged; each step was checked in the browser pane (dark, light, 375px).
**Not verified on the user's real data/devices** (see waiting item 12; installed apps update on reload). Left out on purpose (docs/LIMITS-AND-IDEAS.md):
"mentioned together with", place suggestion from location, converting an old `#sarah` into `@sarah`.

### NEXT (after that); nothing else in progress as of 2026-11-13; ask the user which of these

1. **Separate Dropbox app for development** (offered 2026-11-12, user said "not now"): the Dropbox App key is hard-coded
   (`DROPBOX_APP_KEY`) and `http://localhost:5173/` is a registered redirect of the same app, so a dev-server Dropbox
   sign-in writes to the real `Apps/Interstitial Journal/` folder. Plan: the user registers a second app-folder app
   ("Interstitial Journal Dev", redirect `http://localhost:5173/`) and sends only its App key; read the key from
   `import.meta.env.VITE_DROPBOX_APP_KEY` (git-ignored `.env.local`, live build keeps the real key), plus a visible DEV
   badge. Until then: **never connect Dropbox on localhost.**
2. **Step 4.6, the update-banner test** (still open; see below).
3. **pCloud** (step 5, on hold), or **native apps with Tauri** (step 6). Both described below.
4. Confirm the open details of waiting items 10 and 11 if the user wants them recorded as verified.

### Step 5a, Dropbox: built, pushed, and working across devices (user, 2026-11-12)

**Pushed and deployed 2026-11-12** (`22a834c`, deploy succeeded; the live bundle contains the Dropbox sign-in). After
testing Windows ↔ Android on the hosted app the user said it **"appears to be working"**. Which parts were tried (a
photo both ways, the offline edits, staying signed in after a restart) was not reported one by one: ask before
calling those verified.

All five sub-steps are built and committed locally (2026-11-12): 5a.1 sign-in helper (`oauth.ts`), 5a.2 the
`FileStore` (`dropbox-store.ts`, tested against `fake-dropbox.ts`), 5a.3 the module and finishing the sign-in at
startup (`dropbox.ts`, `resume.ts`, `oauthPending.ts`, `manager.ts`), 5a.4 the App key and Settings wording, 5a.5 docs.
How it works and why: DESIGN.md "Dropbox notes"; the build log: [docs/CLOUD-STORAGE.md](docs/CLOUD-STORAGE.md).

- **Confirmed for real (localhost:5173, the user's own browser):** sign-in, token exchange, browser (CORS) calls, the
  `""` root listing; Settings showed "Dropbox · Saved".
- **Still open:** the details of item 10 below that the user hasn't reported individually.
- Testing note: the Claude browser pane can't use Dropbox passkeys; real sign-ins happen in the user's own browser.
- 2026-11-12: the user added two entries (one with a photo) on localhost with Dropbox; the photo showed "Not synced
  yet" because the dev server had stopped (session restart), so the open tab couldn't load the image worker and made
  no thumbnail. After restarting the server, reload + "Save now" rebuilt it from the local original: **the photo shows**.
  Dev-only (the built app precaches the worker). If a photo says "Not synced yet" on the device that added it, check
  the dev server first.

**After Dropbox:** pCloud (step 5, on hold: its app approval may need manual approval; notes in the same doc), then native
apps with Tauri (step 6: Windows `.exe` and Android `.apk` built in GitHub Actions, tray/hotkey, native Android folder;
quick capture on Android is planned in [android-capture-plan.md](android-capture-plan.md)).

**Open, skipped on request: step 4.6, the update-banner test.** Make a small visible change, run the tests, ask before
pushing, push (a second deploy); the installed app should show "A new version is ready" with Reload, and Reload shows the
change. Closes waiting item 7.

### Start over (pushed 2026-11-12, fix `0bea543` pushed too; second real try: user "I think it works")

Settings > **Start over** erases the journal here and in the storage; other devices clear their copy at their next
sync (marker `.meta/reset.json`; rules in DESIGN.md "Start over"). The user chose: other devices clear themselves;
confirm by typing START OVER, with a backup offered.
**First real test failed (2026-11-12):** Start over on the PC worked, but the phone (which got the new version only
afterwards) remembered no marker, kept its copy and uploaded it again, so the PC got the old entries back. **Fix:** a
device that remembers nothing but had synced with the storage before now clears too (regression test reproduces the
phone). It can't help a device still *running* the old version. Recovery for the user: after the fix is pushed, update
both devices, then Start over once more (item 11).
