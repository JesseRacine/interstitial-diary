# Plan: pCloud storage module

_Status: **PLAN AGREED 2026-11-17 (with the `dev-localhost/` folder on localhost); step 1 not started.** Written after
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
2. **The files.** `pcloud-store.ts` (the FileStore: `list`, `read`, `write`, `remove`, the photo methods,
   `removeAll`, the `diff` change check; waits and retries on 4xxx/5xxx; 1000/2000 → "Sign in to pCloud again") and
   `fake-pcloud.ts`; tests through the sync engine as `dropbox-store.test.ts` does.
3. **First real try (the user, on localhost, writing into `dev-localhost/` only).** Sign in, write entries and a photo,
   look at the files on pcloud.com; Claude settles the unknowns above from what happens and fixes what differs.
   Settings text and the Manual's storage section.
4. **Docs and push.** DESIGN.md (table + "pCloud notes"), CLOUD-STORAGE.md, PROGRESS.md "Waiting on the user"; raise
   `BUILD_NUMBER` and push **only with the user's OK**. Then the user tries Windows ↔ Android on the live site.
   (The native apps need `https://tauri.localhost/` registered and an app rebuild: a later, separate step.)

**Done when:** an entry and a photo written on Windows appear on Android and the other way round, through pCloud,
including edits made offline on both.
