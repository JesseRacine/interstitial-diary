# Design: Interstitial Diary

## Product principles

1. **Capture in seconds.** Opening the app lands in the capture box; Enter saves. If writing is slow, the habit dies.
2. **Freeform first.** One text box, automatic timestamp, optional `#tags` anywhere in the text. No required fields.
3. **Search and browse are core**, not extras: by keyword, phrase, tag, date, date range, time of day and weekday,
   plus calendar and tag views.
4. **Your journal is plain Markdown files you own.** The browser database is a fast working copy; the files are the
   durable record and can be read or edited in any text editor.
5. **Never lose an entry.** When in doubt, keep data (see "Sync rules").
6. **Windows + Android.** PWA first; native (Tauri) later from the same code.

## Architecture

```
 UI (React) ──► Dexie / IndexedDB  ◄──►  sync engine  ◄──►  storage module (FileStore)
                (working copy:            (sync.ts)          folder | browser files | pCloud* | GitHub* ...
                 search, offline)                            (* = planned)
```

- **IndexedDB (Dexie)** holds every entry, including soft-deleted ones. All UI reads come from here via `liveQuery`,
  so the UI updates by itself after edits or syncs.
- **The journal is virtualised** (`react-virtuoso`): all entries are flattened into rows (a header per day plus its entries,
  `lib/journalRows.ts`) and only the rows on screen exist in the DOM, so two years of entries (about 7,300) scroll
  smoothly. Anything that changes a row's height after it renders (e.g. images) must reserve its space up front.
  Photos do: every box is sized from the stored `w`/`h` (`lib/imageLayout.ts`) before the thumbnail decodes.
- **Photos** (`lib/images.ts`, `lib/attach.ts`): an attached file is hashed (SHA-256, first 16 hex = its name), its
  type sniffed from its bytes, and saved at once to Dexie: the original byte for byte in `blobs`, a ~512 px WebP
  thumbnail in `thumbs` (made in a Web Worker, `lib/images.worker.ts`, with EXIF rotation). Entries only hold small
  `ImageRef`s. Thumbnails reach the UI through one ref-counted cache of object URLs (`lib/urlCache.ts`).
- **The Photos view** is virtualised the same way (`lib/photoRows.ts`): day headers and rows of square tiles whose size
  comes from the grid width alone, so its rows never change height either.
- **The storage manager** (`storage/manager.ts`) is the one runtime singleton: it holds the active module, runs syncs
  one at a time, exposes status to the UI, and trims the original cache. See "When sync runs" for how jobs are ordered.
- **Search** builds a MiniSearch index over all live entries in memory (rebuilt when entries change). This is fine
  for tens of thousands of entries; move to incremental `add/replace/discard` if it ever gets slow.
- **Storage modules** move files; the **sync engine** does all merging. One module is active at a time.

## Data model

```ts
Entry {
  id: string          // ULID for app-created entries; "h<yyyymmdd><hhmm><hash>" for hand-written ones
  createdAt: number   // ms epoch, never changes (so an entry never moves to another day)
  updatedAt: number   // ms epoch, bumped on every edit/delete; the merge "clock"
  text: string        // trimmed
  tags: string[]      // derived: lowercase, no '#'
  day, hour, minute, weekday  // derived from createdAt in LOCAL time
  deleted: 0 | 1      // soft delete (tombstone)
  dirty: 0 | 1        // changed since last successful sync
  images?: ImageRef[] // missing = none; only small references, never image bytes
}
ImageRef { hash: string /* 16 hex chars of SHA-256, file name stem */, ext: string, w: number, h: number /* 0 = unknown */ }
```

`withDerived` (entry.ts) rebuilds an entry field by field and must copy every core field, `images` included, or edits,
tag renames and parsing would drop it. Dexie v2 adds `thumbs` (rebuildable thumbnails) and `blobs` (originals, with
`onRemote` once the storage module has the file); see [images-plan.md](images-plan.md).

**Tags** match `#` followed by letters/digits/`_`, then letters/digits/`_-/`, when not glued to a preceding word
(`C#` and `a#b` are not tags). Stored lowercase; trailing `-`/`/` stripped.

