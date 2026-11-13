# Known limitations and ideas backlog

_Reference only: not needed at the start of a session. Read [../PROGRESS.md](../PROGRESS.md) first._

## Known limitations
- Unsaved edits to an existing entry are lost if you scroll far enough that its row leaves the screen (the journal is virtualised).
- Removing an entry from a file by hand doesn't delete it (by design; see DESIGN.md).
- The folder module needs Chrome/Edge on desktop and usually needs "Reconnect folder" after a browser restart.
- On Android there is currently no copy outside the browser (the app warns about this in the header and Settings, and
  reminds you to export every couple of weeks) until a cloud module (Dropbox, then pCloud) works.
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
- People and places: older text that happens to contain `@word` or `~word` (a letter right after the symbol, not glued
  to a word before it) becomes a person or place the first time the new version runs; nothing is changed in the files,
  but it shows in colour, in the Tags view and in search. Edit the text if that is unwanted.
- A person or place name has no spaces (`@sarah_jones`); the app shows the underscore as a space. A tag, person and
  place of the same name (`#sarah`, `@sarah`, `~sarah`) are three different things; rename cannot change a tag's kind.

## Ideas backlog
- Restyle search results to match the chat look (they still use cards).
- Idle nudge ("you haven't logged in 90 minutes").
- Weekly review page: entries per day, top tags, time-of-day patterns.
- Edit an entry's time.
- Incremental search indexing if the journal gets very large.
- GitHub storage module (see [CLOUD-STORAGE.md](CLOUD-STORAGE.md), "Other storage ideas").
- Photos view: filter by tag/date range; jump to the entry from the lightbox.
- Clean up photos removed from live entries (needs a way to know nothing else uses the file).
- People and places, next: on a person's/place's page show who or where they were mentioned together with; suggest a
  place from the device location (asks for permission, privacy-sensitive); turn an old `#sarah` into `@sarah` in one
  go (a "convert to person/place" action); a page for plain tags too (`hasPage` on the `tag` kind); more kinds such as
  projects or moods (one row in `lib/tagKinds.ts`, plus colours and a search-help row).
- Small polish: one ~500 kB JS chunk (Vite warns); code-splitting would shrink the first load.
