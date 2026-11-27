# Progress and next steps

_Last updated: 2026-11-27 (build 19, live and in both apps: the Manual brought up to date and it scrolls into view when opened; build 17 was Make this a place; apps rebuilt with 19, APK installed on the user's Pixel 9a over adb). Kept short on purpose:
read this file first, and open the other files only when you need them (index at the bottom). When a piece of work is
finished, move its story to [docs/HISTORY.md](docs/HISTORY.md) and keep only one line here._

## Where things stand

- **Web app, live and public:** https://jesseracine.github.io/interstitial-diary/ (GitHub Pages). Repo
  https://github.com/JesseRacine/interstitial-diary (public, branch `main`); every push to `main` runs the tests and
  redeploys. The user has it installed on Windows and Android.
- **Built and live:** journal, search, calendar (Month | Year | Week review | Events), tags + people + places + **restaurants** (`$name`, build 16), events
  (`!"Title"`, own date, search, rename, merge), **Tracking** (`+"Name"`: the Tracking tab, Track button, Star, Done,
  Delete, journal chips; [tracking-plan.md](tracking-plan.md)), **notes on people and places** (📝 Note button, Notes
  on each person's/place's page; [person-notes-plan.md](person-notes-plan.md)), photos (phases 1 to 3, filters), export, three storage
  modules (folder, browser files, **Dropbox**: working Windows ↔ Android per the user), installable PWA, data-safety
  features, Settings (the gear) > Start over, Delete permanently, the Manual, Android quick capture stage 1 (shortcut +
  text share), editing an entry's time, Enter = new line on touch screens, focus stays in the entry box after Save, the
  entry box grows with wrapped lines, `!"` offers the last event's title (build 8), **typing mode on the phone** (header,
  search and date row hide while typing; build 9), **the new-entry box hides while an entry is being edited** (build 10)
  and **a big edit box for an existing entry** (build 11).
  How each was built and checked: docs/HISTORY.md.
