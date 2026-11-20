# Changelog

## Unreleased

### Features
- **Every column has a heading, as APA 7 asks.** Pairs and paths ("Revise – Exam", "Framing → Justification") become one first column headed "Variables" or "Path", and empty headings are named after what the column holds (Predictor, Source, Model, Test). "Variable" is used only when the column lists the analysis's own variables; anything unsure says "[Add heading]".
- **First version.** Open a saved JASP file and copy any of its tables as an APA 7 table, with what only you can add highlighted.
- **Sample size from the data.** When an analysis's tables don't report *N* (correlations, reliability), it is counted from the data saved in the file: rows that pass the filter and have every variable the analysis uses. It isn't counted for weighted or frequency data, or when missing values give each test its own *N*.

### Fixes
- **Files with very large numbers open.** A meta-analysis file in JASP's Data Library didn't open ("number out of range"); now it does.
- **Missing values are counted the way JASP counts them.** The sample size now leaves out values stored as "nan", values matching the file's empty-value list ("." and others), and missing levels in nominal columns. Wide-format measurement data gets no count from rows.
- **Checked against all of JASP's examples.** Every table in JASP's 124 Data Library files was run through the copier. Fixes from that: pairs written with any JASP symbol become one column, empty columns are removed, "NaN" becomes a dash, and small values follow the decimals instead of showing as 8.72×10⁻⁴.