Other local data lives in the Dexie `meta` table: `savedSearches`, `recentSearches`, `storage` (active backend id +
config, e.g. a folder handle), `sync:<backendId>` (file revisions from the last sync), `images:<backendId>` (image
paths confirmed in that storage), `originalsLimit` (the cache limit in bytes, 0 = none). `blobs` rows also carry `usedAt` (last opened, for the original cache). The theme and the journal layout (`journalLayout`: `cards` or `stream`) are in `localStorage`.

## File format (public contract)

```
<root>/
  2026/2026-11-08.md        one file per day that has entries
  .meta/tombstones.json     { "<id>": <deletedAt ms>, ... }
```

Day file, oldest entry first:

```markdown
# Sunday, 8 November 2026

## 09:14 <!-- id:01JC... created:1794171327958 updated:1794171327958 -->
Finished email triage. Next: draft report. #work

## 14:30
A heading without the comment (typed by hand) is accepted too.
```

- The `#` title is cosmetic and ignored when parsing.
- An entry is everything from its `## HH:MM` heading to the next one. Body lines starting with `## ` are escaped
  with a leading `\` when written, and unescaped when read.
- Hand-written headings get a stable id from day + time + text hash. After the next sync the file is rewritten with
  proper id comments.
- CRLF line endings are accepted.
- **Images:** a trailing block of lines `![<w>x<h>](images/<hex>.<ext>)` (blank lines allowed between them) after the
  text becomes the entry's images; the files are in `<year>/images/`. `WxH` is optional. Written as the text, a blank
  line, then one line per image; an entry without images is written exactly as before. Any other image syntax, or an
  image line followed by more text, stays plain text. A text line that would read as an image line is escaped with a
  leading `\`, like headings. Hand-written ids hash the whole body, image lines included, so they didn't change when
  image support arrived.
- Other files in the folder are ignored, so a README or notes in the folder are safe.

## Sync rules (`storage/sync.ts`)

Each run:
1. **List** files. Read `.meta/tombstones.json` and every day file whose `rev` differs from the last sync.
2. **Detect hand edits:** a file entry whose `updated` stamp equals the local one but whose text differs was edited
   outside the app. It gets a fresh `updatedAt` so it wins. Images count too (`sameImages`): adding or removing an
   image line by hand is an edit, so a removed line is not written back.
3. **Merge** by id: newest `updatedAt` wins; on a tie, a deletion wins; a tombstone beats any version not edited after it.
4. **Write** day files that have dirty local entries, that changed after merging, or that are missing from storage
   (so a new empty folder gets everything). Remove files for days left with no live entries. Write tombstones if changed.
5. **Save** merged entries locally with `dirty: 0`, skipping any entry edited in the app while the sync ran
   (`LocalStore.apply` compares `updatedAt` with the snapshot).

If anything throws, nothing is marked synced and the next run retries.

**Deliberate limits:**
- **Removing an entry from a file by hand does not delete it**: it is written back. Sync apps (pCloud Drive,
  Syncthing) can briefly deliver a stale copy of a file, and treating "missing" as "deleted" would wipe real entries
  on every device. Deletions go through the app (tombstones).
- If the same entry is edited in a file *and* in the app before a sync runs, the app's version wins.

### Images in a sync run (`storage/syncAll.ts`, `storage/attachments.ts`)

A run is **push images → text sync → pull images**. Both image passes are backend-agnostic like `sync.ts`, run only
if the module has the blob methods, and sit in their own try/catch: an image problem never blocks or fails the text
sync. It is counted, shown, and retried next run. Image files are never deleted automatically (the one exception is the
user-confirmed cleanup in Settings, see "Platform plan and data safety"), not even when the
entry using them is deleted, and `list()` never returns them (it runs every sync).

1. **Push** (`pushImages`, before the text so originals land before the day files that refer to them): every
   original this device holds is written to each `<year>/images/` folder whose live entries use it, plus
   `.thumbs/<hash>.webp`. `writeBlob` never overwrites: the same size is accepted, a different file with that name is
   an error. Paths confirmed in storage are remembered per module (`images:<backendId>` in `meta`), so a quiet sync
   touches no image files. An original is marked `onRemote: 1` once every year copy it needs is confirmed, including
   a local copy whose files were confirmed earlier (a photo attached again after the cache dropped it:
   `ImageLocal.unsaved`). Choosing a new storage resets that list and every `blobs.onRemote`.
2. **Text sync** (the rules above).
3. **Pull** (`pullImages`): every image a live entry uses gets a thumbnail on this device. It downloads
   `.thumbs/<hash>.webp` (small, so eagerly; the original's size comes from the image line); if storage has none but
   this device has the original, it makes one in the worker and writes it back. An image that is nowhere yet (the
   other device hasn't uploaded it) is reported **missing** and looked for again next run. A failed read is counted as
   failed, not missing. Formats without thumbnails (HEIC, AVIF) are skipped. A quiet sync reads nothing: only images
   without a local thumbnail are looked up.

**Originals are never downloaded by sync.** The photo viewer asks for one when it opens (`loadOriginal` in
`manager.ts`, `fetchOriginal` in `storage/originals.ts`). It tries the entry's year folder, then other years that use
it, and only accepts bytes that hash to the file name (a file replaced by hand is never taken for the photo). The
download is kept (`onRemote: 1`, so it may be dropped again) and a missing thumbnail is made from it. Local originals
are a bounded cache: see "Platform plan and data safety".

**What the user sees:**
- A row on screen picks up a thumbnail that arrives later, at the same height (`useThumbUrl` watches the `thumbs`
  table; `UrlCache.retry`).
- A missing image's box says **"Not synced yet"** (dashed edge) until it arrives (`missingImages` in `manager.ts`, a
  `KeySet` recomputed every sync, so only rows whose answer changes re-render). Settings gives the count.
- The status badge adds **"· N photos waiting"**: photos on this device that storage doesn't have yet and a live entry
  uses (`imagesWaiting`, a live count like "changes waiting", so it shows before the next sync and drops to 0 after a
  good one; photos of deleted entries or discarded drafts never count), plus photos the last pull failed to fetch.
  The last image error is shown in Settings ("will retry").

**When sync runs** (`storage/manager.ts`): on startup, ~1.5 s after local changes, when the page is hidden or
shown again, every 5 minutes, and on "Save now". Only one sync runs at a time; a request made while one runs sets a
flag and the run repeats once. After every successful sync (and every original download) the manager trims the original
cache (`trimOriginals`). Jobs that edit the per-storage `images:<id>` list, such as the photo cleanup, run through
`exclusive`: they wait for a running sync, and any sync requested meanwhile waits for them, then the manager syncs again.

## Storage modules

```ts
interface FileStore {           // what a module implements
  list(): Promise<{ path: string; rev: string }[]>   // recursive; rev changes when content changes
  read(path): Promise<string | null>
  write(path, content): Promise<string>                // creates folders; returns new rev
  remove(path): Promise<void>
  // optional, for images; without them a module syncs text only
  readBlob?(path): Promise<Blob | null>
  writeBlob?(path, blob): Promise<void>               // never overwrites: same size = no-op, else BlobCollisionError
  hasBlob?(path): Promise<{ size } | null>
  removeBlob?(path): Promise<void>                    // missing file = no error; only the user-confirmed photo cleanup calls it
}
interface StorageBackend<Config> { // how the app offers and reopens it
  id, name, description
  unsupportedReason(): string | null
  setup(): Promise<{ config, store, label }>          // interactive, runs in a click handler
  open(config, interactive): Promise<OpenResult>       // reopen from saved config; may need permission
  insideBrowser?: boolean  // its files live in this browser's own data: local originals are never dropped for it
}
```

Paths use `/`. `config` must survive IndexedDB structured cloning (a directory handle is fine; a class instance is not).

**Images need the three blob methods.** `readBlob`/`writeBlob` move bytes as they are (no text decoding), `hasBlob`
answers with the size only (cheap: no download). `removeBlob` is a fourth, optional method used only by the
user-confirmed photo cleanup; a module without it is left alone by the cleanup (only this device is cleaned). A module without them syncs text only: image lines still sync, the
photos themselves stay on the device that added them. Set `insideBrowser` when the files are wiped together with the
browser's data (OPFS): then a stored file is not a separate copy, so the app keeps every local original.

| Module | Status | Notes |
|---|---|---|
| `folder`: Folder on this computer | done | Text and images. File System Access API. Chrome/Edge desktop only. Permission usually has to be re-granted after a browser restart ("Reconnect folder" badge). Choosing a folder inside pCloud Drive/OneDrive/Syncthing gives sync for free. |
| `browser`: Files inside this browser | done | Text and images; `insideBrowser`. OPFS. Works everywhere incl. Android, but is wiped together with browser data. |
| `pcloud` | planned | See below. |
| `github` | idea | Files in a private repo via the GitHub contents API. |
| native folder (Tauri) | idea | Real folders on Android once there's a native build. |

**Adding a module:** implement `StorageBackend` in `storage/backends/<name>.ts`, register it in `backends/index.ts`
(and remove it from `PLANNED_BACKENDS`), then test it against the sync engine the same way `sync.test.ts` uses
`memoryStore` (and, with blob methods, the way `attachments.test.ts` does). Nothing else should need to change.

**pCloud notes** (from a CORS check on 2026-11-08):
- Use the **HTTP API** (`api.pcloud.com` US / `eapi.pcloud.com` EU). It returns `Access-Control-Allow-Origin: *`.
- **WebDAV has no CORS headers**, so browsers can't use it.
- Preflight allows no custom headers, so send the token as the `access_token` parameter, not an `Authorization` header.
- Auth is OAuth2 (token flow). The app must be registered in pCloud's developer console with a redirect URL, which
  means the app needs its hosted address first.
- Useful calls: `listfolder` (recursive, gives `hash`/`modified` for `rev`), `getfilelink` or `file_open/file_read`,
  `uploadfile`, `deletefile`, `createfolderifnotexists`.
- For images: `uploadfile` takes the bytes as they are; `getfilelink` downloads them; `stat` (size) serves `hasBlob`.
  Fetch the `.thumbs/` folder's listing once per sync rather than one `stat` per photo if many are looked up.

## Search

One search bar; filter chips write the same syntax. Parser: `search/query.ts`. Engine: `search/engine.ts`.

| Query | Meaning |
|---|---|
| `report draft` | all words must match; prefix match, fuzzy for words over 4 letters |
| `"email triage"` | exact phrase |
| `#work #tired` / `#work\|#personal` | all tags / any tag |
| `-#personal` / `-meeting` / `-"a phrase"` | exclude |
| `on:2026-11-08`, `from:2026-11-01 to:2026-11`, `in:2026-11`, `in:2026` | dates (day, month or year precision) |
| `today`, `yesterday`, `last:7d` / `w` / `m` / `y` | relative dates (`last:7d` = the 7 days ending today) |
| `time:09-12`, `time:22-05` (wraps midnight), `after:22:00`, `before:7` | time of day (end exclusive) |
| `day:mon`, `day:weekend`, `day:mon,fri` | weekday |
| `has:image` / `-has:image` | only entries with photos / only entries without (`has:photo`, `has:images`, `has:photos` work too) |

