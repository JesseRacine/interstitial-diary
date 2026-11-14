# Progress and next steps

_Last updated: 2026-11-13. Kept short on purpose: read this file first, and open the `docs/` files only when you need
them (index at the bottom)._

## Where things stand

- **Live and public:** https://jesseracine.github.io/interstitial-diary/ (GitHub Pages). Repo:
  https://github.com/JesseRacine/interstitial-diary (public, branch `main`). Every push to `main` runs the tests and
  redeploys (`.github/workflows/deploy.yml`). The user has installed the hosted app ("installed, works").
- **Built:** journal, search, calendar, tags (+ **people and places**, live 2026-11-12), **events** (`!"Title"`, an Events
  tab; live 2026-11-13, see its section below), export, three
  storage modules (folder, browser files, **Dropbox**: live since 2026-11-12, working Windows ↔ Android per the user),
  photos (phases 1–3), installable PWA, data-safety features, hosting, Settings > **Start over** (live 2026-11-12, works
  per the user). 504 tests; `npx tsc -b` clean; lint 0 errors (5 old warnings). `storage/manager.ts` now has tests too
  (`manager.test.ts`, 2026-11-12: a fresh copy per test with fake-indexeddb, a fake page and mocked modules; covers
  the sign-in return, another tab's storage, connect/reconnect/disconnect).
- **Git state:** `main` is usually **ahead of `origin/main` by local docs-only commits that are not pushed.** A push
  publishes the public repo and redeploys the site, so **ask the user before every push**. Check with `git status -sb`.
- **Backup:** the newest dated archive was made 2026-11-14 at commit `794873f` (`archive-2026-11-14/` + zip in the Claude
  session folder, restore tested, 504 tests passed on a fresh clone of its bundle): it includes the whole six-item plan (make
  a new one after big changes; offer it). The user was also advised to do one Settings > Export (a Dropbox sync is not a
  backup); not confirmed done.
- **Workflow with this user:** one plan step per turn, then ask before the next (CLAUDE.md "How we work").

## Current plan (agreed 2026-11-13): six improvements, one step per turn, in this order

1. **Enter adds a line on touch screens: built, PUSHED and deployed 2026-11-13** (with step 2, `ad749ae`, deploy green; the
   live bundle was not checked) (`enterAction` in `lib/dom.ts`,
   6 tests; checked in the pane with the phone preset: plain Enter is left to the browser, desktop unchanged). The hint line
   changes on touch. **Not tried on the real phone** (waiting item 14).
2. **Edit an entry's time and date, any date: built, PUSHED and deployed 2026-11-13 (`ad749ae`, deploy green).** A "When" field in the
   entry editor (not in the future). A new backup was made first (`archive-2026-11-13/`, commit 03c54dc, restore tested).
   Because a day change leaves a stale copy in the old day's file, the entry carries a local-only `prevDay` that
   `syncOnce` uses to rewrite that file (DESIGN.md "Editing an entry's time"; `lib/retime.ts`). 434 tests (7 new sync tests,
   mutation-checked, + db and retime tests); checked in the pane, including a real sync to "files inside this browser":
   the moved entry left the old day's file and the other entry stayed. **Not tried on the real Windows folder or with
   Dropbox on two devices** (waiting item 15).
3. **Weekly review inside the Calendar tab (Month | Year | Week): built, PUSHED and deployed 2026-11-14 (with steps 4a to 4c,
   `a65efbc`, deploy green; the live bundle was not checked).**
   `lib/weekReview.ts` + `WeekReview.tsx` (10 tests; 444 total, `tsc` clean, lint unchanged). Checked in the pane with
   seeded weeks (dark and light, 375px, no overflow): the numbers match the data, ‹ › / This week / empty week, a tag chip
   searches, a day bar opens the day, the event link opens the event. Not looked at on the real phone or with real data
   (waiting item 16).
4. **Events/people (4a, 4b, 4c all PUSHED and deployed 2026-11-14, `a65efbc`, deploy green):** **4a `event:` search filter and `has:event`: built 2026-11-13**
   (`search/query.ts` keeps `event:"Title"` together as one token, whole-title match on the markers, plus `-has:event`, a
   "With events" chip, syntax help, and a **Search this event** button on the event page; 459 tests, `tsc` clean, lint
   unchanged; checked in the pane with seeded events; waiting item 17); **4b "Merge into…" on the event page: built 2026-11-13** (pick the right event from a list, nearest in time first; it rewrites the title like Rename, and the
   confirmation warns when the entries are more than 7 days from the target's, so they stay a separate event with the same title;
   464 tests, `tsc` clean, lint unchanged; checked in the pane, near and far cases and at 375px; waiting item 18);
   **4c an event's own date: built 2026-11-13.** The user chose `!"Title" (2026-05-12)`
   (date in brackets, year-month-day only). Same title + date = one event however far apart the entries were written
   (its day is that date); a marker without a date joins the nearest dated event of its title within 7 days; chip shows
   "· 12 May 2026"; Rename/Merge keep the date; search unchanged. 483 tests, `tsc` clean, lint unchanged; checked in the pane
   (waiting item 19).
5. **Photo filters in the Photos tab: built, PUSHED and deployed 2026-11-14 (with step 6, `8cebc29`, deploy green).** A filter box with the search
   syntax (`lib/photoFilter.ts` runs `parseQuery` + `runSearch`, so no second parser), quick chips for the top tags/people/
   places among photos, a year choice, "N of M photos", errors, "No photos match / Clear the filter". 494 tests, `tsc`
   clean, lint unchanged; checked in the pane with seeded photo entries (all, `#trip`, `#trip @sam`, year, event, no match,
   bad word, chips on/off, 375px, no overflow). The grid showed empty tiles because the seeded photos have no files:
   not looked at with real photos (waiting item 20). Not included: jump to the entry from the lightbox.
6. **Quick capture on Android, stage 1 (PWA): built, PUSHED and deployed 2026-11-14 (`8cebc29`, deploy green; live bundle not
   checked)** (all six steps of the plan are now built and live; what remains is the user's device checks, items 14 to 21). `?new=1` (the shortcut) opens the journal on the entry box; Android's Share sheet sends title, text
   and link as a GET (manifest `share_target`) into the box, caret at the end, nothing saved until you save; the address is
   cleaned after reading; a Settings tip explains pinning the icon and sharing. **Startup was measured and left alone**
   (box first, 20,000 entries: ~60 ms read, ~80 ms index; DOMContentLoaded 21 ms with the service worker; details in
   android-capture-plan.md). 504 tests, `tsc` clean, lint unchanged; checked in the pane (dev and production build: manifest
   has the shortcut and share target, share-style address prefills, reload/back start empty, `?view=` still works; the
   hosted sub-path build `/interstitial-diary/`: share action and shortcut resolve inside the scope, prefill works). **Not
   verified:** everything that needs the phone (waiting item 21); the pane cannot test offline navigation at all (even a plain
   reload failed with the server stopped), so offline share rests on reading the service worker's code. Photo sharing is not
   built (needs a POST target and a custom service worker). Stage 2 (native widget) waits for Tauri.
The full plan: the session's plan file; each step ends with tests, a commit and a question before the next.

## Next plan (agreed 2026-11-13): permanent delete, then an in-app Manual

1. **Delete permanently + Deleted entries list: built 2026-11-13, committed locally, NOT pushed.** The user chose: Delete
   stays soft; Settings > **Deleted entries** lists soft-deleted entries with **Restore**, **Delete permanently…** (one,
   confirm) and **Delete all permanently…** (type DELETE FOREVER). Erasing scrubs the row (text/photos/tags gone,
   tombstone kept, local `purged: 1`) and lists its id in the new `.meta/purged.json` so other devices scrub theirs at
   their next sync; the manager syncs first, removes the photos only those entries used (keeps shared ones), then
   scrubs (DESIGN.md "Delete permanently"; `lib/purge.ts`, `purgeDeleted`, `DeletedEntriesCard.tsx`). 522 tests (18 new,
   two safeguards mutation-checked), `tsc` clean, lint unchanged; checked in the pane on an empty local copy (restore,
   erase one, erase-all confirm at 375px, text gone from IndexedDB). **Not tried with Dropbox or two devices** (waiting
   item 22).
2. **Manual (Settings card): not started** (explains tags, formats and search; reuse the `SYNTAX` table, see the plan).

**22. Delete permanently** (once pushed; reload both devices to the new version first): delete an entry, find it in
Settings > Deleted entries, Restore it, delete it again and Delete permanently; with Dropbox its text leaves the day file
(already gone) and `Apps/Interstitial Journal/.meta/purged.json` lists its id; on the other device it vanishes from
Deleted entries after its next sync; a deleted entry with a photo: the photo files leave `images\` and `.thumbs\`.

## Events (`!"Jack's 40th birthday"`): all 5 steps built, PUSHED and live 2026-11-13 (`0995008`, deploy #10 green; live bundle checked)

Not a tag kind: an event is the unique name of something that happened, so it has its own module and its own
top-level **Events** view (timeline by date and title). The user tried it on an empty local copy (no storage connected)
and said **"it works"** (2026-11-13). Decisions: quoted titles with spaces (straight or curly quotes, up to 120 characters, `!` must
follow whitespace/start/an opening bracket), no autocomplete, nothing new stored (the marker stays in the entry text; the
list is computed), same title within 7 days = one event, a longer gap = a new event with the same title (no year in
the title needed).
- **Step 1 done:** `src/lib/events.ts` (`eventSpans`, `eventSegments`, `blankEvents`, `eventKey`, `parseEventTitle`,
  `renameEventInText`, `computeEvents`) + `events.test.ts` (20 tests); `extractTags` and `replaceTag` leave event titles
  alone. 400 tests, `tsc` clean, lint 0 errors (5 old warnings). Nothing visible in the app yet.
- **Step 2 done:** `EntryText` (`text.tsx`) shows a marker as a blue "🎉 Jack's 40th birthday" chip (`--event` colour, light and
  dark; the marker as written is the tooltip); the entry box hint ends with `!"event"`. The chip is **not clickable yet**
  (step 3 makes it open the event). Checked in the browser pane (dark, light, 375px): `#party` inside a title is not in
  Tags, `he said "stop!" and "go"` stays plain. 400 tests, `tsc` clean, lint 0 errors.
- **Step 3 done:** new top-level **Events** tab (after Calendar; the phone nav was tightened so six tabs fit at 375px).
  `EventsView.tsx`: rows by month (date or range, title, entries), filter by title, year select (when more than one
  year), sort Newest / Oldest / A-Z; a row opens the event page (its entries, oldest first). The list logic is in
  `src/lib/eventRows.ts` (+ tests). An event chip anywhere (journal, search, tag pages) opens its event through
  `OpenEventContext` (`components/eventNav.ts`, provided in `App.tsx`, read by `EntryItem`). Checked in the browser pane
  with seeded entries (list, range, same birthday a year apart = two events, chip from the journal opens the right one, filter,
  year, 375px). 407 tests, `tsc` clean, lint 0 errors. The journal list was blank on first load in the emulated phone
  view until scrolled (not looked into; JournalView untouched, probably old).
- **Step 4 done:** a **Rename event** button on the event page (prompt, then a confirm that says how many entries).
  `renameEvent(entryIds, key, newTitle)` in `db.ts` rewrites the markers only in that event's entries (a same-titled event
  months away is untouched), keeps the quote marks the person typed, bumps `updatedAt` and marks them dirty so it syncs;
  `eventAfterRename` (`events.ts`) lets the page follow the event to its new id (it may join a neighbour with the same
  new title). Tests: 2 in `db.test.ts`, 2 in `events.test.ts`; 411 total, `tsc` clean, lint 0 errors. Checked in the
  browser pane (prompt/confirm stubbed): both entries and the page updated, `#trip` untouched.
- **Step 5 done:** DESIGN.md "Events" (+ Events view bullet), docs/HISTORY.md rows, docs/LIMITS-AND-IDEAS.md (limits and
  ideas), CLAUDE.md (code map, six tabs, rule 13: events are not tags).
- **Next:** nothing in progress. **Not verified on the user's real devices** (item 13 below; reload until both devices
  have the new version).

