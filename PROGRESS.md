# Progress and next steps

_Last updated: 2026-11-09_

## Done

| Commit | What |
|---|---|
| 3aad18f | Vite + React + TypeScript scaffold in WSL; Dexie, MiniSearch, ulid, Vitest |
| 92f76f8 | Local journal: capture, day timeline, search (full syntax), results histogram, saved/recent searches, calendar heatmap, tags page with rename, settings, export to Markdown zip; Markdown format and merge logic with tests |
| 1e0d668 | Modular storage: sync engine, "Folder on this computer" and "Files inside this browser" modules, auto-sync, status badge |
| 9747fca | Fix: edits made to existing entries directly in the files were overwritten; now they win |
| 05c214a | Chat-style journal: one scrolling chat with the capture bar pinned at the bottom; left-aligned bubbles; two layouts (`Days` = a box per day, `Stream` = one continuous chat), remembered in localStorage; virtualised with `react-virtuoso` so two years (7,300 entries) scroll smoothly (~24 rows in the DOM); jump from calendar/search/date picker; `lib/journalRows.ts` + tests |
| 5d66390 | Images 1.1: `ImageRef` data model, `withDerived` keeps images, Dexie v2 (`thumbs`, `blobs`) |
| 725ab6e | Images 1.2: image lines in day files (backward compatible; hand-written ids unchanged) |
| 82ecaa0 | Images 1.3: sync treats image lines changed by hand as edits |
| d934111 | Images 1.4: hashing, type sniffing, thumbnail worker (EXIF rotation), `attachImage` |
| 8bbe2d7 | Images 1.5: blob methods on `FileStore`; `pushImages` writes originals + thumbnails before day files |
| c7f17cf | Images 1.6: attach photos in the capture box (paste, drop, pick) |
| f1dcd22 | Images 1.7: photos in bubbles, sized before decode; add/remove while editing |
| 0cb6125 | Images 1.8: lightbox (zoom, pan, keys, back button, save, remove) |
| 924391e | Images 1.9: export with photos (streamed zip, per year over 4 GB); then 1.10: docs, phase 1 done |
| 937a468 | Images 2.1: `pullImages` after the text sync: thumbnails to other devices, rebuild missing ones |
| 6e8117c | Images 2.2: originals downloaded when opened; bounded original cache (only safe copies dropped) |
| 811c738 | Images 2.3: "Not synced yet" placeholder for photos the last sync found nowhere |
| 9dadbe1 | Images 2.4: badge shows "N photos waiting" (live); fix: re-attached photo now marked as stored |
| 5a2c729 | Images 2.5: docs (DESIGN.md image sync + storage modules), two-device "done when" test; phase 2 done |
| aba1edd | Images 3.1: `has:image` / `-has:image` search filter, "With photos" chip, help row, DESIGN.md |
| 97b5ff1 | Images 3.2: Photos view (virtualised thumbnail grid by day, tile opens the lightbox, day heading opens the journal) |
| 5e3ccbe | Images 3.3: "Photos on this device" card in Settings (space used, browser estimate, adjustable original-cache limit) |
| 4e9a162 | Images 3.4: "Remove photos of deleted entries" (confirmed, sync-first cleanup; `storage/cleanup.ts`, `removeBlob` on stores) |
| 85df32f | Images 3.5: "only in this browser" warning with photo wording (Settings box, header badge); phase 3 done |
| f4ef4d9 | Documentation pass: CLAUDE.md rewritten (full code map, rules, testing, gotchas, workflow), PROGRESS/DESIGN/images-plan tidied. Backed up to the Windows project folder (`archive/` + zip, snapshot of this commit) |

| afa7135 | PWA 2: installable PWA: manifest + generated icons + "New entry" shortcut, `vite-plugin-pwa` precaching the whole build (image worker included), update banner, theme-color/apple-touch-icon; 6 new tests |

| daa2fb8 | Data safety 3: Settings "Data safety" card (persistent-storage state, last backup, reminder switch), header badge for entries-only users, backup reminder, `restored` startup flag; 18 new tests |

| f3c682f | Docs: handoff for step 4 (GitHub Pages): open decisions, user tasks, pre-publish cleanup, checklist |

| d1594c0 | Step 4.1: pre-publish cleanup: personal paths/email removed from the docs; whole history rewritten to the GitHub noreply identity (and old doc versions scrubbed); branch renamed `master` to `main` |