Date filters intersect. Unknown `key:value` tokens are treated as words. Bad filter values show an error under the
search bar. Results are sorted by relevance when there are keywords, otherwise newest first.

## UI

- **Header:** app name, views (Journal, Calendar, Photos, Tags, Settings), storage status badge. With no storage chosen
  the badge is hidden, except a red "⚠ Photos only in this browser" once the device holds photos.
- **Search bar** (always visible): tag autocomplete, chips, saved (★) and recent searches, `?` syntax help.
- **Journal:** a chat. One continuous scroll through all days, oldest at the top and newest at the bottom, with the
  capture bar pinned at the bottom. Entries are left-aligned bubbles (time underneath; Edit/Delete on hover, always
  visible on touch screens). A faint divider shows the gap since the previous entry when it is an hour or more.
  Two layouts, chosen with the **Days / Stream** toggle and remembered: *Days* puts each day in its own box with a date
  header and entry count; *Stream* is one unbroken chat with a thin date divider between days. The header shows the day
  currently at the top; the arrows, date picker and **Latest** button jump between days. Saving an entry scrolls to it.
- **Photos:** attach in the capture box (or while editing) by pasting (only taken over when the clipboard holds
  files), dropping, or the Photo button; up to 10 per entry, a warning over 100 MB, text still required. In a bubble: one
  photo at its ratio (max 320×260), 2–4 as a grid of squares, 5+ as four with "+N". Clicking opens the **lightbox**:
  original after the thumbnail, ←/→ within the entry, wheel/pinch/double-click zoom, drag to pan, Esc or Back to
  close (it is a history entry), Save (download original), Remove (takes it off the entry; the file is kept). An
  original that isn't on this device is downloaded from storage when opened (the thumbnail shows meanwhile); if
  storage doesn't have it yet, a note says so with "Try again". Formats the browser can't show (HEIC, AVIF) show a
  placeholder with Save.
