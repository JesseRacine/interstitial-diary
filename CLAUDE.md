# CLAUDE.md: Interstitial Diary

An interstitial journal: short, timestamped, freeform notes written between tasks, with `#tags`, strong search,
photos, and Markdown files as the durable copy. Targets **Windows and Android**: an installable PWA first, then native
apps via Tauri built from the same code.

Read these before changing anything substantial:
- **[DESIGN.md](DESIGN.md)**: how it works and why (data model, file format, sync rules, storage modules, search syntax,
  photos, data safety).
- **[PROGRESS.md](PROGRESS.md)**: **short on purpose; read it at the start of a session**: where things stand, what's
  next, what the user still has to do or confirm. **Update it when you finish a step, and keep it short.** Detail lives in
  `docs/`: [docs/CLOUD-STORAGE.md](docs/CLOUD-STORAGE.md) (Dropbox/pCloud plans: read when working on storage modules),
  [docs/HISTORY.md](docs/HISTORY.md) (commit table, how finished steps were done and checked, how to push: look things up
  there, don't read it whole), [docs/LIMITS-AND-IDEAS.md](docs/LIMITS-AND-IDEAS.md). Don't grow PROGRESS.md again: put new
  history in HISTORY.md and new plans in their own `docs/` file.
- **[images-plan.md](images-plan.md)**: the photo feature's plan, with a build log of every step's decisions (phases 1–3
  built; phase 4 = images on the cloud modules). [android-capture-plan.md](android-capture-plan.md): quick capture on
  Android (not started).

**Status (2026-11-12):** journal, search, calendar, tags, export, two storage modules (folder, browser files), photos
(phases 1–3), the installable PWA, the data-safety features and **hosting** are built; 282 tests pass. **Live on GitHub
Pages: https://jesseracine.github.io/interstitial-diary/** (repo `JesseRacine/interstitial-diary`, public; the user has
installed it). **Next: step 5a, the Dropbox storage module** (so Windows and Android can share one journal; plan in
docs/CLOUD-STORAGE.md), which is waiting for the user to create a Dropbox app and send the **App key** (PROGRESS.md item 10;
the key-independent code and mocked-`fetch` tests can be built first: ask). After that pCloud (on hold: its app approval
may be manual) and Tauri. The update-banner test (step 4.6) was skipped on request and is still open.

**This repo is public** (`origin` = https://github.com/JesseRacine/interstitial-diary; every push to `main` runs the tests
and deploys the site). Keep it free of personal data: no machine paths, personal email addresses, keys or tokens (scan
before pushing: `git grep -n -I -i -E "@gmail|/home/[a-z]|C:.Users|wsl.localhost" -- . ':!package-lock.json'` should show
only generic mentions). Commits use the GitHub noreply address (the repo's local git identity). **Ask the user before every
push** (it publishes and redeploys); `main` may be ahead of `origin/main` with unpushed docs commits (`git status -sb`).
`gh` is at `~/.local/bin/gh` in WSL (not on PATH); push with `git -c credential.helper= -c "credential.helper=!$HOME/.local/bin/gh
auth git-credential" push origin main` (the user signed in themself with `gh auth login`; never handle a token or password).
Rewriting pushed history is no longer safe. For cloud-storage sign-ins (OAuth): the **app key / client id is public**, but
never commit an app secret, access token or refresh token.

## Where things are

- **Repo (source of truth):** the WSL Ubuntu home directory, `~/projects/interstitial-diary`. Tools on Windows reach it
  through the `\\wsl.localhost\Ubuntu\...` network path (the exact path is in the Claude session folder's own
  `CLAUDE.md`, which is not part of this repo).
- **Claude session folder (Windows, outside this repo):** holds `.claude/launch.json` (dev servers `interstitial-dev`
  5173, `interstitial-preview` 4173, `interstitial-preview-sub` 4174), a pointer `CLAUDE.md`, and **read-only backups**
  (the current `archive-2026-11-10/` + zip, and the older `archive/` + zip of f4ef4d9, which still has the old identity in
  its history: keep it private): source snapshot, full git history as a `.bundle`, Claude's notes. No working code lives
  there; never edit or build in a snapshot. To refresh the backup after more work, make a new dated archive (`git archive
  HEAD` for the source, `git bundle create ... --all` for the history: test a clone of the bundle).
- **Claude's own memory notes** (outside the repo, in the user's Claude profile) are a short summary of this file and
  PROGRESS.md; if they disagree with the repo, the repo wins.
