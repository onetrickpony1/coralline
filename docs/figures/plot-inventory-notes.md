# Plot inventory notes

This file explains `plot-inventory.csv`. The CSV lists every plot kind that JASP 0.99 can draw, one row per kind. It is the base for a coverage matrix of Coralline's APA 7 figure styling.

## How it was built

1. **Upstream snapshots.** I listed the 69 `jasp-stats/jasp*` repos and pulled each git tree. 37 repos hold vdiffr snapshots under `tests/testthat/_snaps/`, 3,529 SVGs in all. I used only paths and names. I did not download the SVGs.
2. **Deparsed module code.** I parsed local dumps of the 38 modules' deparsed R code (not in the repo). Each `createJaspPlot(` call was tied to its enclosing function and its title. That gave 696 calls in 496 functions. These 38 modules are the ones in the installed JASP bundle.
3. **jaspVisualModeling.** Its dump has no `createJaspPlot` calls, because the plots live in the `flexplot` package. I read them from the installed `flexplot` lazy-load database: ten calls in five plot functions.
4. **Coralline examples.** I read 157 readable JSON results of `coralline --figures` on example files (not in the repo). Two were empty. They hold 394 figures, 238 of them trusted.
5. **Plot kinds.** I wrote one catalogue entry per kind by hand. Each entry has a regex for snapshot paths and a regex for example figures (analysis name, figure path, title). A script counted the matches. Each snapshot and each figure goes to exactly one kind. I checked that no regex matched twice.

### Merging rules

- Per-variable, per-pair and per-level copies are one kind. Examples are `residuals-vs-<predictor>` and correlation pairs.
- Option variants are one kind. Examples are BF01, BF10 and log BF, one-sided and two-sided, CI and SE error bars, and horizontal and vertical rainclouds.
- Platform copies (`-mac`, `-unix`) and numbered test cases (`x-bar-r-control-chart12`) are one kind.
- When classical and Bayesian versions of one module share a drawing function, they are one kind. Examples are t-test descriptives, bar and raincloud plots.
- Functions that draw clearly different pictures stay apart, even inside one analysis. For example, the Distributions module has PDF, PMF, CDF, CMF, quantile, data and fit plots.
- The 10 Power test families share four kinds: contour, curve by effect size, curve by N, and demonstration.

### Column meanings

- `panels`: `single`, `multi` (facets or stacked sub-plots are possible) or `matrix` (a grid of variable pairs).
- The trait columns say what *can* occur with common options. They are not limited to the default output. They come from the code and the plot titles. Where Coralline has example figures, I added the geoms it saw, such as `GeomErrorbar`, `GeomRibbon` and `GeomText`.
- `coded_levels_possible`: the plot shows factor levels taken from the data, so numeric codes such as 0 and 1 can reach the axis or legend.
- `plotmath_titles`: the titles or labels use R plotmath or Unicode maths, such as δ, BF₁₀, R² or σ².
- `non_ggplot`: `qgraph` and `qgraph (semPlot)` are base graphics. `grob (...)` means a gtable or arranged layout that wraps ggplots. `ggraph` path plots are ggplot, so they count as `no`.
- `upstream_snapshots` counts SVG files, sub-plots included.
- `example_test_file` is the test file with the most snapshots for that kind.
- `evidence` names the sources that confirm the kind.

## Counts per family

| Family | Kinds | With snapshots | In Coralline examples | With a trusted figure |
|---|---:|---:|---:|---:|
| 1 single-panel continuous | 64 | 53 | 28 | 21 |
| 2 categorical x with error bars | 36 | 30 | 16 | 10 |
| 3 Bayesian | 57 | 36 | 13 | 8 |
| 4 matrix / multi-panel | 25 | 12 | 6 | 3 |
| 5 networks / path diagrams / trees | 16 | 9 | 8 | 5 |
| 6 quality control charts | 35 | 35 | 19 | 0 |
| 7 meta-analysis | 23 | 19 | 6 | 3 |
| 8 polar / circular | 4 | 4 | 2 | 1 |
| 9 time series | 36 | 26 | 5 | 1 |
| 10 Plot Builder | 2 | 2 | 2 | 0 |
| 11 learning / distribution demos | 53 | 34 | 11 | 9 |
| 12 MCMC diagnostics (added) | 11 | 7 | 0 | 0 |
| 13 machine learning performance (added) | 20 | 18 | 7 | 0 |
| 14 power and design curves (added) | 8 | 8 | 0 | 0 |
| **Total** | **390** | **293** | **123** | **61** |

