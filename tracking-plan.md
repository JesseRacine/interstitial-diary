# Plan: Tracking (things to keep an eye on)

_Status: **planned 2026-11-15; step 1 (header) built, pushed and approved by the user the same day; step 2 (the marker
and its list, `lib/tracking.ts`, no UI) built 2026-11-15, committed locally, not pushed; steps 3 to 5 not started.**
Decisions below were made with the user in conversation on that day.
Build one step per turn: finish, test, commit, update PROGRESS.md, then ask before the next step._

## What it is

A light list of things the user might want later but that are not to-do items: a product seen on Amazon (a screenshot
and a line of description), a film that is coming out. The user adds an item with a name, a note and at most one
photo, sees all items on one page, can **star** the important ones, mark them **Done** (bought, watched) and
**Delete** them.

Not a habit tracker (decided: that idea is not wanted). Not a to-do list. Expect 10 to 20 items at most, so there is
**no filter box, no special search and no manual drag-to-reorder** on the page.

## The key idea: no new storage

A tracked item is an ordinary journal entry with a marker in its text, exactly like events (`!"Jack's 40th"`, see
DESIGN.md "Events"). Nothing new is stored: no Dexie change, no file-format change, nothing new to sync. The list of
tracked items is computed from the text of the live entries. So photos, sync, search, export, soft delete and Restore
(Settings > Deleted entries) all work as they already do.

Why not a tag kind (`#`, `@`, `~`)? A tag is a reusable one-word label; a tracked item's name has spaces and is
used once, which is how events behave.

| Wish | How it works |
|---|---|
| Name | The quoted title in the marker |
| Journal entry | The rest of the entry's text |
| Up to 1 photo | The entry's normal photo. The limit of 1 applies **only in the Track form**; the card shows the first photo |
| **Delete** | The existing soft delete. It is the same entry, so **it also disappears from the journal stream** (required by the user) and can be restored from Settings > Deleted entries |
| **Done** | The marker changes (below). The entry stays in the journal as a memory; only its place on the Tracking page changes |
| **Star** | The marker changes (below). Starred active items sit at the top of the list |

## The marker (proposed, confirm while building step 2)

| States | Written in the text |
|---|---|
| Tracking | `+"Dyson V15 vacuum" $450 on Amazon, wait for a sale` |
| Starred | `+*"Dyson V15 vacuum" ...` |
| Done | `+x"Dyson V15 vacuum" (2026-11-20) ...` (the bracketed day is optional; the app adds today's date) |

- **Syntax:** `+`, an optional `*` or `x`, then a straight or curly quote, a title of 1 to 120 characters (no quote
  marks inside, no line break; an apostrophe is fine), a closing quote. The `+` must start the text or follow whitespace
  or `(`/`[`/`{`, so `C++"x"`, `2 + "3"` and an unquoted `+word` are plain text.
- **Done date:** like an event's date: `(YYYY-MM-DD)` right after the marker, real days only. Missing or invalid means "done,
  no date shown".
- **Done clears the star.** "Track again" turns a done item back into a plain `+` item.
- **One item per entry:** an entry counts once, by its first marker. Further markers stay plain text. Two entries with the
  same name are two items (there is no merging of names, unlike events).
- **Not tags:** `extractTags` and `replaceTag` must skip the marker, as they do for events (`blankEvents`), so a `#word` in
  a title is part of the title.
- **Changing the state** (Star, Done, Track again) rewrites the marker in the entry's text: an ordinary edit (`updatedAt`
  bumped, `dirty: 1`), like `renameEvent` in `db.ts`. It syncs like any edit and shows in the Markdown file. The usual
  last-write-wins applies.
- A hand-written marker in the Markdown file works the same way.

## What the user sees

**Header** (after step 1): **Journal · Calendar · Photos · Tags · Tracking** and a **⚙** icon for Settings (next to
the storage badge). Events moves into Calendar as a fourth switch: **Month | Year | Week | Events**.

**Tracking page:**

```
Tracking          [ Active | Done | All ]        Newest ▾

★ ┌─────┐ Dyson V15 vacuum                 (starred: top of the list)
  │photo│ $450 on Amazon, wait for a sale
  └─────┘ 3 Nov
          [ ☆ Unstar ] [ ✓ Done ] [ Delete ]
  ┌─────┐ Dune: Part Three
  │photo│ Dec 18, theaters
  └─────┘ 9 Oct
          [ ★ Star ]   [ ✓ Done ] [ Delete ]
```

- **Active** (default) shows items still being watched: starred ones first, then the rest. **Done** shows finished items with
  their date, newest first, each with **Track again** and **Delete**. **All** shows the active group, then the done group.