## People and place tags: all 6 steps built, PUSHED and live 2026-11-12 (`cf88bea`, deploy #7 green; live bundle checked)

`#tag`, `@person`, `~place`; names with spaces use `_` (`@sarah_jones` is shown as "Sarah Jones"); `@`/`~` need a letter
first; more kinds later = one row in `src/lib/tagKinds.ts`. Stored keys: `work`, `@sarah`, `~home`. Markdown files are
unchanged; Dexie v3 recalculates tags on each device without marking anything changed. Done: reading (`entry.ts`),
showing/typing (`text.tsx`), search (`query.ts`), Tags / People / Places switch with per-kind rename (`TagsView.tsx`),
a page per person/place (`TagPage.tsx`). Details: DESIGN.md "Tags" and its Tags UI bullet; commits `006db68`..`5bad3f0` in
docs/HISTORY.md. 380 tests, `tsc` clean, lint unchanged; each step was checked in the browser pane (dark, light, 375px).
**Not verified on the user's real data/devices** (see waiting item 12; installed apps update on reload). Left out on purpose (docs/LIMITS-AND-IDEAS.md):
"mentioned together with", place suggestion from location, converting an old `#sarah` into `@sarah`.

## NEXT (after that); nothing else in progress as of 2026-11-13; ask the user which of these

