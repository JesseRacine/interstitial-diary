# Plan: images in journal entries

**Status (2026-11-09): phases 1, 2 and 3 are built and committed; phase 4 (pCloud) comes with the pCloud module
([PROGRESS.md](PROGRESS.md) step 5).** The "Build log" near the end records what each step decided and how it was checked;
DESIGN.md describes the result. Still to confirm by the user on the real Windows folder / a second device: see
PROGRESS.md "Waiting on the user". Written 2026-11-08; replaces [junior-plan.md](junior-plan.md) (see "Review of the
junior plan" at the end for what changed and why).

| Phase | Steps | State |
|---|---|---|
| 1: attach, show, store | 1.1 data model, 1.2 Markdown, 1.3 sync comparisons, 1.4 image pipeline, 1.5 binary storage + `pushImages`, 1.6 capture UI, 1.7 bubbles, 1.8 lightbox, 1.9 export, 1.10 docs | done |
| 2: images on other devices | 2.1 `pullImages`, 2.2 originals on demand + cache, 2.3 "Not synced yet", 2.4 badge, 2.5 docs | done |
| 3: search, browse, housekeeping | 3.1 `has:image`, 3.2 Photos view, 3.3 storage in Settings, 3.4 cleanup of deleted entries' photos, 3.5 data-safety wording | done |
| 4: pCloud | the pCloud module implements the blob methods | not started |

Goal: attach photos to entries, show thumbnails in the chat, open them full size, and keep the originals in the
storage folder, without hurting scroll performance or risking journal data.

Before you start, read `CLAUDE.md` (rules and commands), `DESIGN.md` (data model, file format, sync rules) and
`PROGRESS.md`. Run everything through WSL as described in `CLAUDE.md`.

## Decisions

| Topic | Decision |
|---|---|
| Per entry | Up to **10** images. Warn when one entry's images total more than 100 MB. **Text stays required.** |
| Originals | Kept **byte for byte** (EXIF included). Never resized or re-encoded. |
| File names | SHA-256 of the bytes, first **16 hex characters**. The extension comes from the sniffed file type, not the file name. Image files never change. |
| Location | `<year>/images/<hash>.<ext>` next to that year's day files (so a photo is stored once per year). `.thumbs/<hash>.webp` is a rebuildable cache. |
| Thumbnails | About 512 px wide, WebP, about 25 KB, made in a Web Worker. |
| Formats shown | JPEG, PNG, WebP, GIF (GIF thumbnails are still frames). Anything else (e.g. HEIC) is stored, but shows a placeholder and a download link. |
| Folder writes | **From phase 1:** every original is written to the active storage module. The Markdown never points at a file that was never written. |
| Export | The text-only zip stays the default. "Include photos" streams ONE uncompressed zip (day files + originals, the storage-folder layout, so it is a complete backup) and shows its size first. *(Built as one zip, not the separate photos zip first planned.)* |
| Deleting files | Never automatic. The only cleanup removes images used solely by deleted entries, after a check and a confirmation that says it can't be undone (built in 3.4; rules in DESIGN.md). |
| Cache limit | Local originals are a bounded cache, 1 GB by default; changeable in Settings (3.3). Only confirmed copies are dropped. |

## Constraints in the current code

1. `FileStore` (`src/storage/types.ts`) only reads and writes **strings**.
2. `directoryStore` (`src/storage/backends/fs-store.ts`) only walks `YYYY/` folders and `.meta/`, and `isDiaryFile`
   only lists day files and the tombstones file. `<year>/images/` and `.thumbs/` are invisible to `list()`. Keep it
   that way: `list()` runs every sync and calls `getFile()` for every file, so listing thousands of photos would be
   slow. Images get separate methods instead.
3. `memoryStore` (`src/storage/memory.ts`) lists every file, unlike the real stores. Keep blobs in a separate map, so
   tests behave like the real stores.
4. **`withDerived` (`src/lib/entry.ts`) rebuilds the entry field by field**, so any field it doesn't know is dropped.
   It is used by `updateEntryText`, `renameTag` and `parseDay`. If it doesn't carry `images`, editing an entry or renaming a
   tag silently strips the photos.
5. The app loads **every entry into memory** (`useLive` in `App.tsx`) and rebuilds the search index on each change, so an
   `Entry` may only hold small references, never image data.
6. The journal is **virtualised** (react-virtuoso), so a thumbnail that changes a row's height after it renders makes
   the list jump.
7. The Markdown format is a **public contract** (`DESIGN.md`). Rule 1: every change to `sync.ts`, `merge.ts`,
   `markdown.ts` or `manager.ts` needs a test that fails before and passes after. Rule 2: no backend-specific code in `sync.ts`.
8. `syncNow` in `manager.ts` treats any exception as a failed sync. Image work must not share that try block.
9. Export (`SettingsView.tsx`) uses `zipSync`, which builds the whole zip in memory. That doesn't work for gigabytes of photos.
10. Tests run in Node: there is no `createImageBitmap` or `OffscreenCanvas`. Keep the pure logic in testable modules.

## Data model

```ts
interface ImageRef {
  hash: string   // 16 hex chars, also the file name stem
  ext: string    // 'jpg' | 'png' | 'webp' | 'gif' | 'heic' | ...
  w: number      // width after EXIF rotation, 0 if not known yet
  h: number      // height after EXIF rotation, 0 if not known yet
}
Entry.images?: ImageRef[]   // missing means []
```

- Treat a missing `images` as `[]` everywhere (old IndexedDB rows, old files).
- **`CoreFields` and `withDerived` must include `images`.** Tests: `renameTag` keeps images; `updateEntryText` keeps
  images; `parseDay` → `serializeDay` keeps images.
- `db.ts`: `addEntry(text, images = [])` and `setEntryImages(id, images)`. Both use `nextStamp` and set `dirty: 1` (rule 4).
- Dexie **version 2** adds two tables:
  - `thumbs`: key `hash`, value `{ hash, blob, w, h }`.
  - `blobs`: key `hash`, value `{ hash, blob, mime, size, onRemote: 0 | 1, addedAt }`, the full original. (This is
    called `blobs`, not `images`, to avoid confusion with `Entry.images`.) `onRemote` records that the active storage
    module confirmed it has the file.
- Bytes are saved to `blobs`/`thumbs` **when the image is attached**, not when the entry is saved. If an edit is lost
  (a known limitation of the virtualised list), only the reference is lost, never the photo.

## File format (backward compatible)

```markdown
## 09:14 <!-- id:01JC... created:... updated:... -->
Finished the sketch #work

![640x480](images/3f9a2c1b7d04e8aa.jpg)
![800x600](images/9c01aa22f3b6d710.png)
```

```
<root>/
  2026/2026-11-08.md
  2026/images/<hash>.<ext>      originals
  .thumbs/<hash>.webp           thumbnails (cache)
  .meta/tombstones.json
```

Parsing (`src/lib/markdown.ts`):
- Only a **trailing block** of lines matching `![<w>x<h>](images/<hex>.<ext>)` becomes `entry.images` (blank lines
  are allowed between them). These lines are removed from `entry.text`, so search and display see clean text.
- `WxH` in the alt text is optional; without it, `w`/`h` are 0 and are measured when the image is first read.
- Any other image syntax (`![](https://...)`, an image line in the middle of the text) stays as plain text.
- **Hand-written entries (no id comment) still hash the full body, image lines included**, so their ids stay exactly as
  they are today. (Stripping first would change the id of an existing hand-written entry and create a duplicate.)
- Serialising writes the text, a blank line, then one line per image. An entry without images is written exactly as today.
- Older app versions see the image lines as plain text. Nothing is lost.

Tests (`markdown.test.ts`): round trip; files without images byte-identical to today; foreign image syntax untouched;
an image line in the middle stays text; lines without `WxH`; CRLF files; text plus 10 images; a hand-written entry with
an image line keeps its id.

## Sync

Each change below needs a test that fails before and passes after (rule 1).

**Day files (`sync.ts`)**
- Hand-edit detection (`remoteEntries` loop) compares `text` **and `images`**. Otherwise removing an image line in
  Notepad keeps the old stamp, isn't seen as an edit, and is written back. Add a `sameImages(a, b)` helper.
- `sameVersion` compares `images` too.
- Tests: an image line removed by hand wins; an image-only change counts as a change.

**Merge (`merge.ts`)**: no change needed. It picks by `updatedAt` only, so `images` goes with the winning version. Add
one test to prove it.

**Binary files (`types.ts` + stores)**
- Add optional methods to `FileStore`: `readBlob(path): Promise<Blob | null>`, `writeBlob(path, blob): Promise<void>`,
  `hasBlob(path): Promise<{ size: number } | null>`.
- Implement them in `fs-store.ts` (covers both the folder and the browser-files modules) and in `memory.ts` (a separate
  blob map). Leave `list()` and `isDiaryFile` alone. A module without blob methods simply skips image sync.
- `writeBlob` never overwrites: if the file exists with the same size, it's already there; with a different size it is a
  hash collision. Report it as an error and leave the file alone.

**Attachment passes (`src/storage/attachments.ts`, new, backend-agnostic)**
- `pushImages(store)`: for each `blobs` row with `onRemote: 0` that a live entry uses: `hasBlob`, else `writeBlob` the
  original, then the thumbnail; then set `onRemote: 1`. One file at a time; a failure is counted and retried next sync.
- `pullImages(store)` (phase 2): download missing thumbnails for every referenced image (eagerly, they are small);
  rebuild a missing thumbnail from a local original and write it back. Originals are downloaded on demand (lightbox).

**Order in `manager.ts` `syncNow`**: `pushImages` (own try/catch) → `syncOnce` → `pullImages` (own try/catch). So
originals are written **before** the day file that references them. If an image write fails, text sync still runs (text
is never blocked by an image) and the image retries next time. Image errors never set the sync status to `error`; they
show as `imagesPending` in the status instead.

**Tests (`attachments.test.ts`, memory stores like `sync.test.ts`)**: originals written before the day file; a failed
image write doesn't block text sync; a second device gets thumbnails; a missing thumbnail is rebuilt; nothing removed
after an entry is deleted; nothing evicted without `onRemote: 1`; a hash collision is an error, not an overwrite.

**Rules**
- **Never auto-delete image files.** A deleted entry keeps its images.
- **Never evict the only copy.** A local original may be dropped from the cache only when `onRemote: 1`, a backend is
  active, and that backend is not "Files inside this browser". That module lives in the same browser storage as IndexedDB,
  so it isn't a separate copy.

## Performance rules (do not skip)

1. **No blobs in `Entry`.** Only `ImageRef`.
2. **Reserve space.** Every thumbnail box is sized from `w`/`h` (CSS `aspect-ratio`, max height about 260 px) *before*
   it decodes. When `w`/`h` are 0, use a fixed square box.
3. **Thumbnails only in the chat.** Never put a full original in a bubble.
4. **Off the main thread.** A worker (`src/lib/images.worker.ts`) does
   `createImageBitmap(file, { imageOrientation: 'from-image' })` → `OffscreenCanvas` → `convertToBlob({ type: 'image/webp' })`
   → `bitmap.close()`. A 12-megapixel decode is about 48 MB.
5. **Blob URL hygiene.** `createObjectURL` on mount, `revokeObjectURL` on unmount; a small LRU cache of recent thumbnail URLs.
6. `decoding="async"`; ignore results that arrive after the row unmounted.
7. Run the 2-year check (see Testing) before calling phase 1 done.

## Build order

### Phase 1: attach, show and store images (written to the folder) — DONE

1. **Data model.** `ImageRef`, `Entry.images`, `CoreFields`/`withDerived`, Dexie v2 with `thumbs` and `blobs`,
   `addEntry`/`setEntryImages`. Tests.
2. **Markdown.** Parse/serialise as above. Tests.
3. **`sync.ts` comparisons.** Hand-edit detection + `sameVersion`. Tests.
4. **Image pipeline.** `src/lib/images.ts`: hashing, type sniffing from magic bytes, paths (`imagePath(day, ref)`,
   `thumbPath(hash)`). Pure and tested. Plus the worker for decoding, size and thumbnail. Unsupported formats: store the
   original, no thumbnail, placeholder in the UI.
5. **Binary storage.** Blob methods on `FileStore`, `fs-store.ts`, `memory.ts`; `pushImages` wired into `syncNow`. Tests.
6. **Capture UI** (`Capture.tsx`). Paste (take over Ctrl+V **only** when the clipboard has files; text paste works as
   before), drag-and-drop, attach button (`accept="image/*"`, `multiple`; Android offers the camera). Preview chips with
   ×, the 10-image limit with a clear message, a size warning. Enter still saves; **Save stays disabled without text**.
7. **Bubbles** (`EntryItem.tsx`). Thumbnails under the text: 1 image = natural ratio up to about 260 px tall; 2–4 = a
   2-column grid of squares (`object-fit: cover`); 5 or more = the first 4 with "+N" on the 4th. Add/remove while editing.
8. **Lightbox** (`Lightbox.tsx`). A portal; opens with the thumbnail, then swaps to the original; Esc closes, ←/→
   move within the entry, wheel/pinch zoom, drag to pan; `history.pushState` so Android back closes it; takes over the keys
   while open (doesn't trigger the journal's `←`/`→`/`t`); caption with date and text; Save and Remove-image buttons; a
   missing file shows a placeholder, never an error.
9. **Export.** The text zip unchanged. "Include photos" builds ONE zip (day files plus originals; see the Decisions
   table) with fflate's streaming `Zip` at level 0 (JPEGs don't compress), showing the total size first; originals under
   `<year>/images/`, no `.thumbs/`.