I added families 12 to 14 because those plots fit none of the first 11. Survival curves sit in family 1. Acceptance sampling OC, AOQ and ATI curves sit in family 6.

In short, Coralline's 159 example files reach 123 of the 390 kinds (32%). 61 kinds (16%) have at least one trusted figure, and 54 have only trusted figures. 293 kinds (75%) have upstream snapshots.

## Gaps

### Kinds with neither snapshots nor examples (91)

These kinds show up only in the code. They are the hardest to test, because nothing upstream or local draws them yet.

- **jaspLearnStats (16):** none of its plots have snapshots or examples. This covers CLT, descriptives demo, reliability demo, p-value demo, sampling variability, effect size demos and the test-choice tree.
- **jaspPredictiveAnalytics (10):** the whole module, including the control, forecast, PIT and multivariate plots.
- **jaspMetaAnalysis (9):** trim-and-fill funnel, MASEM path diagram, Bayesian metamisc prior/posterior and MCMC plots, BMA prior and sequential plots, RoBMA and PEMA diagnostics, and PEMA posteriors.
- **jaspNetwork (8):** the whole Bayesian Network Analysis (structure, evidence, centrality, HDI, complexity, posterior structure, SBM co-clustering) plus the classical clustering plot.
- **jaspRegression (6):** logistic residual plots (independent vs predicted, predicted vs residuals, predictor vs residuals) and the Bayesian model complexity, model probabilities and log odds plots.
- **jaspClassicalTests (5):** Q-Q plots and the variance-test box, raincloud, estimate and ratio plots.
- **jaspVisualModeling (5):** all of it. The plots come from the `flexplot` package.
- **jaspLearnBayes (5):** binary classification PPV/NPV by threshold, alluvial, area, PR and TOC.
- **jaspCochrane (4), jaspMachineLearning (4), jaspAnova (3), jaspAudit (3), jaspFrequencies (3), jaspBFF (2), jaspDescriptives (2), jaspRobustTTests (2):** see the CSV rows with 0 in both count columns. The ANOVA three are the Bayesian ANOVA posterior, Q-Q and R² plots. The ML four are the decision boundary matrix, neural network activation and structure, and cluster matrix.
- **One each:** `eq.bayes.sequential`, `factor.cfa.misfit`, `mm.diagnostics`, `sem.lgcm.misfit`.

### Families with thin Coralline coverage

- **MCMC diagnostics (0 of 11)** and **power curves (0 of 8):** no example file reaches them.
- **Quality control (19 of 35 reached, 0 trusted):** Coralline marks every QC chart untrusted. 60 figures say "quality control charts get crowded when redrawn with APA text sizes". This is the largest block of untrusted figures.
- **Machine learning (7 of 20, 0 trusted)** and **Prophet (4 of 7, 0 trusted):** untrusted because the analyses are random, so a rerun draws a different picture. This reason covers 32 figures.
- **Time series (5 of 36):** Bsts, ARIMA, spectral and the time series descriptives are absent. The five reached kinds are three Prophet plots (none trusted), the QC autocorrelation plot and the LGCM curve plot.
- **Bayesian (13 of 57):** t-test, correlation and binomial prior/posterior plots are covered. Robustness checks are untrusted. Audit, Cochrane, BMA, RoBMA, summary statistics tests and the reliability posteriors are missing.
- **Plot Builder (2 of 2 reached, 0 trusted):** both kinds appear, but no figure is trusted.
- **Whole modules with no example figures:** jaspAcceptanceSampling, jaspBFF, jaspBfpack, jaspBsts, jaspClassicalTests, jaspCochrane, jaspEquivalenceTTests, jaspEsci, jaspJags, jaspLearnStats, jaspPower, jaspPredictiveAnalytics, jaspRobust, jaspRobustTTests, jaspTimeSeries and jaspVisualModeling.

