# Cloud storage modules: Dropbox (next), pCloud (on hold), other ideas

_Read this when working on step 5a/5 (a cloud storage module). For the short state of things read
[../PROGRESS.md](../PROGRESS.md) first. The storage contract is in [../DESIGN.md](../DESIGN.md) ("Storage modules")._

## 5a. Dropbox storage module: NEXT (chosen 2026-11-12; waiting on the user's App key)
The user has a Dropbox account and wants to try it. Same pattern as every module: `storage/backends/dropbox.ts` + one
line in `backends/index.ts`, no changes to `sync.ts` (CLAUDE.md rule 3). It must implement the blob methods
(`readBlob`/`writeBlob`/`hasBlob`/`removeBlob`) so photos sync too (images phase 4). Facts read from Dropbox's docs on
2026-11-12 (docs.dropboxapi.com/dropbox-api/docs/oauth and .../technical-reference/request-response-formats):
- **Sign-in: OAuth code flow with PKCE** (Dropbox's recommendation for pure-JavaScript apps; no client secret). Authorize at
  `https://www.dropbox.com/oauth2/authorize?client_id=...&redirect_uri=...&response_type=code&code_challenge=...&
  code_challenge_method=S256&token_access_type=offline`, then POST the code and `code_verifier` to `/oauth2/token`.
  Access tokens are **short-lived**; `token_access_type=offline` also returns a **refresh token** (stored in the backend
  config, which lives in IndexedDB), used to get new access tokens, so the auto-syncing installed app keeps working. The
  redirect URI must match one registered in the console exactly.
- **Browser use is supported:** RPC calls go to `api.dropboxapi.com` (JSON body); uploads/downloads to
  `content.dropboxapi.com` with the arguments in the `Dropbox-API-Arg` header (or an `arg` URL parameter); a "simple
  request" mode (`text/plain; charset=dropbox-cors-hack`, `arg`/`authorization` as URL parameters,
  `reject_cors_preflight=true`) avoids the CORS preflight. Verify the real behaviour from the app before relying on either.
- **Paths are case-insensitive** (and start with `/`, relative to the app folder): fine for day files and hash-named
  photos, but keep in mind in tests. Content downloads support Range and ETag.
- **Still to check in the docs when building:** the single-upload size limit (recalled as 150 MB; larger needs upload
  sessions; phone photos are far below), `list_folder` (recursive, `has_more` cursor, `content_hash` for `rev`),
  `files/upload` modes (`overwrite` for text; `add` without autorename so a photo never overwrites: `BlobCollisionError`),
  `get_metadata` for `hasBlob`, `delete_v2` for `remove`/`removeBlob`. Dropbox's docs pages offer a Markdown version
  (append `.md`) and `/llms.txt`.
- **What the user does** (also PROGRESS.md waiting item 10): at https://www.dropbox.com/developers/apps choose **Create
  app** > **Scoped access** > **App folder** (not Full Dropbox: the journal then lives in `Apps/<app name>/` and a leaked
  token cannot read their other files) > a unique name (e.g. "Interstitial Diary JR"). **Permissions** tab: tick
  `files.metadata.read`, `files.metadata.write`, `files.content.read`, `files.content.write` and click Submit. **Settings**
  tab > OAuth 2: add redirect URIs `https://jesseracine.github.io/interstitial-diary/`, `http://localhost:5173/` and
  `http://127.0.0.1:5173/`, and make sure "Allow public clients (Implicit Grant & PKCE)" is on. Then send Claude the
  **App key** (public; fine to commit). **Never share the App secret or an access token.**