1. **Separate Dropbox app for development** (offered 2026-11-12, user said "not now"): the Dropbox App key is hard-coded
   (`DROPBOX_APP_KEY`) and `http://localhost:5173/` is a registered redirect of the same app, so a dev-server Dropbox
   sign-in writes to the real `Apps/Interstitial Journal/` folder. Plan: the user registers a second app-folder app
   ("Interstitial Journal Dev", redirect `http://localhost:5173/`) and sends only its App key; read the key from
   `import.meta.env.VITE_DROPBOX_APP_KEY` (git-ignored `.env.local`, live build keeps the real key), plus a visible DEV
   badge. Until then: **never connect Dropbox on localhost.**
2. **Step 4.6, the update-banner test** (still open; see below).
3. **pCloud** (step 5, on hold), or **native apps with Tauri** (step 6). Both described below.
4. Confirm the open details of waiting items 10 and 11 if the user wants them recorded as verified.

## Step 5a, Dropbox: built, pushed, and working across devices (user, 2026-11-12)

**Pushed and deployed 2026-11-12** (`22a834c`, deploy succeeded; the live bundle contains the Dropbox sign-in). After
testing Windows ↔ Android on the hosted app the user said it **"appears to be working"**. Which parts were tried (a
photo both ways, the offline edits, staying signed in after a restart) was not reported one by one: ask before
calling those verified.