- **Photos view** (header tab between Calendar and Tags): every photo of every live entry as a grid of square
  thumbnails, newest day first (newest entry first within a day, an entry's photos in their own order), under a heading
  per day with its photo count. Virtualised like the journal (`lib/photoRows.ts` turns entries into day and tile rows;
  `components/PhotosView.tsx`). The number of columns comes from the width (tiles of at least 104 px, never fewer than 2:
  3 on a 375 px phone, 6 at full width). Tiles are squares sized from the grid width alone, so a row's height never
  depends on what has loaded. Clicking a tile opens the lightbox on that entry's photos; clicking a day's heading opens
  that day in the journal. A photo without a thumbnail shows the same placeholders as in a bubble.
- **Results:** match count, sort, a histogram of matches over time (click a bar to filter), entries with highlights;
  clicking a date opens that day with a "Back to results" link.
- **Calendar:** month or year heatmap; click a day to open it.
- **Tags:** count and last-used date per tag; rename/merge.
- **Settings:** storage, **photos on this device**, theme, export, shortcuts. The photos card (`PhotoStorageCard`) lists
  full-size photos (count and size, with how many storage doesn't have yet), thumbnails, what the browser reports for
  the whole app (`navigator.storage.estimate()`, an estimate; left out where unsupported), and the cache limit. The
  limit says in words when it does nothing: no storage connected, "Files inside this browser" (not a separate copy),
  or access to storage paused. Lowering it frees space at once (`applyOriginalsLimit`), still only for photos storage
  has confirmed. Export is a zip of the Markdown files; with **Include photos** it
  also holds the originals in the storage-folder layout, streamed (photos stored uncompressed), size shown first,
  one year at a time when over the 4 GB a plain zip can hold.
- **Shortcuts:** `n` new entry, `/` or Ctrl+K search, ←/→ previous/next day with entries, `t` jump to the latest entry, Esc clears search.

## Platform plan and data safety

- **Now:** an installable PWA (PROGRESS step 2). Data lives in the browser and, optionally, a storage module.
  - `pwa-manifest.ts` is the web app manifest: standalone display, relative `start_url`/`scope` (so a sub-path host such
    as GitHub Pages works), 192/512 icons plus a maskable one, and a "New entry" shortcut (`./?view=journal`, which
    opens the journal; the capture box autofocuses). `scripts/make-icons.mjs` generates the icons and favicon
    (`npm run icons`); replace the files in `public/` to use other artwork.
  - `vite-plugin-pwa` (`generateSW`, `registerType: 'prompt'`) precaches the whole build, **including the image worker
    chunk**, so the app opens and photos can be attached offline. `components/UpdatePrompt.tsx` registers the worker and
    shows "A new version is ready. Reload": a new version is never applied on its own, so a half-written entry is never
    lost. It also checks for updates hourly (an installed window can stay open for days).
  - The service worker only exists in production builds (`npm run build`, `npm run preview`), not in `npm run dev`.
  - **Next (PROGRESS step 4):** host it on GitHub Pages over HTTPS (required for installing on Android; decided
    2026-11-10). The hosted site is public and contains only the app's code: journal data never leaves the user's browser
    or their own folder. Browser data belongs to the exact address, so the final address is chosen before anyone
    installs. The build is path-independent (relative manifest paths, query-parameter routing), so a sub-path such as
    `/<repo>/` only needs Vite's `base`. `vite.config.ts` reads it from the `BASE_PATH` environment variable
    (`base-path.ts`: unset = `/`; a malformed value fails the build). The planned address is
    `https://jesseracine.github.io/interstitial-diary/` (`BASE_PATH=/interstitial-diary/`); the service worker's scope
    then is that path, and the installed app's data belongs to that origin.
- **Later:** Tauri wraps the same build into a Windows `.exe` and Android `.apk`, built in GitHub Actions so nothing
  extra is installed locally. Native-only features (tray, global hotkey, Android folders) go in as small
  platform-specific pieces or storage modules.
- **Browser data can be wiped** by: clearing site data, uninstalling with "clear data" ticked, Android "Clear storage"
  for Chrome, eviction under low disk (unless persistent storage was granted; the app requests it at startup), or the
  app's address changing. This is why file storage matters. On Android, until pCloud or native exists, the only copy
  is inside the browser. That includes photos, which take far more space (a phone photo is about 4 MB).
- **The app says so** (`lib/dataSafety.ts`): with no storage chosen, or only "Files inside this browser" (same browser
  data, so not a backup), the Settings storage card shows a warning: "Entries are only in this browser", or "Entries and
  photos are only in this browser" with the photo count when the device holds any, suggesting a storage or Export. The
  header badge adds "Photos only in this browser" when storage is off and there are photos. A storage outside the
  browser's data (the folder module) gives no warning.
- **Header badge:** with no storage chosen, "⚠ Only in this browser" appears as soon as there is an entry or photo
  (`showHeaderWarning`). It waits for `StorageState.restored` (the saved storage has been read at startup), otherwise
  folder users would see it flash while the folder is still being opened.
- **Persistent storage:** the app asks the browser to keep its data (`navigator.storage.persist()`) at startup; Settings >
  Data safety shows the answer (`persisted()`): protected, not protected (with "Ask the browser again"), or unknown.
  Browsers decide by themselves (installed apps and regularly used sites usually get it).
- **Backup reminder** (`BackupReminder`; rule in `backupReminderDue`): only when the data is only in the browser (no
  storage, or "Files inside this browser"), there are entries, it is switched on, and it isn't snoozed. No backup yet:
  from 3 days after the oldest entry; after a backup: 14 days after it. A finished export (text or with photos) stores
  `lastBackupAt` in `meta`; "Later" snoozes 7 days (`backupSnoozedUntil`); "Stop reminding me" sets
  `backupReminders: false` (switch in Settings). Never shown with a storage outside the browser, where the files are the
  backup. It is local only (`meta` is not synced).
- **Photo files are never deleted automatically**: not when an entry is deleted, and not when a photo is removed from
  an entry. Local originals are a bounded cache (1 GB unless changed in Settings: 256 MB to 10 GB or no limit, saved
  as `originalsLimit` in `meta`, read by `trimOriginals` each time; an invalid saved value means the 1 GB default, so
  a bad value can never make it drop photos): beyond it, the least recently
  viewed are dropped from the browser, but only ones the active storage has confirmed (`blobs.onRemote`), only while
  that storage is a separate copy (not "Files inside this browser": `StorageBackend.insideBrowser`), and never the
  photo on screen. Choosing another storage resets every `onRemote`, so nothing is dropped until the new one has the
  files. A dropped original is downloaded again when opened. Thumbnails are never dropped. Export with photos only
  includes originals that are on the device at the time (it says how many are left out).
- **Removing photos of deleted entries** (Settings, "Photos of deleted entries"; `storage/cleanup.ts`) is the only way
  photo files are deleted, and only when the user asks and confirms (the dialog gives the count and size and says it
  can't be undone). Rules: a photo is a candidate only if a **deleted entry this device still knows** used it and **no
  live entry uses it** in any year (so an image another device uploaded whose entry hasn't arrived here is never named,
  let alone touched); only the paths those entries imply are removed (`<year>/images/<hash>.<ext>` for their years and
  `.thumbs/<hash>.webp`), after the name is checked against the parser's patterns (and `fs-store` refuses any other
  path). It syncs first and stops if that sync can't complete, so entries from other devices are included; then it runs
  while no sync can (`exclusive` in `manager.ts`), recomputes from the entries as they are then, and only removes
  photos the user was shown that are still unused. The copy on this device goes in one database transaction that
  re-checks the live entries (`removeLocalImagesUnlessUsed`), so a photo saved to an entry meanwhile survives. If a
  file in storage can't be removed, this device's copy is kept and the problem is shown. Removed paths are taken out of
  the per-storage `images:<id>` list, so the same photo attached again later is written to storage again. Text, tombstones
  and the deleted entries themselves are never changed. A storage without `removeBlob` is left alone (only this device
  is cleaned). Other devices keep what they already downloaded.
