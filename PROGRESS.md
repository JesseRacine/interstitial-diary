# Progress and next steps

_Last updated: 2026-11-15 (Tracking finished, pushed and working on the phone; the native apps rebuilt with it, not yet tried). Kept short on purpose:
read this file first, and open the other files only when you need them (index at the bottom). When a piece of work is
finished, move its story to [docs/HISTORY.md](docs/HISTORY.md) and keep only one line here._

## Where things stand

- **Web app, live and public:** https://jesseracine.github.io/interstitial-diary/ (GitHub Pages). Repo
  https://github.com/JesseRacine/interstitial-diary (public, branch `main`); every push to `main` runs the tests and
  redeploys. The user has it installed on Windows and Android.
- **Built and live:** journal, search, calendar (Month | Year | Week review | Events), tags + people + places, events
  (`!"Title"`, own date, search, rename, merge), **Tracking** (`+"Name"`: the Tracking tab, Track button, Star, Done,
  Delete, journal chips; [tracking-plan.md](tracking-plan.md)), photos (phases 1 to 3, filters), export, three storage
  modules (folder, browser files, **Dropbox**: working Windows ↔ Android per the user), installable PWA, data-safety
  features, Settings (the gear) > Start over, Delete permanently, the Manual, Android quick capture stage 1 (shortcut +
  text share), editing an entry's time, Enter = new line on touch screens, focus stays in the entry box after Save.
  How each was built and checked: docs/HISTORY.md.
- **Build number (from 2026-11-15):** `BUILD_NUMBER` in `src/build.ts`, shown in Settings > About; raise it by 1 before
  every push to `main`. Pushed and live: **2** (deploy run 43774248654 green, built into the apps in run 43774335949; build 1 was run 43769444518).
- **Stuck on "Saving…" (reported 2026-11-15, Android):** cause found by reading the code, **not reproduced and not yet
  confirmed on the phone**: no Dropbox request had a timeout, so one that never answered kept the sync "running" forever
  (every later sync reused it). The user then pressed Stop and chose Dropbox again: still stuck, and **the entry has two
  photos** (photos are sent one by one *before* the text, so a stalled photo upload holds the text back too). Fix in
  build 2 (pushed, deploy run 43774248654 green; apps rebuilt in run 43774335949): **the user then removed the photos from
  the entry and the sync worked, so the photos were what blocked it** (not yet known whether a slow or a stalled upload;
  the new Settings step text will show). `src/storage/backends/timeout.ts` aborts a request after 45 s (2 min + upload time
  for photo calls); a photo timeout ends the photo pass at once (text still saves, "Photos: ... (will retry)", retry after
  20 s); a text timeout gives "Problem saving" and the same retry; the thumbnail worker has a 45 s limit; Settings shows
  what a running sync is doing ("Sending photo file 1 of 2 (4.2 MB)…"), which tells slow from stuck. Ask the user to
  confirm on the phone after the update. Not changed on purpose: photos still go before the text (tested design).
- **Numbers:** 597 tests; `npx tsc -b` clean; lint 0 errors (5 old warnings).
- **Git state (2026-11-15):** `origin/main` is at `eeec68a` (pushed on the user's request and deployed: run
  43761235371 green; it includes the search-help table fix for phones, CSS only in `src/index.css`). Later local commits may be docs-only. A push publishes and redeploys: **ask the user before every push**.
  Check with `git status -sb`.
- **Backup:** the newest dated archive is `archive-2026-11-15/` + zip in the Claude session folder, made 2026-11-15
  (after Tracking): **both repos** (web `65aa322`, app `b22c6d3`), restore tested (both bundles cloned with matching heads
  and files; 580 tests passed on the web clone; the app clone cannot be built locally). Previous: `archive-2026-11-14b/`.
  Offer a new one after the next big change. The user was also advised to do one Settings > Export (a Dropbox sync is not a backup); not confirmed.
- **Workflow with this user:** one plan step per turn, then ask before the next (CLAUDE.md "How we work").

## Native apps (second repo `interstitial-diary-app`, started 2026-11-14)

