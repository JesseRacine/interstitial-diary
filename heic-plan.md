# HEIC photos: convert to JPEG when attached (plan, 2026-11-19)

**Status: DROPPED by the user on 2026-11-19 (they prefer no LGPL library; HEIC stays "stored, not shown"). Nothing was
built; kept only so the reasoning is not lost.** Asked for by the user on 2026-11-19 after attaching a HEIC with the Photo button: the
journal showed a gray "HEIC" square and the viewer said "This HEIC photo can't be shown here. Use Save…" (the designed
behaviour, see images-plan.md and docs/LIMITS-AND-IDEAS.md). The user chose **"convert to JPEG"** over keeping the HEIC
original with a converted thumbnail.

## Decision

When a HEIC/HEIF file is attached, decode it in the browser and **store a JPEG instead**. The journal, the Photos tab,
the viewer, sync and export then treat it as any other JPEG. The HEIC bytes are not kept.

What this changes (to tell the user, not hide):
- DESIGN.md's rule "originals are stored byte for byte" gets one exception: **HEIC is converted on the way in.** All
  other types stay byte for byte.
- A little quality is lost (JPEG quality ~0.92) and the camera's metadata (GPS, date taken) is not carried into the JPEG.
  The app only reads the orientation, which is applied during conversion.
- The same HEIC attached twice gives the same JPEG only if the converter is deterministic; if not, it is stored twice
  (harmless, the hash differs). Check in step 1.

## Where it goes

Every attach (Photo button, paste, drop, share) goes through `attachImage` in `src/lib/attach.ts`. After sniffing, if the
type is `heic`: convert the bytes to a JPEG blob, then continue with the JPEG exactly as before (hash the JPEG bytes,
store, thumbnail). Everything after that point is unchanged, so sync, Dropbox, export and the cleanup need no change.
The converter is passed in like the `thumbnailer` (default = the real one), so tests run in Node with a fake.

AVIF stays "stored, not shown" (not asked for; browsers can decode it, a later small step).

## The decoder (to confirm in step 1)

Looked up on npm 2026-11-19 (`npm view`):
| Package | Version | Licence | Last published | Note |
|---|---|---|---|---|
| `heic-to` | 1.6.7 | LGPL-3.0 | 2026-10-27 | Maintained; libheif compiled to WebAssembly; HEIC to JPEG/PNG in the browser |
| `libheif-js` | 1.23.5 | LGPL-3.0 | 2026-10-04 | The raw libheif build; we would write the conversion ourselves |
| `heic2any` | 0.0.4 | MIT | 2023-03-29 | Not updated since 2023: may fail on newer iPhone files |

Leaning to `heic-to`. Things to check, not assume: that it runs inside our web worker (or is fine on the main thread
with a "Converting…" note), the size it adds (the WebAssembly is a few MB), that it is **loaded only when a HEIC is
attached** (not in the first page load, and decide whether the service worker precaches it: offline conversion vs. a
bigger install), that it works in the Tauri web views (Windows WebView2, Android WebView), and that **LGPL-3.0** is
acceptable for a public repo that ships it unmodified as a separate file (the user decides; it only needs the library's
licence text kept with the build).

## Steps (one per turn, ask before the next)

1. **Try the decoder.** Install it in WSL, convert a real HEIC from the user's phone in Claude's browser pane
   (`127.0.0.1:5173`, never Dropbox), check size, speed, orientation, memory on a 12 MP photo, and that it loads lazily.
   Nothing committed until this works. *Needs a HEIC sample from the user (a copy of the file, on this PC).*
2. **Convert in `attachImage`**, with the converter injected; tests: a HEIC in gives a JPEG out (type, hash is of the
   JPEG), a conversion that fails gives a clear message and stores nothing, other types untouched, a second attach of
   the same photo does not add a second copy. Update `sniffImageType` tests only if needed.
3. **Show it in the UI:** a "Converting…" state on the draft thumbnail (a 12 MP conversion takes a few seconds on a
   phone), the failure message, and the multi-photo case (convert one at a time to keep memory low).
4. **Docs and the user's checks:** DESIGN.md (the exception), docs/LIMITS-AND-IDEAS.md (remove the limitation), the
   Manual text, images-plan.md log, PROGRESS.md, build number +1; then the push (ask first) and a native-app rebuild.
   Checks that are the user's: a HEIC from the phone's gallery in the Android app, in the Windows app and in the
   installed web app; with Dropbox the photo appears on the other device.

## Open questions for the user

- **HEIC photos already in the journal** (the test entry from 2026-11-19, and any others): leave them as gray squares
  (the user removes and re-adds them), or add a later step "Convert the HEIC photos already stored" (it would have to
  replace a stored file in Dropbox, which the rules treat carefully: image files are never deleted automatically). The
  proposal is to leave them and decide later.
- **Licence:** LGPL-3.0 is fine for this use, but it is the user's call.
