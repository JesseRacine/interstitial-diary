# Progress and next steps

_Last updated: 2026-11-12. Kept short on purpose: read this file first, and open the `docs/` files only when you need
them (index at the bottom)._

## Where things stand

- **Live and public:** https://jesseracine.github.io/interstitial-diary/ (GitHub Pages). Repo:
  https://github.com/JesseRacine/interstitial-diary (public, branch `main`). Every push to `main` runs the tests and
  redeploys (`.github/workflows/deploy.yml`). The user has installed the hosted app ("installed, works").
- **Built:** journal, search, calendar, tags (+ **people and places**, live 2026-11-12), export, three
  storage modules (folder, browser files, **Dropbox**: live since 2026-11-12, working Windows ↔ Android per the user),
  photos (phases 1–3), installable PWA, data-safety features, hosting, Settings > **Start over** (live 2026-11-12, works
  per the user). 380 tests; `npx tsc -b` clean; lint 0 errors (5 old warnings). `storage/manager.ts` now has tests too
  (`manager.test.ts`, 2026-11-12: a fresh copy per test with fake-indexeddb, a fake page and mocked modules; covers
  the sign-in return, another tab's storage, connect/reconnect/disconnect).
- **Git state:** `main` is usually **ahead of `origin/main` by local docs-only commits that are not pushed.** A push
  publishes the public repo and redeploys the site, so **ask the user before every push**. Check with `git status -sb`.
- **Backup:** a new dated archive was made 2026-11-12 at commit `b19f155` (`archive-2026-11-12/` + zip in the Claude
  session folder, restore tested, 380 tests passed on its copy). The user was also advised to do one Settings > Export
  (a Dropbox sync is not a backup); not confirmed done.
- **Workflow with this user:** one plan step per turn, then ask before the next (CLAUDE.md "How we work").

## Events (`!"Jack's 40th birthday"`): IN PROGRESS, steps 1-4 of 5 built locally 2026-11-13 (not pushed)

Not a tag kind: an event is the unique name of something that happened, so it has its own module and, later, its own
top-level **Events** view (timeline by date and title). Decisions: quoted titles with spaces (straight or curly quotes, up to 120 characters, `!` must
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
- **Next:** 5 docs (DESIGN.md "Events", HISTORY, LIMITS), then ask the user about pushing.

## People and place tags: all 6 steps built, PUSHED and live 2026-11-12 (`cf88bea`, deploy #7 green; live bundle checked)

`#tag`, `@person`, `~place`; names with spaces use `_` (`@sarah_jones` is shown as "Sarah Jones"); `@`/`~` need a letter
first; more kinds later = one row in `src/lib/tagKinds.ts`. Stored keys: `work`, `@sarah`, `~home`. Markdown files are
unchanged; Dexie v3 recalculates tags on each device without marking anything changed. Done: reading (`entry.ts`),
showing/typing (`text.tsx`), search (`query.ts`), Tags / People / Places switch with per-kind rename (`TagsView.tsx`),
a page per person/place (`TagPage.tsx`). Details: DESIGN.md "Tags" and its Tags UI bullet; commits `006db68`..`5bad3f0` in
docs/HISTORY.md. 380 tests, `tsc` clean, lint unchanged; each step was checked in the browser pane (dark, light, 375px).
**Not verified on the user's real data/devices** (see waiting item 12; installed apps update on reload). Left out on purpose (docs/LIMITS-AND-IDEAS.md):
"mentioned together with", place suggestion from location, converting an old `#sarah` into `@sarah`.

## NEXT (after that); nothing else in progress as of 2026-11-12; ask the user which of these

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