- **Build number (from 2026-11-15):** `BUILD_NUMBER` in `src/build.ts`, shown in Settings > About; raise it by 1 before
  every push to `main`. Pushed and live: **19** (2026-11-27, the Manual scrolls to its top when opened; `ba49b36`, deploy run 46036566241 green; the user checked the live site: "looks good"; apps rebuilt: run 46036993738, APK 10,214,079 bytes and `.exe` 6,345,728 copied to `builds\`, the `.exe` started from a scratch copy; the APK installed on the user's Pixel 9a with `adb install -r`; copying the `.exe` to the real Windows copy is the user's). Before: **18** (2026-11-27, the Manual updated; `0828bd2`, deploy run 46034685415 green). Before: **17** (Make this a place, `5d50779`). Before: **16** (2026-11-23, restaurants; `b31c04d`, deploy run 45288158327 green; apps rebuilt: run 45288633402 green, APK 10,193,599 bytes and `.exe` 6,343,680 copied to `builds\`, the `.exe` started from a scratch copy; the user installed and tried it: "it seems to work"). Before: **15** (2026-11-21, photo drops in the Windows app and Back cancelling a question box; `549d372`, deploy run
  44950487049 green; apps rebuilt with it: run 44950568205 green, so the `.disable_drag_drop_handler()` line compiled; the bundled web
  build has the new code, APK 10,193,599 bytes and `.exe` 6,343,680 copied to `builds\`, the `.exe` started from a scratch copy; installing
  them and checks 36 and 38 are the user's). Before: **14** (2026-11-21, the native-shell plan, steps 1 to 4; `4d8f6df`, deploy run 44936471645 green; apps
  rebuilt with it: run 44936547052 green, the bundled web build has the native shell and Text size, APK 10,193,599 bytes and `.exe`
  6,343,168 copied to `builds\`, the `.exe` started from a scratch copy: window "Interstitial Diary", its own `journal-data`; installing
  them is the user's). Before: **13** (2026-11-20, option to hide the time between entries; `08fb921`, deploy run 44679902355; apps
  rebuilt with it: run 44679990189). Before: **12** (2026-11-19, US conventions and the device's clock; `0c6991f`, deploy run 44642065580; apps
  rebuilt with it: run 44642168354; installing the APK is the user's). Before: **11** (bigger edit box; `09d8952`, run
  44631791405, apps run 44631902836). Before: **10** (new-entry box hidden while editing; `8c765e2`,
  run 44629736942, apps run 44629879656). Before: **9** (typing mode, `31031c7`, run
  44588046433, apps run 44588204073; the user installed that APK). Before: **8** (2026-11-18, entry box + last
  event; `f38eefa`, run 44332869492; apps rebuilt with it: run 44374189547, the APK installed by the user). Before that: **7** (2026-11-17, pCloud removed from Settings; `b14e17d`, deploy run
  44216122403 green; Claude's browser pane showed "A new version is ready", Reload, then Settings > About "Build 7" and
  no pCloud option; **apps rebuilt with it**: run 44216731203 green, the bundled web build checked for build 7 and no
pCloud, APK 10,193,599 bytes and `.exe` 6,338,560 copied to the session folder's `builds\`, the `.exe` started from a
scratch copy (window "Interstitial Diary", its own `journal-data`); installing and using them is the user's). Build 6 (2026-11-17, notes; `001ac63`, deploy run 44208677386 green, the live
  site's Settings > About read "Build 6"; the apps are not rebuilt with it). Build 5: (deploy run 43805685363 green, built into the apps in run 43805769633; build 4 was runs 43803994684 and 43804086111, build 3 runs 43776852761 and 43776935182, build 2 runs 43774248654 and 43774335949, build 1 run 43769444518).
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
- **Cheap checks (2026-11-15, build 3, pushed: deploy run 43776852761 green; apps rebuilt in run 43776935182):** a check when the page is shown or hidden now asks
  Dropbox one question ("anything changed since my bookmark?", its change cursor) and stops there if the answer is no and
  nothing is waiting here; any doubt means the full sync as before. Design and limits: DESIGN.md "Cheap checks". Settings
  says "Checking…" when nothing is waiting to be saved. **Not tried against real Dropbox** (tests use the fake): the user
  should confirm that a change made on Windows still shows on the phone after switching back to the app.
- **Native apps: no saved copy (2026-11-15, build 4, pushed: deploy run 43803994684 green; apps rebuilt in run 43804086111, new exe checked from a clean scratch copy: Build 4, no service worker or cache):** found on the user's PC: the Windows exe
  was build 3 but its `journal-data` held an older service worker + cache, which served the old site (a copy of the same
  exe in a folder with no `journal-data` showed build 3; a hard reload (Ctrl+Shift+R) fixed it). Now `src/lib/nativeApp.ts`:
  on `tauri.localhost` the service worker is not registered, and an existing one is removed once at startup (then one
  reload, guarded). Website unchanged. Checked in headless Edge on this PC against `tauri.localhost` with a build 3 saved
  copy: Reload banner path and hard-reload path both end on build 4 with no service worker or cache; a plain address still
  gets its service worker. Android untested here. Build 4 alone still needed one Reload (banner) or hard refresh on an
  app holding an old saved copy: **the user's real Windows copy showed no build number after build 4** (its old copy was
  never replaced; the banner did not show; the earlier Ctrl+Shift+R only skipped it for one load), and the user does not
  want to ever reload the apps (and on Android there is no way to).
- **Build 5 did NOT fix the user's real Windows copy (found 2026-11-15, same night), and why:** with a copy of that
  copy's `Service Worker` folder in a scratch profile, the old worker controlled the window, `registration.update()` failed
  with "unknown error when fetching the script", and a net log showed the update fetch of `https://tauri.localhost/sw.js`
  going to the real network (type "other", `Service-Worker: script`), not through Tauri's custom protocol (page fetches
  do go through it). So **in the Tauri web view a saved copy can never be updated or replaced** (also why the Reload banner
  never showed); the web-side cleanup (`nativeApp.ts`, `sw-native.js`) only helps once the page is not controlled (a hard
  reload) and `sw-native.js` never reaches an old worker. **Real fix, in the app repo (pushed: `a0edce4`, `02187c7`; build
  run 43807025001 green, so the Rust and Kotlin compile; the web build inside it is still build 5, no web change):** Windows `lib.rs` deletes `journal-data\EBWebView\Default\Service Worker` before opening the window;
  Android `MainActivity.kt` deletes `app_webview/Default/Service Worker` once per process before the first web view
  (path unverified; harmless if wrong). **Checked on this PC:** the new exe run against a copy of the user's old `Service
  Worker` folder (30 files) plus a stand-in database folder: no controlling worker, no registration or cache, About shows
  Build 5 straight away with no reload, the stand-in database untouched, the old saved-copy files gone. **The user then
  confirmed the real Windows copy works** (2026-11-16) **and then the Android app** (the `app_webview/Default/Service
  Worker` path was right, or at least the result is: Build 5 with no reload). From here new builds should show on opening
  in both apps without any Reload.
- **Build 5 (pushed: deploy run 43805685363 green; apps rebuilt in run 43805769633; new exe checked from a clean scratch copy: Build 5, no worker or cache; the real Windows copy and Android are the user's to confirm): the old saved copy cleans itself.** `public/sw-native.js` is loaded by sw.js
  (`importScripts`, vite.config.ts; not precached). On `tauri.localhost` / `tauri://` only, the new worker skips waiting,
  clears every cache, unregisters itself and reloads the open window; on the website it does nothing (the Reload banner
  still works there). Checked in headless Edge against `tauri.localhost`: a saved copy from build 3, then build 5 served,
  opened with **no clicks**: ends on Build 5, no worker, no cache, no banner; on a plain address the same upgrade still
  waits for the banner. Unit tests in `src/swNative.test.ts`. Real exe and Android untested.
