# Development

You need Rust 1.90 or newer and, on Linux, WebKitGTK 4.1 (`webkit2gtk-4.1` on Arch, `libwebkit2gtk-4.1-dev` on Debian and Ubuntu).

```sh
cd src-tauri
cargo run --release -- path/to/file.jasp     # the app
cargo test --no-default-features             # the .jasp reader, no WebKit needed
../tests/apa/run.sh                          # the APA rules (JASP's own tests), in headless Chrome
../tests/ui/run.sh                           # the interface with real tables, in headless Chrome
```

`tests/ui/run.sh` uses JSON dumps in `tests/ui/fixtures/`, made with `coralline --json`. They aren't in the repo.

The corpus check runs every table in JASP's Data Library through the copier and checks it: no crashes, every number of JASP's in the copy, APA *p* values, no exponents outside Bayes factors, every column headed, *N* from the tables matching *N* from the data.

```sh
tests/corpus/dump.sh     # JSON from the installed JASP's Data Library (or a folder of .jasp files)
tests/corpus/run.sh      # summary in the terminal, details in tests/corpus/report.html
```

## The APA code

The APA rules are JASP code (`table.js` and its tests in `utils-test.js`). They are changed in a jasp-desktop checkout first and copied here with `tools/sync-jasp-js.sh`, which also records the commit in `ui/vendor/jasp/SOURCE.md`. Don't edit the copies in `ui/vendor/jasp` or `tests/apa`.

## Releases

Push a tag `vX.Y.Z` whose version has a section in `CHANGELOG.md`. The Release workflow creates the GitHub release from that section and adds the Linux, Windows and macOS builds, which the installers download.
