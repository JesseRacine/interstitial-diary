# Restaurants: a kind of tag of their own (started 2026-11-23)

_Status: planned, nothing built yet. Four steps, one per turn._

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
