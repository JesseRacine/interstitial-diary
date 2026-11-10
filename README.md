# Interstitial Diary

A quick, searchable interstitial journal: short timestamped notes between tasks, with `#tags` and photos, saved as
plain Markdown files (photos as image files next to them). A web app today (Windows and Android browsers); an
installable PWA and native apps are planned.

- [DESIGN.md](DESIGN.md): how it works (data model, file format, sync, storage modules, search, photos, data safety)
- [PROGRESS.md](PROGRESS.md): what's done, what's next, what still needs confirming on a real device
- [images-plan.md](images-plan.md): the photo feature's plan and build log
- [CLAUDE.md](CLAUDE.md): working notes for AI-assisted development (commands, code map, rules, gotchas)

```bash
npm install
npm run dev     # http://localhost:5173
npm test
npx tsc -b      # type check
npm run lint
npm run build
```

Everything the app saves stays in your browser until you choose a storage in Settings (a folder on your computer, for
example one inside pCloud Drive, OneDrive or Syncthing). The Markdown files are yours: you can read and edit them in
any text editor, and Export makes a zip backup at any time.
