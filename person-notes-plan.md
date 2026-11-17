# Plan: Person notes (facts about a person)

_Status: **planned 2026-11-16; step 1 (the marker and its logic, no UI) built 2026-11-17, committed locally, not pushed.
Steps 2 to 5 not started.** Decisions below were made with the user in conversation on 2026-11-16.
Build one step per turn: finish, test, commit, update PROGRESS.md, then ask before the next step._

## What it is

A **person note** is a fact about someone that is not a journal entry and does not belong to a day: "allergic to
shellfish", "birthday 3 March", "moved to Denver". It sits on the person's page, under their name, until the user edits
or deletes it. It is not part of the journal stream, the calendar or the weekly review.

Decided with the user:

| Question | Decision |
|---|---|
| How is a note written? | A **marker typed in the entry box** and an **Add note button on the person's page** that writes the marker for the user (like Tracking: marker + button) |
| Where does it show? | The **person's page** (a Notes section at the top) and **search**. Not in the journal stream, the calendar, the week review, the Photos view or the Tracking tab |
| Only people? | **People first.** Keep the design open so places could follow (`~blue_door`: "closed Mondays") |

## The key idea: no new storage

As with events and Tracking (DESIGN.md "Events", tracking-plan.md), a note is **an ordinary entry** whose text carries a
marker. Nothing new is stored: no Dexie change, no file-format change, nothing new to sync. Sync, Dropbox, export, soft
delete and Restore (Settings > Deleted entries), editing and search all work as they already do. An older app version
shows a note as an ordinary entry whose text starts with `=@sam ...`, so nothing is lost.

The entry does have a `createdAt` and a day (that is where it is saved: `2026/2026-11-16.md`). The app simply **never
shows the day** of a note and **never counts it** as a day's entry.

## The marker (proposed, confirm while building step 1)

```
=@sam_jones Allergic to shellfish
=@maria Birthday is 3 March. Prefers a call to a text.
```

- **Syntax:** `=` immediately followed by an ordinary person tag (`@sam_jones`), at the **start of the entry's text**
  (leading whitespace allowed). The rest of the text is the note. Anywhere else `=@sam` is plain text, so an ordinary
  entry cannot turn into a note by accident. Why `=`: it is one key on the phone's symbol page and reads as "equals
  fact"; `#`, `@`, `~`, `!` and `+` are taken.
- **One note, one person, one entry.** A note about two people is two notes. Another `@maria` inside the text of a note
  about Sam is an ordinary mention (search finds it); it does **not** put the note on Maria's page.
- **The person is a normal `@` tag.** The `@sam_jones` after the `=` is **not blanked** like an event or tracking
  title: it stays a real tag of the entry, so **Rename** and **Merge** of a person (`replaceTag`) rewrite the note's
  marker for free, and search `@sam_jones` finds the note.
- **Not a tag kind.** The marker is not a new `TAG_KINDS` row: it is about an entry's shape, not a reusable label.
- A note typed by hand in a Markdown file works the same way.

## What the user sees

**Person's page** (`TagPage.tsx`, people only):

```
👤 Sam Jones
12 entries · first 3 Mar · last 9 Nov · written as @sam_jones          (notes are not counted here)

Notes                                                   [ + Add note ]
  • Allergic to shellfish                               [Edit] [Delete]
  • Birthday is 3 March
  ...
[ Search these entries ]   (histogram, timeline as before: journal entries only)
```

- Notes are listed **newest first with no date shown** (the day is not the point). Each has the entry's normal **Edit**
  and **Delete** (soft delete, restorable from Settings > Deleted entries).
- **Add note** opens a small box; Save writes `=@sam_jones <text>` as a new entry.
- A person who has only notes (no journal entry yet) still appears in Tags > People and has a page: "0 entries · 3 notes".

**Entry box:** typing `=@sa` suggests people as `@sa` does. Saving writes the entry as typed; it then leaves the journal
stream (it is a note). The box shows a small hint "Saved as a note for Sam Jones" so the entry's disappearance is not a
surprise.

**Search:** a note is found by its words and by `@sam_jones`; its result card carries a "📝 Note" label and no date line.

## Steps

### 1. The marker and the logic (`src/lib/personNotes.ts`, no UI)