10. **Docs.** DESIGN.md (data model, file format, `FileStore` interface, sync order), CLAUDE.md code map, PROGRESS.md.

**Phase 1 done when:** a photo can be pasted, dragged or picked; its original appears in the storage folder; the thumbnail
doesn't shift the list; it opens full size; it survives a reload; the 2-year check scrolls smoothly in Days and Stream;
375 px, light and dark mode work; `npm test`, `npx tsc -b` and `npm run lint` pass.

### Phase 2: images on other devices — DONE

- `pullImages` (thumbnails eagerly, rebuild missing thumbnails).
- Originals downloaded on demand in the lightbox, plus a bounded local cache that follows the eviction rule above.
- "Not synced yet" placeholder for referenced images that aren't available anywhere yet.
- Storage badge shows "N photos waiting".
- Docs: DESIGN.md sync rules and storage-module sections.

**Phase 2 done when:** a photo added on one device shows as a thumbnail on another within one sync cycle, the original
downloads when opened, and failures recover on the next sync. Tests pass.

### Phase 3: search, browse and housekeeping — DONE

1. **`has:image`** filter. Rule 6: `search/query.ts`, the `SYNTAX` table in `components/SearchBar.tsx` and DESIGN.md
   together, with parser tests.
2. **Photos view** next to Calendar and Tags: a virtualised grid of thumbnails by date; click opens the lightbox.
3. **Storage in Settings:** space used by images (`navigator.storage.estimate()`), cache size limit.
4. **"Remove images of deleted entries":** only images that no live entry uses *and* that at least one deleted entry
   used. Files the app has never seen referenced (for example uploaded by another device whose day file hasn't arrived
   yet) are never touched. Confirmation shows the count and size and says it can't be undone.
