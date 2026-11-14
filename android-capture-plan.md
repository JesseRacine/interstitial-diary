# Plan: quick capture on Android (widget and friends)

_Status: **stage 1 (the PWA) built 2026-11-14, not yet tried on a phone** (see the build log at the end); stage 2 (native
widget) not started. Written 2026-11-08. Stage 2 depends on Tauri (PROGRESS step 6) for the native parts._

Goal: adding an entry on Android should take one tap from the home screen, then type and save, in about two seconds.
That fits the product principle "Capture in seconds" (DESIGN.md).

## What is possible where

| Option | PWA (installed from Chrome) | Native app (Tauri 2) |
|---|---|---|
| Long-press the app icon → "New entry" | Yes: manifest `shortcuts` (already in the PWA step) | Yes: Android app shortcuts |
| That shortcut dragged onto the home screen as its own icon | Yes (Android lets you pin a shortcut) | Yes |
| Share text or a photo from another app into the diary | Yes: manifest `share_target` | Yes: Android share intent |
| A real home-screen **widget** | **No.** Android doesn't support PWA widgets (the Widgets API only works on Windows, in Edge) | Yes, but only with native Kotlin code (Tauri has no widget support) |
| Quick Settings tile (pull-down shade) | No | Yes, native `TileService` |

_Check these again before building; browser support moves. Last checked from memory on 2026-11-08, not verified online._

**Bottom line:** the PWA can come very close: a pinned "New entry" icon on the home screen, plus sharing into the app.
A true widget needs the native app.

## Stage 1: PWA quick capture (with the PWA/hosting steps)

1. **Open straight to capture.** The app already reads `?view=` (`App.tsx`) and the `n` shortcut focuses the capture box.
   Add `?new=1`: open the journal, focus the capture box, show the Android keyboard. The manifest shortcut
   "New entry" uses `start_url`-relative `/?new=1`.
2. **Fast start.** This is where the speed comes from: the service worker serves the app shell offline, and the
   capture box shows **before** the journal list and search index finish loading (today `App.tsx` loads every entry and
   builds the index first). Measure the cold start on a real phone; aim for typing within about 1 second.
3. **Share target.** `share_target` in the manifest (`method: POST`, `enctype: multipart/form-data`) accepting text,
   URLs and images. The service worker catches the POST and opens `/?new=1` with the capture box pre-filled (and, once
   images exist, photos attached). Text is still required before saving.
4. **Docs:** a "pin New entry to your home screen" tip in Settings (long-press the app icon, drag "New entry").

**Done when:** on an Android phone, tapping the pinned "New entry" icon shows the keyboard in the capture box within
about a second, offline too; sharing text or a photo from another app lands in the capture box.

## Stage 2: native widget (with Tauri, PROGRESS step 6)

**What the user sees:** a small widget (1×1 or 4×1) with a "New entry" button and maybe the time of the last entry.
Tapping it opens a **small pop-up box over the home screen** (a dialog-style Activity) with a text field, keyboard
already open, and Save. Android widgets can't hold a text field themselves, so this pop-up is the standard approach.

**How it saves (the important part).** Two ways, in order:

- **2a. Widget opens the app at `?new=1`.** Simplest: no second way of writing entries. It's only as fast as the app's
  cold start (stage 1, step 2), which may be good enough. Do this first and measure.
- **2b. Native pop-up with an inbox** (only if 2a feels slow). The pop-up writes each entry as its own small file in
  an app-private `inbox/` folder: `<ulid>.md`, in the normal day-file entry format, with an id comment. When the app
  starts or comes to the front, it imports the inbox: add each entry to Dexie (skipped if the id already exists, so a
  repeat import is harmless), then delete the inbox file **only after** the database write succeeded. The entry is
  then synced as usual.
  - It reuses `parseDay` from `markdown.ts`, so there's no new file format. Tests: import is idempotent; a failed
    database write keeps the inbox file; a half-written file is left alone until it parses.
  - The pop-up never touches the journal folder or the database directly, so it can't conflict with sync.

**Building it:** a small Tauri plugin (or edits to the generated `src-tauri/gen/android` project) with Kotlin for the
widget (`AppWidgetProvider`), the pop-up Activity and, optionally, a Quick Settings tile using the same pop-up. Built in
GitHub Actions like the rest of the native build, so nothing new is installed locally.

**Done when:** the widget is on the home screen; tap → type → Save takes about two seconds; the entry shows in the
journal and syncs; it works offline and with the app closed.

## Windows counterpart (for reference)

Already planned: the PWA `shortcuts` entry, and in Tauri a global hotkey plus a tray icon that open the same capture
pop-up. The `?new=1` route and the inbox import serve both platforms.

## Stage 1 build log (2026-11-14)

- **1. Open straight to capture: done.** `src/lib/launch.ts` reads `?new=1` (and the share words below); `App.tsx` opens the
  journal on the entry box (it autofocuses), then removes the words from the address. The manifest shortcut is now
  `./?new=1`; Settings has a short "Quick entry" tip.
- **2. Fast start: measured, nothing changed.** The entry box is the first thing drawn and the post-load work is small:
  20,000 entries took ~60 ms to read (off the main thread), ~80 ms to index (dev build), a few ms for tag stats and events.
  Production build with the service worker: DOMContentLoaded at 21 ms, box present and focused. Not measured on a phone; the
  pane's long-task observer did not work (it missed a task provoked on purpose), so the numbers are component timings.
  If it feels slow on the phone, defer building the search index until it is needed (App.tsx).
- **3. Share target, text only: done as a GET.** `share_target` in the manifest: `action ./?new=1`, `method GET`, params
  `title`, `text`, `url`. A GET needs no service-worker code, which is why it is first; the title, text and link are put on
  separate lines (a piece another contains is dropped) and nothing is saved until the person saves. **Photos are not shared
  in**: that needs `method: POST`, `enctype: multipart/form-data`, a custom service worker (`injectManifest` instead of the
  generated one) that stores the files, and a way to hand them to the entry box; left for a later step because it changes how
  the offline worker is built.
- **4. Docs: done** (Settings tip, DESIGN.md "Quick capture").
- **Not verified (needs the phone):** the pinned icon opens with the keyboard up (Android may not raise it for a script
  focus; the first tap on the box does), the app appears in the Share list (Chrome reads the manifest when the app is
  installed or updated; a reinstall may be needed), and a share works in airplane mode. The pane cannot install an app, open
  the Share sheet or test offline (even a plain reload fails offline there). The service worker's code answers any address
  with the cached app shell, so offline should work.

## Open questions (decide later)

1. Should the widget show anything besides the button, such as the last entry's time or today's count?
2. Should the pop-up offer tags (recent tags as chips) or stay as a single text box? Recommendation: one text box first.
3. Should the pop-up allow attaching a photo (camera)? It depends on the images plan; probably later.