- **Sort: Newest first by default** (by the entry's date), with a small Newest / Oldest / A–Z switch like the old Events
  page had. Starred items stay on top in Active whatever the sort. No drag-and-drop ordering: entries have no position
  field and one move would rewrite several entries (and two devices could clash), so that is deliberately not built.
- Tapping the photo opens the lightbox; the card also has **Edit** (the normal entry editor). Delete asks like the journal's
  delete does.
- **In the journal:** an active item has a chip such as "📌 Dyson V15", a starred one "★ Dyson V15", a done one
  "✓ Dyson V15" (chip icons and colour to be chosen while building). Tapping a chip opens the Tracking page.
- **Track button** in the capture box (next to Photo): a small form with a name, a note and an optional single photo; the
  app writes the marker for the user. Typing the marker by hand also works.

## Steps

### 1. Header restructure (no new feature)

Settings becomes a gear icon; Events moves into Calendar as a fourth switch (`CalendarView.tsx`, `EventsView.tsx`, the
`VIEWS` list and `eventId` state in `App.tsx`, `eventNav.ts`). Event chips in the journal and in the Week review must still
open the right event page, now inside Calendar, with the usual Back behaviour. Keep an old `?view=events` address working
(it should open Calendar > Events). Update the Manual (`ManualCard.tsx`), DESIGN.md ("Events view", "Header", "Six header
tabs fit...") and the `max-width: 520px` CSS comment. Check it in the browser at 375 px width.
**Done when:** tests, `npx tsc -b` and lint are clean; the five tabs and the gear fit a 375 px phone; every route to an
event page still works; the user has tried it.

### 2. The marker and the list (`src/lib/tracking.ts`, no UI)

`computeTracking` (items: name, state, done date, entry, first photo), parser and rewriter for the marker, the
state-change function, sorting and grouping (starred first; Newest / Oldest / A–Z). `extractTags` / `replaceTag` skip the
marker. Settle the exact symbols and the edge cases with tests, in the style of `events.test.ts`: all three forms, curly
quotes, bad dates, `C++"x"`, two markers in one entry, a marker inside a `#tag` sentence, a title containing `#word`,
state changes keep the rest of the text byte for byte, and a round trip through the Markdown file (`markdown.test.ts`) keeps
the marker as typed.
**Done when:** the tests above pass and the existing 524 still pass.
_Built 2026-11-15: symbols settled as proposed (`+`, `+*`, `+x`; `+X` also reads as done; the icons `📌 ★ ✓` are in
`TRACKING_ICONS`); the date belongs only to a done marker; `setTracking(id, state)` is in `db.ts`; 44 new tests, 572 in all.
`replaceTag` now skips markers by span (events and tracking together), the same result as before for events alone._

### 3. The Tracking page

New header tab and view (`TrackingView.tsx`, a `trackingRows.ts` if grouping needs one): Active / Done / All, the sort
switch, cards with the first photo (reuse `Thumb`/`Lightbox` as `PhotosView` does), and the Star, Done, Track again,
Edit and Delete buttons. State changes go through `updateEntry`-style edits in `db.ts`. Empty states ("Nothing tracked
yet" with a hint about the Track button). Phone layout checked at 375 px.
**Done when:** with test entries, every button works and syncs as an edit; deleting from the page removes the entry from
the journal and it can be restored from Settings > Deleted entries; a done item keeps showing in the journal.

### 4. Track button and journal chips

The Track form in `Capture.tsx` (name, note, one photo, reusing `useDraftImages` with a limit of 1), and the chips in
journal bubbles (`text.tsx`, `EntryItem.tsx`, in the way event chips are drawn). A chip opens the Tracking page.
**Done when:** an item can be created from the form with and without a photo; the text written is the marker plus the note;
the chip shows in the journal, in search results and in the week review without breaking other chips.

### 5. Docs, Manual and backup

DESIGN.md (a "Tracking" section next to "Events"), the Manual, the `?` help if anything changed, PROGRESS.md and
docs/HISTORY.md; add "Waiting on the user" checks. Then offer a new dated backup archive of both repos.

## Left out on purpose

- Search additions (`has:tracking` etc.): ordinary search already finds the words of a name or note.
- A filter box and manual ordering on the Tracking page (see above); the Star covers "this one matters more".
- Stop tracking (removing the marker but keeping the entry): Done covers it.
- Sharing a screenshot into the app from another Android app: sharing only passes text and links today (photo sharing is on
  the ideas list). Until then a screenshot is added with the Photo button inside the app. A shared page title and link
  already land in the capture box, so they can be turned into an item by hand.
- Habit tracking, reminders and due dates: not wanted.

## Open decisions (small, settled while building)

- Exact marker symbols for starred and done (`+*` and `+x` proposed) and the chip icons and colours.
- Whether Edit on a card opens an inline editor or jumps to the entry in the journal (decide when reading `EntryItem.tsx`).
- Where `eventId` and the Calendar mode live after step 1.