- **Numbers:** 516 tests (2026-11-27, builds 17 to 19; `npx tsc` clean); 515 tests (2026-11-23, build 16; 507 at build 15); 493 tests (2026-11-21, local, after native-shell step 4); 484 after step 3; 471 after step 1; 459 tests (2026-11-20, build 13; 458 at build 12, 450 at build 11, 448 after the 2026-11-18 test trim); `npx tsc -b` clean; lint 0 errors (5 old warnings).
- **Git state (2026-11-27):** `origin/main` is at `ba49b36` (build 19, deployed, run 46036566241 green; build 18 was `0828bd2`, build 17 `5d50779`, build 16 `b31c04d`); the docs commit after it is local until pushed. Any commit after `ba49b36` is local: check `git status -sb`. Before: `549d372` (build 15, deployed; build 14 was `4d8f6df`, build 13 `08fb921`, build 12 `0c6991f`, build 11 `09d8952`, build 10 `8c765e2`, build 9 `31031c7`). Any commits after it are **local and unpushed** (docs only; `git status -sb` shows how many). A push publishes and redeploys: **ask the user before every push**. Check with `git status -sb`.
- **Backup:** the newest is `Interstitial-Diary-archive-2026-11-19b.zip` in the Claude session folder (no unzipped
  folder, as the user prefers), made 2026-11-19 at **build 12** at the user's request, after the US conventions: **both
  repos** (commit ids and test counts in its `README.md`) **plus the user's uncommitted app-id edits in the app repo as a
  patch** (`history/app-uncommitted-edits.patch`); restore tested (both bundles cloned with matching heads and identical
  files; 458 tests and the type check passed on the web clone; the app clone cannot be built locally). The earlier
  `...-2026-11-19.zip` (build 11, before the US conventions) was **gone from the folder by the end of the session**
  (Claude did not delete it; presumably the user did, they keep only the newest), so this is the only one. The build 7 zip (`...-2026-11-17.zip`) was deleted at the user's request (2026-11-19). All older
  archives, including the one with the personal Gmail address in its history, were deleted at the user's request. The
  zip is on the same disk as the project: the user was advised to copy it elsewhere (not confirmed). Offer a new one
  after the next big change. The user was also advised to do one Settings > Export (a Dropbox sync is not a backup);
  not confirmed.
- **Workflow with this user:** one plan step per turn, then ask before the next (CLAUDE.md "How we work").

## Native apps (second repo `interstitial-diary-app`, started 2026-11-14)

