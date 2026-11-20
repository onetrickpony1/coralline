# jAPAsp tool

A Tauri app (Rust shell, plain HTML and JS interface) that turns the tables in a saved `.jasp` file into APA 7 tables.
General rules are in the owner's dev-conventions. This file holds only this project's specifics.

## Layout

- `src-tauri/src/jasp.rs`: reads `analyses.json` from the `.jasp` zip and lists each analysis's tables in `.meta` order (the JSON keys are sorted, so key order is wrong).
- `src-tauri/src/data.rs`: counts N from `internal.sqlite` (table `DataSet_<id>`, columns `Column_<Columns.id>`, `Filter_<id>` = 1 for included rows, missing = NULL or INT_MIN). Variables come from the options marked `shouldEncode` in `options['.meta']`. Frequency data (`count`/`counts` options) sums the counts, through `Labels.originalValueJson` when the column stores codes. A code of -1 is missing in any coded column. FIML counts rows with any value; perDependent, pairs and pairwise give a `Range` of per-test N. Syntax models (SEM) fall back to `{ types, value }` lists anywhere in the options. Any `dataFormat` (quality-control measurement data) and audit analyses get no data N. Meta-analyses (an `effectSize` variable) give `Meta { studies, effects, total }`; JAGS takes `n` from `userData`. Only a fallback: the tables' own numbers win.
- `src-tauri/src/app.rs`: the window, file opening and the clipboard (arboard, HTML plus plain text). Behind the `app` feature. `move_old_name` moves the settings and Linux launcher entries of the old name `japasp-tool` (up to 0.1.0) to `japasp` once; keep it until most users have updated.
- `open_link` (app.rs) opens only the links in `allowed_link`: the author's profile and new issues on this repo (`.github/ISSUE_TEMPLATE/feedback.yml`, whose `version` and `system` fields the app fills in). Add new links there, never a general "open any URL".
- `src-tauri/src/main.rs`: the command line (`--json`, `--version`, `--desktop-entry` for install.sh).
- `ui/app.js`: builds a JASP table model per table, renders it with JASP's code, runs `buildAPATable`, shows cards. Tables are identified by `key` (`a<analysis>-t<table>`), never by number: numbers change when tables are left out. Per-file reader settings (`files` in localStorage: first number, left-out tables, checks put back in) are keyed by path. Assumption-check tables (`checkTitles`) start left out. The ring counts copied tables (the yellow parts can't be finished in the app). `todoKind`/`spotKind` tie each to-do chip to its highlights; keep them in step with the builder's to-do wording. The **What changed** panel shows `apa.changes` (the builder's change log, rule by rule; `shownTable` is passed so decimals are compared with the table as JASP shows it).
- `ui/vendor/jasp/`: JASP's own results-page code, copied by `tools/sync-jasp-js.sh`. `tests/apa/utils-test.js` is JASP's test file, copied by the same script.
- `install.sh`, `install.ps1` (and the double-click `install.cmd`, also attached to each release so the README can link a download, and `install.command`): download the latest release's build for the platform. `.github/workflows/release.yml` builds those files when a `vX.Y.Z` tag is pushed; their names must match the installers.
- `ui/app.css`: the liquid glass look. Themes are token sets on `[data-theme]` (light, dark, pink, green; green uses JASP's `#8cc63e`, its theme button is JASP's J); `ui/theme-boot.js` sets the saved theme before the first paint (the CSP forbids inline scripts). No purple gradients (owner's rule). Performance rule: no `filter: blur` or animated backgrounds, `backdrop-filter` only on panes floating over content (menu, dialog), no masks on `.tables`; it must stay smooth on a basic laptop. `.reduced` (Reduce effects) turns off transparency, shadows and animation.
- `ui/icon.svg`: the icon (psi whose stem ends in the J of JASP), hand-written SVG. `tools/make-icons.sh` renders it to `src-tauri/icons/`, plus the dark, pink and green versions (`ui/icons/`, `src-tauri/icons/variants/`). The window reports app id `japasp`; on Linux `set_app_icon` writes desktop entries `japasp.desktop` (launcher, current colour) and hidden `japasp-{blue,dark,pink,green}.desktop` in `~/.local/share/applications/`, icons in `~/.local/share/japasp/`, then switches the Wayland app id to `japasp-<colour>`: KDE caches an icon per app id, so a new id is the only way to change it on an open window. On Windows (`windows_icon` in app.rs) Tauri's set_icon only sets the small icon, so the app also sends WM_SETICON ICON_BIG and points the Start menu and taskbar-pin shortcuts at `%LOCALAPPDATA%\japasp\icons\japasp-<colour>.ico` (made by tools/make-icons.sh). Only checked by compiling: test changes on a real Windows PC.
- `docs/DEVELOPMENT.md`: building, tests and releases for contributors.
- `ui/fonts/`: Inter (OFL, licence alongside), vendored so the app works offline.

## Rules

- README order (the owner's choice, differs from dev-conventions): title and description, Install, "Before you use it" (what the app does and doesn't do, for students, plain words, no jargon), screenshot, then the rest. Keep that section true when features change (for example when plots arrive).

- Never edit `ui/vendor/jasp/` or `tests/apa/utils-test.js`. APA changes are made on the `copyAPATable` branch of a jasp-desktop checkout (default `../jAPAsp/jasp-desktop`), with a test in `utils-test.js`, then copied here with `tools/sync-jasp-js.sh`.
- Licence is AGPL-3.0-or-later, not the usual GPL-3.0-or-later: the vendored code is JASP's (AGPL-3.0).
- Don't commit `.jasp` files or their JSON dumps. Test fixtures stay local (`tests/ui/fixtures/`, ignored). Use JASP's example data, never the owner's own files.
- The interface must keep working in a plain browser (no `window.__TAURI__`): that is how `tests/ui/run.sh` tests it.
- The Content Security Policy allows only local scripts. Table titles and notes come from the file and are inserted as HTML, so don't loosen it.

## Tests

- `cd src-tauri && cargo test --no-default-features`
- `tests/ui/run.sh` (needs fixtures and Chrome)
- `tests/corpus/dump.sh` then `tests/corpus/run.sh`: all of JASP's Data Library (472 tables). Must report 0 problems and 0 missing numbers before a change is done. Quality-control wide-format data gets no N from the data rows on purpose.
- `tests/apa/run.sh`: the APA rules (JASP's tests, needs Chrome). CI runs this and the Rust tests on Linux, macOS and Windows with Rust 1.90 and stable.
