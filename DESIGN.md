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
config, e.g. a folder handle), `sync:<backendId>` (file revisions from the last sync). The theme and the journal layout (`journalLayout`: `cards` or `stream`) are in `localStorage`.

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

**When sync runs** (`storage/manager.ts`): on startup, ~1.5 s after local changes, when the page is hidden or
shown again, every 5 minutes, and on "Save now".

## Storage modules

```ts
interface FileStore {           // what a module implements
  list(): Promise<{ path: string; rev: string }[]>   // recursive; rev changes when content changes
  read(path): Promise<string | null>
  write(path, content): Promise<string>                // creates folders; returns new rev
  remove(path): Promise<void>
}
interface StorageBackend<Config> { // how the app offers and reopens it
  id, name, description
  unsupportedReason(): string | null
  setup(): Promise<{ config, store, label }>          // interactive, runs in a click handler
  open(config, interactive): Promise<OpenResult>       // reopen from saved config; may need permission
}
```

Paths use `/`. `config` must survive IndexedDB structured cloning (a directory handle is fine; a class instance is not).

| Module | Status | Notes |
|---|---|---|
| `folder`: Folder on this computer | done | File System Access API. Chrome/Edge desktop only. Permission usually has to be re-granted after a browser restart ("Reconnect folder" badge). Choosing a folder inside pCloud Drive/OneDrive/Syncthing gives sync for free. |
| `browser`: Files inside this browser | done | OPFS. Works everywhere incl. Android, but is wiped together with browser data. |
| `pcloud` | planned | See below. |
| `github` | idea | Files in a private repo via the GitHub contents API. |
| native folder (Tauri) | idea | Real folders on Android once there's a native build. |

**Adding a module:** implement `StorageBackend` in `storage/backends/<name>.ts`, register it in `backends/index.ts`
(and remove it from `PLANNED_BACKENDS`), then test it against the sync engine the same way `sync.test.ts` uses
`memoryStore`. Nothing else should need to change.

**pCloud notes** (from a CORS check on 2026-11-08):
- Use the **HTTP API** (`api.pcloud.com` US / `eapi.pcloud.com` EU). It returns `Access-Control-Allow-Origin: *`.
- **WebDAV has no CORS headers**, so browsers can't use it.
- Preflight allows no custom headers, so send the token as the `access_token` parameter, not an `Authorization` header.
- Auth is OAuth2 (token flow). The app must be registered in pCloud's developer console with a redirect URL, which
  means the app needs its hosted address first.
- Useful calls: `listfolder` (recursive, gives `hash`/`modified` for `rev`), `getfilelink` or `file_open/file_read`,
  `uploadfile`, `deletefile`, `createfolderifnotexists`.

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

Date filters intersect. Unknown `key:value` tokens are treated as words. Bad filter values show an error under the
search bar. Results are sorted by relevance when there are keywords, otherwise newest first.

## UI

- **Header:** app name, views (Journal, Calendar, Tags, Settings), storage status badge.
- **Search bar** (always visible): tag autocomplete, chips, saved (★) and recent searches, `?` syntax help.
- **Journal:** a chat. One continuous scroll through all days, oldest at the top and newest at the bottom, with the
  capture bar pinned at the bottom. Entries are left-aligned bubbles (time underneath; Edit/Delete on hover, always
  visible on touch screens). A faint divider shows the gap since the previous entry when it is an hour or more.
  Two layouts, chosen with the **Days / Stream** toggle and remembered: *Days* puts each day in its own box with a date
  header and entry count; *Stream* is one unbroken chat with a thin date divider between days. The header shows the day
  currently at the top; the arrows, date picker and **Latest** button jump between days. Saving an entry scrolls to it.
- **Results:** match count, sort, a histogram of matches over time (click a bar to filter), entries with highlights;
  clicking a date opens that day with a "Back to results" link.
- **Calendar:** month or year heatmap; click a day to open it.
- **Tags:** count and last-used date per tag; rename/merge.
- **Settings:** storage, theme, export (zip of Markdown), shortcuts.
- **Shortcuts:** `n` new entry, `/` or Ctrl+K search, ←/→ previous/next day with entries, `t` jump to the latest entry, Esc clears search.

## Platform plan and data safety

- **Now:** PWA. It installs from Edge/Chrome with its own window and icon and works offline. Install on Android needs
  HTTPS hosting.
- **Later:** Tauri wraps the same build into a Windows `.exe` and Android `.apk`, built in GitHub Actions so nothing
  extra is installed locally. Native-only features (tray, global hotkey, Android folders) go in as small
  platform-specific pieces or storage modules.
- **Browser data can be wiped** by: clearing site data, uninstalling with "clear data" ticked, Android "Clear storage"
  for Chrome, eviction under low disk (unless persistent storage was granted; the app requests it at startup), or the
  app's address changing. This is why file storage matters. On Android, until pCloud or native exists, the only copy
  is inside the browser.