A public repo, https://github.com/JesseRacine/interstitial-diary-app (local: `~/projects/interstitial-diary-app`),
holding only a Tauri 2 shell. Its workflow checks out this repo (ref in its `web.ref`, default `main`), runs the tests,
builds once, then makes the Windows folder and a signed Android APK (about 8 minutes; a `v*` tag makes a Release).
**Nothing can be built locally** (no Rust or Android tools): every try is a push to that repo and a wait. Its
`README.md` explains the rest. `origin/main` there is at `b22c6d3`, nothing unpushed. A web-app change reaches the
apps only through a new build there (`gh workflow run 'Build apps' --ref main`). **Rebuilt 2026-11-15 on the user's
request, three times (latest: run 43769444518 green, web `main` at `09c1f03`, app repo unchanged at `b22c6d3`): the APK and
portable Windows folder have Tracking, the new header, the search-help phone layout fix and **build number 1 in Settings >
About** and replaced the old ones in `builds\` (APK 10,222,271 bytes, `.exe` 6,320,640; the sizes did not change, but the
hashes did and the built bundle was checked for the change each time). Claude checked only that the new `.exe` starts from a scratch copy (window titled "Interstitial Diary",
`journal-data` created beside it); **installing the APK and using either app is the user's to check** (check 29).
Both builds are version 0.1.0 as before; if Android ever refuses to install over the old app, raise the version (README). App id
`io.github.jesseracine.interstitialdiary`; the app's origin is `https://tauri.localhost/`. The newest builds are copied
to the Claude session folder, `builds\`.

- **Android: working.** Signed with the user's own key (made 2026-11-14 with `scripts/make-android-key.sh`; the key
  file and its password are the user's to keep, never in a repo). Our own `MainActivity.kt` keeps the app clear of the
  status bar, cutout and keyboard. The user installed it: "the app works fine"; after the focus fix: "definitely
  better, more responsive, happy with it".
- **Windows: a portable folder, built 2026-11-14 (`b22c6d3`, run 43654221469 green); the user tried it: "I think
  it's good" (item 25 has what was not confirmed).** No installer (the user asked for none): the `windows-portable` artifact is a folder `Interstitial
  Diary\` with `Interstitial Diary.exe` (6.3 MB) and `Read me.txt`. On Windows `src-tauri/src/lib.rs` opens the window
  itself (`tauri.windows.conf.json` has `"create": false`) with its data in `journal-data` beside the `.exe` (it falls
  back to AppData only if that folder cannot be created). It uses the PC's own WebView2 (not bundled). **Checked by
  Claude on the user's PC:** a scratch copy started, the window opened, `journal-data\EBWebView\` appeared, nothing
  appeared under the app id in `AppData\Local` or `AppData\Roaming`. **Not checked:** writing entries, Dropbox sign-in
  in the window, and Settings > Export. The user accepted a database in `journal-data` instead of readable `.md` files
  **only as long as exporting to Markdown works in the app**, so Export is the important one.
- **Open points for the apps:** Dropbox needs `https://tauri.localhost/` as a redirect URI and the sign-in inside the
  app window is untried (passkeys may not work there); the PWA service worker and "install" hints still run inside the
  apps (probably switch them off with a build flag); the share target and the "New entry" shortcut do not exist
  natively; no native widget (quick capture stage 2, android-capture-plan.md).

## What next

Nothing in progress. **Tracking is finished** (planned 2026-11-15, [tracking-plan.md](tracking-plan.md); story in
docs/HISTORY.md): pushed, and the user confirmed on the phone the header, the Track button, chips, Star, Done, Track
again, Delete, Restore, the photo on a card, the one-photo limit and the sort. Ask the user which of these, when they want:

1. **Try the rebuilt native apps** (check 29). (Rebuilding after any later web change: `gh workflow run 'Build apps'
   --ref main` in `~/projects/interstitial-diary-app`, about 5 minutes, then `gh run download <run id> --dir <an empty
   scratch folder>` and copy into the session folder's `builds\`. Run the download from a script file: quoting a `$` or a
   path through `wsl ... bash -ic "..."` once made it write into a folder named with a space inside the app repo.)
2. **The open details of the portable Windows app** (item 25: Export and Dropbox in the window), if the user wants
   them confirmed.
3. **Tidy the apps:** switch off the PWA service worker and "install" hints inside the native apps (see open points).
4. **Separate Dropbox app for development** (offered 2026-11-12, "not now"): the dev server shares the real app's
   Dropbox folder, so **never connect Dropbox on localhost**. Plan: docs/CLOUD-STORAGE.md.