| 8ec4067 | Step 4.1b: deleted the superseded `junior-plan.md` |

| 88d19ea | Docs: record the new archive (step 4.1 finished) |

| ec9e90a | Step 4.2: base path: Vite `base` from the `BASE_PATH` variable (`base-path.ts`, `normaliseBase`, 5 new tests); checked on a build under `/interstitial-diary/`; `dist-sub` git-ignored |

| b8df143 | Step 4.3: GitHub Pages deploy workflow `.github/workflows/deploy.yml` (tests, build with `BASE_PATH`, deploy); 5 new tests |

| 6e90356 | Step 4.4/4.5: repo published, site live at https://jesseracine.github.io/interstitial-diary/ (first deploy green; hosted site checked read-only in the Browser pane); docs |

| (this commit) | Docs: hosted install confirmed by the user; second deploy green |

**All hashes above, except f3c682f and the ones after it, are from before the 2026-11-10 history rewrite** (author change plus a scrub of
old doc text); the same commits now have different hashes. Match them by subject (`git log --oneline`). The pre-rewrite
history is only in the local backup bundle `~/interstitial-diary-pre-rewrite.bundle` (outside the repo, private; it still
holds the old identity, so never push or share it) and in the older Windows-folder archive of f4ef4d9.

282 tests pass (`npm test`); `npx tsc -b` is clean; lint has 0 errors (5 old warnings, none in recent work).

## Waiting on the user