A public repo, https://github.com/JesseRacine/interstitial-diary-app (local: `~/projects/interstitial-diary-app`),
holding only a Tauri 2 shell. Its workflow checks out this repo (ref in its `web.ref`, default `main`), runs the tests,
builds once, then makes the Windows folder and a signed Android APK (about 8 minutes; a `v*` tag makes a Release).
**Nothing can be built locally** (no Rust or Android tools): every try is a push to that repo and a wait. Its
`README.md` explains the rest. `origin/main` there is at `9e0eb90` (2026-11-21: autofill, page zoom and Tauri's file-drop handler off in the Windows window; the Rust compiled, runs 44936547052 and 44950568205 green), nothing unpushed (the user's own uncommitted app-id edits below are not committed). A web-app change reaches the
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
- **Found 2026-11-19 (the user's own edit, confirmed by them; do not rebuild for it yet):** the app repo's working folder
  has **uncommitted edits that change the Android/Windows app id** from `io.github.jesseracine.interstitialdiary` to `net.alpacatech.interstitialdiary`
  (`tauri.conf.json`, `MainActivity.kt`, the README, the Windows read-me). Builds use only what is pushed, so build 9
  kept the old id. Android treats a new id as a different app (a separate install with its own data), so ask the user
  before it is committed or built.
- **Open points for the apps:** Dropbox needs `https://tauri.localhost/` as a redirect URI and the sign-in inside the
  app window is untried (passkeys may not work there); the "install" hints still show inside the apps (the PWA service
  worker no longer runs there since build 4, see "Native apps: no saved copy" above); the share target and the "New entry" shortcut do not exist
  natively; no native widget (quick capture stage 2, android-capture-plan.md).

## What next

**Restaurants are finished (2026-11-23, build 16; the user: "it seems to work"; story in docs/HISTORY.md, plan in [restaurants-plan.md](restaurants-plan.md)).** `$blue_door` is a kind of tag of its own, apart from `~places`: chip, Tags > Restaurants and its page, search, autocomplete, notes (`=$name`), the week review, the Manual; a place's page has **Make this a restaurant** (asks first, rewrites `~name` to `$name` everywhere; never automatic; no reverse button in build 16). **Build 17 (2026-11-27, the user's request; pushed as `5d50779`, deploy run 46033843234 green, the live bundle holds the new Manual text; apps NOT rebuilt yet): a restaurant's page has Make this a place, the reverse; if the other kind has the name the two merge, after a question; 516 tests; checked in the pane only (check 40).** Build 16: pushed (`b31c04d`, deploy run 45288158327 green) and the apps rebuilt (run 45288633402, in `builds\`; the user's uncommitted app-id edits are not in them). Left: nothing to build; check 39 below is recorded as a general OK only.
**Manual update (2026-11-27, builds 18 and 19, the user's request: "review the built in manual", then "fix gaps").** A read of `ManualCard.tsx` against this file found gaps; added: the entry box grows, typing mode and Done typing, quick entry (Android shortcut and Share, Windows taskbar), a new Appearance section (Light/Dark/System, Text size, the gap line; pinch and Ctrl+scroll do not zoom in the apps), a new section on the Windows and Android apps (self-updating, `journal-data`, photo drops, Dropbox to share one journal, build number in About) and Dropbox status text in Your data (photos go before the text, retries, changes show on switching back). **Build 19 fix:** the user saw the Manual "squeezed into a short strip at the bottom": the card is the last one on a long Settings page, so opening it only grew the page below the button. Not reproduced as a layout fault (no fixed height or inner scroll); the fix scrolls the card's top into view on open (`useEffect` + `scrollIntoView` in `ManualCard.tsx`, `scroll-margin-top: 5rem` on `.card.manual` in `index.css` to clear the sticky search bar), checked in the pane; the user then said the live site "looks good". Considered and not done: moving the Manual to the top of Settings or its own tab. The first app rebuild (run 46036993738) had its Android job fail on a Maven Central "429 Too Many Requests"; re-running only the failed job passed (a temporary rate limit, not our code). `adb` is on the user's PC (`D:\scoop\scoop\shims\adb.exe`): the Pixel 9a installs with `adb install -r` from `builds\` (data kept).

**Native apps should not behave like a browser window (started 2026-11-21, the user's request after reviewing a checklist from another project; 4 steps, one per turn).**
**All four steps pushed as build 14 on 2026-11-21 (web repo `4d8f6df`, app repo `bea2367`; the two Rust lines compiled; the apps were
rebuilt and are in `builds\`; installing them and checks 35 to 37 are the user's).** Everything is gated by `isNativeApp()` so the
website and the installed web app are untouched. **Step 1 done:** `src/lib/nativeShell.ts` (wired in `main.tsx`) cancels F5 / Ctrl+R /
Ctrl+Shift+R, Ctrl+F / G / F3 (the browser's find would miss entries the journal does not draw), Ctrl+S, Ctrl+P, Ctrl+U, F7, F12,
Ctrl+Shift+I / C / J, and the right-click menu outside text fields; `html[data-native]` turns off `overscroll-behavior` (no
pull-to-refresh or swipe back). Left alone on purpose: Alt+Left (the photo viewer is a history entry), zoom (step 4), the app's own
Ctrl+K. 471 tests (12 new), type check and lint clean. Checked in the pane by installing it on localhost and sending synthetic
events (all as expected); **not checked: real key presses in the `.exe`, the phone (check 35)**. **Step 2 done:** `autoComplete="off"` on every text box (`src/autofill.test.ts` fails if a new one forgets it; 473 tests), and in the app
repo `lib.rs` `.general_autofill_enabled(false)` on the Windows window (tauri's docs.rs for 2.12.7 list it for Windows; the app repo has no
`Cargo.lock`, so the build takes the newest tauri 2; **it compiled in the build 14 apps run**; it does not cover
password or card autofill, which the app has no fields for). **Step 3 done:** the browser's `confirm` (8
places), `prompt` (2: rename event, rename tag) and `alert` (2) are replaced by the app's own question box on every build
(`lib/dialog.ts` + `components/DialogHost.tsx`, a native `<dialog>`; buttons say "Delete", "Rename", "Merge", "Remove", "Stop saving"; a
destructive one starts on Cancel; Esc cancels; the focus goes back where it was; the page's and the photo viewer's key shortcuts
step aside while one is open). 484 tests (a test fails if a `confirm(`/`prompt(`/`alert(` call comes back). Checked in the pane: delete
(Cancel, Esc, confirm), tag rename (prompt, then confirm, then the entry changed), the empty-name message; **not checked: the phone
(a `<dialog>` on Android WebView), the `.exe`, the photo viewer's "Remove photo" (check 36)**. **Step 4 done:** in the native apps
page zoom is off: Ctrl + `=` `+` `-` `_` `0`, Ctrl+scroll and touchpad pinch (`nativeShell.ts`), touch pinch (`touch-action: pan-x pan-y`
under `html[data-native]`, at zero specificity so the photo viewer's own `touch-action: none` still wins), and in the app repo `lib.rs`
`.zoom_hotkeys_enabled(false)` (docs.rs 2.12.7: on Windows it is WebView2's IsZoomControlEnabled; compiled in the build 14 apps run, but whether it really stops a pinch is unchecked). Replacement for
everyone: **Settings > Appearance > Text size** (Small 90%, Normal, Large 115%, Extra large 135%; per device, `localStorage`
`textSize`, set on the root font size before the first paint; `body` is now `1rem`, not `16px`, so it scales). 493 tests. Checked in the
pane at all four sizes: the journal, entry box and settings reflow with no overlap and the choice survives a reload; **not checked: the
phone, the `.exe`, a long journal at Extra large, the photo viewer's own pinch in the apps (check 37)**. The four steps are done; what is
left is the dropped-photos question below, then pushing and rebuilding. **Android Back button with a question box open (the user on the build 14 APK, 2026-11-21: checks 1 to 5 of the phone list "seem to work";
"I brought up the delete dialog, and went back, and then went back into the app and it stayed open"): Back left the app and the box was
still there. Fixed in build 15 (pushed and rebuilt 2026-11-21; Android itself still to be confirmed by the user):** a question box now has a history entry of its
own while it is on screen, like the photo viewer, so Back answers it as canceled (`connectDialogHistory` in `lib/dialog.ts`, hooked up in
`main.tsx`, every build). The entry copies the state under it, so Back from "Remove photo?" lands on the viewer's own entry and
`App.tsx`'s `popstate` handler keeps the viewer open; a second question asked at once (rename: name, then "Rename in N entries?") waits
for the first entry to be taken off, then gets its own. 507 tests (9 new, with a fake browser history); checked in the pane with the real
history: Back, the Cancel button and the two-question rename all end with the page where it was and no extra history entry;
**not checked: Android itself (check 36 a, b), and "Remove photo?" over the photo viewer in a real browser**. **Dropped photos in the Windows `.exe` (found while on step 2; the user tried it on
build 14 and "nothing happened", 2026-11-21): fixed in build 15 (pushed and rebuilt 2026-11-21; whether a real drop now works in the `.exe` is the user's to confirm, check 38).**
The entry box and the edit box accept photos dropped on them (`useDraftImages.ts` `dropHandlers`), but Tauri's file-drop handler on Windows
takes the files before the page sees them. App repo `lib.rs`: `.disable_drag_drop_handler()` (documented for exactly this; compiled in the build 15 apps run). Web `nativeShell.ts`: with Tauri's handler off a file dropped anywhere else would be opened in place of the app, so a file drag over
a place that is not a drop zone is cancelled with the "not here" pointer, and a zone's own answer is left alone. 497 tests. Checked in the
pane with real DOM drag events: a photo dropped on the entry box becomes a photo in the draft, a drag over the header is refused, dragged
text is untouched; **not checked: a real drop in the `.exe` (check 38)**. **Check first, before the rest: Export and the photo Save button inside the Windows window** (item 25, never
confirmed): they use `showSaveFilePicker` or a browser download, the most browser-like part left.

**Build 13, hide the time between entries (2026-11-20, pushed as `08fb921`, deploy run 44679902355 green; apps rebuilt, run 44679990189 green, copied to `builds\`; the user: "the
feature can be left in but I want to be able to turn it off"; story in docs/HISTORY.md):** the dashed "+3 h 30 min" line
between entries an hour or more apart stays on by default; **Settings > Appearance > "Show the time between entries"**
turns it off, per device (`localStorage` `showGaps`, `lib/prefs.ts`). Checked in the pane only (check 34).

**Build 12, US conventions (2026-11-19, pushed as `0c6991f`, deploy run 44642065580 green; apps rebuilt, run
44642168354 green, copied to `builds\`; the user asked for it: "update everything", including the texts, Manual and
search; story in docs/HISTORY.md):** American spelling everywhere (screen,
code, docs); dates month first ("Thu, Nov 19, 2026"); **times follow the device's 12/24-hour setting** (`lib/clock.ts`),
including the week review's parts of the day and the search chips and help; **weeks start on Sunday**; search accepts
12-hour times (`time:9am-12pm`, `after:5:30pm`) next to 24-hour ones. **Left as it was on purpose:** the saved Markdown
files (`## 09:14`, day-first `#` title). Checked in the pane (en-US) and by 458 tests; **not checked: a 24-hour device,
the native apps, the phone (check 33)**. The user asked (2026-11-19) where the file title is seen: only in the saved
files (Export zip, Dropbox or folder), not in the app; offered to make it month-first too: **the user said keep as is** (2026-11-19).

**Open, not being worked on (the user, 2026-11-19: "we will not deal with it now"):** sometimes the
**Edit button of an older entry has to be pressed twice** before the edit box opens (the user did not say on which
device); they think it may be a glitch. Not investigated, not reproduced. Guesses to test first: (1) on a phone, tapping Edit while the cursor is in the
entry box ends typing mode, so the header comes back and moves the list between the touch and the click (the tap
lands on the wrong spot); (2) the virtualised journal re-measuring its rows after the first tap. Also known: whether it
started with build 9 is not known. Listed in docs/LIMITS-AND-IDEAS.md.

**The user is happy with builds 9, 10 and 11** (2026-11-19: "these changes are much better", "I'm happy with it"). The
three changes of that day, newest first:

**Typing mode on the phone, step 1 of 2, pushed 2026-11-19 as build 9** (`31031c7`, deploy run 44588046433 green; apps
rebuilt: run 44588204073 green, the bundled web build has the typing bar and reads "Build 9", APK 10,193,599 bytes and `.exe`
6,341,120 copied to `builds\`; story in docs/HISTORY.md): with the cursor in the entry box or an edit box on a
phone-sized touch screen, the header, search and date row hide, with a thin "Done typing" bar; checked in Claude's pane
only, the user's phone is untried (check 31). The same push also published the older local docs and test-trim commits. Step 2 (a full-screen writing sheet) only if the user finds
it not enough. **Build 10 (pushed 2026-11-19 as `8c765e2`, deploy run 44629736942 green; apps rebuilt, run 44629879656 green, copied to `builds\`):** the new-entry box hides while
an entry is being edited, phone and PC (one CSS rule; HISTORY.md). **Build 11 (pushed 2026-11-19 as `09d8952`, deploy run
44631791405 green; apps rebuilt, run 44631902836 green, copied to `builds\`):** the edit box for an existing entry is big (full width, at least ~14 lines, grows with the text; HISTORY.md).
HEIC conversion was **dropped** by the user
(2026-11-19, no LGPL library; [heic-plan.md](heic-plan.md), docs/LIMITS-AND-IDEAS.md). **The test-suite trim is finished** (2026-11-18, story in docs/HISTORY.md): 685 → 448 tests,
the ones guarding entries and photos untouched; no app change, commits local (no push needed). **Build 8 is finished** (2026-11-18, story in docs/HISTORY.md): the entry box grows with wrapped
lines, and `!"` offers the last event's title; pushed, the user: "I'm happy with the test"; apps rebuilt, the APK
installed by the user: "seems good" (the Windows `.exe` is in `builds\`, copying it to the real folder is the user's).

**pCloud is stopped** (2026-11-17, the user's decision; story in docs/HISTORY.md, API results in
[pcloud-plan.md](pcloud-plan.md)): a web page can save to pCloud but not read files back. Removed from Settings in
**build 7** (pushed); **the code and its tests were removed 2026-11-18** (test trim step 1; last in `ff75bef`). **If the user picks it up again, they want pCloud's own login (email +
password)**; check first that the read calls accept that token. The user may delete the test folder
`Applications/Interstitial Diary/dev-localhost` on pcloud.com and remove the app's access in pCloud's settings.

**Notes on people and places are finished** (2026-11-16/17, [person-notes-plan.md](person-notes-plan.md);
story in docs/HISTORY.md): built in five steps, tried by the user on localhost ("This works, I like it") and pushed as
**build 6** on the user's request; not yet tried on the user's devices (check 30); the native apps have it since their
build 7 rebuild (the Android app installed with build 8, 2026-11-18). **Tracking is finished** (2026-11-15, [tracking-plan.md](tracking-plan.md)). Ask the user which of these, when
they want:

1. **Try the rebuilt native apps** (check 29). (Rebuilding after any later web change: `gh workflow run 'Build apps'
   --ref main` in `~/projects/interstitial-diary-app`, about 5 minutes, then `gh run download <run id> --dir <an empty
   scratch folder>` and copy into the session folder's `builds\`. Run the download from a script file: quoting a `$` or a
   path through `wsl ... bash -ic "..."` once made it write into a folder named with a space inside the app repo.)
2. **The open details of the portable Windows app** (item 25: Export and Dropbox in the window), if the user wants
   them confirmed.
3. **Tidy the apps:** the "install" hints inside the native apps (the service worker part is done, build 4).
4. **Separate Dropbox app for development** (offered 2026-11-12, "not now"): the dev server shares the real app's
   Dropbox folder, so **never connect Dropbox on localhost**. Plan: docs/CLOUD-STORAGE.md. **It happened on 2026-11-17:**
   localhost in the user's own browser still had an old Dropbox connection, synced with the real folder, met the old
   Start-over marker and cleared only its local copy ("Journal started over"), then downloaded the real entries again; the
   user switched it to browser storage (a disconnect). Nothing in Dropbox was erased (only Settings > Start over can), but
   anything typed there while connected went to the real journal (the user was told to check 17 Nov). Offered a guard
   (localhost refuses Dropbox and drops an old connection): "not now". **Before asking the user to try localhost, have
   them check its badge says "Only in this browser".**
5. **The update-banner test** (step 4.6, skipped on request): make a small visible change, push with permission; the
   installed app should show "A new version is ready" with Reload. Closes older check 7. (The Tracking push on
   2026-11-15 was a chance to see it; the user did not say whether it appeared.)
6. **pCloud** is stopped (see above; a later try would use pCloud's own login). Also: photo sharing into the app, and the ideas in
   docs/LIMITS-AND-IDEAS.md.

## Waiting on the user

Everything below is built and pushed. Until the user reports a check it is **not verified**; general remarks ("it
works") are recorded as said, not as each point confirmed. Before testing a web-app change, reload both devices until
they have the newest version.

**41. The Manual** (builds 18 and 19, pushed and rebuilt 2026-11-27; **the user: the live site "looks good"**; the APK is installed on their phone over adb): the website was checked by the user; still theirs: in the Android app and the Windows `.exe` (copy the new `.exe` over the real one, keep `journal-data`): Settings > Manual > Show scrolls the Manual to the top of the window; the new Appearance and Windows/Android sections read right.
**40. Make this a place** (build 17, pushed 2026-11-27; reload the web app until Settings > About says Build 17): on a restaurant's page tap it: the question names the restaurant and says it is rewritten as `~name`; Cancel changes nothing; confirm and the page of the place opens with its entries and notes; the place's page now offers Make this a restaurant again; if a place of that name already exists the question says so and "Move" merges them with no entry lost; with Dropbox the change shows on the other device.
**39. Restaurants** (build 16, pushed and rebuilt 2026-11-23; **the user: "it seems to work"**, a general OK, not a to h one by one; reload the web app until Settings > About says Build 16): a. write
`Dinner at $blue_door, paid $20`: a 🍽️ chip, and `$20` stays plain text; typing `$bl` suggests known restaurants; b. Tags > Restaurants
lists it and its page opens; c. Note on a restaurant (📝 Note, type `$` first) shows on its page; d. a place you wrote with `~` that is
really a restaurant: its page > Make this a restaurant: it asks, then every entry and note says `$` and the new page opens; the
place is gone from Places; e. with Dropbox the change shows on the other device after its next sync, and the day file reads `$blue_door`;
f. Calendar > Week lists a Restaurants group; g. the Manual (Settings) reads right; h. in the Android app and the Windows `.exe` after the rebuild.
**35. No browser behavior in the apps** (step 1, build 14, pushed and rebuilt 2026-11-21; in the Windows `.exe` and the Android app): Ctrl+F, F5,
Ctrl+R, Ctrl+S, Ctrl+P and F12 do nothing; right-click on an entry shows no menu, but in the entry box it still offers Paste;
a touchpad swipe or a pull at the end of the list does not reload or go back; Ctrl+K and typing work as before; on the
website and the installed web app nothing changed (Ctrl+F still opens the browser's find).
**36. The app's own question boxes** (step 3, build 14, pushed and rebuilt 2026-11-21; website, phone and `.exe` alike): Delete an entry, a note, a tracked item;
Rename a tag, a person, an event (a box with the name, then a second question, and the empty name gives a message); Merge an event;
Settings > the folder "Stop"; in the photo viewer "Remove photo". Each should show a box in the app's look (no "tauri.localhost says"),
Esc and Cancel leave everything as it was, the arrow keys do not change the day behind it, and the photo viewer stays open
behind "Remove photo?". **On Android, with a box open, the Back button cancels the box and stays in the app (build 15; build 14 left the app);**
Back again then behaves as it always did.
**38. Dropping photos in the Windows `.exe`** (build 15, pushed and rebuilt 2026-11-21): drag a photo from File Explorer onto the entry box: "Drop photos to
attach them" shows and the photo joins the entry; the same on an entry being edited; dragging a photo over the header or the list shows the
"not allowed" pointer and dropping it there does nothing (the app is not replaced by the picture). If the app does get replaced, tell
me: the cancel in `nativeShell.ts` is not enough and the Rust line should come out.
**37. Text size and no page zoom** (step 4, build 14, pushed and rebuilt 2026-11-21): Settings > Appearance > Text size: Small, Normal, Large, Extra large
change all text at once, on a long journal too (scroll up and down: no rows overlapping or gaps), and it is still set after closing and
reopening; the other device keeps its own. In the Windows `.exe` and the Android app: Ctrl+scroll, a touchpad pinch, Ctrl and + - 0, and a
two-finger pinch on the page do **not** zoom it (the website still zooms as a browser does); in the photo viewer the +, -, 0 keys, the wheel
and a pinch on the photo still zoom the photo.
**31. Typing mode** (build 9, pushed 2026-11-19; the Android APK and Windows `.exe` are rebuilt with it): on the phone (Android app and the installed web app), tap the entry box: the header, search and date row
should slide away, leaving the title bar with "Done typing", the last entries and the box above the keyboard; a. is
there enough room now, and does the list keep showing the newest entry; b. tap Edit on an entry: the same; c. Photo,
Track and Note still work and the header does not flash back while the photo picker is open; d. Done typing, or Back to
hide the keyboard, brings the header back; e. the search box still works as before.
**34. Hide the time between entries** (build 13, pushed and rebuilt 2026-11-20): in a day with two entries an hour or more apart the
journal shows "+1 h 20 min" between them; Settings > Appearance > "Show the time between entries": untick it and the
line is gone on that device (the Journal, Days and Stream); tick it and it is back; it is still off after closing and
reopening the app; the other device keeps its own choice.

**33. US conventions and the clock** (build 12, pushed and rebuilt 2026-11-19): after installing: a. entry times and the Lightbox/Photos
dates look right for your phone's and PC's 12/24-hour setting (switch the phone's setting and reopen the app: the times
should follow); b. dates read "Thu, Nov 19, 2026", an event's range "Nov 8–10, 2026"; c. Calendar month and Week start on
Sunday; d. Calendar > Week: the Time of day rows show the hours in your clock's style; e. the search quick chips
(Mornings, Evenings ...) work, and typing `time:9am-12pm` and `after:22:00` both work; the `?` help shows the row in
your clock's style; f. the Manual reads right (Settings > Manual).

**32. Editing an old entry** (builds 10 and 11, 2026-11-19; the user said "I'm happy with it" after build 11 was sent; which of a–d they tried one by one is not known): press Edit on
an older entry: the new-entry box disappears (phone and PC), the edit box is full width and at least about 14 lines
(less on a short window), grows as you type, and Save or Cancel (Esc) brings the new-entry box back with any draft
still in it. Open question: Edit sometimes needs two presses (above).

**The user installed the build 9 APK on 2026-11-19 and said "these changes are much better"** (a general OK; a–e were
not reported one by one). Step 2 (a full-screen writing sheet) is therefore not needed for now.

**30. Notes on people and places** (build 6, pushed 2026-11-17; **the user tried it on localhost: "This works, I like
it"**; not yet on the devices): on the phone and on Windows (installed web app, reloaded to Build 6 in Settings > About):
a. 📝 Note in the entry box: pick a person, write a fact, Save: "Saved as a note for … · Open", nothing new in the
journal; b. Open shows it at the top of the person's page; Add note, Edit, Delete there; c. with Dropbox the note shows
on the other device's page (and not in its journal); d. a place note (`~` in front of a new name); e. the Manual's new
"Notes on people and places" section reads well.

**29. The rebuilt apps** (2026-11-15, `builds\`): a. Android: install `Interstitial-Diary-0.1.0.apk` over the old app (it
should keep its data; if Android refuses, say so); the header has the gear and the five tabs on two rows, the Track
button is next to Photo; b. Windows: run the new `Interstitial Diary\Interstitial Diary.exe` (it is a new folder: the old
copy's `journal-data` stays with the old folder, so connect Dropbox again or copy `journal-data` over if you want your
entries); c. in either app try Track, Star, Done, Delete; d. Settings > Export still works in the Windows app (item 25).

**26. Tracking and the new header** (pushed 2026-11-15; **the user confirmed on the phone: the header with the gear, the
Track button, chips, Star, Done, Track again, Delete, Restore, the photo on a card, the one-photo limit, the sort**; the
rest was not asked or reported): the Tracking tab's All view and the item page's Edit; Calendar > Events (Rename, Merge,
chips from the Week review) after the move; `?view=events` and `?view=tracking` bookmarks; the light theme (the amber chip
color); the Manual's new Tracking text and the apostrophe note (see 23); Enter in the Track form's name field on the phone.

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

**18. Merge events:** make a misspelled event (`!"Wekend away"` next to `!"Weekend away"`), open its page, Merge into…
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
7. The update banner: **seen working once, by Claude, 2026-11-17** (build 6 → 7 in its browser pane on the live site:
   "A new version is ready", Reload, Build 7). Not yet seen in the user's installed app.
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
| [docs/CLOUD-STORAGE.md](docs/CLOUD-STORAGE.md) | Dropbox (built) and pCloud (stopped), what the user registers, other storage ideas |
| [docs/LIMITS-AND-IDEAS.md](docs/LIMITS-AND-IDEAS.md) | Known limitations and the ideas backlog |
| [images-plan.md](images-plan.md) | The photo feature's plan and build log |
| [tracking-plan.md](tracking-plan.md) | The Tracking feature: decisions, the marker, the five steps |
| [person-notes-plan.md](person-notes-plan.md) | Notes on people and places (2026-11-16/17): decisions, the `=@name` / `=~name` marker, the Note button, the five steps |
| [restaurants-plan.md](restaurants-plan.md) | Restaurants as their own tag kind (`$name`, 2026-11-23): decisions, the four steps |
| [pcloud-plan.md](pcloud-plan.md) | The pCloud module (stopped 2026-11-17): the plan, what was built, why it stopped (the table of API results), the own-login idea for later |
| [android-capture-plan.md](android-capture-plan.md) | Quick capture on Android: stage 1 built, stage 2 (native widget) not started |
| The app repo's `README.md` | The native apps: how the build works, releasing, the signing key, the Windows folder |
