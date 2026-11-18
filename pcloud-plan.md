# Plan: pCloud storage module

_Status: **PLAN AGREED 2026-11-17 (with the `dev-localhost/` folder on localhost); steps 1 and 2 done 2026-11-17; step 3 (the user's first real try on localhost) next.** Written after
the user registered the app with pCloud. Decisions below were agreed in the conversation on 2026-11-17; the steps are built one per turn, each tested and committed, asking before the
next. Older background: docs/CLOUD-STORAGE.md section 5 and DESIGN.md "pCloud notes"._

## What it is

A fourth storage module, **pCloud**, next to Folder, Browser files and Dropbox: the same Markdown day files and photos,
in the user's pCloud, so Windows and Android share one journal. It follows the Dropbox module's pattern (a new module in
`src/storage/backends/`, one line in `backends/index.ts`, **no change to `sync.ts`**).

## What we know

| | |
|---|---|
| The app | Registered by the user, approved by pCloud. **Client ID `8rKcvw6AboV`** (public, goes in one constant like `DROPBOX_APP_KEY`). Access: **a specific folder** (its own app folder), not the whole pCloud. No app secret is ever used or committed |
| The account | **US** (`my.pcloud.com`, API host `api.pcloud.com`). The app still takes the API host from the sign-in reply (`hostname`), so a Europe account would work too |
| Redirect URIs | **All four registered by the user (2026-11-17)**: `https://jesseracine.github.io/interstitial-diary/`, `http://localhost:5173/`, `http://127.0.0.1:5173/`, `https://tauri.localhost/` (the last for the native apps). pCloud's form first looked like one box only; several do fit |
| Sign-in | OAuth **token flow** (no secret in a browser app): `https://my.pcloud.com/oauth2/authorize?client_id=…&response_type=token&redirect_uri=…&state=…`; the reply comes back in the URL **fragment** (`#access_token=…&state=…&locationid=…&hostname=…`). `state` is supported. **Tokens do not expire** (no refresh token) |
| API | HTTP JSON at `https://<hostname>/<method>`; CORS allows any origin but **no custom headers**, so the token goes as the `access_token` parameter. Errors come as `{"result": <code>}` (0 = fine): 1000/2000 = not signed in, 2005 = folder missing, 2009 = file missing, 4xxx = slow down, 5xxx = server trouble |
| Calls to use | `listfolder` (per folder; `hash` + `size` per file), `uploadfile` (overwrites by default, keeping the old one as a pCloud revision; `renameifexists` to never overwrite; `nopartial`), `createfolderifnotexists` (uploads do not create folders), `stat` (size, for `hasBlob`), `deletefile`, `deletefolderrecursive`, `diff` (`last=0` gives a cheap bookmark, for the "anything changed?" check) |

**Not known until a real try (step 3):** whether `/` for an app-folder token is the app folder itself or the whole pCloud
with the folder at `/Applications/<name>`; how the browser reads a file's content (`getfilelink` says it refuses web
apps by referrer; the alternatives are `gettextfile` for text and `file_open`/`file_read` for photos); whether the
64-bit `hash` survives JSON as a number (if not, `rev` = hash text + size).

## Decisions (agreed 2026-11-17)

| Question | Proposal |
|---|---|
| Localhost and the real journal (the Dropbox mistake of 2026-11-17) | **On localhost the module uses a separate subfolder, `dev-localhost/`, inside the app folder**, never the real journal's files. Testing on localhost is then safe even signed in to the real account, and needs no second app. The badge says "pCloud (development folder)" there. (Alternatives: refuse pCloud on localhost; or a second registered app.) |
| Where the files go | The app folder's root holds `2026/…`, `.meta/`, `.thumbs/`, exactly as in Dropbox (or `/Applications/<name>/` if step 3 shows paths are not rooted there) |
| Text writes | `uploadfile` overwriting (pCloud keeps the old version as a revision: a free safety net) |
| Photos | Never overwritten: `stat` first; same size = done, other size = `BlobCollisionError`; uploaded with `renameifexists`, and if pCloud had to rename it (another device won the race) the renamed copy is deleted and the size is checked again |
| Saved config | `{ token, hostname, locationid, uid }` in IndexedDB, like every module's config. The token never appears in a log, an error message or a URL that is kept |
| "Stop" | Forgets the token on this device (as Dropbox). Revoking is done by the user in pCloud's settings |
| Tests | Only where entries or photos could be lost: the store against a fake pCloud through the real sync engine (text, photos, collision, delete, Start over, not-found, signed-out), and the token return (state check). No tests for small UI details (the user wants fewer tests) |