- Node (via nvm), npm and git are installed **inside WSL only**. The user wants installs kept in WSL and off Windows.
  **Ask before installing anything on Windows.**
- Stack: Vite + React 19 + TypeScript, Dexie (IndexedDB), MiniSearch, `react-virtuoso`, `fflate` (zip), Vitest with
  `fake-indexeddb`, oxlint. `vite-plugin-pwa` (configured in `vite.config.ts`; manifest in `pwa-manifest.ts`).

## Commands

Run everything through WSL from PowerShell, using an interactive shell so nvm loads:

```
wsl -d Ubuntu -- bash -ic "cd ~/projects/interstitial-diary && npm test"
```

| Task | Command (inside the repo) |
|---|---|
| Tests (Vitest, runs with `TZ=UTC`) | `npm test` (one file: `npx vitest run src/storage/cleanup.test.ts`) |
| Type check | `npx tsc -b` |
| Production build | `npm run build` (runs `tsc -b` first) |
| Lint | `npm run lint` (currently 5 old warnings, 0 errors; keep it at 0 errors and add no new warnings) |
| Dev server | use the Browser pane's `preview_start` with name `interstitial-dev` (port 5173) |
| Production build served (PWA/service worker) | `preview_start` with name `interstitial-preview` (builds, then serves on 4173); the service worker does not run in the dev server |
| Build for the hosted sub-path | `BASE_PATH=/interstitial-diary/ npx vite build --outDir dist-sub` (what the deploy workflow will do, minus the output folder); `preview_start` with name `interstitial-preview-sub` builds that and serves it on 4174 at `/interstitial-diary/` |
| Regenerate icons | `npm run icons` (`scripts/make-icons.mjs`, no dependencies) |

Before every commit run tests, `npx tsc -b` and lint. The repo's local git identity is `JesseRacine` with the GitHub
noreply address (`git config user.email` shows it; never use a personal address). Commit with the co-author trailer:
```
git commit -m "..." -m "Co-Authored-By: <model> <noreply@anthropic.com>"
```

## How we work

- The user goes **one plan step per turn**: implement, add tests, run test/tsc/lint, check it in the browser pane when it
  shows in the UI (on `127.0.0.1`, see Gotchas), commit with the step number in the subject (e.g. `Images 3.2: ...`),
  update the plan's status line and PROGRESS.md, then **ask before the next step**. Don't run ahead.
