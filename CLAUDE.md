# CLAUDE.md: Interstitial Diary

An interstitial journal: short, timestamped, freeform notes written between tasks, with `#tags`, strong search,
and Markdown files as the durable copy. Targets **Windows and Android**: an installable PWA first, then native apps
via Tauri built from the same code.

Read these before changing anything substantial:
- **[DESIGN.md](DESIGN.md)**: how it works and why (data model, file format, sync rules, storage modules, search syntax).
- **[PROGRESS.md](PROGRESS.md)**: what's done, what's next, open decisions. **Update it when you finish a step.**

## Where things are

- **Repo (source of truth):** WSL Ubuntu, `~/projects/interstitial-diary`
  - From Windows tools: `\\wsl.localhost\Ubuntu\home\<user>\projects\interstitial-diary\`
- **Claude session folder (Windows):** `C:\Users\<user>\Documents\Claude\Projects\Interstitial Diary`. It only holds
  `.claude/launch.json` (dev server config) and a pointer `CLAUDE.md`. No code lives there.
- Node (via nvm), npm and git are installed **inside WSL only**. The user wants installs kept in WSL and off Windows.
  **Ask before installing anything on Windows.**

## Commands

Run everything through WSL from PowerShell, using an interactive shell so nvm loads:

```
wsl -d Ubuntu -- bash -ic "cd ~/projects/interstitial-diary && npm test"
```

| Task | Command (inside the repo) |
|---|---|
| Tests (Vitest, runs with `TZ=UTC`) | `npm test` |
| Type check | `npx tsc -b` |
| Production build | `npm run build` |
| Lint | `npm run lint` |
| Dev server | use the Browser pane's `preview_start` with name `interstitial-dev` (port 5173) |

Commit with the user's identity and the co-author trailer:
```
git -c user.email=9375408+JesseRacine@users.noreply.github.com -c user.name=JesseRacine commit -m "..." -m "Co-Authored-By: <model> <noreply@anthropic.com>"
```

## Code map

```
src/
  lib/entry.ts        Entry type, tag parsing, date helpers (all local time)
  lib/db.ts           Dexie (IndexedDB) schema + add/edit/delete/renameTag; tables thumbs/blobs (photos);
                      cached originals: touchOriginal, saveFetchedOriginal, evictOriginals
  lib/markdown.ts     day file <-> entries (the on-disk format, see DESIGN.md)
  lib/merge.ts        union-by-id merge + tombstones
  lib/images.ts       pure image helpers: SHA-256 name, type sniffing, paths, thumbnail size (tested in Node)
  lib/images.worker.ts  decode + EXIF rotation + WebP thumbnail, off the main thread
  lib/imageClient.ts  main-thread wrapper for the worker (makeThumbnail)
  lib/attach.ts       attachImage: save original (byte for byte) + thumbnail to Dexie, return an ImageRef
  search/query.ts     search syntax parser
  search/engine.ts    MiniSearch full-text + filters, tag stats, day counts
  storage/types.ts    FileStore / StorageBackend / LocalStore interfaces
  storage/sync.ts     backend-agnostic sync engine (text: day files + tombstones)
  storage/attachments.ts  image passes: pushImages (originals + thumbnails to storage), pullImages (thumbnails back),
                      imagesWaiting (the badge's "N photos waiting")
  storage/originals.ts  originals on demand (fetchOriginal, hash-checked) + cache eviction choice (chooseEvictions)
  storage/cleanup.ts  "remove photos of deleted entries": unusedImages / planCleanup / removeUnusedImages (the only
                      deletion of image files; user-confirmed; see DESIGN.md)
  storage/syncAll.ts  one sync run: pushImages → syncOnce → pullImages (image passes in their own try/catch)
  storage/manager.ts  runtime: active backend, auto-sync, status for the UI (incl. photos waiting); loadOriginal
                      (lightbox download), trimOriginals (~1 GB cache), missingImages ("Not synced yet")
  storage/backends/   one file per storage module + index.ts registry
  storage/memory.ts   in-memory FileStore/LocalStore for tests (and a template)
  components/         React UI (Capture, JournalView, EntryItem, Results, SearchBar, Calendar, Tags, Settings, StorageCard)
  components/useDraftImages.ts  photos on a draft (new or edited entry): paste/drop/pick -> attachImage; useImageInput
  components/DraftImages.tsx  chips + "Photo" button shared by Capture and EntryItem's edit mode
  components/EntryImages.tsx  photos in a bubble (layout from lib/imageLayout.ts, sized before decode)
  components/Thumb.tsx + useThumbUrl.ts  thumbnails via one shared ref-counted URL cache (lib/urlCache.ts);
                      "Not synced yet" from manager's missingImages (lib/keySet.ts)
  components/Lightbox.tsx  full-size viewer (zoom maths in lib/zoom.ts); opened/closed via history in App.tsx
  components/ExportCard.tsx  export: text zip, or "Include photos" (lib/exportZip.ts: streamed, photos stored, <4 GB, per year)
  lib/journalRows.ts  entries -> flat chat rows (day headers + entries) for the virtualised journal
  lib/dataSafety.ts   "only in this browser" warning: when it applies (no storage / inside-browser) and its wording (photo-aware)
  lib/photoRows.ts    entries -> day headers + rows of square tiles (and columnsFor(width)) for the Photos view
  components/PhotosView.tsx  Photos tab: virtualised grid of every photo, newest day first; tile -> lightbox
  components/PhotoStorageCard.tsx  Settings: photo space used (db.photoUsage, storage.estimate) + original-cache limit
                      (limit setting in db.ts + originals.ts; manager.applyOriginalsLimit / useOriginalsLimitMode)
  App.tsx             views, routing, keyboard shortcuts
```

## Rules

1. **Sync and merge code can lose people's journal entries.** Any change to `storage/sync.ts`, `lib/merge.ts`,
   `lib/markdown.ts` or `storage/manager.ts` needs a test that fails before and passes after. Run `npm test` before
   every commit. A data-loss bug has already happened once (hand edits overwritten, fixed in 9747fca).
   The same goes for photos: `storage/attachments.ts`, `storage/syncAll.ts`, `storage/originals.ts` and the blob
   helpers in `lib/db.ts`. Local originals are only dropped when `onRemote: 1` (storage confirmed every copy) and never
   with an `insideBrowser` module; image files in storage are never deleted automatically. The only deletion is the user-confirmed cleanup of photos of
   deleted entries (`storage/cleanup.ts`, rules in DESIGN.md); keep every rule and test there when changing it.
2. **Storage is modular.** New storage (pCloud, GitHub, native folder...) = a new `StorageBackend` in
   `storage/backends/` plus one line in `backends/index.ts`. Do not add backend-specific logic to `sync.ts`.
3. **The Markdown file format is a public contract.** Users edit these files by hand and older files must keep
   parsing. Changing it needs backward-compatible parsing and tests.
4. **Every edit/delete must bump `updatedAt` (use `nextStamp` in db.ts) and set `dirty: 1`.** Deletes are soft
   (`deleted: 1`) so they sync as tombstones.
5. **Do not treat an entry missing from a file as deleted.** This is deliberate (see DESIGN.md, "Sync rules").
6. **Search syntax lives in three places:** `search/query.ts` (parser), the `SYNTAX` table in
   `components/SearchBar.tsx`, and DESIGN.md. Keep them in step, and add parser tests for new syntax.
7. TypeScript settings: `verbatimModuleSyntax` + `erasableSyntaxOnly`, so use `import type` for types and no `enum`s.
8. Keep the UI working at phone width (375px) and in light and dark mode. Colours come from CSS variables in
   `src/index.css`.

## Gotchas

- **`$variables` in `wsl ... bash -c "..."` get mangled** when sent from PowerShell. For anything non-trivial, write a
  script file and run `wsl -d Ubuntu -- bash /mnt/c/.../script.sh`.
- **Vite HMR can load a second copy of a module** (`manager.ts?t=...`). When poking the app from the browser console,
  importing `/src/storage/manager.ts` may give you a disconnected copy. Import the URL from
  `performance.getEntriesByType('resource')`, or trigger things through the UI.
- **Browser pane screenshots can lag behind the DOM.** Verify state with `javascript_tool` / `read_page` instead.
- **The Browser pane only repaints when it is asked to** (e.g. a screenshot). The virtualised journal (react-virtuoso) measures with
  ResizeObserver, so right after a reload it can look empty (0 `.vrow` elements) until you take a screenshot. That is the pane, not a bug.
- **Never seed fake entries into `localhost:5173`**: that origin may have a storage backend, which would sync them into real files.
  For performance tests (e.g. 7,300 entries) use `http://127.0.0.1:5173`: a different origin, so its own empty database and no sync.
  Delete the database afterwards (`indexedDB.deleteDatabase("interstitial-diary")`).
- **When the Browser pane is hidden, `requestAnimationFrame` never fires**, so a script awaiting it hangs. Use `setTimeout`.
- **Synthetic `PointerEvent`s** need a real pointer for `setPointerCapture` (it throws otherwise); the lightbox guards it.
- The folder picker (`showDirectoryPicker`) opens a native dialog that can't be driven from the pane; the user tests that.
- **Testing photos/sync in the pane** (on `127.0.0.1:5173` only): connect "Files inside this browser" by importing
  the manager URL from the resource list and calling `connect('browser')`, then **reload** so the app's own copy
  opens it. Seed rows straight into `db.blobs`/`db.thumbs`/`db.entries` (with `dirty: 1`); note `makeEntry(text,
  createdAt, id, images)`: the third argument is the id, so give each entry its own. Afterwards `disconnect()`, delete
  the OPFS files (`navigator.storage.getDirectory()`) and the IndexedDB database.
- The dev database at `localhost:5173` in the pane contains ~360 generated sample entries (not real data).

## Working with the user

- Explain decisions plainly and recommend one option rather than listing many.
- They care most about: search/browse quality, not losing data, Windows + Android, and a "real app" feel.
