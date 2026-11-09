# Plan: images in journal entries

_Status: planned, nothing built yet. Written 2026-11-08._

Goal: attach photos to entries, show thumbnails in the chat, open them full size, and sync them like everything
else, without hurting scroll performance or risking journal data.

Before you start, read `CLAUDE.md` (rules and commands), `DESIGN.md` (data model, file format, sync rules) and
`PROGRESS.md`. Run everything through WSL as described in `CLAUDE.md`.

## Decisions (already made, do not re-open)

| Topic | Decision |
|---|---|
| Images per entry | Up to **10**. Warn when the total size of one entry gets very large (suggest 100 MB). |
| Text | **Required.** An entry cannot be saved with images only. The existing "text required" check stays. |
| Image quality | **Originals are kept byte-for-byte.** No resizing, no re-encoding. EXIF stays in the file. |
| Image file names | By **content hash** (SHA-256, shortened), so the same photo is stored once and a file never changes. |
| Thumbnails | Made locally for the UI (about 512 px wide, WebP, about 25 KB). Also stored in the folder in **`.thumbs/`** from the start so a new device fills in fast. |
| Formats shown | JPEG, PNG, WebP, GIF. Anything else (e.g. HEIC) is stored, but shows a placeholder and a download link. |

## Constraints in the current code that shape the design

1. `FileStore` (`src/storage/types.ts`) only reads and writes **strings**. Images need binary methods.
2. The app loads **every entry into memory** (`useLive` in `App.tsx`) and rebuilds the search index on each change.
   So an `Entry` may only hold a small *reference* to an image, never the image data.
3. The journal is **virtualised** (`JournalView.tsx`, react-virtuoso). Row heights are measured, so a thumbnail that
   loads late and changes a row's height makes the list jump. Every thumbnail must reserve its exact size up front.
4. The Markdown format is a **public contract** (`DESIGN.md`). Older files must keep parsing, and users edit them by hand.
5. Sync and merge code can lose entries (`CLAUDE.md` rule 1). Every change to `sync.ts`, `merge.ts`, `markdown.ts` or
   `manager.ts` needs a test that **fails before and passes after**.
6. New storage behaviour goes in the backend modules and `FileStore`, never as special cases in `sync.ts` (rule 2).

## Data model

Add to `Entry` in `src/lib/entry.ts`:

```ts
interface ImageRef {
  hash: string   // content hash, also the file name stem
  ext: string    // 'jpg' | 'png' | 'webp' | 'gif' | ...
  w: number      // width after EXIF rotation, in pixels
  h: number      // height after EXIF rotation
}
Entry.images: ImageRef[]   // [] when none
```

- Existing entries have no `images`. Treat a missing field as `[]` everywhere (old rows in IndexedDB, old files).
- Adding or removing an image is an edit: bump `updatedAt` with `nextStamp` and set `dirty: 1` (rule 4).
- `sameVersion` in `sync.ts` must also compare images, otherwise an image-only change is not seen as a change.
- Image bytes live in **separate Dexie tables**, added in a new Dexie version in `src/lib/db.ts`:
  - `thumbs`: key `hash`, value `{ hash, blob, w, h }`. Always kept.
  - `images`: key `hash`, value `{ hash, blob, mime, size, onRemote }`. The full original. `onRemote` records that the
    file is confirmed in the storage backend (needed for cache eviction, see below).

## File format (backward compatible)

Standard Markdown images at the end of the entry body, with the size in the alt text:

```markdown
## 09:14 <!-- id:01JC... created:... updated:... -->
Finished the sketch #work

![640x480](images/3f9a2c1b7d.jpg)
![800x600](images/9c01aa22f3.png)
```

Files on disk:

```
<root>/
  2026/2026-11-08.md
  2026/images/<hash>.<ext>      originals, referenced from the Markdown above
  .thumbs/<hash>.webp           thumbnails, a regenerable cache
  .meta/tombstones.json
```

Parsing rules (`src/lib/markdown.ts`):
- Only **trailing** lines that match `![<w>x<h>](images/<hash>.<ext>)` become `entry.images`. They are removed from
  `entry.text`, so search and display see clean text. Serialising writes them back after the text.
- Any other image syntax (e.g. `![](https://...)`, or an image in the middle of the text) stays as plain text. Do not touch it.
- A matching line without `WxH` in the alt text is still accepted; `w`/`h` are then measured when the file is first read.
- Files from before this change must parse exactly as before. Older versions of the app will show the image lines as
  plain text, which loses nothing.