All five sub-steps are built and committed locally (2026-11-12): 5a.1 sign-in helper (`oauth.ts`), 5a.2 the
`FileStore` (`dropbox-store.ts`, tested against `fake-dropbox.ts`), 5a.3 the module and finishing the sign-in at
startup (`dropbox.ts`, `resume.ts`, `oauthPending.ts`, `manager.ts`), 5a.4 the App key and Settings wording, 5a.5 docs.
How it works and why: DESIGN.md "Dropbox notes"; the build log: [docs/CLOUD-STORAGE.md](docs/CLOUD-STORAGE.md).

- **Confirmed for real (localhost:5173, the user's own browser):** sign-in, token exchange, browser (CORS) calls, the
  `""` root listing; Settings showed "Dropbox · Saved".
- **Still open:** the details of item 10 below that the user hasn't reported individually.
- Testing note: the Claude browser pane can't use Dropbox passkeys; real sign-ins happen in the user's own browser.
- 2026-11-12: the user added two entries (one with a photo) on localhost with Dropbox; the photo showed "Not synced
  yet" because the dev server had stopped (session restart), so the open tab couldn't load the image worker and made
  no thumbnail. After restarting the server, reload + "Save now" rebuilt it from the local original: **the photo shows**.
  Dev-only (the built app precaches the worker). If a photo says "Not synced yet" on the device that added it, check
  the dev server first.

**After Dropbox:** pCloud (step 5, on hold: its app approval may need manual approval; notes in the same doc), then native
apps with Tauri (step 6: Windows `.exe` and Android `.apk` built in GitHub Actions, tray/hotkey, native Android folder;
quick capture on Android is planned in [android-capture-plan.md](android-capture-plan.md)).

**Open, skipped on request: step 4.6, the update-banner test.** Make a small visible change, run the tests, ask before
pushing, push (a second deploy); the installed app should show "A new version is ready" with Reload, and Reload shows the
change. Closes waiting item 7.

## Start over (pushed 2026-11-12, fix `0bea543` pushed too; second real try: user "I think it works")

Settings > **Start over** erases the journal here and in the storage; other devices clear their copy at their next
sync (marker `.meta/reset.json`; rules in DESIGN.md "Start over"). The user chose: other devices clear themselves;
confirm by typing START OVER, with a backup offered.
**First real test failed (2026-11-12):** Start over on the PC worked, but the phone (which got the new version only
afterwards) remembered no marker, kept its copy and uploaded it again, so the PC got the old entries back. **Fix:** a
device that remembers nothing but had synced with the storage before now clears too (regression test reproduces the
phone). It can't help a device still *running* the old version. Recovery for the user: after the fix is pushed, update
both devices, then Start over once more (item 11).

## Waiting on the user

**21. Quick capture on Android** (step 6 above, once pushed; the installed app updates when reloaded, and Chrome reads the
new manifest at its next check, so a reinstall may be needed for the Share list): a. long-press the app icon: "New entry"
is there; drag it to the home screen; tapping it opens the app on the entry box, and say whether the keyboard comes up by
itself; b. in Chrome on any page tap Share > Interstitial: a new entry opens with the page title and link in the box, you
add a note and Save; c. the same in airplane mode; d. reloading the app afterwards does not bring the shared text back;
e. does it start fast enough?

**20. Photo filters** (step 5 above, once pushed): in the Photos tab, tap a chip such as a person or tag: only photos from
entries with it remain and the count reads "N of M photos"; type `last:3m` or `#trip`; pick a year; "Clear the filter"
brings everything back; it looks right on the phone with real thumbnails.

**19. Event dates** (step 4c above, once pushed): write `Great night at !"Jack's 40th" (2026-05-12)` in an entry (and again
in another entry weeks later with the same date): the Events tab lists one event on 12 May 2026 with both entries, and the
chip reads "🎉 Jack's 40th · 12 May 2026"; Rename keeps the `(2026-05-12)`; a wrong date such as `(2026-02-30)` just stays text.

**18. Merge events** (step 4b above, once pushed): make a misspelt event (`!"Wekend away"` next to `!"Weekend away"`), open
its page, Merge into… the right one: the entries now carry the right title and the page shows the joined event; with
Dropbox the change shows on the other device. A merge into an event more than 7 days away says so before it does it.

**17. Event search** (step 4a above, once pushed): search `event:"<one of your event titles>"`: it finds the entries
that name it (not entries that only mention the words); `has:event` lists every entry with an event; on an event's page,
"Search this event" does the same; the `?` help lists both.

**16. Weekly review** (step 3 above, once pushed): Calendar > Week with your real entries: the counts, busiest day and
top tags/people/places look right for a week you remember; ‹ › moves between weeks; tapping a day, a tag or an event
opens it; it reads well on the phone.

**15. Edit an entry's time** (step 2 above, once pushed and both devices have the new version): a. in the journal click
Edit on an entry, change "When" to an earlier day: Save moves it there; b. with Dropbox, the entry appears under the new
day on the other device after its next sync, and in `Apps/Interstitial Journal/` the new day's file has it and the old
day's file no longer does (or is gone if it was the only entry); c. a time later today just reorders the day; d. a time in
the future is refused. Reload both devices until they have the new version before testing (an old version would write
the old day back).

**14. Enter on the phone** (step 1 above, once pushed and the installed app has updated): in the capture box on Android,
Enter adds a line and the Save button saves; the hint under the time says so; a two-line entry shows both lines in the
journal and on Dropbox. Not tried on a real touch device (the pane only emulates one).

**13. Events** (pushed 2026-11-13; the user tried it on an empty local copy with no storage connected and said **"it works"**,
without reporting a-d one by one, and not on the phone or with Dropbox, so those are not confirmed; reload on both
devices until they have the new version): a. write `Went to !"Jack's 40th birthday" with
@sam` (a straight or curly quote from the phone keyboard): shown as a blue "🎉 Jack's 40th birthday" chip; b. the Events
tab lists it by month, the chip opens its page, Rename event fixes a typo; c. the six header tabs fit the phone without
scrolling; d. with Dropbox, a renamed event shows renamed on the other device.

**12. People and places on the real app** (pushed 2026-11-12; the user tested it and said **"seems to work"**, without
reporting a, b and c one by one, so they are not individually confirmed; reload until both devices have the new version):
a. Open the app on Windows: the journal, search and Tags view still work, nothing looks lost (the one-time tag
recalculation ran). Any old text like `@home` or `~word` now shows as a person/place: expected, see limits.
b. Write `Lunch with @sarah_jones at ~blue_door`: shown as "👤 Sarah Jones", "📍 Blue Door"; `@sa` suggests, search
`@sarah_jones` finds it; Tags > People > click it opens its page.
c. With Dropbox: the entry appears on the phone, with the same people/places; the day file in Dropbox has the text as
typed (no format change) and the upgrade itself uploaded nothing.

**11. Start over with Dropbox, second try** (fix pushed 2026-11-12; the user said "I think it works", without
reporting each check below, so not individually confirmed): open the app on both devices and reload until
both have the newest version, then Start over on one; check `Apps/Interstitial Journal/` holds only `.meta/reset.json`, and the other
device shows "Journal started over" and is empty after its next sync.


**10. Dropbox real checks** (asked 2026-11-12; overall "appears to be working" on Windows ↔ Android, 2026-11-12; a
photo on localhost confirmed; the items below not confirmed one by one). In
the user's own browser on `http://localhost:5173/` with Dropbox connected (the dev server must be running):
- a. Add an entry; within a few seconds `Apps/Interstitial Journal/2026/2026-11-xx.md` appears on dropbox.com.
- b. Attach a photo; after the next save `2026/images/` and `.thumbs/` hold a file each.
- c. Close the tab, open the app again: still "Dropbox · Saved" (the refresh token works), no sign-in.
- d. Edit that day's file on dropbox.com (or add a line), then click "Save now": the change shows in the app (download).
Then, after a push the user approves: e. the hosted app on Windows and on Android (Settings > Dropbox on each, each
signs in), an entry and a photo written on one appear on the other, including edits made offline on both.
**Never share the App secret or any token.**

**Older checks** (can only be done on the real Windows folder, a real Save dialog, or a second device; until the user
confirms them they are **not verified**):
1. Photos reach the real folder: with the folder module on `localhost:5173`, attach a photo; check `<folder>\2026\images\`
   and `<folder>\.thumbs\` get files after the next save.
2. One real export with photos through the Save dialog (Chrome/Edge).
3. The original-cache limit (Settings > Photos on this device): lower it; originals leave the browser only once saved to
   the folder, and are downloaded again when opened.
4. "Photos of deleted entries": delete an entry with a photo, run it; its files leave `images\` and `.thumbs\`, a photo
   still used by another entry stays.
5. A real second device: a photo added on one device shows as a thumbnail on the other within one sync, and its original
   downloads when opened (the Dropbox module will make this testable).
6. PWA install in Edge on `localhost:4173`: confirmed (2026-11-10), incl. the jump-list "New entry" shortcut. Lighthouse
   was not reported.
7. The update banner (step 4.6 above): never seen working in a browser.
8. Data safety on the real setup: Settings > Data safety shows the persistent-storage state; one real export changes
   "Last backup" to today; with the folder module no "Only in this browser" badge or reminder, not even briefly.
9. The hosted install: the user said "installed, works" (2026-11-12) without saying which of Edge/Android, or whether
   the shortcut and airplane-mode checks were each tried: **not individually confirmed**. The hosted copy starts with its
   own empty data; on Android entries exist only in that browser until a cloud module works (keep the backup reminder on).

## Where the details are (open only when needed)

| File | What it holds |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Always loaded: commands, code map, rules, gotchas, how we work, how to push |
| [DESIGN.md](DESIGN.md) | The contract: data model, file format, sync rules, storage modules, search syntax, photos, data safety |
| [docs/CLOUD-STORAGE.md](docs/CLOUD-STORAGE.md) | Dropbox (next) and pCloud (on hold) plans, what the user registers, other storage ideas |
| [docs/HISTORY.md](docs/HISTORY.md) | The commit table (what was built when), how steps 1–4 (photos, PWA, data safety, hosting) were done and checked, how to push |
| [docs/LIMITS-AND-IDEAS.md](docs/LIMITS-AND-IDEAS.md) | Known limitations and the ideas backlog |
| [images-plan.md](images-plan.md) | The photo feature's plan and build log |
| [android-capture-plan.md](android-capture-plan.md) | Quick capture on Android (not started) |