5. **The update-banner test** (step 4.6, skipped on request): make a small visible change, push with permission; the
   installed app should show "A new version is ready" with Reload. Closes older check 7. (The Tracking push on
   2026-11-15 was a chance to see it; the user did not say whether it appeared.)
6. **pCloud** (on hold: its app approval may be manual; docs/CLOUD-STORAGE.md), photo sharing into the app, ideas in
   docs/LIMITS-AND-IDEAS.md.

## Waiting on the user

Everything below is built and pushed. Until the user reports a check it is **not verified**; general remarks ("it
works") are recorded as said, not as each point confirmed. Before testing a web-app change, reload both devices until
they have the newest version.

**29. The rebuilt apps** (2026-11-15, `builds\`): a. Android: install `Interstitial-Diary-0.1.0.apk` over the old app (it
should keep its data; if Android refuses, say so); the header has the gear and the five tabs on two rows, the Track
button is next to Photo; b. Windows: run the new `Interstitial Diary\Interstitial Diary.exe` (it is a new folder: the old
copy's `journal-data` stays with the old folder, so connect Dropbox again or copy `journal-data` over if you want your
entries); c. in either app try Track, Star, Done, Delete; d. Settings > Export still works in the Windows app (item 25).

**26. Tracking and the new header** (pushed 2026-11-15; **the user confirmed on the phone: the header with the gear, the
Track button, chips, Star, Done, Track again, Delete, Restore, the photo on a card, the one-photo limit, the sort**; the
rest was not asked or reported): the Tracking tab's All view and the item page's Edit; Calendar > Events (Rename, Merge,
chips from the Week review) after the move; `?view=events` and `?view=tracking` bookmarks; the light theme (the amber chip
colour); the Manual's new Tracking text and the apostrophe note (see 23); Enter in the Track form's name field on the phone.

**25. Portable Windows app** (built 2026-11-14; **the user, 2026-11-14: "I think it's good, I tried it earlier"**,
without saying which of a to d were tried, so Export and Dropbox in the window are not individually confirmed): copy `builds\Interstitial Diary\` somewhere, run the `.exe`: a. write
an entry, close, reopen: it is still there; b. Settings > Export: does a Save dialog or download appear and is the
Markdown file written; c. Settings > Dropbox: does the sign-in work inside the window; d. move the whole folder
elsewhere: the journal comes along.

**23. Manual:** Settings (the gear) > Manual > Show the manual: read it; say what is wrong, unclear or missing. (It gained
a Tracking section, the Calendar > Events move and a note that an apostrophe ends a person's name, 2026-11-15.)

**22. Delete permanently:** delete an entry, find it in Settings > Deleted entries, Restore it, delete it again and
Delete permanently; with Dropbox, `Apps/Interstitial Journal/.meta/purged.json` lists its id and on the other device
it vanishes from Deleted entries after its next sync; for a deleted entry with a photo, the photo files leave
`images\` and `.thumbs\`.

**21. Quick capture on Android** (a reinstall of the web app may be needed for the Share list): a. long-press the app
icon: "New entry" is there; tapping it opens the app on the entry box (does the keyboard come up by itself?); b. in
Chrome, Share > Interstitial: a new entry opens with the page title and link in the box; c. the same in airplane mode;
d. reloading afterwards does not bring the shared text back; e. does it start fast enough?

**20. Photo filters:** in the Photos tab tap a chip (a person or tag): only those photos remain and the count reads
"N of M photos"; type `last:3m` or `#trip`; pick a year; "Clear the filter" brings everything back; it looks right on
the phone with real thumbnails.

**19. Event dates:** write `Great night at !"Jack's 40th" (2026-05-12)` in two entries weeks apart: Calendar > Events
lists one event on 12 May 2026 with both; the chip reads "🎉 Jack's 40th · 12 May 2026"; Rename keeps the date; a wrong
date such as `(2026-02-30)` stays plain text.

**18. Merge events:** make a misspelt event (`!"Wekend away"` next to `!"Weekend away"`), open its page, Merge into…
the right one: the entries carry the right title; with Dropbox the change shows on the other device; a merge into an
event more than 7 days away warns first.

**17. Event search:** `event:"<a title>"` finds the entries that name it; `has:event` lists every entry with an
event; "Search this event" on an event's page does the same; the `?` help lists both.

**16. Weekly review:** Calendar > Week with real entries: counts, busiest day and top tags/people/places look right
for a week you remember; ‹ › moves between weeks; tapping a day, tag or event opens it; it reads well on the phone.

**15. Edit an entry's time:** a. Edit an entry, change "When" to an earlier day: Save moves it there; b. with Dropbox
it appears under the new day on the other device, and the old day's file no longer has it (or is gone); c. a time
later today just reorders the day; d. a time in the future is refused.

**14. Enter on the phone:** in the entry box on Android, Enter adds a line and the Save button saves; a two-line entry
shows both lines in the journal and on Dropbox.

**13. Events** (the user tried it on an empty local copy: "it works"; phone and Dropbox not confirmed): a. `Went to
!"Jack's 40th birthday" with @sam` shows a blue chip (straight or curly quotes); b. Calendar > Events lists it, the chip
opens its page, Rename event fixes a typo; c. the header fits the phone (changed 2026-11-15, see 26); d. with Dropbox a renamed event shows
renamed on the other device.

**12. People and places** (the user: "seems to work"; a to c not confirmed one by one): a. on Windows the journal,
search and Tags still work, nothing lost; b. `Lunch with @sarah_jones at ~blue_door` shows "👤 Sarah Jones", "📍 Blue
Door", `@sa` suggests, search finds it, Tags > People opens its page; c. with Dropbox the entry appears on the phone
with the same people/places and the day file holds the text as typed.

**11. Start over with Dropbox, second try** (the user: "I think it works"; not confirmed point by point): with both
devices on the newest version, Start over on one; `Apps/Interstitial Journal/` holds only `.meta/reset.json` and the
other device shows "Journal started over" and is empty after its next sync.

**10. Dropbox real checks** (overall "appears to be working" Windows ↔ Android; a photo on localhost confirmed; the
rest not one by one): a. a new entry appears as `Apps/Interstitial Journal/2026/2026-11-xx.md` within seconds; b. a
photo puts a file in `2026/images/` and `.thumbs/`; c. after closing and reopening, still "Dropbox · Saved" with no
sign-in; d. an edit made to a day file on dropbox.com shows in the app after "Save now"; e. an entry and a photo
written on one device appear on the other, including edits made offline on both.

**Older checks** (need the real Windows folder, a real Save dialog or a second device):
1. Photos reach the real folder (folder module): `<folder>\2026\images\` and `<folder>\.thumbs\` get files.
2. One real export with photos through the Save dialog (Chrome/Edge).
3. The original-cache limit (Settings > Photos on this device): lowering it removes originals only once they are saved
   to the storage, and they download again when opened.
4. "Photos of deleted entries": the files of a deleted entry's photo leave `images\` and `.thumbs\`; a photo still
   used by another entry stays.
5. A photo added on one device shows as a thumbnail on the other within one sync; its original downloads when opened.
6. PWA install in Edge on `localhost:4173`: **confirmed 2026-11-10**, incl. the "New entry" shortcut.
7. The update banner: never seen working (see "What next" 4).
8. Data safety: Settings > Data safety shows the persistent-storage state; a real export sets "Last backup" to today;
   with the folder module there is no "Only in this browser" badge or reminder.
9. The hosted install: "installed, works" (2026-11-12), without saying which of Edge/Android or whether the shortcut
   and airplane mode were tried.

## Where the details are (open only when needed)

| File | What it holds |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Always loaded: commands, code map, rules, gotchas, how we work, how to push |
| [DESIGN.md](DESIGN.md) | The contract: data model, file format, sync rules, storage modules, search syntax, photos, data safety |
| [docs/HISTORY.md](docs/HISTORY.md) | The commit table, and how every finished piece of work was built and checked (look things up, don't read it whole) |
| [docs/CLOUD-STORAGE.md](docs/CLOUD-STORAGE.md) | Dropbox (built) and pCloud (on hold), what the user registers, other storage ideas |
| [docs/LIMITS-AND-IDEAS.md](docs/LIMITS-AND-IDEAS.md) | Known limitations and the ideas backlog |
| [images-plan.md](images-plan.md) | The photo feature's plan and build log |
| [tracking-plan.md](tracking-plan.md) | The Tracking feature: decisions, the marker, the five steps |
| [android-capture-plan.md](android-capture-plan.md) | Quick capture on Android: stage 1 built, stage 2 (native widget) not started |
| The app repo's `README.md` | The native apps: how the build works, releasing, the signing key, the Windows folder |