- `dayFromPath` already ignores files that aren't `YYYY/YYYY-MM-DD.md`, so image and thumbnail files do not disturb sync.

## Performance rules (do not skip these)

1. **No blobs in `Entry`.** Only `ImageRef`.
2. **Reserve space.** Every thumbnail element gets a box sized from the stored `w`/`h` (CSS `aspect-ratio`, with a max
   height of about 260 px) *before* the image decodes, so rows never change height.
3. **Thumbnails only in the chat.** Never put a full original into a bubble.
4. **Work off the main thread.** Decoding and thumbnailing happen in a Web Worker. Use `createImageBitmap(file,
   { imageOrientation: 'from-image' })`, draw to an `OffscreenCanvas`, and call `bitmap.close()` when done. A 12-megapixel
   decode is about 48 MB of memory.
5. **Blob URL hygiene.** `URL.createObjectURL` when a row mounts, `URL.revokeObjectURL` when it unmounts (Virtuoso
   mounts and unmounts rows constantly). Keep a small LRU cache of recent thumbnail URLs to avoid re-reading IndexedDB.
6. `decoding="async"` on `<img>`. Ignore results that arrive after the row has unmounted.
7. Test with the 2-year dataset (see "Testing" below) before calling phase 1 done.

## Build order

### Phase 1: local images (no sync yet; usable on its own)

1. **Data model.** `ImageRef`, `Entry.images`, Dexie version bump with `thumbs` and `images` tables, an `images` default of
   `[]` when reading old rows. Update `withDerived` / `makeEntry`. Add tests in a new test file.
2. **Markdown.** Parse and serialise the trailing image lines in `markdown.ts`. Tests: round trip, old files unchanged,
   non-matching image syntax left alone, images with and without `WxH`, CRLF files, an entry with text and 10 images.
3. **Merge and sync comparison.** Include `images` in the merge version check (`merge.ts`) and in `sameVersion`
   (`sync.ts`). Test: an entry whose only difference is an added image is detected as changed and wins by `updatedAt`.
4. **Image pipeline.** New `src/lib/images.ts` plus a worker: content hash of the original bytes, detect type, decode with
   EXIF rotation, read width and height, make the thumbnail. Store original and thumbnail in the Dexie tables.
   Unsupported formats: store the original, skip the thumbnail, mark the reference so the UI shows a placeholder.
5. **Capture UI** (`Capture.tsx`). Paste (Ctrl+V), drag-and-drop, and an attach button (`accept="image/*"`, `multiple`;
   on Android this offers the camera). Show preview chips above the text box with a remove "×". Enforce the 10-image
   limit with a clear message, and show a size warning. Enter still saves. **Save stays disabled without text.**
6. **Bubbles** (`EntryItem.tsx`). Thumbnails under the text, using the layout below. Add/remove images when editing.
7. **Lightbox.** New `Lightbox.tsx`:
   - Opens instantly with the thumbnail, then swaps to the full image from the `images` table.
   - Esc closes; ←/→ move between that entry's images; wheel or pinch to zoom; drag to pan.
   - Uses `history.pushState` so the Android back button closes it.
   - Shows the date and text as a caption, with Save-to-disk and Remove-image buttons.
   - It is a portal above the app, and it must not break the journal's own `←`/`→`/`t` shortcuts (it should take over
     the keys while open).
8. **Export.** Include the originals in the Settings zip export under `2026/images/`. Leave `.thumbs/` out.
9. **Docs.** Update `DESIGN.md` (data model, file format, layout) and the code map in `CLAUDE.md`.

Thumbnail layout in a bubble:

| Images | Layout |
|---|---|
| 1 | Natural aspect ratio, up to about 260 px tall |
| 2 to 4 | 2-column grid of cropped squares (`object-fit: cover`) |
| 5 or more | First 4 as a grid, the 4th with a "+N" overlay that opens the lightbox |

**Phase 1 done when:** a photo can be pasted, dragged or picked; it appears as a thumbnail that does not shift the list;
it opens full size; it survives a reload; the 2-year test still scrolls smoothly; all new tests and `npm test`,
`npx tsc -b` and `npm run lint` pass; the layout works at 375 px wide and in light and dark mode (rule 8).

### Phase 2: binary sync

1. **`FileStore` blob methods** (`src/storage/types.ts`): add `readBlob(path): Promise<Blob | null>` and
   `writeBlob(path, blob): Promise<string>` (returns the new rev). Implement them in `backends/folder.ts`,
   `backends/browser.ts` (shared code is in `fs-store.ts`) and `storage/memory.ts` (used by tests).