Things that can only be checked on the real Windows folder, a real export dialog, or a second device (the folder picker
and Save dialog can't be driven from the Browser pane). Until confirmed they are **not verified**:

1. **Photos reach the real folder.** On `localhost:5173` with the folder module, attach a photo and check that
   `<folder>\2026\images\` and `<folder>\.thumbs\` get the files after the next save.
2. **One real export with photos** through the Save dialog (Chrome/Edge).
3. **The original-cache limit** (Settings > Photos on this device): lower it and check that originals leave the browser
   only once they are saved to the folder (and are downloaded again when opened).
4. **"Photos of deleted entries"** (same card): delete an entry that has a photo, run it, and check the files leave
   `<folder>\<year>\images\` and `.thumbs\`, and that a photo still used by another entry stays.
5. **A real second device** (needs hosting, or a shared folder such as pCloud Drive between two browsers): a photo added
   on one device shows as a thumbnail on the other within one sync, and its original downloads when opened.
6. **PWA install in Edge: confirmed working by the user (2026-11-10)** on `localhost:4173` (`npm run build && npm run
   preview`), and the jump-list "New entry" shortcut works. Not reported, so unchecked: Lighthouse (recent Lighthouse
   versions have no separate PWA score; DevTools > Application > Manifest shows installability instead).
   Note: an install from `localhost:<port>` is tied to that address and its own empty data; the real install comes after
   hosting (step 4).
7. **The update banner.** Install, then change something and rebuild: the open app should show "A new version is ready"
   with Reload/Later. (The banner code is untested in the browser: it needs two builds in a row.)
8. **Data safety on your real setup.** In the installed Edge app, open Settings > Data safety: it should say whether the
   browser granted persistent storage (installing usually gets it granted). Do one real export (Settings > Your data)
   and check "Last backup" changes to today. With the folder module connected, no "Only in this browser" badge or
   backup reminder should appear, not even for a moment after opening the app.
9. **Install the hosted app: user reported "installed, works" (2026-11-12).** They did not say which of Edge/Android, or
   whether the shortcut and airplane-mode checks were each tried, so those are **not individually confirmed**; ask again
   if it matters. Original instructions: in Edge on Windows and Chrome on Android, open
   https://jesseracine.github.io/interstitial-diary/ and install it (Edge: the install icon in the address bar or
   Settings > Apps; Chrome on Android: menu > Install app). Check that it opens in its own window, that the long-press
   "New entry" shortcut works, and that it opens with no network (turn on airplane mode after the first open). It starts
   with its own **empty** data, separate from the `localhost:4173` test install: use Export/Import-by-folder if you want
   your entries there. On Android, entries exist only in that browser until pCloud (step 5): keep the backup reminder on.

## Next steps (in order)

### 1. Images in entries: phases 1–3 done; phase 4 comes with pCloud
- Planned in [images-plan.md](images-plan.md), which also holds the build log (what each step decided and how it was
  checked). The design is in DESIGN.md ("Photos", "Images in a sync run", "Platform plan and data safety").
- **Phase 1 (2026-11-09):** attach (paste, drop, pick), show in bubbles, open full size, export with photos, originals
  written to the storage folder.
- **Phase 2 (2026-11-09):** images on other devices: thumbnails arrive with the entry (or are rebuilt), originals
  download when opened (hash-checked, bounded cache), "Not synced yet" placeholder, "N photos waiting" in the badge.
- **Phase 3 (2026-11-09):** `has:image` search, a Photos tab, photo storage + cache limit in Settings, a confirmed
  cleanup of photos of deleted entries, and the "only in this browser" warning with photo wording.
- **Phase 4:** images on pCloud. Implement `readBlob`/`writeBlob`/`hasBlob`/`removeBlob` in the pCloud module (step 5).

### 2. Installable PWA: done (2026-11-10); user confirmed install works in Edge
- `pwa-manifest.ts` (name, short name "Interstitial", standalone, relative `start_url`/`scope`, icons incl. maskable,
  "New entry" shortcut = `./?view=journal`), `vite-plugin-pwa` in `vite.config.ts`, `components/UpdatePrompt.tsx`,
  `scripts/make-icons.mjs` (generated placeholder icons: three journal lines on the accent green; swap the files in
  `public/` for real artwork any time). Details in DESIGN.md "Platform plan".
- Checked in the Browser pane on a production build: manifest served, worker active, 12 files precached (the image
  worker chunk included), app reloads and runs with the server stopped, the shortcut URL focuses the capture box.
- **Confirmed by the user:** installs and works in Edge, and the "New entry" jump-list shortcut works. **Not yet
  verified:** the update banner (waiting list item 7).
- Still a small polish idea: one ~500 kB JS chunk (Vite warns); code-splitting would shrink the first load.

### 3. Data-safety features: done (2026-11-10)
- **Settings > Data safety** (`DataSafetyCard`): whether the browser has granted persistent storage (granted / not
  granted with an "Ask the browser again" button / can't tell), the date of the last backup (export), and a switch for
  the backup reminder.
- **Header badge:** decided: entries-only users get it too. With no storage chosen it shows "⚠ Only in this browser" as
  soon as there is one entry (or "Photos only in this browser" with photos). It stays quiet until the saved storage has
  been read at startup (new `restored` flag in the storage state), so folder users no longer see a false flash.
- **Backup reminder** (`BackupReminder`, above the search bar): for anyone whose entries are only in the browser (no
  storage, or "Files inside this browser"; this is what Android users are until pCloud exists). First reminder once the
  oldest entry is 3 days old and there has been no export; afterwards 14 days after the last export. "Back up now" opens
  Settings, "Later" snoozes 7 days, "Stop reminding me" turns it off (the Settings switch turns it back on). A finished
  export records the date. Never shown with the folder module.
- Checked in the Browser pane at 375px (badge, reminder, Later, Stop, stale/recent backup dates, Settings card, Ask
  again). Logic is in `lib/dataSafety.ts` with 18 new tests. **Not verified:** the real Export buttons recording the
  date (the pane can't take downloads; the code path is two `setMeta` calls), and a real Android phone.
- Possible later polish: a "Files inside this browser" user still sees a green "Saved" header badge (the Settings card
  and the reminder do say it isn't a backup).

### 4. Hosting on GitHub Pages: LIVE (2026-11-12); installs and the update-banner test still to do
**Status (2026-11-12): the site is live at https://jesseracine.github.io/interstitial-diary/.** Sub-steps 1 (clean-up and
new dated archive in the Windows session folder, `archive-2026-11-10/` + zip), 2 (base path), 3 (deploy workflow), 4
(repo created, `main` pushed, first run green) and the read-only part of 5 (hosted site checked in the Browser pane) are
done. The user has installed it ("installed, works", waiting-list item 9). The docs push (6e90356) also deployed green.
**Next: sub-step 6 (a second deploy with a visible change, to see the update banner in the installed app).** Repo: https://github.com/JesseRacine/interstitial-diary (public, default
branch `main`); `gh` 2.103.3 lives in the WSL home at `~/.local/bin/gh` (not on PATH; the user signed in themself with
`gh auth login`; pushes use `git -c "credential.helper=!$HOME/.local/bin/gh auth git-credential" push`, no git config was
changed).

**Decisions (answered 2026-11-10):** GitHub account `JesseRacine` (numeric id 9375408; looked up from GitHub's public
profile API); repo `interstitial-diary`, public; address `https://jesseracine.github.io/interstitial-diary/` (so
`base: '/interstitial-diary/'`); commits use `JesseRacine <9375408+JesseRacine@users.noreply.github.com>` (set as the
repo's local git identity); branch `main`. The superseded `junior-plan.md` was deleted (it stays in the git history, which holds no personal data).

**What the user has already been told (don't re-explain at length):**
- The hosted site is **public**; on GitHub's free plan the repo must be public too (Pages from a private repo needs a
  paid plan, and even then the site is public; only Enterprise can restrict it). Cloudflare Pages + Access was the
  private alternative; the user chose GitHub Pages anyway.
- Their **journal is never uploaded**: entries and photos stay in their browser or their own folder; the site is only the
  app's code, and a stranger opening it gets their own empty journal.
- An app installed from the hosted address has its **own empty data**, separate from the `localhost:4173` test install
  (bring a journal across with Export, or a shared folder).
- The address is permanent in practice (browser data belongs to the exact address). Changing it later starts the
  installed app empty (files in a folder or pCloud carry over).

**The four decisions that were asked (answers above; the options and reasoning are kept for the record):**
1. **Address:** `https://<username>.github.io/<repo>/` (default; needs `base: '/<repo>/'`), or a repo named exactly
   `<username>.github.io` (address with no sub-path, `base: '/'`), or later a custom domain (about $10/year, survives
   a change of host). Recommend one of the first two; custom domain only if they want long-term permanence.
2. **Public repo OK?** Required on the free plan.
3. **Commit email.** All 40 commits were authored with the user's personal Gmail address; a public repo would show it
   (also in the text of two doc commits). Recommend rewriting the author email to their GitHub noreply address
   (`<id>+<username>@users.noreply.github.com`, shown at github.com > Settings > Emails) before the first push, and
   switching on "Keep my email addresses private" and "Block command line pushes that expose my email". Alternative:
   accept the exposure. A rewrite changes every commit hash (see cleanup below).
4. **Default branch:** the repo's branch is `master` and there is no remote. Recommend renaming it to `main` (what
   GitHub and most workflow examples assume).

