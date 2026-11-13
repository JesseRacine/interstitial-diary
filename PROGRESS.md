# Progress and next steps

_Last updated: 2026-11-12. Kept short on purpose: read this file first, and open the `docs/` files only when you need
them (index at the bottom)._

## Where things stand

- **Live and public:** https://jesseracine.github.io/interstitial-diary/ (GitHub Pages). Repo:
  https://github.com/JesseRacine/interstitial-diary (public, branch `main`). Every push to `main` runs the tests and
  redeploys (`.github/workflows/deploy.yml`). The user has installed the hosted app ("installed, works").
- **Built:** journal, search, calendar, tags, export, three storage modules (folder, browser files, **Dropbox**: live
  since 2026-11-12, working Windows ↔ Android per the user), photos (phases 1–3), installable PWA, data-safety features,
  hosting, Settings > **Start over** (live 2026-11-12, works per the user).
  355 tests; `npx tsc -b` clean; lint 0 errors (5 old warnings). `storage/manager.ts` now has tests too
  (`manager.test.ts`, 2026-11-12: a fresh copy per test with fake-indexeddb, a fake page and mocked modules; covers
  the sign-in return, another tab's storage, connect/reconnect/disconnect).
- **Git state:** `main` is usually **ahead of `origin/main` by local docs-only commits that are not pushed.** A push
  publishes the public repo and redeploys the site, so **ask the user before every push**. Check with `git status -sb`.
- **Workflow with this user:** one plan step per turn, then ask before the next (CLAUDE.md "How we work").

## IN PROGRESS: people and place tags (plan: `~/.claude/plans/we-are-going-to-agile-riddle.md`, 6 steps)

`#tag`, `@person`, `~place` (names with spaces use `_`; `@`/`~` need a letter first; more kinds later = one row in
`src/lib/tagKinds.ts`). Stored keys: `work`, `@sarah`, `~home` (DESIGN.md "Tags").
- **Step 1 done (2026-11-12, not pushed):** reading the kinds from text (`extractTags`/`replaceTag` in `entry.ts`),
  `tagKinds.ts`, Dexie v3 tag recalculation, 369 tests. Also fixed an old bug: renaming a tag containing `-` threw.
- **Step 2 done (2026-11-12, not pushed):** people/places show as "👤 Sarah Jones" / "📍 Blue Door" (plum / amber, light
  and dark; the typed text is the tooltip); `@` and `~` suggestions list only their own kind (`tagSegments` and
  `tagBeingTyped` in `entry.ts`, `tagLabel` in `tagKinds.ts`); Capture hint; search chips and the Tags view show the
  right labels; Rename is hidden for people/places until step 4. Checked in the browser (dark + light). 372 tests.
- **Next, one per turn:** 3 search (`query.ts`, `SearchBar.tsx` help rows, tests; clicking a name already calls
  `searchTag` with `tagToken`), 4 Tags view split + rename per kind, 5 person/place page, 6 docs and push (ask first).
- Until step 3 ships, clicking a person/place or typing `@sarah` in search does **not** filter yet (the parser reads it
  as a plain word): **don't push before step 3**.

## NEXT (after that); nothing else in progress as of 2026-11-12; ask the user which of these

1. **A new dated backup archive** in the Claude session folder (the current one, 2026-11-10, predates hosting, Dropbox
   and Start over; steps in CLAUDE.md "Where things are").
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