2. **Attachment sync pass.** A separate function called after the entry merge in the manager (keep `syncOnce` itself
   focused on day files). It:
   - uploads originals and thumbnails that exist locally but not remotely,
   - downloads thumbnails for every referenced image that is missing locally (eagerly, they are small),
   - downloads originals only on demand (lightbox) or into a bounded background cache,
   - rebuilds a missing or corrupt thumbnail from the original and uploads it again.
3. **Order matters: upload before referencing.** Images (and thumbnails) are written to storage *before* the day file
   that references them. If an upload fails, the text still syncs (the text must never be blocked by an image), and the
   missing image shows a "not synced yet" placeholder until it arrives.
4. **Never auto-delete image files.** A deleted entry keeps its images in storage. Add a Settings action, "Remove unused
   images", with a confirmation that says how many files and how much space, and that it cannot be undone.
5. **Never evict the only copy.** The local cache may drop an old original only when `onRemote` confirms it is in the
   backend. With no backend configured, nothing is evicted.
6. **Status.** The storage badge shows pending image uploads/downloads (for example "3 images pending").
7. **Upload behaviour.** Sequential or two at a time; each file is independent, so a failure retries on the next sync
   without blocking the others. Image files never change, so there are no merge conflicts, only add and remove.
8. **Tests** (use `memoryStore` extended with blobs, as `sync.test.ts` does): upload ordering; a failed image upload
   does not block text sync; a second device gets thumbnails first; a missing thumbnail is rebuilt; no auto-delete after
   an entry is deleted; no eviction of a file that is not on the backend. Each test must fail before the change.
9. **Docs.** Update the sync rules and storage-module sections of `DESIGN.md`.

**Phase 2 done when:** a photo added on one device shows as a thumbnail on another within a sync cycle, and the
original downloads when opened; failures recover on the next sync; tests pass.

### Phase 3: search, browse and housekeeping

1. **`has:image`** filter. Rule 6: change all three places together, `search/query.ts` (parser), the `SYNTAX` table in
   `components/SearchBar.tsx`, and `DESIGN.md`, and add parser tests.
2. **Photos view.** A new view next to Calendar and Tags: a virtualised grid of thumbnails by date, click to open the lightbox.
3. **Storage display** in Settings: space used by images (`navigator.storage.estimate()`), cache size limit, and the
   "Remove unused images" action from phase 2.
4. **Data-safety wording.** With no file storage configured, the warning must say that photos exist only in this browser.
   This ties into the data-safety step already in `PROGRESS.md`.

### Phase 4: pCloud

The planned pCloud module (`PROGRESS.md`, step 4) should implement the same blob methods using its HTTP API
(`uploadfile`, `getfilelink`). No other change should be needed.

## Testing

- **Unit tests** (Vitest): everything above that is marked as a test. Keep them next to the code, like
  `journalRows.test.ts`.
- **2-year performance check:** seed a throwaway database with about 7,300 entries and some photos on
  `http://127.0.0.1:5173` (a different origin from `localhost`, so it has its own database and no sync). Scroll the whole
  range and confirm there is no row-height jump and the number of DOM rows stays small. Delete the database afterwards.
  Never seed `localhost:5173`: it may have a storage backend that would sync fake entries into real files.
- **Browser pane quirk:** the pane only repaints when you take a screenshot, so a virtualised list can look blank until
  you do (see `CLAUDE.md` gotchas). Check state with `javascript_tool` or `read_page`.
- Check both layouts of the journal (Days and Stream), 375 px wide, and light and dark mode.

## Risks and pitfalls

- **Layout jumps** in the virtualised list are the most likely visible bug. Always size from stored `w`/`h`.
- **EXIF orientation:** `w`/`h` must be the dimensions *after* rotation, or the reserved box will be wrong.
- **Quota:** originals are large (a typical phone photo is about 4 MB, so 700 photos is about 3 GB). Check storage
  estimates, keep the persistent-storage request, and never evict a file that is not safely in the backend.
- **Old app versions** see image lines as plain text. That is acceptable, and nothing is lost.
- **Hand-edited files:** someone may move or rename an image file or its Markdown line. A missing file must show a
  placeholder, never an error or a crash, and never delete the entry.
- **Keys and shortcuts:** the lightbox and the paste handler must not fight with the capture box or the journal
  keyboard shortcuts.

## Out of scope for now

Videos and other file types, HEIC conversion, image editing or cropping, OCR or search inside images, and a
"keep originals vs downscale" setting (decided: always keep originals).
