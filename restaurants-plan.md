# Restaurants: a kind of tag of their own (started 2026-11-23)

_Status: all four steps done (2026-11-23), pushed as build 16 (`b31c04d`, deploy run 45288158327 green); the native apps are not rebuilt yet. Four steps, one per turn._

**Step 4 done:** the week review needed no code (it lists every kind in `TAG_KINDS`); a test now pins "Restaurants" in it
(`weekReview.test.ts`). The Manual (`ManualCard.tsx`: the symbols table, the four-different-tags line, the "Make this a
restaurant" paragraph, notes, week review wording), DESIGN.md (Tags, Notes, search table, Tags tab), CLAUDE.md (intro,
code map, the regex-escaping warning) and `BUILD_NUMBER` = 16 are updated. 515 tests, `tsc` and lint clean. **Not checked:**
the Manual and the week review by eye in the pane, the phone, the apps, Dropbox with a move. The British-spelling scan
in CLAUDE.md prints five old "cancelled" lines (PROGRESS.md, `nativeShell.ts` and its test); not from this work.

**Step 3 done:** a place's page has **Make this a restaurant** (next to "Search these entries"; restaurants and other kinds
do not show it). It asks first with the app's question box ("Make 📍 Blue Door a restaurant? This rewrites ~blue_door as
$blue_door in 2 entries, notes included."; Cancel changes nothing), then rewrites with the existing `renameTag`, which
already swaps symbols across kinds, so no new data code: it leaves `!"event"` and `+"item"` titles alone, skips deleted
entries and longer names (`~blue_door_two`), bumps `updatedAt` and `dirty` so sync carries it, keeps photos, and moves the
place's notes (`=~name` becomes `=$name`). If the restaurant name already exists the box says so and "Move" merges
(no entry is dropped). Afterwards the new restaurant's page opens. 515 tests (1 new in `db.test.ts`, mutation-checked:
without the sync marks or the deleted-entry filter it fails). Checked in the pane (empty `127.0.0.1` journal, cleaned up):
the button, Cancel, confirm, the page, the note, the raw saved text with the event title untouched. **Not checked:** the
merge case in the UI (the data path is the same `renameTag` as a tag merge), Dropbox, the phone and the apps. There is no
reverse button ("Make this a place") yet; say if you want one.

**Step 2 done:** restaurants are in `NOTE_KINDS` (`lib/notes.ts`): `=$blue_door Try the lamb` is a note, kept out of the
journal like the others; the Note form accepts `$name` (suggestions keep to restaurants after a `$`, a bare known name
finds it, a new bare name is still a new person); when two kinds share a name the message names them ("A place and a
restaurant are both called Salt Bar: type ~ or $ in front"). **A trap found on the way:** `notes.ts` put each symbol
into its pattern unescaped, and a bare `$` means "end of text" there, so `=$name` would never have matched; the symbol is
now escaped (mutation-checked: without it 2 new tests fail). 514 tests; `tsc` and lint clean. Checked in the pane (empty
`127.0.0.1` journal, cleaned up): Note about `$blue` offers only the restaurant, the note saved ("Saved as a note for 🍽️
Blue Door · Open"), the restaurant's page shows it under Notes, apart from the place of the same name. **Not checked:** the
phone and the apps; the Manual's wording (step 4).

**Step 1 done:** the `restaurant` row in `TAG_KINDS` (🍽️, olive green `--restaurant` in light and dark), CSS for the chip and
the page heading, the hint line under the entry box, the search-help rows (`$blue_door`, mixing with `|`). Everything
else (parsing, search, counts, autocomplete, Tags tab button and page, rename check) followed from the list. 509 tests
(2 new: the kind itself, and search/counts apart from a place of the same name); `tsc` and lint clean. Checked in the pane
(empty `127.0.0.1` journal, cleaned up after): the chip shows in the restaurant color, `$20` stays plain text, typing
`$bl` offers Blue Door, the Tags tab has "Restaurants 1" and the restaurant's page opens with its entry. **Not checked:**
the phone, the apps, light theme by eye, the Manual (step 4).

## What the user asked for

Places (`~blue_door`) are one kind of tag. Restaurants should be separate from places, with their own symbol, list and
page.

## Decisions (the user, 2026-11-23)

- **Symbol: `$`.** `Lunch at $blue_door` is a restaurant. Like places, the name must start with a letter, so `$5` or
  `$20 lunch` stay plain text. Stored key: `$blue_door` (prefix `$`, the same pattern as `~` and `@`).
- **Old entries:** restaurants already written as `~places` stay places until the user moves them one at a time with a
  button on the place's page ("Make this a restaurant"). Nothing is changed automatically.

## How it fits the code

`src/lib/tagKinds.ts` is built for this: a new kind is one row in `TAG_KINDS` (`id: 'restaurant'`, sigil and prefix `$`,
icon 🍽️, `className: 'tag tag-restaurant'`, `letterFirst: true`, `pretty: true`, `hasPage: true`), a color in
`index.css`, a search-help row and tests (CLAUDE.md rule 11). Reading, search, counts, the Tags tab buttons and the week
review loop over the list, so most of it follows. `$` is already escaped by the regexes in `entry.ts`, `text.tsx` and
`search/engine.ts`; `$` is not in the "may not come before a tag symbol" rule except through the list itself, which is
the wanted behavior (`US$5` and `a$b` are not tags).

## Steps

1. **The kind.** The `TAG_KINDS` row, CSS color, Tags tab "Restaurants" button and page, search (`$blue_door`,
   `-$x`, `$a|~b`), autocomplete when typing `$`, the hint line under the entry box (`$ restaurants`), the search-help
   row, tests (parsing `$5` is not a tag, `US$5`, `$blue_door`, search, counts, rename through `parseTagName`).
   Also check the Markdown file keeps `$` text as typed.
2. **Notes on restaurants.** Add restaurants to `NOTE_KINDS` (`lib/notes.ts`), the Note button's target picker
   (`lib/noteTarget.ts`: `$name` means a restaurant; a name that is both a place and a restaurant needs its symbol), the
   restaurant page's Notes section, tests.
3. **"Make this a restaurant"** on a place's page: rewrites `~name` to `$name` in every entry that has it (and its notes),
   asks first with the app's question box, bumps `updatedAt` and `dirty` so sync carries it (CLAUDE.md rule 5; built the
   way `renameTag` in `lib/db.ts` is), a test that fails if an entry is missed or an `!"event"` title containing `~name`
   is touched. If the restaurant name already exists, it merges, with a warning. Sync-sensitive: mutation-check it.
4. **Wrap-up.** Week review shows top restaurants (it loops over kinds already; check the layout at phone width), Manual
   and DESIGN.md updated, CLAUDE.md rule/code map lines mention `$`, build number 16, then ask before pushing.

## Not decided yet (ask when we get there)

- Whether restaurants should be reachable from the Tags tab's place list too (default: no, a separate button).