5. **Data-safety wording:** with no file storage set up, the warning says photos are only in this browser.

### Phase 4: pCloud — NOT STARTED

The pCloud module (PROGRESS step 5) implements `readBlob`/`writeBlob`/`hasBlob` and `removeBlob` (needed by the photo
cleanup) with its HTTP API (`uploadfile`, `getfilelink`/`file_open`, `stat`, `deletefile`). Nothing else should need to
change.

## Testing

- **Unit tests** (Vitest), next to the code: everything marked as a test above.
- **2-year check:** seed about 7,300 entries plus some photos on `http://127.0.0.1:5173` only (its own database, no
  sync). Scroll the whole range: no row-height jumps, few DOM rows. Delete the database afterwards. **Never seed
  `localhost:5173`.**
- The browser pane only repaints on a screenshot (CLAUDE.md gotchas). Check state with `javascript_tool`/`read_page`.
- Check Days and Stream layouts, 375 px, light and dark mode.
- The folder picker can't be driven from the pane; ask the user to check that originals land in their real folder.

## Risks

- **Layout jumps:** always size from `w`/`h`.
- **EXIF orientation:** `w`/`h` are the size *after* rotation.
- **Quota:** a phone photo is about 4 MB (700 photos ≈ 3 GB). Keep the persistent-storage request, show the estimate,
  never evict the only copy.