- **Build plan** (read first: `storage/types.ts`, `storage/backends/folder.ts` + `fs-store.ts`, `storage/memory.ts`,
  `storage/manager.ts`, `components/StorageCard.tsx`, `storage/sync.test.ts`, `storage/attachments.test.ts`): (1) a small
  PKCE + redirect-return helper (reusable by pCloud later); (2) the `FileStore` over the Dropbox HTTP API with a
  mocked-`fetch` test suite (sync engine, blobs, collision, delete, token refresh, 401 handling, `has_more` paging);
  (3) the sign-in leaves the page: `StorageBackend.setup()` is an interactive promise, so use either a popup that posts the
  result back, or a full-page redirect whose return is handled at startup (more robust for an installed Android PWA; needs a
  small "pending sign-in" step in `manager.ts`: that file has no direct tests, so keep the logic in tested modules);
  (4) a Settings entry and a "coming later" list update (`PLANNED_BACKENDS` in `backends/index.ts` currently lists pCloud
  and GitHub); (5) DESIGN.md (storage modules table, "Dropbox notes") and PROGRESS.md.
- **Decided 2026-11-12** (sub-steps 5a.1–5a.5 = the build plan items 1–5): full-page **redirect**, not a popup (a
  popup's `opener` is unreliable from an installed Android app); the PKCE verifier and `state` wait in the IndexedDB
  meta table (not sessionStorage), so the return can be finished in whichever tab/app of the origin it lands in; the
  saved config is `{ refreshToken, accountId }`, the access token stays in memory; a revoked refresh token throws
  `NotAllowedError`, which `manager.ts` already shows as "needs permission"; `rev` = Dropbox `content_hash`; `list()`
  lists the root and then each `YYYY` folder and `.meta` non-recursively (never walking images); text writes use upload
  mode `overwrite`, photos mode `add` without autorename; retry 429/503 with `Retry-After`. 5a.1 (`oauth.ts`) is done.
- The App key is a public identifier: keep it in one constant. **Never commit the App secret, a refresh token or an access
  token.** Until a real entry travels Windows to Android and back, the module is **not verified**: put that on PROGRESS.md
  "Waiting on the user".
- **Done when:** an entry (and a photo) written on Windows appears on Android and vice versa, including offline edits on
  both.

## 5. pCloud storage module (on hold: the user's app registration may need manual approval)
- See DESIGN.md "pCloud notes". The user registers an app in pCloud's developer console and provides the client id.
- **Read in pCloud's docs on 2026-11-12** (docs.pcloud.com/methods/oauth_2.0/authorize.html): the sign-in page is
  `https://my.pcloud.com/oauth2/authorize` with `client_id`, `response_type=token` and a mandatory `redirect_uri`; for a
  pure browser app pCloud recommends the **token (implicit) flow**: it redirects to `redirect_uri#access_token=...&uid=...
  &locationid=1|2&hostname=api.pcloud.com|eapi.pcloud.com` (so the region comes back automatically: all later API calls go
  to that `hostname`). Tokens **do not expire**. No client secret is needed in the browser: **never put an app secret in
  this public repo**.
- **What the user does:** have a pCloud account; register an app at https://docs.pcloud.com/my_apps/ (e.g. "Interstitial
  Diary") with the same three redirect URIs as for Dropbox; if offered, give it its **own app folder only**; send Claude the
  app key / client id and whether the account is US or Europe. Never share the app secret or a token.
- Implement `storage/backends/pcloud.ts`; handle the US/EU region; token stored in the backend config; include the image
  methods. Reuse the sign-in helper from Dropbox.
- **Done when:** an entry written on Windows appears on Android and vice versa, including offline edits on both.
- Meanwhile on Windows the Folder module pointed at a folder inside pCloud Drive already syncs through pCloud's desktop app.

## Other storage ideas (discussed 2026-11-12, none started)
After Dropbox: **GitHub private repo** (contents API, a token pasted into the app, free version history, 100 MB per file),
**OneDrive** (simple upload only up to 4 MB, so photos need upload sessions), **Google Drive** (fiddly sign-in rules). Poor
fits: WebDAV/Nextcloud (CORS), folder-sync apps on Android (no real folder access from a web app), a self-run server.
