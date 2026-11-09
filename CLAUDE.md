# CLAUDE.md: Interstitial Diary

An interstitial journal: short, timestamped, freeform notes written between tasks, with `#tags`, strong search,
and Markdown files as the durable copy. Targets **Windows and Android**: an installable PWA first, then native apps
via Tauri built from the same code.

Read these before changing anything substantial:
- **[DESIGN.md](DESIGN.md)**: how it works and why (data model, file format, sync rules, storage modules, search syntax).
- **[PROGRESS.md](PROGRESS.md)**: what's done, what's next, open decisions. **Update it when you finish a step.**

## Where things are

- **Repo (source of truth):** WSL Ubuntu, `~/projects/interstitial-diary`
  - From Windows tools: `\\wsl.localhost\Ubuntu\home\<user>\projects\interstitial-diary\`
- **Claude session folder (Windows):** `C:\Users\<user>\Documents\Claude\Projects\Interstitial Diary`. It only holds
  `.claude/launch.json` (dev server config) and a pointer `CLAUDE.md`. No code lives there.
- Node (via nvm), npm and git are installed **inside WSL only**. The user wants installs kept in WSL and off Windows.
  **Ask before installing anything on Windows.**

## Commands

Run everything through WSL from PowerShell, using an interactive shell so nvm loads:

```
wsl -d Ubuntu -- bash -ic "cd ~/projects/interstitial-diary && npm test"
```

| Task | Command (inside the repo) |
|---|---|
| Tests (Vitest, runs with `TZ=UTC`) | `npm test` |
| Type check | `npx tsc -b` |
| Production build | `npm run build` |
| Lint | `npm run lint` |
| Dev server | use the Browser pane's `preview_start` with name `interstitial-dev` (port 5173) |

Commit with the user's identity and the co-author trailer:
```
git -c user.email=9375408+JesseRacine@users.noreply.github.com -c user.name=JesseRacine commit -m "..." -m "Co-Authored-By: <model> <noreply@anthropic.com>"
```

## Code map

```
src/
  lib/entry.ts        Entry type, tag parsing, date helpers (all local time)
  lib/db.ts           Dexie (IndexedDB) schema + add/edit/delete/renameTag
  lib/markdown.ts     day file <-> entries (the on-disk format, see DESIGN.md)
  lib/merge.ts        union-by-id merge + tombstones
  search/query.ts     search syntax parser
  search/engine.ts    MiniSearch full-text + filters, tag stats, day counts
  storage/types.ts    FileStore / StorageBackend / LocalStore interfaces
  storage/sync.ts     backend-agnostic sync engine
  storage/manager.ts  runtime: active backend, auto-sync, status for the UI
  storage/backends/   one file per storage module + index.ts registry
  storage/memory.ts   in-memory FileStore/LocalStore for tests (and a template)
  components/         React UI (Capture, JournalView, EntryItem, Results, SearchBar, Calendar, Tags, Settings, StorageCard)
  lib/journalRows.ts  entries -> flat chat rows (day headers + entries) for the virtualised journal
  App.tsx             views, routing, keyboard shortcuts
```

## Rules

1. **Sync and merge code can lose people's journal entries.** Any change to `storage/sync.ts`, `lib/merge.ts`,
   `lib/markdown.ts` or `storage/manager.ts` needs a test that fails before and passes after. Run `npm test` before
   every commit. A data-loss bug has already happened once (hand edits overwritten, fixed in 9747fca).
2. **Storage is modular.** New storage (pCloud, GitHub, native folder...) = a new `StorageBackend` in
   `storage/backends/` plus one line in `backends/index.ts`. Do not add backend-specific logic to `sync.ts`.
3. **The Markdown file format is a public contract.** Users edit these files by hand and older files must keep
   parsing. Changing it needs backward-compatible parsing and tests.
4. **Every edit/delete must bump `updatedAt` (use `nextStamp` in db.ts) and set `dirty: 1`.** Deletes are soft
   (`deleted: 1`) so they sync as tombstones.
5. **Do not treat an entry missing from a file as deleted.** This is deliberate (see DESIGN.md, "Sync rules").
6. **Search syntax lives in three places:** `search/query.ts` (parser), the `SYNTAX` table in
   `components/SearchBar.tsx`, and DESIGN.md. Keep them in step, and add parser tests for new syntax.
7. TypeScript settings: `verbatimModuleSyntax` + `erasableSyntaxOnly`, so use `import type` for types and no `enum`s.
8. Keep the UI working at phone width (375px) and in light and dark mode. Colours come from CSS variables in
   `src/index.css`.

## Gotchas

- **`$variables` in `wsl ... bash -c "..."` get mangled** when sent from PowerShell. For anything non-trivial, write a
  script file and run `wsl -d Ubuntu -- bash /mnt/c/.../script.sh`.
- **Vite HMR can load a second copy of a module** (`manager.ts?t=...`). When poking the app from the browser console,
  importing `/src/storage/manager.ts` may give you a disconnected copy. Import the URL from
  `performance.getEntriesByType('resource')`, or trigger things through the UI.
- **Browser pane screenshots can lag behind the DOM.** Verify state with `javascript_tool` / `read_page` instead.
- The folder picker (`showDirectoryPicker`) opens a native dialog that can't be driven from the pane; the user tests that.
- The dev database at `localhost:5173` in the pane contains ~360 generated sample entries (not real data).

## Working with the user

- Explain decisions plainly and recommend one option rather than listing many.
- They care most about: search/browse quality, not losing data, Windows + Android, and a "real app" feel.
