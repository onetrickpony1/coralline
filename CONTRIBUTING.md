# Contributing

Bug reports and fixes are welcome, especially for macOS and Windows. Please read [AGENTS.md](AGENTS.md) first: it has the layout and the project's rules. [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) has the commands in more detail.

- **Setup:** Rust 1.90 or newer and, on Linux, WebKitGTK 4.1 and its build packages (`libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev libxdo-dev` on Debian and Ubuntu, `webkit2gtk-4.1` on Arch). `cd src-tauri && cargo run --release -- path/to/file.jasp` builds and starts the app.
- **Figures:** need Linux and JASP from [Flathub](https://flathub.org/apps/org.jaspstats.JASP). Coralline reruns the analyses in that JASP's own R. Without it you get tables only. `coralline --figures FILE.jasp` prints the figures as JSON.
- **Tests:** all of these must pass before a change is done.
  - `cd src-tauri && cargo test --no-default-features`: the `.jasp` reader and the sample size.
  - `tests/apa/run.sh`: the APA rules (JASP's own tests), in headless Chrome.
  - `tests/ui/run.sh`: the interface with real tables, in headless Chrome. It needs JSON dumps in `tests/ui/fixtures/`, made with `coralline --json`. They aren't in the repo.
  - `test-apastyle.R`: the figure helpers. Run it from `src-tauri/r` with JASP's R; the command is at the top of the file.
  - `tests/corpus/dump.sh` then `tests/corpus/run.sh`: every table in JASP's Data Library. It needs JASP installed, and must report 0 problems and 0 missing numbers.
- **The APA code is JASP's.** `ui/vendor/jasp/` and `tests/apa/utils-test.js` are copied from a JASP branch by `tools/sync-jasp-js.sh`, so don't edit them here. For a change to the APA rules, open an issue or a pull request that describes the fix and a test for it, and it will be moved into the JASP branch.
- **Figure rules:** [docs/figures/RULES.md](docs/figures/RULES.md) lists the APA 7 rules figures must meet, each with its source in the Publication Manual. A change to how figures look should keep to it.
- **Commits:** one plain line saying what the user will notice, with a component prefix when it helps ("Figures: ..."). Add each change to `## Unreleased` in [CHANGELOG.md](CHANGELOG.md), in the same style as the entries there.
- **Writing:** British English, short plain sentences, no em dashes.

**Bug reports.** Use **Feedback and problems** in the app: it opens an issue with the version and system filled in. Say which analysis and table, what you saw and what APA 7 asks for instead. Issues are public, so never attach your own data or `.jasp` files. If a file would help, make one with JASP's example data (File > Data Library).

**Licence.** By submitting a contribution you confirm you have the right to do so, and you license it under the GNU Affero General Public License v3.0 or later, the same as the rest of the project, on the same "as is", no-warranty terms.
