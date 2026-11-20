# jAPAsp tool

A Tauri app (Rust shell, plain HTML and JS interface) that turns the tables in a saved `.jasp` file into APA 7 tables.
General rules are in the owner's dev-conventions. This file holds only this project's specifics.

## Layout

- `src-tauri/src/jasp.rs`: reads `analyses.json` from the `.jasp` zip and lists each analysis's tables in `.meta` order (the JSON keys are sorted, so key order is wrong).
- `src-tauri/src/data.rs`: counts N from `internal.sqlite` (table `DataSet_<id>`, columns `Column_<Columns.id>`, `Filter_<id>` = 1 for included rows, missing = NULL or INT_MIN). Variables come from the options marked `shouldEncode` in `options['.meta']`. Frequency data (`count`/`counts` options) sums the counts, through `Labels.originalValueJson` when the column stores codes. A code of -1 is missing in any coded column. FIML counts rows with any value; perDependent, pairs and pairwise give a `Range` of per-test N. Syntax models (SEM) fall back to `{ types, value }` lists anywhere in the options. Any `dataFormat` (quality-control measurement data) and audit analyses get no data N. Meta-analyses (an `effectSize` variable) give `Meta { studies, effects, total }`; JAGS takes `n` from `userData`. Only a fallback: the tables' own numbers win.
- `src-tauri/src/app.rs`: the window, file opening and the clipboard (arboard, HTML plus plain text). Behind the `app` feature.
- `ui/app.js`: builds a JASP table model per table, renders it with JASP's code, runs `buildAPATable`, shows cards.
- `ui/vendor/jasp/`: JASP's own results-page code, copied by `tools/sync-jasp-js.sh`.

## Rules

- Never edit `ui/vendor/jasp/`. APA changes are made on the `copyAPATable` branch in `~/Apps/jAPAsp/jasp-desktop` (with its tests in `utils-test.js`), then copied here with `tools/sync-jasp-js.sh`. The same code goes upstream to JASP.
- Licence is AGPL-3.0-or-later, not the usual GPL-3.0-or-later: the vendored code is JASP's (AGPL-3.0).
- Don't commit `.jasp` files or their JSON dumps. Test fixtures stay local (`tests/ui/fixtures/`, ignored). Use JASP's example data, never the owner's own files.
- The interface must keep working in a plain browser (no `window.__TAURI__`): that is how `tests/ui/run.sh` tests it.
- The Content Security Policy allows only local scripts. Table titles and notes come from the file and are inserted as HTML, so don't loosen it.

## Tests

- `cd src-tauri && cargo test --no-default-features`
- `tests/ui/run.sh` (needs fixtures and Chrome)
- `tests/corpus/dump.sh` then `tests/corpus/run.sh`: all of JASP's Data Library (472 tables). Must report 0 problems and 0 missing numbers before a change is done. Quality-control wide-format data gets no N from the data rows on purpose.
- APA rules: `~/Apps/jAPAsp/scratch/run-tests.sh` in the JASP workspace
