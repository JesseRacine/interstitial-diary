# Plan: Notes on people and places

_Status: **planned 2026-11-16; step 1 (the marker and its logic, no UI) built 2026-11-17 and widened to places the same
day; step 2 (notes kept out of the journal) and step 3 (the Notes section and Add note on the page) built 2026-11-17; all
committed locally, not pushed (steps 2 and 3 may now be pushed together, with the user's permission). Steps 4 and 5 not
started.** Decisions below were made with the user in conversation
on 2026-11-16 and 2026-11-17. (The file keeps its old name, `person-notes-plan.md`, so older links still work.)
Build one step per turn: finish, test, commit, update PROGRESS.md, then ask before the next step. **Push steps 2 and 3
together**: after step 2 alone, notes would leave the journal with no page to show them on (search only)._

## What it is

A **note** is a fact about a person or a place that is not a journal entry and does not belong to a day: "Sam is
allergic to shellfish", "Maria's birthday is 3 March", "Blue Door is closed on Mondays". It sits on the person's or
place's page until the user edits or deletes it. It is not part of the journal stream, the calendar or the weekly review.

Decided with the user:

| Question | Decision |
|---|---|
| Who can have notes? | **People and places** (2026-11-17; first planned for people only). **Not events**: an event is a moment, and what you write about it is already the journal. **Not plain `#tags`**: a tag is a label, not a thing with facts of its own |
| How is a note written? | Mainly with a **Note button in the entry box** (a small form: who or where, then the fact), and with **Add note on the person's or place's page**. Both write the marker for the user. Typing the marker by hand also works but is never needed (the user found `=@sam` too much to remember) |
| Where does it show? | The **person's or place's page** (a Notes section at the top) and **search**. Not in the journal stream, the calendar, the week review, the Photos view or the Tracking tab |

## The key idea: no new storage

As with events and Tracking (DESIGN.md "Events", tracking-plan.md), a note is **an ordinary entry** whose text carries a
marker. Nothing new is stored: no Dexie change, no file-format change, nothing new to sync. Sync, Dropbox, export, soft
delete and Restore (Settings > Deleted entries), editing and search all work as they already do. An older app version
shows a note as an ordinary entry whose text starts with `=@sam ...`, so nothing is lost.

The entry does have a `createdAt` and a day (that is where it is saved: `2026/2026-11-16.md`). The app simply **never
shows the day** of a note and **never counts it** as a day's entry.

## The marker (settled in step 1)

```
=@sam_jones Allergic to shellfish
=@maria: Birthday is 3 March. Prefers a call to a text.
=~blue_door Closed on Mondays, ask for the window table
```

- **Syntax:** `=` immediately followed by an ordinary person tag (`@sam_jones`) or place tag (`~blue_door`), at the
  **start of the entry's text** (spaces and line breaks before it are fine). The rest of the text is the note, without the
  spaces and **one `:`** right after the marker. Anywhere else `=@sam` is plain text (also `(=@sam`), so an ordinary entry
  cannot turn into a note by accident. `=@sam` alone is an **empty note** (still a note; the forms never write one). Why
  `=`: one key on the phone's symbol page; `#`, `@`, `~`, `!` and `+` are taken.
- **One note, one person or place, one entry.** A note about two is two notes. Another `@maria` or `~home` inside the text
  is an ordinary mention (search finds it); it does **not** put the note on that page.
- **The name is a normal tag.** It is **not blanked** like an event or tracking title: it stays a real tag of the entry,
  so **Rename** and **Merge** (`replaceTag`) rewrite the marker for free, and search `@sam_jones` finds the note. No
  change to `entry.ts` was needed (`=` is not in the tag code's "not before" list).
- **Not a tag kind.** The marker is not a new `TAG_KINDS` row: it is about an entry's shape, not a reusable label.
  `NOTE_KINDS` in `notes.ts` lists the kinds that can have notes (person, place).
- A note typed by hand in a Markdown file works the same way. The day file trims leading spaces of any entry, so
  `  =@sam x` comes back as `=@sam x` (still a note).

## What the user sees

**Note button in the entry box** (next to Photo and Track; it opens a form the way Track does):

```
 [ 📷 Photo ]  [ 📌 Track ]  [ 📝 Note ]                  [ Save ]

 Note about  [ sa_______________ ]
             ┌───────────────────┐
             │ 👤 Sam Jones       │   ← people and places, as you type
             │ 📍 Salt Bar        │
             └───────────────────┘
┌──────────────────────────────────────────┐
│ Allergic to shellfish                    │
└──────────────────────────────────────────┘
 [ Cancel ]                         [ Save note ]
```

- **Note about:** type part of a name and pick, or Enter for the first suggestion. A new name is allowed and makes a new
  person or place (the field needs a way to say which: a 👤 / 📍 switch, or `@`/`~` typed first; settle while building).
- If the entry box already names exactly one person or place when Note is tapped, the field starts filled with it.
- **Save note** writes `noteText(key, text)` as a new entry. A short message follows: "Saved as a note for Sam Jones ·
  Open" (Open goes to the page), because the journal shows nothing new. An empty fact cannot be saved.

**Person's or place's page** (`TagPage.tsx`):

```
👤 Sam Jones
12 entries · first 3 Mar · last 9 Nov · written as @sam_jones          (notes are not counted here)

Notes                                                   [ + Add note ]
  • Allergic to shellfish                               [Edit] [Delete]
  • Birthday is 3 March
  ...
[ Search these entries ]   (histogram, timeline as before: journal entries only)
```

- Notes are listed **newest first with no date shown**. Each has the entry's normal **Edit** and **Delete** (soft delete,
  restorable from Settings > Deleted entries).
- **Add note** opens the same form as the Note button, with the person or place filled in and fixed.
- A person or place that has only notes (no journal entry yet) still appears in Tags > People / Places and has a page:
  "0 entries · 3 notes".

**Search:** a note is found by its words and by `@sam_jones` / `~blue_door`; its result card carries a "📝 Note" label and
no date line.

## Steps

### 1. The marker and the logic (`src/lib/notes.ts`, no UI) — built

`noteOf(text)` (the key and the note text, or none), `isNote(entry)`, `noteText(key, text)` (what the forms write),
`computeNotes(entries)` (notes grouped by key, newest first), `NOTE_KINDS`, `canHaveNotes(key)`.
_Built 2026-11-17 for people (`personNotes.ts`), widened to places the same day and renamed `notes.ts` (23 tests in
`notes.test.ts`, 648 in all; tsc clean, lint 0 errors). Covered: both kinds, spaces before the marker, name characters and a
trailing `-`/`/`, not-at-start, missing or wrong names (`=@3pm`, `=~5 min`, `=#work`, `=!"…"`, `=+"…"`), the colon, empty
notes, a second mention, Rename and Merge of the note's own and of another name, a person and a place of the same name kept
apart, `noteText` refusing a plain tag, newest-first order with ties by id, photos kept, a Markdown round trip._

### 2. Keep notes out of the journal

In `App.tsx` the one live list `entries` (line 40) feeds everything. Split it: **`journalEntries`** (notes removed) goes to
Journal, Calendar, Week review, Photos, Tracking, the backup reminder and the tag statistics; **`entries`** (all) goes to
search, the Notes counts, Settings and export. Check every consumer one by one: a note must not count in Month, Year or
Week counts, the entry total, the histogram, `first`/`last` on a person or place, or the Photos view. Search results label
a note.
**Done when:** a seeded note appears only in search and in the Settings export; tests for `computeTagStats` and the week
review with a note present; a person or place with only notes still has a Tags entry. **Not pushed on its own** (see top).
_Built 2026-11-17, committed locally, not pushed (652 tests; tsc clean, lint 0 errors). `App.tsx` keeps `entries` (all:
search index and results, tag statistics, backup reminder, Settings/export, the photo viewer) and adds `journal =
journalEntries(entries)` (`lib/notes.ts`) for Journal, Calendar (so Month, Year, Week review and Events), Photos, Tags pages
(so a person's page lists journal entries only: it runs its search over the entries it is given) and Tracking. `TagStat` got
`notes` (note entries that carry the tag, as their own name or a mention); `count`, `first` and `last` count journal entries
only and are 0 when only notes have the tag, which is still listed (so it can be renamed; the rename message counts both).
Tags list shows "—" for Last used and the page leaves out first/last when there are no entries. `EntryItem` shows a note
with a "📝 Note" label instead of its date and time (no "open this day") and hides the When field in its editor. Checked on
localhost with typed test data: the journal and calendar show only the ordinary entry; a search for the person lists the
entry and the notes, the notes labelled; the person's page counts and lists the entry only. Not checked: a person with only
notes in the Tags list (covered by a unit test) and the export (unchanged code path; notes are entries).
Noticed: in search results a note's marker shows as "=👤 Sam Test …" (the `=` stays visible); tidy that in step 3 or 4._

### 3. The page: Notes section and Add note

`TagPage.tsx`, for people and places: the Notes section, Add note (the form from step 4, or a simple text box first if
step 4 is not built yet), Edit and Delete on each note (reuse `EntryItem` or its editor), the empty state ("No notes yet"
with the Add note button), the "N notes" count in Tags > People / Places. Phone layout checked at 375 px.
**Done when:** with seeded data every button works and syncs as an ordinary edit; Delete removes the note and Restore
brings it back; the journal stream never shows it. Then steps 2 and 3 can be pushed together (with permission).
_Built 2026-11-17, committed locally, not pushed (652 tests, no new ones: the logic underneath is tested and the user wants
fewer tests; tsc clean, lint 0 errors). `NotesSection.tsx` on `TagPage` (people and places): heading, **+ Add note** (a
plain text box for now; step 4's form can replace it), notes newest first with no date, the fact only (the marker is never
shown or typed here), mentions inside clickable, a note's photos if it has any, Edit (the fact only; saved as
`noteText(key, fact)` with `updateEntryText`) and Delete (asks, soft delete). Empty state: "No notes yet. A note is a fact
about … that does not belong to a day." The summary line says "· N notes"; the Tags list's Entries column says
"1 · 3 notes" (counted from `computeNotes`, so a name only *mentioned* in someone else's note shows no notes). App computes
`computeNotes(entries)` once and hands it to TagsView. `openPhoto` takes any `{ id }`. In search results a note no longer
shows its `=` (the text is drawn without it). Checked on localhost in the browser: the section and counts, Add note (new
note on top, stored as `=@sam_test Birthday is 3 March`), Edit (stored text rewritten, still `dirty`), Delete (soft delete,
`deleted: 1`), the journal still one entry, the page at 375 px (no sideways scroll). Not checked: Restore from Settings >
Deleted entries (the ordinary code path), a place's page (same component), a note with photos._

### 4. The Note button in the entry box

`Capture.tsx`, in the way the Track form is built: the Note button, the "Note about" field with people-and-places
suggestions (reuse the `@`/`~` autocomplete data), the fact box, Save note, prefill from a single name in the box, the
"Saved as a note for … · Open" message, a way to make a new person or place. Phone layout at 375 px.
**Done when:** a note can be saved for an existing and a new person and place; the text written is `noteText`; it shows on
the page and not in the journal; Cancel leaves the entry box as it was.

### 5. Docs, Manual, search help and backup

DESIGN.md (a "Notes" section next to "Tracking"), the Manual (`ManualCard.tsx`: the Note button first, the marker as an
aside), the `?` search help if `has:note` is added, PROGRESS.md and docs/HISTORY.md, "Waiting on the user" checks. Then
offer a dated backup of both repos.

## Left out on purpose

- Notes on events and on plain `#tags` (see the decisions above).
- Pinning, ordering by hand, categories or a "birthday" field. A note is free text.
- A note about two people or places at once (write two notes).
- Photos on a note: the forms take text only (an entry written another way may hold photos; the Photos view leaves it out).
- Showing the day a note was written (the entry keeps it in its file; the app does not show it).

## Later (ideas, not planned)

- **"Make this a note"** on an existing entry: write naturally ("Sam said he's allergic to shellfish @sam"), then turn the
  entry into a note from its Edit; if it names more than one person or place, pick which.
- A suggestion while typing `=` at the start of the entry box (people and places, like `@`).

## Open decisions (small, settled while building)

- How the Note form makes a **new** person or place (a 👤/📍 switch, or `@`/`~` typed first).
- Whether `has:note` belongs in search (an `@person` or `~place` search already finds notes).
- A person or place with only notes: listed in Tags with "0 entries" (proposed) or hidden until it has an entry.
- Whether a note shows on the page of a **second name it mentions** (decided no; revisit if it feels wrong).