### Why example figures are untrusted

Across all 156 untrusted figures, the main reasons are these:

- QC crowding: 60.
- Random analyses: 32.
- The rerun did not draw the plot: 30.
- No tables to check the rerun against: 6.
- Table mismatches in mediation, outlier, funnel and other tables: 16.
- Robustness curves that drift a little between runs: 3.
- Forest plots whose redrawn study order is not yet trusted: 3.

## Ready-made test inputs upstream

Many upstream tests are generated from `.jasp` files kept in `tests/testthat/jaspfiles/`. The test files `test-library-*.R`, `test-example-*.R` and `test-other-*.R` load one of these files and run it with `jaspTools::analysisOptions(jaspFile)`. The shipped modules hold 86 such `.jasp` files, and jaspSyntax holds 2 more:

- jaspMetaAnalysis: 26
- jaspSurvival: 11
- jaspAudit: 8
- jaspTTests: 7
- jaspBain: 7
- jaspBfpack: 6
- jaspAnova: 5
- jaspReliability: 4
- jaspPower: 4
- jaspSem, jaspFactor, jaspClassicalTests and jaspAcceptanceSampling: 2 each

Coralline could rerun them directly. They would fill several of the gaps above, for example Bfpack, Power, acceptance sampling and the newer meta-analysis plots.

The other tests build options by hand. They start from `analysisOptions("<analysis>")` or a helper such as `initTTestOptions(...)`. Then they set fields like `options$descriptivesPlot <- TRUE` and `options$barPlotErrorType <- "se"`, call `runAnalysis`, and compare with `expect_equal_plots(plot, "<name>")`. The snapshot name is the slugged string passed to `expect_equal_plots`. That is why per-option variants show up as separate SVGs.

## Things left out or uncertain

- **jaspGraphs** (55 snapshots) is the plotting library, not an analysis. I left it out of the kinds. Its snapshots for `PlotPriorAndPosterior`, `PlotRobustnessSequential`, `drawBFpizza`, `PlotPieChart`, `descriptivesPlot`, `jaspHistogram` and `plotQQnorm` are good unit references for families 2 and 3.
- **Modules not in the 0.99 bundle:** jaspIrt (11 snapshots: latent ability histogram, plus item characteristic, item information, test information, parameter and heterogeneity plots in code) and jaspLearnN1 (4 snapshots: data plots and an event network). Also jaspRem, jaspBlinding, jaspBayesianQualityControl and jaspIrtStanModels. They are not rows. Add them if a later bundle ships them.
- **Snapshot-only kinds:** nine kinds appear in upstream tests but not in the 0.99 dump. These are the acceptance sampling Bayesian plans, Bayesian and group sequential power, and the Process residual plots. The default branch may be newer than 0.99. Their notes say so.
- **Unattributed snapshots (8):** SVGs named only `analysis-N-figure-M` give no clue to their kind. Six are in jaspRobustTTests (`example-Model-Averaged Bayesian t-Tests`). Two are in jaspMetaAnalysis (`library-Effectiveness of the BCG Vaccine...` and `other-Selection Models - bcg`). They are not counted.
- **Shared snapshot names:** a few test files reuse one name for two plot kinds. These are the Bain t-test per-variable snapshots and the Bayesian equivalence `contnormal` snapshots. I gave all of them to one kind, as the row notes say. The reliability standard error of measurement library snapshots mix CI and point plots, so all of them went to `rel.sem.ci`.
- The bsts snapshots exist in both jaspBsts and jaspTimeSeries. They are counted once per file under the `bsts.*` kinds.
- `analysis` names come from function names and titles in the dump, not from the QML menus. They may differ a little from the menu labels.
