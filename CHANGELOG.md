# Changelog

## Unreleased

### Features
- **First version.** Open a saved JASP file and copy any of its tables as an APA 7 table, with what only you can add highlighted.
- **A new look.** Liquid glass panels over soft colour, with light, dark and pink themes (or follow the system), and a new icon: the psychology psi with the J of JASP.
- **Fast on any computer.** The background is painted once and only floating menus blur what is behind them, so scrolling and theme changes stay smooth. Jumping to a table scrolls with an eased animation. **Reduce effects** in the menu turns off transparency and animation for slower computers, and comes on by itself when the system asks for less motion or transparency.
- **Reloads when JASP saves**, keeping your place. Also: search and filter tables (to do / ready), a ready count, recent files, copy all tables, copy as plain text, number the first table, jump to each highlight, hide highlights in the preview, preview size, and keyboard shortcuts (press ?).
- **Every column has a heading, as APA 7 asks.** Pairs and paths ("Revise – Exam", "Framing → Justification") become one first column headed "Variables" or "Path", and empty headings are named after what the column holds (Predictor, Source, Model, Test). "Variable" is used only when the column lists the analysis's own variables; anything unsure says "[Add heading]".
- **More columns are named for you.** Post hoc comparisons become one "Comparison" column ("Beer – Wine"), and confusion matrices, hypotheses, factors, effects and meta-analysis parameters get their headings. Across JASP's examples, columns asking for a heading went from 106 to 54; the rest depend on the field (audit, machine learning) and stay highlighted.
- **Sample size from the data.** When an analysis's tables don't report *N* (correlations, reliability), it is counted from the data saved in the file: rows that pass the filter and have every variable the analysis uses. Frequency data adds up its counts, and when missing values give each test its own *N* the note gives the range.
- **Sample size for more analyses.** Frequency data (contingency tables, multinomial and log-linear tests) adds up its counts, using the real values when JASP stores them as codes. SEM models written as syntax find their variables. Full-information maximum likelihood counts every row with any value. Regression and GLM weights no longer stop the count.
- **A range when each test has its own N.** With missing values handled per variable or pair (t-tests, paired tests, pairwise correlations), the note says "*N*s range from 8 to 9 because of missing values" instead of asking you.
- **Sample size the way APA's sample tables do it.** Meta-analyses say "Number of studies = 18, total *N* = 2,899" (and the number of effects for multilevel models) instead of a wrong *N*. Tables that show their own sample, tables without numbers and audit settings no longer ask for one. Binomial summary data gets *N* = successes + failures, and JAGS models use their own *n*.

### Fixes
- **Files with very large numbers open.** A meta-analysis file in JASP's Data Library didn't open ("number out of range"); now it does.
- **Missing values are counted the way JASP counts them.** The sample size now leaves out values stored as "nan", values matching the file's empty-value list ("." and others), and missing levels in nominal columns. Wide-format measurement data gets no count from rows.
- **Checked against all of JASP's examples.** Every table in JASP's 124 Data Library files was run through the copier. Fixes from that: pairs written with any JASP symbol become one column, empty columns are removed, "NaN" becomes a dash, and small values follow the decimals instead of showing as 8.72×10⁻⁴.
- Audit files and quality-control measurement data no longer take *N* from the data's rows: those rows are a population or single measurements, and the tables give the real sample.