`personNoteOf(text)` (the person key and the note text, or none), `isPersonNote(entry)`, `personNoteText(key, text)` (the
text the Add note button writes), `computePersonNotes(entries)` (notes grouped by person key, newest first). Edge cases
with tests in the style of `tracking.test.ts`: marker at the start, with leading spaces, curly or odd spacing, `=@sam`
mid-text (not a note), `=@` alone, `=@3pm` (not a name), a name with `-` and `/`, two people (only the first is the
person), `x=@sam` (not a note), Rename and Merge rewrite the marker, a round trip through the Markdown file
(`markdown.test.ts`), an older text with no marker unchanged.
**Done when:** the new tests pass and all 620 existing still pass, `npx tsc -b` clean.
_Built 2026-11-17 (`src/lib/personNotes.ts`, 20 tests in `personNotes.test.ts`, 645 in all; tsc clean, lint 0 errors):
marker settled as proposed, `=@name` at the start of the text only (`(=@sam` is plain text). No change was needed in
`entry.ts`: `=` is not in the tag code's "not before" list, so `extractTags` and `replaceTag` already treat the person as
an ordinary tag, and Rename/Merge rewrite the marker. The note's text drops the spaces and **one `:`** after the marker
(`=@sam: likes jazz`). `=@sam` alone is an **empty note** (still a note). The day file trims leading spaces of any entry,
so `  =@sam x` comes back as `=@sam x` (still a note). Functions: `personNoteOf`, `isPersonNote`, `personNoteText` (throws
for a key that is not a person), `computePersonNotes` (a Map by person key, newest first, ties by id, keeps photos)._

### 2. Keep notes out of the journal

In `App.tsx` the one live list `entries` (line 40) feeds everything. Split it: **`journalEntries`** (notes removed) goes to
Journal, Calendar, Week review, Photos, Tracking, the backup reminder and the tag statistics; **`entries`** (all) goes to
search, the people list's notes counts, Settings and export. Check every consumer one by one: a note must not count in
Month, Year or Week counts, "On this day"-style views, the entry total, the histogram, `first`/`last` on a person, or the
Photos view. Search results label a note.
**Done when:** a seeded note appears only in search and in the Settings export; tests for `computeTagStats` and the
week review with a note present; a person with only notes still has a Tags entry.

### 3. The person's page: Notes section and Add note

`TagPage.tsx`: the Notes section, the Add note form (a text box, Save writes `personNoteText`), Edit and Delete on each
note (reuse `EntryItem` or its editor, whichever step 2 of Tracking settled on), the empty state ("No notes yet" with the
Add note button), the people list's "N notes" count. Phone layout checked at 375 px.
**Done when:** with seeded data every button works and syncs as an ordinary edit; Delete removes the note and Restore
brings it back; the journal stream never shows it.

### 4. Typing the marker in the entry box

`@` autocomplete after `=`; the "Saved as a note" hint; a "📝 Note" label in the search results (if not done in step 2).
**Done when:** `=@sa` suggests people; saving a note from the box makes it show on the person's page and not in the
journal.

### 5. Docs, Manual, search help and backup

DESIGN.md (a "Person notes" section next to "Tracking"), the Manual (`ManualCard.tsx`), the `?` search help if `has:note`
is added, PROGRESS.md and docs/HISTORY.md, "Waiting on the user" checks. Then offer a dated backup of both repos.

## Left out on purpose

- Notes for places or plain tags (see "Open decisions": the design is kept open for places).
- Pinning, ordering by hand, categories or a "birthday" field. A note is free text.
- A note about two people at once (write two notes).
- Photos on a note: the Add note form takes text only (an entry written another way may hold photos; the Photos view
  leaves it out).
- Showing the day a note was written (the entry keeps it in its file; the app does not show it).

## Open decisions (small, settled while building)

- The exact marker (`=@name` proposed) and whether `=@` right after another character is accepted (`(=@sam ...)`).
- Whether a note shows on the page of a **second person it mentions** (decided no above; revisit if it feels wrong).
- Whether `has:note` and `note:` belong in search (an `@person` search already finds notes).
- A person with only notes: listed in Tags > People with "0 entries" (proposed) or hidden until they have an entry.
- Notes order: newest first (proposed); no date shown.