- **Hand-edited files:** a moved or renamed image shows a placeholder; never an error, never deleting the entry.
- **Keys:** the lightbox, the paste handler, the capture box and the journal shortcuts must not fight.
- **PWA (built after this):** its service worker must precache the image worker chunk.

## Out of scope

Video and other file types, HEIC conversion, editing/cropping, OCR, a "downscale" setting.

---

## Build log (what each step decided, and how it was checked)

All 2026-11-09. "Checked" means in the Browser pane on `127.0.0.1` (never `localhost`, see CLAUDE.md) unless stated.

### Phase 1: attach, show, store
- **1.1–1.3 (data model, Markdown, sync comparisons):** a text line that looks like an image line is escaped with `\`;
  an entry whose text was removed by hand keeps its images with empty text.
- **1.4 (pipeline):** `attachImage` (`lib/attach.ts`) is the entry point for the capture UI; `ThumbRow.w/h` hold the
  original's size; AVIF is stored but not shown, like HEIC; very tall thumbnails are capped at 1024 px. Checked in Edge:
  worker decode, EXIF orientation 6, originals byte for byte.
- **1.5 (binary storage):** instead of only `blobs.onRemote`, `pushImages` keeps a per-module set of confirmed paths (an
  image can be needed in several year folders, and switching storage must re-check everything); `onRemote` is set once
  all of an original's year copies are written. The order (push, text sync, pull) lives in `storage/syncAll.ts` so it is
  testable. A file deleted by hand from storage after being confirmed is not rewritten.
- **1.6 (capture UI):** Save waits until every photo is stored ("Preparing photos…"); the same photo twice in one draft
  is dropped with a message; the Attach button turns off at 10. Checked with "Files inside this browser": originals,
  thumbnails and image lines land in storage; 375 px, light and dark.
- **1.7 (bubbles):** one photo fits 320×260 (small ones not enlarged), unknown size = 160 px square; grid tiles are
  120 px. Thumbnails share a ref-counted URL cache (150 idle URLs kept); a missing thumbnail isn't cached, so one that
  syncs in later shows up. Editing saves text and photos with one `updateEntry`. 2-year check (7,306 entries, 1,049 with
  photos): no row height changed after thumbnails loaded, in Days and Stream; 6–11 rows in the DOM.
- **1.8 (lightbox):** the viewer is always dark; "Remove" takes the photo off the entry but keeps the file; history is
  pushed when opening (App), so Esc/×/tap-outside all close through `history.back()`; keys are taken in the capture
  phase so ←/→/t/n never reach the journal; a HEIC shows a message with Save; an original that isn't on the device shows
  the thumbnail with a note and Save disabled.
- **1.9 (export):** "Include photos" makes ONE zip with the day files and the originals (same layout as the storage
  folder), not a second photos-only zip, so it is a complete backup on its own. Chrome/Edge desktop stream it into the
  file chosen in a save dialog; elsewhere (Android) it is collected into a Blob and downloaded. fflate doesn't write
  ZIP64, so a zip is capped just under 4 GB; over that, export one year at a time (offered automatically). Export file
  names use the local date.

### Phase 2: images on other devices
- **2.1:** `pullImages` runs after `syncOnce`; a missing thumbnail is downloaded, else rebuilt from a local original (via
  `ImageLocal.thumbnail`) and written back, else reported in `missing`; a failed read counts in the badge. Rows on screen
  pick up a thumbnail that arrives later (`useThumbUrl` + `UrlCache.retry`). Checked: fetched, rebuilt and written back,
  shown in place with no height change.
- **2.2:** the lightbox calls `loadOriginal` (manager): local, else `fetchOriginal` from storage (entry's year first, bytes
  must hash to the name), kept with `onRemote: 1`, plus a thumbnail if missing; states loading / no storage / not in
  storage yet / error, with "Try again". The cache is trimmed after every sync and every download, least recently viewed
  first (`usedAt`), only `onRemote: 1`, never with an `insideBrowser` module, never the photo on screen (`holdOriginal`).
  Checked: download on open, "not in storage yet", then Try again.
- **2.3:** the pull report's `missing` feeds `missingImages` (a `KeySet` in the manager, cleared on connect/disconnect);
  `Thumb` shows "Not synced yet" with a dashed edge for those, an empty box while loading, the format name for HEIC/AVIF.
  Only images with no thumbnail in storage and no local original count (a failed read doesn't). Checked: placeholder,
  then the thumbnail in place after the next sync (same height), light and dark.
- **2.4:** the badge's "N photos waiting" is `imagesWaiting` (live: local originals with `onRemote: 0` that a live entry
  uses) plus pull failures (`imagesFailed`). Bug found and fixed on the way: a photo attached again after its files were
  confirmed was never marked `onRemote` (so it would wait forever); `pushImages` now also checks `ImageLocal.unsaved()`.
  Settings shows how many photos from another device haven't arrived yet.
- **2.5:** DESIGN.md "Images in a sync run" and the storage-module section. The "done when" check is one two-device test
  in `attachments.test.ts` (upload fails then recovers; "missing", then a failed read, then the thumbnail within one
  sync; the original fetched and hash-checked).

### Phase 3: search, browse, housekeeping
- **3.1 `has:image`:** also `has:photo`/`has:images`/`has:photos`; `-has:image` keeps entries without (an empty `images`
  list counts as none). `ParsedQuery.hasImages`, a "With photos" chip, the SYNTAX help row, DESIGN.md. Only `has:` can be
  negated; `-on:x` etc. stay excluded words. An unknown `has:` value is a "Didn't understand" error.
- **3.2 Photos view:** a **Photos** tab (between Calendar and Tags). `lib/photoRows.ts` (pure, tested) flattens live
  entries into day-header rows and rows of `columns` square tiles, newest first; `columnsFor(width)` gives 3 columns on a
  375 px phone and 6 at full width; `PhotosView` uses `react-virtuoso` (the app uses the `fill` layout for it, like the
  journal). Tile sizes come from the grid width only: every row was 119 px in a 2,420-photo check, at most ~60 tiles in
  the DOM. A tile opens the existing lightbox (via `openPhoto`, so Esc/Back close it and the scroll position is kept);
  a day heading opens that day in the journal. Five tabs no longer fit 375 px, so the nav's padding is tighter there.
- **3.3 storage in Settings:** the "Photos on this device" card (`PhotoStorageCard`): full-size photos (count, size, how
  many storage doesn't have yet), thumbnails, `storage.estimate()`, and a picker for the original-cache limit (256 MB,
  512 MB, 1 GB default, 2 GB, 5 GB, 10 GB, no limit). Saved as `originalsLimit` in `meta`; anything that isn't one of the
  choices reads as the 1 GB default; 0 = no limit = `Infinity`. `trimOriginals` calls `evictOriginalsToLimit`, and
  lowering the limit trims at once (`applyOriginalsLimit`; same rule as always). `limitMode` (pure) says when the limit
  does nothing (no storage / inside browser / permission paused). A real eviction needs a separate-copy storage, so it is
  covered by unit tests only.
- **3.4 cleanup:** "Photos of deleted entries" (`DeletedEntryPhotos`) → `planImageCleanup` (count and sizes, changes
  nothing) → a confirmation that says it can't be undone → `removeImagesOfDeletedEntries`. All logic is in
  `storage/cleanup.ts` (rules in DESIGN.md and CLAUDE.md rule 2). Mutation-checked: removing the live-entry check or the
  confirmed-list update makes 7 of the 23 cleanup tests fail. Checked with "Files inside this browser": 3 entries deleted
  through the app, the plan showed exactly the 2 photos nothing live uses (a photo shared with a live entry and an
  unreferenced file were left alone), Cancel changed nothing, Remove deleted the 2 originals + 2 thumbnails from storage
  and the device with day file and tombstones untouched, and a second look found nothing. Not exercised in the pane: the
  "sync failed, so refuse" path and the real folder.
- **3.5 data-safety wording:** there was no "only in this browser" warning yet, so this adds it. `lib/dataSafety.ts`
  (pure, tested): `browserOnlyMode` (no storage, or "Files inside this browser", which is not a backup) and
  `browserOnlyWarning(mode, photos)`. Shown as a notice in the Settings storage card, and as a "⚠ Photos only in this
  browser" header badge when storage is off and the device holds photos (nothing new in the header for entries-only
  users; that is PROGRESS step 3). Checked: no photos / photos (singular too, live) / inside-browser storage; 375 px dark,
  light.

---

## Review of the junior plan (what changed and why)

Checked against the code on 2026-11-08.

**Data-loss risks fixed**
1. `withDerived` drops unknown fields, so edits and tag renames would strip images. This is now an explicit step with tests.
2. Hand-edit detection in `sync.ts` only compared `text`, so a hand-removed image line would be written back. It now compares images too.
3. Stripping image lines before hashing would change hand-written entry ids and create duplicates. The full body is hashed.
4. The junior plan said "upload before referencing" but ran the attachment pass after the entry merge. Uploads now run before `syncOnce`.
5. "Remove unused images" could delete a photo another device uploaded just before its day file. Cleanup now only removes images of deleted entries.

**Wrong assumptions corrected**
6. `merge.ts` has no version check to update. It needs no change.
7. `fs-store.ts` doesn't list image folders, and shouldn't (cost). Separate blob methods instead of `list()`.
8. `memoryStore` lists every file; blobs live in a separate map so tests match the real stores.
9. In-memory `zipSync` can't export gigabytes. Streaming, uncompressed, optional photo export.
10. Image failures inside `syncNow`'s try block would fail text sync. They have their own error handling.

**Other changes**
11. Phase 1 writes originals to the folder (the junior plan left the only copy in the browser until phase 2).
12. Hash names lengthened from 10 to 16 hex characters, with collision detection on write.
13. "Stored once" corrected to "once per year" (per-year image folders).
14. The browser-files module doesn't count as a safe copy for eviction.
15. Bytes are saved when the image is attached, so a lost edit draft doesn't lose the photo.
16. Paste only takes over when the clipboard has files.
17. Pure logic is split from the worker so it can be tested in Node.
18. The PWA (now after images) must precache the image worker chunk; `vite-plugin-pwa` picks it up from the build.
