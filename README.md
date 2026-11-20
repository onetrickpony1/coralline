# jAPAsp

jAPAsp opens a saved [JASP](https://jasp-stats.org) file and turns every results table in it into an APA 7 table. Click **Copy APA table** and paste into Word or Google Docs. The tables are drawn by JASP's own code, so they show the same values JASP does.

![jAPAsp with the Album Sales example open](docs/screenshot.png)

## Features

- **APA 7 layout:** "Table N" in bold, an italic title in title case, horizontal rules only, a *Note.* under the table.
- **APA numbers:** 2 decimals, 3 for *p* values, no leading zero for statistics that can't exceed 1, commas in thousands, whole-number *df*.
- **APA wording:** sentence-case headings, *M*, *SD*, *SE* and the other standard symbols in italics, readable variable names ("FaceType" becomes "Face type").
- **Sample size:** *N* goes in the note, taken from what the analysis reports, so missing values and filters are already counted.
- **Layouts APA expects:** descriptive statistics with variables in rows, correlation matrices with numbered columns and asterisks instead of *p* rows.
- **What only you can add is highlighted:** a vague title, a missing heading or an unclear abbreviation is marked in yellow in the pasted table, and listed under each table in the app.
- **Fits the page:** column widths are measured so nothing wraps, and wide tables step down to a smaller type size.

## Install

There are no releases yet. Build it from source (see Development).

## Use

1. Save your work in JASP.
2. Open the `.jasp` file in jAPAsp: drop it on the window, or click **Open JASP file**. You can also start it with a file: `japasp-tool results.jasp`.
3. Click **Copy APA table** on a table, then paste it into your document.
4. Fix what is highlighted in yellow, then remove the highlight.

To see a file's tables as JSON instead: `japasp-tool --json results.jasp`.

## Notes

- Only what is saved in the file is shown. Run your analyses and save again in JASP to update it.
- Tables are numbered in the order they appear in the file. Renumber them to match your paper.
- The same APA copy is being proposed for JASP itself, as a "Copy APA Table" menu entry. The code in `ui/vendor/jasp` is shared with that change.

## Development

You need Rust (stable) and, on Linux, WebKitGTK 4.1 (`webkit2gtk-4.1` on Arch, `libwebkit2gtk-4.1-dev` on Debian and Ubuntu).

```sh
cd src-tauri
cargo run --release -- path/to/file.jasp     # the app
cargo test --no-default-features             # the .jasp reader, no WebKit needed
../tests/ui/run.sh                           # the APA tables, in headless Chrome
```

`tests/ui/run.sh` uses JSON dumps in `tests/ui/fixtures/`, made with `japasp-tool --json`. They aren't in the repo.

## License

AGPL-3.0-or-later, because the table code comes from JASP, which is AGPL-3.0. See [LICENSE](LICENSE).