**What the user must do (Claude can't):**
- Create the GitHub account (and make the privacy settings above), then give Claude the username and the numeric id
  from the noreply address; create the empty repo (no README/licence) or let `gh repo create` do it.
- Sign in from WSL once. `gh` is **not installed** in WSL: Claude asks before installing it there (installs stay in
  WSL), then the user runs `gh auth login` themselves (Claude never handles the password/token). Alternative: an SSH key
  or a personal access token the user sets up.
- Repo **Settings > Pages > Source: GitHub Actions** (one click, after the first push).
- Test the installs: Edge on Windows, Chrome on Android (needs the hosted HTTPS address).

**Checklist for Claude (in order):**
1. **Clean up before anything is public.**
   - Re-run the scan (all 2026-11-10 results are listed here; there are no keys, tokens or secrets in the repo):
     `git grep -n -I -E "gmail|C:\\\\Users|/home/|wsl.localhost" -- . ':!package-lock.json'` and
     `git log --format='%an <%ae>' | sort | uniq -c`. Findings: the repo's `CLAUDE.md` lines 23, 24 and 53 hold the
     WSL/Windows paths, the user's name and their Gmail address (in the commit command). Move the machine-specific
     paths into the Windows session folder's own `CLAUDE.md` (outside the repo) and use the noreply address in the
     commit command. (`junior-plan.md`: deleted, see above.)
   - If the history is rewritten (decision 3): use `git filter-branch --env-filter` (or `git-filter-repo`, which is not
     installed: ask first), keep the `Co-Authored-By: Claude ... <noreply@anthropic.com>` trailers, check
     `git log --format='%an <%ae>' | sort -u` shows only the noreply address, and note in PROGRESS.md that the hashes in
     the "Done" table predate the rewrite. Then make a **new dated archive** in the Windows folder (the existing
     `archive/` snapshot is of f4ef4d9 and is read-only; never edit it).
   - Rename `master` to `main` if chosen; add the remote; first push.
2. **Base path: DONE (2026-11-10).** `vite.config.ts` sets `base` from the `BASE_PATH` environment variable through
   `normaliseBase` (`base-path.ts`, tested in `src/basePath.test.ts`): unset means `/`, so `dev`, `preview` and a plain
   `npm run build` are unchanged; the deploy workflow will set `BASE_PATH=/interstitial-diary/`. A malformed value (a full
   URL, a query, `..`) makes the build fail rather than ship a broken site. Checked in the Browser pane on a build under
   `/interstitial-diary/` served on 127.0.0.1:4174 (new launch config `interstitial-preview-sub`, builds into the
   git-ignored `dist-sub`): the page, CSS, JS, favicon and apple-touch-icon load from the sub-path; the manifest resolves
   `start_url`/`scope` to `/interstitial-diary/` and its three icons return 200; the "New entry" shortcut URL resolves to
   `/interstitial-diary/?view=journal` and focuses the capture box; the service worker scope is `/interstitial-diary/`,
   12 files precached (the image worker chunk included); with the server stopped the app still reloads from the worker.
   A plain build still emits root-absolute paths. **Not verified until it is hosted:** the real GitHub Pages address
   (HTTPS, Pages' own 404 behaviour), and the Android install.
3. **Deploy workflow: DONE, first run green (2026-11-12).** `.github/workflows/deploy.yml`: on push to `main` (and manual):
   checkout, setup-node (Node 26, as in WSL), `npm ci`, `npm test`, `npm run build` (runs `tsc -b`) with
   `BASE_PATH=/interstitial-diary/`, two `grep` checks that the build really uses the sub-path, `configure-pages`,
   `upload-pages-artifact` (path `dist`), then a second job `deploy-pages`; permissions `contents: read`, `pages: write`,
   `id-token: write`; concurrency group `pages` (never cancels a running deploy). Action versions looked up from GitHub's
   releases on 2026-11-10: checkout v7, setup-node v7, configure-pages v6, upload-pages-artifact v5, deploy-pages v5 (all
   first-party `actions/*`, pinned to a major version; re-check them if a run warns about a deprecated version). Checked
   locally: the YAML parses, the same build and `grep` checks pass with `BASE_PATH` and the check fails without it;
   `src/deployWorkflow.test.ts` (5 tests) guards trigger, order, base path, permissions and pinning. On GitHub the build
   job (tests included, 17 s) and the deploy job (9 s) both passed. Its only warning: the `ubuntu-latest` label is moving
   to Ubuntu 26 (GitHub notice, nothing to change unless a run breaks).
4. **Push and watch: DONE (2026-11-12).** Repo `JesseRacine/interstitial-diary` created public and empty with `gh repo
   create`, `main` pushed (45 commits, every one under the noreply identity, history scanned for personal strings first).
   The user then set Settings > Pages > Source: GitHub Actions. I did not see the result of the very first attempt; when I
   looked afterwards the only run listed (`gh run list`) was green, both jobs.
5. **Verify the hosted site: read-only checks DONE (2026-11-12), installs wait for the user.** In the Browser pane on
   `https://jesseracine.github.io/interstitial-diary/` (HTTPS): page, CSS, JS, favicon and apple-touch-icon load from the
   sub-path; the manifest's `start_url`/`scope` resolve to `/interstitial-diary/`, its three icons return 200 as PNG; the
   service worker is active with scope `/interstitial-diary/` and controls the page after one reload; 12 files precached,
   the image worker included; `?view=journal` focuses the capture box; no console errors; a missing page returns GitHub's
   404 (the app has no path routes, so that is fine). The JS file name (`index-Dl4IZBmu.js`) is identical to the local
   sub-path build, so the hosted build is reproducible. Test data from the check (service worker, caches, empty database)
   was removed. **Not checked from the pane:** offline reload on the hosted origin (can't switch GitHub off); installing in
   Edge and on Android is the user's (waiting-list item 9).
6. **Close the loop on the update banner** (waiting-list item 7): make a visible change, deploy a second time, and the
   installed app should show "A new version is ready".
7. **Docs:** add the live URL to README, CLAUDE.md (status, commands, code map: `.github/workflows/deploy.yml`, the
   `BASE_PATH` variable) and DESIGN.md ("Platform plan"); move the done items into the "Done" table; update the memory
   note `interstitial-diary-project`.

**Things to remember afterwards:**
- Step 5 (pCloud) needs this address for the OAuth redirect URI; the pCloud app is registered in their developer console.
- The Android folder module is still unsupported there, so Android users depend on the export reminder until pCloud or
  native exists.
- A custom domain later means a new origin: installed apps start empty again (plan it before many installs).

**Done when:** the app is installed on both Windows and Android from the hosted address, and a second deploy shows the
update banner.

### 5a. Dropbox storage module: CHOSEN 2026-11-12 as the first cloud module (pCloud's app approval may take a while)
The user has a Dropbox account and wants to try it. Same pattern as every module: `storage/backends/dropbox.ts` + one
line in `backends/index.ts`, no changes to `sync.ts`. Facts read from Dropbox's docs on 2026-11-12
(docs.dropboxapi.com/dropbox-api/docs/oauth and .../technical-reference/request-response-formats):
- **Sign-in: OAuth code flow with PKCE** (Dropbox's recommendation for pure-JavaScript apps; no client secret). Authorize at
  `https://www.dropbox.com/oauth2/authorize?client_id=...&redirect_uri=...&response_type=code&code_challenge=...&
  code_challenge_method=S256&token_access_type=offline`, then POST the code and `code_verifier` to `/oauth2/token`.
  Access tokens are **short-lived**; `token_access_type=offline` also returns a **refresh token** (stored in the backend
  config), used to get new access tokens, so the auto-syncing installed app keeps working. The redirect URI must match one
  registered in the console exactly. The console's "Allow public clients (Implicit Grant & PKCE)" toggle must be on.
- **Browser use is supported:** RPC calls go to `api.dropboxapi.com` (JSON body); uploads/downloads to
  `content.dropboxapi.com` with the arguments in the `Dropbox-API-Arg` header (or an `arg` URL parameter); a "simple
  request" mode (`text/plain; charset=dropbox-cors-hack`, `arg`/`authorization` as URL parameters,
  `reject_cors_preflight=true`) avoids the CORS preflight. Verify the real behaviour from the app before relying on either.
- **Paths are case-insensitive** (and start with `/`, relative to the app folder): fine for day files and hash-named
  photos, but keep in mind in tests. Content downloads support Range and ETag.
- **Not yet checked in the docs (do it when building):** the single-upload size limit (recalled as 150 MB; larger needs
  upload sessions; phone photos are far below), `list_folder` (recursive, `has_more` cursor, `content_hash` for `rev`),
  `files/upload` modes (`overwrite` for text; `add` without autorename so a photo never overwrites: `BlobCollisionError`),
  `get_metadata` for `hasBlob`, `delete_v2` for `remove`/`removeBlob`.
- **What the user does (needs their Dropbox login):** at https://www.dropbox.com/developers/apps choose **Create app** >
  **Scoped access** > **App folder** (not Full Dropbox: the journal then lives in `Apps/<app name>/` and a leaked token
  cannot read their other files) > give it a unique name (e.g. "Interstitial Diary JR"). **Permissions** tab: tick
  `files.metadata.read`, `files.metadata.write`, `files.content.read`, `files.content.write` and click Submit. **Settings**
  tab > OAuth 2: add redirect URIs `https://jesseracine.github.io/interstitial-diary/`, `http://localhost:5173/` and
  `http://127.0.0.1:5173/`; make sure "Allow public clients (Implicit Grant & PKCE)" is on. Then send Claude the **App key**
  (public, fine to commit). **Never share the App secret** or a generated access token.
- **Build plan** (the setup is the part that waits for the key): a small PKCE/redirect helper reused later by pCloud; the
  `FileStore` over the Dropbox HTTP API with a mocked-`fetch` test suite (sync engine, blobs, collision, delete, token
  refresh, 401 handling); the sign-in return handled at startup (a full-page redirect is more robust in an installed
  Android PWA than a popup; it needs a small "pending sign-in" step in `manager.ts`); Settings entry; DESIGN.md.
  Nothing is "working" until a real entry travels Windows to Android and back: that goes on the waiting list.

### 5. pCloud storage module: STARTED 2026-11-12 (waiting on the user's pCloud app registration; Dropbox, 5a, goes first)
- See DESIGN.md "pCloud notes". The user registers an app in pCloud's developer console (needs the hosted address
  for the OAuth redirect) and provides the client id.
- **Read in pCloud's docs on 2026-11-12** (docs.pcloud.com/methods/oauth_2.0/authorize.html): the sign-in page is
  `https://my.pcloud.com/oauth2/authorize` with `client_id`, `response_type=token` and a mandatory `redirect_uri`; for a
  pure browser app pCloud recommends the **token (implicit) flow**: it redirects to `redirect_uri#access_token=...&uid=...
  &locationid=1|2&hostname=api.pcloud.com|eapi.pcloud.com` (so the region comes back automatically: all later API calls go
  to that `hostname`). Tokens **do not expire** (no refresh needed; a lost token means sign in again). No client secret is
  needed in the browser: **never put an app secret in this public repo**.
- **What the user does (Claude can't, it needs their pCloud login):** (1) have a pCloud account; (2) at
  https://docs.pcloud.com/my_apps/ log in and register an app, named e.g. "Interstitial Diary"; (3) add these redirect
  URIs: `https://jesseracine.github.io/interstitial-diary/` (the real one) and, for testing, `http://localhost:5173/` and
  `http://127.0.0.1:5173/`; (4) if the console offers a choice, give the app access to **its own app folder only**, not the
  whole pCloud (the journal then sits in `Apps/<app name>/`, and a leaked token can't read their other files); (5) send
  Claude the **app key / client id** (a public identifier, fine to commit) and say whether the account is US or Europe.
  Never share the app secret or any access token.
- **Design question for Claude once the id arrives:** the sign-in leaves the page. `StorageBackend.setup()` is an
  interactive promise, so either a popup that posts the token back, or a full-page redirect whose return is handled at
  startup (more robust for an installed Android PWA; needs a small "pending setup" step in the manager). Decide then,
  and keep `sync.ts` untouched (rule 3).
- Implement `storage/backends/pcloud.ts`; handle the US/EU region; token stored in the backend config. Include the
  image methods (phase 4) so photos sync too.
- **Done when:** an entry written on Windows appears on Android and vice versa, including offline edits on both.

### 6. Native apps (Tauri)
- The user wants a "real app", with the PWA first. Wrap the same build with Tauri 2; build the Windows `.exe` and
  Android `.apk` in GitHub Actions (keeps Rust/Android SDK off the user's machine).
- Native extras: global hotkey + tray on Windows; a native-folder storage module for Android.
- Android quick capture (home-screen widget, pop-up entry box): planned in [android-capture-plan.md](android-capture-plan.md).
  Its stage 1 (open straight to capture, share target) belongs with the PWA and hosting steps.

## Known limitations
- Unsaved edits to an existing entry are lost if you scroll far enough that its row leaves the screen (the journal is virtualised).
- Removing an entry from a file by hand doesn't delete it (by design; see DESIGN.md).
- The folder module needs Chrome/Edge on desktop and usually needs "Reconnect folder" after a browser restart.
- On Android there is currently no copy outside the browser (the app warns about this in the header and Settings, and
  reminds you to export every couple of weeks).
- No import of existing notes from other apps yet (export only).
- Export with photos only includes originals currently on the device; on a computer with the folder module, photos
  dropped from the browser cache (over the cache limit, 1 GB by default) are left out of the zip (they are still in the folder).
- A photo file deleted by hand from the storage folder after it was saved there is not written back.
- An unsaved edit's photo references can be lost like its text (see the first point), but the photo bytes are already
  saved in the browser and are never lost.
- Photo files are only ever deleted by "Photos of deleted entries". A photo removed from a *live* entry (lightbox
  "Remove") keeps its file, and the cleanup only knows entries deleted on (or synced to) this device, so such files stay.
- "Photos of deleted entries" syncs first and refuses to run if that sync fails; with no storage connected it only
  cleans this device.
- Photos in HEIC/AVIF are stored but can't be shown (placeholder with Save); there is no HEIC conversion.

## Ideas backlog
- Restyle search results to match the chat look (they still use cards).
- Idle nudge ("you haven't logged in 90 minutes").
- Weekly review page: entries per day, top tags, time-of-day patterns.
- Edit an entry's time.
- Incremental search indexing if the journal gets very large.
- GitHub storage module.
- Photos view: filter by tag/date range; jump to the entry from the lightbox.
- Clean up photos removed from live entries (needs a way to know nothing else uses the file).