## Steps

1. **Sign-in.** `oauth.ts` gets the token-flow variant (begin with `state`, read the reply from the **fragment**,
   reuse the pending store and its 30-minute limit; clean the fragment from the URL). `pcloud.ts`: the module (`setup`
   leaves for pCloud's page, `resumeSetup` saves the config, `open` needs no network), registered in `backends/index.ts`
   and removed from `PLANNED_BACKENDS`, with the localhost subfolder rule. Tests: the reply parsing and state check.
   **Done 2026-11-17.** `oauth.ts` has `flow: 'token'` (no PKCE; `parseReturn` reads `access_token`/`state` from the
   fragment, `cleanReturnUrl` removes them from it, a reply of the wrong kind for the provider is refused);
   `pcloud.ts` has `PCLOUD_CLIENT_ID`, `makePCloudBackend` (config `{ token, hostname, uid }`; `hostname` must be a
   `*.pcloud.com` host, else taken from `locationid`), `isDevHost` (localhost, 127.0.0.1, [::1]; **not**
   `tauri.localhost`) and `DEV_FOLDER`: the folder is decided from the page's address every time, never saved. 9 new
   tests (667 in all), tsc clean, lint 0 errors. **Changed from the plan:** the module is **not registered yet** (no
   `pcloudBackend` instance, still in `PLANNED_BACKENDS`): its file store is a dependency, so registering waits for step
   2, and Settings shows no half-working pCloud meanwhile.
2. **The files.** `pcloud-store.ts` (the FileStore: `list`, `read`, `write`, `remove`, the photo methods,
   `removeAll`, the `diff` change check; waits and retries on 4xxx/5xxx; 1000/2000 → "Sign in to pCloud again") and
   `fake-pcloud.ts`; tests through the sync engine as `dropbox-store.test.ts` does.
   **Done 2026-11-17.** `pcloud-store.ts`: every call is a GET (or a plain multipart POST for `uploadfile`) with
   `access_token` as a parameter, no referrer, no cookies; `result` 1000/2000/2094 → "sign in again", 2002/2005/2009 =
   not found, 2008 = "Your pCloud is full.", 4xxx/5xxx (and HTTP 429/5xx) waited out up to 4 times (1, 2, 4, 8 s);
   uploads create missing folders (`createfolderifnotexists`, level by level) once on 2005; text overwrites; photos use
   `stat` first and `renameifexists`, and a renamed copy (another device won) is deleted by `fileid` and the size
   checked again; reading is `getfilelink` + a GET of `https://<hosts[0]><path>`; `rev` = `hash:size`; `list()` walks
   the root, the year folders and `.meta` only; `removeAll` = `deletefolderrecursive` per app folder; the change check
   is `diff` (`last=0` bookmark, then `diffid` + `limit=1`). `timeout.ts` now counts a FormData body's size. Registered
   in `backends/index.ts` (`pcloudBackend`, `location.hostname` decides the development folder); pCloud left
   `PLANNED_BACKENDS`. 12 new tests (679 in all; two devices through the sync engine with a photo and offline edits, the
   development folder never touching the real files and surviving the real Start over, the photo race, sign-in refused,
   slow-down retries, the change check), tsc clean, lint 0 errors. Seen in the local preview build (port 4173):
   Settings lists pCloud with the development-folder text, no console errors; **not signed in** (the user's step 3).
   Note: only `localhost:5173` and `127.0.0.1:5173` are registered, so the preview builds (4173/4174) cannot sign in.
3. **First real try (the user, on localhost, writing into `dev-localhost/` only).** Sign in, write entries and a photo,
   look at the files on pcloud.com; Claude settles the unknowns above from what happens and fixes what differs.
   Settings text and the Manual's storage section.
4. **Docs and push.** DESIGN.md (table + "pCloud notes"), CLOUD-STORAGE.md, PROGRESS.md "Waiting on the user"; raise
   `BUILD_NUMBER` and push **only with the user's OK**. Then the user tries Windows ↔ Android on the live site.
   (The native apps need `https://tauri.localhost/` registered and an app rebuild: a later, separate step.)

**Done when:** an entry and a photo written on Windows appear on Android and the other way round, through pCloud,
including edits made offline on both.