- A step's commit hash goes into the commit table in docs/HISTORY.md in the *next* commit (you can't know it beforehand).
- Anything that needs the real Windows folder (the folder picker can't be driven from the pane) goes on PROGRESS.md's
  "Waiting on the user" list instead of being claimed as verified.
- Docs are part of the work: when behaviour changes, update DESIGN.md (the contract), this file's code map, and PROGRESS.md.

## Code map

```
pwa-manifest.ts       web app manifest (tested by src/pwa.test.ts); vite.config.ts wires vite-plugin-pwa (precache, prompt update)
base-path.ts          normaliseBase: the BASE_PATH env variable -> Vite `base` (tested by src/basePath.test.ts); unset = "/"
.github/workflows/deploy.yml  GitHub Pages deploy on push to main: npm ci, test, build with BASE_PATH=/interstitial-diary/, deploy
                      (checked by src/deployWorkflow.test.ts; keep BASE_PATH there in step with the repo name)
scripts/make-icons.mjs  generates public/icons/*.png, apple-touch-icon.png, favicon.svg
src/
  main.tsx, App.tsx   entry point; views (Journal, Calendar, Photos, Tags, Settings), routing, keyboard shortcuts,
                      the photo viewer's history entry
  lib/                pure logic and the database
    entry.ts            Entry/ImageRef types, tag parsing, date helpers (all local time), withDerived
    db.ts               Dexie schema (v2: entries, meta, thumbs, blobs) + add/update/delete/renameTag/setEntryImages;
                        cached originals (touchOriginal, saveFetchedOriginal, evictOriginals*, getOriginalsLimit),
                        photoUsage, localImageSizes, removeLocalImagesUnlessUsed
    markdown.ts         day file <-> entries (the on-disk format, see DESIGN.md)
    merge.ts            union-by-id merge + tombstones
    hooks.ts            useLive: a Dexie liveQuery as React state
    dom.ts              isTyping (keyboard shortcuts ignore typing)
    journalRows.ts      entries -> flat chat rows (day headers + entries) for the virtualised journal
    photoRows.ts        entries -> day headers + rows of square tiles (and columnsFor(width)) for the Photos view
    dataSafety.ts       "only in this browser" warning (when it applies, photo-aware wording), header-badge rule, persistent-
                        storage wording, backup-reminder rule/text and its `meta` keys (lastBackupAt, backupReminders, backupSnoozedUntil)
    images.ts           pure image helpers: SHA-256 name, type sniffing, paths, thumbnail size, formatBytes
    images.worker.ts    decode + EXIF rotation + WebP thumbnail, off the main thread
    imageClient.ts      main-thread wrapper for the worker (makeThumbnail)
    attach.ts           attachImage: save original (byte for byte) + thumbnail to Dexie, return an ImageRef
    imageLayout.ts      how an entry's photos are laid out in a bubble (sized before decode)
    urlCache.ts         ref-counted object-URL cache for thumbnails; keySet.ts: observable set (missing photos)
    zoom.ts             lightbox zoom/pan maths
    exportZip.ts        export: planExport / writeExportZip (streamed, photos stored, <4 GB, per year)
  search/
    query.ts            search syntax parser (incl. has:image)
    engine.ts           MiniSearch full-text + filters, tag stats, day counts
  storage/              modular storage; knows nothing about the UI
    types.ts            FileStore (text + optional blob methods incl. removeBlob) / StorageBackend / LocalStore
    sync.ts             backend-agnostic sync engine (text: day files + tombstones)
    attachments.ts      image passes: pushImages (originals + thumbnails to storage), pullImages (thumbnails back),
                        imagesWaiting (the badge's "N photos waiting")
    originals.ts        originals on demand (fetchOriginal, hash-checked), cache eviction choice (chooseEvictions),
                        cache-limit setting (choices, normaliseLimit) and limitMode
    cleanup.ts          "remove photos of deleted entries": unusedImages / planCleanup / removeUnusedImages
                        (the ONLY deletion of image files; user-confirmed; see DESIGN.md)
    syncAll.ts          one sync run: pushImages -> syncOnce -> pullImages (image passes in their own try/catch)
    manager.ts          runtime singleton: active backend, auto-sync, status for the UI, `exclusive` jobs,
                        loadOriginal (lightbox), trimOriginals, applyOriginalsLimit, missingImages,
                        planImageCleanup / removeImagesOfDeletedEntries
    memory.ts           in-memory FileStore/LocalStore for tests (and a template for new modules)
    fs-access.d.ts      File System Access API typings
    backends/           one file per storage module (folder.ts, browser.ts; fs-store.ts = shared directory store)
                        + index.ts registry
  components/           React UI
    Capture, JournalView, EntryItem, Results, SearchBar, CalendarView, TagsView, SettingsView, text.tsx (tag highlighting
    + autocomplete)
    DraftImages.tsx + useDraftImages.ts   photos on a draft (new or edited entry): paste/drop/pick; useImageInput
    EntryImages.tsx     photos in a bubble
    Thumb.tsx + useThumbUrl.ts   thumbnails via the shared URL cache; "Not synced yet" from manager's missingImages
    Lightbox.tsx        full-size viewer; opened/closed via history in App.tsx
    PhotosView.tsx      Photos tab: virtualised grid of every photo, newest day first; tile -> lightbox
    StorageCard.tsx     storage choice + status badge + "only in this browser" warning
    useBrowserOnlyMode.ts  hook: is the data only in this browser (null until the saved storage is read: `restored`)
    DataSafetyCard.tsx  Settings: persistent-storage state, last backup, backup-reminder switch
    BackupReminder.tsx  the notice above the search bar (Back up now / Later / Stop reminding me)
    PhotoStorageCard.tsx  Settings: photo space used, original-cache limit, "Photos of deleted entries" cleanup
    ExportCard.tsx      export: text zip, or "Include photos"
    UpdatePrompt.tsx    registers the service worker; "new version ready: Reload" / "ready offline" banner
  index.css             all styles; colours are CSS variables
```

## Rules

1. **Sync and merge code can lose people's journal entries.** Any change to `storage/sync.ts`, `lib/merge.ts`,
   `lib/markdown.ts` or `storage/manager.ts` needs a test that fails before and passes after. Run `npm test` before
   every commit. A data-loss bug has already happened once (hand edits overwritten, fixed in 9747fca).
2. **The same goes for photos:** `storage/attachments.ts`, `storage/syncAll.ts`, `storage/originals.ts`,
   `storage/cleanup.ts` and the blob helpers in `lib/db.ts`.
   - Local originals are only dropped when `onRemote: 1` (storage confirmed every copy), never with an `insideBrowser`
     module, never the photo on screen.
   - Image files in storage are **never deleted automatically**. The only deletion is the user-confirmed cleanup of photos
     of deleted entries (`storage/cleanup.ts`); keep every rule and test there when changing it (live-entry check,
     name validation, sync first, exclusive run, atomic local removal, forget removed paths from `images:<id>`).
   - Bytes are saved to Dexie when a photo is *attached*, so a lost draft never loses a photo.
3. **Storage is modular.** New storage (pCloud, GitHub, native folder...) = a new `StorageBackend` in
   `storage/backends/` plus one line in `backends/index.ts`. Do not add backend-specific logic to `sync.ts`. To carry
   photos it must implement `readBlob`/`writeBlob`/`hasBlob` (and `removeBlob` for the cleanup).
4. **The Markdown file format is a public contract.** Users edit these files by hand and older files must keep
   parsing. Changing it needs backward-compatible parsing and tests.
5. **Every edit/delete must bump `updatedAt` (use `nextStamp` in db.ts) and set `dirty: 1`.** Deletes are soft
   (`deleted: 1`) so they sync as tombstones. `withDerived` must carry every core field (`images` included).
6. **Do not treat an entry missing from a file as deleted.** This is deliberate (see DESIGN.md, "Sync rules").
7. **Search syntax lives in three places:** `search/query.ts` (parser), the `SYNTAX` table in
   `components/SearchBar.tsx`, and DESIGN.md. Keep them in step, and add parser tests for new syntax.
8. **Virtualised lists must not change row height after render** (journal, Photos grid). Size boxes from data (stored
   `w`/`h`, or the grid width) before anything decodes.
9. TypeScript settings: `verbatimModuleSyntax` + `erasableSyntaxOnly`, so use `import type` for types and no `enum`s.
10. Keep the UI working at phone width (375px) and in light and dark mode. Colours come from CSS variables in
    `src/index.css`. The header's five tabs fit 375px only because of the tighter padding in the `max-width: 520px`
    block; check it if you add a tab.
11. Anything that can only be wrong at the user's real folder, or on a second device, is **not verified** until the user
    confirms it; say so in PROGRESS.md.

## Testing

- Tests sit next to the code (`*.test.ts`). Logic is kept pure (or behind small interfaces) so it runs in Node; there is
  no `createImageBitmap` or `OffscreenCanvas` there.
- Storage logic is tested with `memoryStore` / `memoryLocal` (`storage/memory.ts`), the way `sync.test.ts`,
  `attachments.test.ts` and `cleanup.test.ts` do; database code with `fake-indexeddb` (`lib/db.test.ts`).
- For anything that deletes or merges data, **mutation-check** the key test: temporarily break the safeguard and confirm
  tests fail, then restore it (and grep that no marker is left behind).
- `manager.ts` is a singleton wired to the browser and has no direct tests: keep real logic in tested modules and make
  the manager a thin wire-up.

## Gotchas

- **`$variables` in `wsl ... bash -c "..."` get mangled** when sent from PowerShell. For anything non-trivial, write a
  script file (in the session scratchpad, outside the repo) and run `wsl -d Ubuntu -- bash /mnt/c/.../script.sh`. In a
  script, `source ~/.nvm/nvm.sh` first so `node`/`npm` work. PowerShell has no `head`: pipe to `Select-Object -First N`.
- **Test code that touches the hosted site or a service worker on another origin** (e.g. `jesseracine.github.io`): afterwards
  unregister the worker, delete its caches and any database the visit created, so the pane keeps no stray data.
- **PWA changes can only be checked on a production build** (`interstitial-preview`, port 4173). To test offline, stop
  that server (`preview_stop`) and reload the tab: the service worker answers. A stale service worker on a port can
  serve an old build; unregister it or use a fresh origin. Keep `images.worker-*.js` in the precache (it is, via the
  `globPatterns` in `vite.config.ts`).
- **Don't glob the repo root or `node_modules`** (12,000+ files); glob `src/` or list files with `Get-ChildItem -File`.
- **Port 5173 may already be taken** by another session's dev server (it serves the same repo, so edits show up there).
  If `preview_start` fails with "port in use", open `http://127.0.0.1:5173` with `preview_start {url}` instead.
- **Vite HMR can load a second copy of a module** (`manager.ts?t=...`). When poking the app from the browser console,
  importing `/src/storage/manager.ts` may give you a disconnected copy. Import the URL from
  `performance.getEntriesByType('resource')`, or trigger things through the UI.
- **Browser pane screenshots can lag behind the DOM.** Verify state with `javascript_tool` / `read_page` instead.
- **The Browser pane only repaints when it is asked to** (e.g. a screenshot). The virtualised views (react-virtuoso)
  measure with ResizeObserver, so right after a reload or a jump they can look empty or land on the wrong day until you
  take a screenshot and wait a moment. That is the pane, not a bug (the Calendar jump behaves the same).
- **Never seed fake data into `localhost:5173`**: that origin may have a storage backend, which would sync it into real
  files. Use `http://127.0.0.1:5173`: a different origin, so its own empty database and no sync.
- **Cleaning up after seeding:** the pane may refuse `indexedDB.deleteDatabase`. Instead `disconnect()` the module, delete
  the OPFS entries (`navigator.storage.getDirectory()`), and delete only the rows you seeded by exact key
  (`db.entries/blobs/thumbs.bulkDelete`, `db.meta.delete`). Confirm counts are 0 afterwards.
- **When the Browser pane is hidden, `requestAnimationFrame` never fires**, so a script awaiting it hangs. Use `setTimeout`.
- **Synthetic `PointerEvent`s** need a real pointer for `setPointerCapture` (it throws otherwise); the lightbox guards it.
- The folder picker (`showDirectoryPicker`) opens a native dialog that can't be driven from the pane; the user tests that.
- **Testing photos/sync in the pane** (on `127.0.0.1:5173` only): connect "Files inside this browser" by importing
  the manager URL from the resource list and calling `connect('browser')`, then **reload** so the app's own copy
  opens it. Seed rows straight into `db.blobs`/`db.thumbs`/`db.entries` (with `dirty: 1`); note `makeEntry(text,
  createdAt, id, images)`: the third argument is the id, so give each entry its own. To get files into storage and then
  delete an entry realistically, seed live entries, sync, then call `deleteEntry`. Seed `blobs.size` freely: the Settings
  numbers use that field, not the real byte length.
- **Checking a long virtualised list:** scroll its Virtuoso scroller (`.chat`, `.photos-scroll`) in steps and check row
  heights and the number of rows in the DOM. The total height Virtuoso reports changes while it measures; that is normal.

## Working with the user

- Explain decisions plainly and recommend one option rather than listing many.
- They care most about: search/browse quality, not losing data, Windows + Android, and a "real app" feel.
- Be honest about what was and wasn't verified (tests vs browser pane vs the real folder).
- They are not a developer by background: avoid jargon (explain a term in plain words the first time), say what they must
  do themselves in a short numbered list, and recommend one option.
- Anything outward-facing needs their explicit yes first: **every push**, creating repos or accounts, installing software
  (WSL only), publishing. Sign-ins and secrets are theirs to handle (`gh auth login`, app secrets, tokens): Claude only
  ever receives public identifiers such as an app key.
- Third-party facts (API limits, sign-in flows, versions) are looked up in the vendor's own docs with the Browser pane
  (navigate, then `get_page_text`/`javascript_tool`; public pages only), not trusted from memory; record what was read and
  when in PROGRESS.md and mark what is still unchecked.
