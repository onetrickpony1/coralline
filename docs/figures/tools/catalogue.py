# Plot-kind catalogue. One line per kind:
# id | module | analysis | family | panels | traits | non_ggplot | snapshot regex | figure regex | note
# traits: L legend, T text annotations, E error bars, B bands, C categorical x, K coded levels possible, P plotmath titles
# snapshot key: module/testdir/name.svg ; figure key: Analysis|figure name|title
CAT = r"""
as.oc | jaspAcceptanceSampling | Create/Analyze Attribute Plan, Create/Analyze Variable Plan | 6 | single | L | | AcceptanceSampling/.*/oc-operating | |
as.aoq | jaspAcceptanceSampling | Create/Analyze Attribute Plan, Create Variable Plan | 6 | single | L | | AcceptanceSampling/.*/aoq-curve | |
as.ati | jaspAcceptanceSampling | Create/Analyze Attribute Plan, Create/Analyze Variable Plan | 6 | single | L | | AcceptanceSampling/.*/ati-curve | |
as.asn | jaspAcceptanceSampling | Analyze Attribute Plan (multiple plans) | 6 | single | L | | AcceptanceSampling/.*/asn-curve | |
as.bayes.prior-posterior | jaspAcceptanceSampling | Bayesian sampling plan | 3 | single | L | | AcceptanceSampling/other-BaySampl/(prior|posterior)-distribution | | not in the deparsed dump (newer code)
as.bayes.predictive | jaspAcceptanceSampling | Bayesian sampling plan, Bayesian state space plan | 3 | single | C | | AcceptanceSampling/other-Bay(Sampl|SSM)/posterior-predictive | | not in the deparsed dump (newer code)
as.bayes.defect-rate | jaspAcceptanceSampling | Bayesian state space sampling | 9 | single | B | | AcceptanceSampling/other-BaySSM/defect-rate | | not in the deparsed dump (newer code)
anova.descriptives | jaspAnova | ANOVA, ANCOVA, RM ANOVA, Bayesian ANOVA/ANCOVA/RM (.BANOVAdescriptivesPlots) | 2 | single/multi | LECK | | Anova/(anova/descriptives|anovarepeatedmeasures/mixedrmanova\d\.svg|anovarepeatedmeasuresbayesian/descriptives|ancovabayesian/|other-[^/]*/(\.svg|dependent|happiness|puppy-love)) | ^(Anova|Ancova|AnovaBayesian|AncovaBayesian|AnovaRepeatedMeasures|AnovaRepeatedMeasuresBayesian)\|[^|]*descriptivesContainer_containerDescriptivesPlots | separate lines and panels by factor; other-* library snapshots attributed here by name
anova.bar | jaspAnova | ANOVA, RM ANOVA, Bayesian variants (.BANOVAbarPlots) | 2 | single/multi | LECK | | Anova/(anova/barplot|anovarepeatedmeasures/mixedrmanova\dbar) | ^(Anova|Ancova|AnovaRepeatedMeasures)[^|]*\|[^|]*barPlots |
anova.raincloud | jaspAnova | ANOVA, RM ANOVA, Bayesian variants (.BANOVArainCloudPlots) | 2 | single/multi | LCK | | Anova/(anova|anovarepeatedmeasures)/raincloud | ^(Anova|Ancova|AnovaRepeatedMeasures)[^|]*\|[^|]*rainCloud |
anova.qq | jaspAnova | ANOVA, ANCOVA, RM ANOVA (.qqPlotFreqAnova) | 1 | single | B | | Anova/(anova/q-q|other-[^/]*/q-q-plot) | ^(Anova|Ancova|AnovaRepeatedMeasures)\|[^|]*qqPlot |
anova.bayes.posterior | jaspAnova | Bayesian ANOVA/ANCOVA/RM: model averaged and single model posteriors | 3 | single/multi | LBP | | | ^(AnovaBayesian|AncovaBayesian|AnovaRepeatedMeasuresBayesian)\|[^|]*posterior |
anova.bayes.qq | jaspAnova | Bayesian ANOVA/ANCOVA/RM model averaged and single model Q-Q | 1 | single | | | | ^(AnovaBayesian|AncovaBayesian|AnovaRepeatedMeasuresBayesian)\|[^|]*[qQ]{2} |
anova.bayes.rsq | jaspAnova | Bayesian ANOVA/ANCOVA/RM posterior R squared | 3 | single | BP | | | ^(AnovaBayesian|AncovaBayesian|AnovaRepeatedMeasuresBayesian)\|[^|]*[Rr]sq |
audit.prior-posterior | jaspAudit | Bayesian Planning, Bayesian Evaluation, Bayesian Workflow (.jfaPlotPriorAndPosterior) | 3 | single | LTP | | Audit/.*/prior-and-(expected-)?posterior | ^audit[^|]*\|[^|]*PriorAndPosterior |
audit.predictive | jaspAudit | Bayesian Planning (.jfaPlotPredictive) | 3 | single | LC | | Audit/.*/prior-predictive | |
audit.sample-sizes | jaspAudit | Classical/Bayesian Planning (.jfaPlotSampleSizes) | 2 | single | LCK | | Audit/.*/across- | |
audit.presumed-dist | jaspAudit | Classical Planning (.plotErrorDist) | 1 | single | C | | Audit/.*/presumed- | |
audit.objectives | jaspAudit | Classical/Bayesian Evaluation and Workflow (.jfaPlotObjectives) | 2 | single | LEC | | Audit/.*/evaluation-of-sampling-objectives | ^audit[^|]*\|[^|]*plotObjectives |
audit.estimates | jaspAudit | Evaluation with strata (.jfaPlotEstimates) | 2 | single | ECK | | Audit/.*/estimates\.svg | ^audit[^|]*\|[^|]*plotEstimates |
audit.book-dist | jaspAudit | Workflow, Selection (.jfaPlotBookDist) | 1 | single | | | Audit/.*/distribution-of-book-values | ^audit[^|]*\|[^|]*plotBookDist |
audit.scatter | jaspAudit | Evaluation (.jfaPlotScatter, .jfaEstimationCorrelationPlot) | 1 | single | L | | | |
audit.sequential | jaspAudit | Bayesian Evaluation (.jfaPlotSequentialAnalysisEvaluation) | 3 | single | LTP | | Audit/auditbayesianevaluation/sequential-analysis | |
audit.benford | jaspAudit | Benford's Law (.jfaBenfordsLawPlot) | 2 | single | LC | | Audit/.*/observed-vs-expected-relative | ^auditClassicalBenfordsLaw\|[^|]*benfordsLawPlot |
audit.bf-robustness | jaspAudit | Benford's Law, Fairness (.jfaBenfordsLawRobustnessPlot, .jfaFairnessRobustnessPlot) | 3 | single | LTP | | Audit/.*/bayes-factor-robustness-plot | |
audit.bf-sequential | jaspAudit | Benford's Law, Fairness (.jfaBenfordsLawSequentialPlot, .jfaFairnessSequentialPlot) | 3 | single | LTP | | Audit/.*/sequential-analysis-plot | |
audit.fairness.parity | jaspAudit | Fairness (.jfaFairnessParityPlot) | 2 | single | ECK | | Audit/.*/parity-estimates | |
audit.fairness.posterior | jaspAudit | Bayesian Fairness (.jfaFairnessPosteriorPlot) | 3 | single | LP | | | |
audit.fairness.workflow | jaspAudit | Fairness Workflow selection (.jfaClassicalFairnessWorkflowSelectionPlot) | 5 | single | T | | | | decision tree diagram drawn in ggplot
audit.bunching.hist | jaspAudit | Number Bunching (.jfaNumberBunchingHistorgramPlot) | 1 | single | | | Audit/.*/histogram-of-individual-values | |
audit.bunching.frequency | jaspAudit | Number Bunching (.jfaNumberBunchingFrequencyPlot) | 1 | single | T | | Audit/.*/observed-vs-expected-average-frequency | |
audit.bunching.entropy | jaspAudit | Number Bunching (.jfaNumberBunchingEntropyPlot) | 1 | single | T | | Audit/.*/observed-vs-expected-entropy | |
bff.function | jaspBFF | Bayes Factor Functions (.bffBayesFactorFunctionPlot) | 3 | single | LP | | | |
bff.prior-posterior | jaspBFF | Bayes Factor Functions (.bffPriorAndPosteriorPlot) | 3 | single | LP | | | |
bain.descriptives | jaspBain | Bain ANOVA, ANCOVA (adjusted means), t-tests (.bainDescriptivePlots) | 2 | single | ECK | | Bain/(bainanovabayesian/descriptives|bainancovabayesian/adjusted|bainttest[^/]*/|library-bain(Independent|One|Paired)[^/]*/) | ^Bain(Anova|Ancova|TTest)[^|]*\|[^|]*descriptivesPlots | t-test snapshots are per variable and mix this kind with the posterior probabilities; all attributed here
bain.posterior-probs | jaspBain | All Bain analyses (.bainPosteriorProbabilityPlot) | 8 | single | LTK | | Bain/.*/posterior-probabilities | ^Bain[^|]*\|[^|]*posteriorProbabilityPlot | pie chart in polar coordinates
bain.sem.path | jaspBain | Bain SEM (.bainSemPathDiagram) | 5 | single | T | qgraph (semPlot) | Bain/(.*/path-diagram|library-bainSem/group) | ^BainSemBayesian\| |
bfpack.probabilities | jaspBfpack | All BFpack analyses (.bfpackPriorPosteriorProbabilityPlot) | 8 | single | LTK | | Bfpack/.*/(prior|posterior)-probabilities | | pie charts
bfpack.cor.posterior | jaspBfpack | BFpack Correlation (.bfpackPosteriorDistributionPlot) | 3 | single | BP | | Bfpack/bfpackcorrelation/cont[^/]*-in-g\d(-\d+)?\.svg | |
bfpack.trace | jaspBfpack | BFpack Correlation (.makeSingleTraceplot) | 12 | single | | | Bfpack/.*-trace | |
bsts.aggregated-state | jaspBsts (copy in jaspTimeSeries) | Bayesian State Space (.bstsAggregatedStatePlot) | 9 | single | B | | /bayesianStateSpace/aggregated-state | |
bsts.component-states | jaspBsts (copy in jaspTimeSeries) | Bayesian State Space (.bstsComponentStatePlot) | 9 | multi | B | | /bayesianStateSpace/component-states | |
bsts.prediction | jaspBsts (copy in jaspTimeSeries) | Bayesian State Space (.bstsCreatePredictionPlot) | 9 | single | B | | /bayesianStateSpace/prediction-plot | |
bsts.forecast-error | jaspBsts (copy in jaspTimeSeries) | Bayesian State Space (.bstsForecastErrorPlot) | 9 | single | B | | /bayesianStateSpace/forecast-error | |
bsts.residual | jaspBsts (copy in jaspTimeSeries) | Bayesian State Space (.bstsResidualPlot) | 9 | single | | | /bayesianStateSpace/residual-plot | |
bsts.control-probability | jaspBsts (copy in jaspTimeSeries) | Bayesian State Space control plots (.bstsFillControlPlotProbability) | 9 | single | B | | /bayesianStateSpace/probability-plot | |
bsts.control-threshold | jaspBsts (copy in jaspTimeSeries) | Bayesian State Space control plots (.bstsFillControlPlotThreshold) | 9 | single | L | | /bayesianStateSpace/threshold-plot | |
circular.rose | jaspCircular | Circular Statistics Descriptives (.circularDescriptivesCreatePlot) | 8 | single | T | | Circular/ | ^CircularStatisticsDescriptives\| | polar coord_polar plot per variable or level
ct.multprop.descriptives | jaspClassicalTests | Multiple Proportions (.mpDescriptivesPlot) | 2 | single | ECK | | ClassicalTests/multipleProportions/ | |
ct.onecor.scatter | jaspClassicalTests | One Correlation (.oneCorrelationScatterPlot) | 1 | single/multi | B | | ClassicalTests/oneCorrelation/ | | optional marginal densities
ct.twocor.scatter | jaspClassicalTests | Two Correlations (.twoCorrelationsScatterPlots) | 1 | single | LB | | ClassicalTests/twoCorrelations/ | |
ct.qq | jaspClassicalTests | Classical tests Q-Q plots (.createQQPlot, .createQQPlotMV) | 1 | single/multi | B | | | |
ct.mv.box | jaspClassicalTests | Variance tests (.boxplotMV) | 2 | single | CK | | | |
ct.mv.raincloud | jaspClassicalTests | Variance tests (.rainCloudPlotMV) | 2 | single | LCK | | | |
ct.var.estimate | jaspClassicalTests | Variance tests (.varEstimatePlotMV) | 2 | single | ECK | | | |
ct.var.ratio | jaspClassicalTests | Variance tests (.varRatioPlotMV) | 2 | single | ECK | | | |
cochrane.descriptive | jaspCochrane | Cochrane classical meta-analyses (.cochraneDecriptivePlot) | 1 | single | | | Cochrane/cochrane[^/]*classical[^/]*/(effect-size|sample-size|log-odds-ratio|risk-difference) | | histograms of study effect sizes and sample sizes
cochrane.forest | jaspCochrane | Cochrane classical meta-analyses (.metaAnalysisForestPlot) | 7 | single | TEC | | Cochrane/.*/forest-plot | |
cochrane.funnel | jaspCochrane | Cochrane classical meta-analyses (.metaAnalysisFunnelPlot) | 7 | single | | | Cochrane/.*/funnel-plot | |
cochrane.trim-fill | jaspCochrane | Cochrane classical meta-analyses (.metaAnalysisTrimFillPlot) | 7 | single | L | | Cochrane/.*/trim-fill | |
cochrane.profile | jaspCochrane | Cochrane classical meta-analyses (.metaAnalysisProfilePlot) | 7 | single | P | | | |
cochrane.diagnostic | jaspCochrane | Cochrane classical meta-analyses (.metaAnalysisDiagnosticPlot) | 7 | multi | | | | |
cochrane.bma.prior-posterior | jaspCochrane | Cochrane Bayesian meta-analyses (.bmaPriorAndPosteriorPlot) | 3 | single | LTP | | Cochrane/cochrane[^/]*bayesian[^/]*/(effect-size|heterogeneity) | |
cochrane.bma.prior | jaspCochrane | Cochrane Bayesian meta-analyses (.bmaPriorPlot) | 3 | single | LP | | | |
cochrane.bma.forest | jaspCochrane | Cochrane Bayesian meta-analyses (.bmaForestPlot, cumulative too) | 7 | single | LTEC | | Cochrane/.*/observed-study-effects | |
cochrane.bma.sequential | jaspCochrane | Cochrane Bayesian meta-analyses (.bmaSequentialPlot) | 3 | single | LP | | | |
desc.distribution | jaspDescriptives | Descriptive Statistics distribution plots (.descriptivesFrequencyPlots_SubFunc) | 1 | single | CK | | Descriptives/descriptives/(countplot|facgender) | ^Descriptives\|distributionPlots | histogram with density for scale, bar chart for nominal
desc.density | jaspDescriptives | Descriptive Statistics density plots (.descriptivesDensityPlotsFill) | 1 | single | LBK | | Descriptives/descriptives/densplot | ^Descriptives\|densityPlot |
desc.qq | jaspDescriptives | Descriptive Statistics Q-Q plots | 1 | single | B | | Descriptives/descriptives/qqplot | ^Descriptives\|QQPlots |
desc.box | jaspDescriptives | Descriptive Statistics boxplots, violin, jitter (.descriptivesSplitPlot) | 2 | single | CK | | Descriptives/descriptives/boxplot | ^Descriptives\|boxPlot |
desc.dot | jaspDescriptives | Descriptive Statistics dot plots | 1 | single | | | Descriptives/descriptives/dot | ^Descriptives\|DotPlots |
desc.interval | jaspDescriptives | Descriptive Statistics interval plots (.descriptivesIntervalPlot) | 2 | single | ECK | | Descriptives/descriptives/interval-plot | ^Descriptives\|IntervalPlots |
desc.scatter | jaspDescriptives | Descriptive Statistics scatter plots (.descriptivesScatterPlots) | 4 | multi | LBK | grob (marginal densities) | Descriptives/descriptives/scatterplot | ^Descriptives\|scatterPlots | main scatter plus marginal density panels
desc.matrix | jaspDescriptives | Descriptive Statistics correlation plot (.descriptivesMatrixPlot) | 4 | matrix | T | grob (ggMatrixPlot) | Descriptives/descriptives/correlation | ^Descriptives\|matrixPlot |
desc.pie | jaspDescriptives | Descriptive Statistics pie charts (.descriptivesPieChart_SubFunc) | 8 | single | LK | | Descriptives/descriptives/piechart | |
desc.pareto | jaspDescriptives | Descriptive Statistics Pareto plots (.descriptivesParetoPlots_SubFunc) | 2 | single | TCK | | Descriptives/descriptives/parplot | | dual y axis
desc.likert | jaspDescriptives | Descriptive Statistics Likert plots (.descriptivesLikertPlotsFill) | 2 | single | LTCK | | Descriptives/descriptives/likplot | | horizontal stacked bars
desc.heatmap | jaspDescriptives | Descriptive Statistics heatmaps (.descriptivesCreateSingleHeatmap) | 4 | single | LTCK | | | |
desc.raincloud | jaspDescriptives | Raincloud Plots analysis (.rainCreatePlots) | 2 | single | LECK | | Descriptives/raincloudPlots/ | |
desc.ts.timeseries | jaspDescriptives | Time series descriptives (.tsTimeSeriesPlotDescriptives) | 9 | single | | | Descriptives/DescriptivesTimeSeries/time-series | |
desc.ts.acf | jaspDescriptives | Time series descriptives (.tsACFDescriptives) | 9 | single | B | | Descriptives/DescriptivesTimeSeries/autocorrelation | |
desc.ts.pacf | jaspDescriptives | Time series descriptives (.tsPACFDescriptives) | 9 | single | B | | Descriptives/DescriptivesTimeSeries/partial-auto | |
desc.ts.lag | jaspDescriptives | Time series descriptives (.tslagPlotDescriptives) | 9 | single | | | Descriptives/DescriptivesTimeSeries/lag-plot | |
plotbuilder.plot | jaspDescriptives | Plot Builder individual plots (.plotBuilderOutputIndividualPlots) | 10 | single/multi | LTEBCK | | Descriptives/example-[^/]*/plot | ^jaspPlotBuilder\|[^|]*\|Plot \d | any geom the user picks, with brackets, facets and annotations
plotbuilder.grid | jaspDescriptives | Plot Builder combined grid (.plotBuilderOutputPlotGrid) | 10 | multi | LT | grob (patchwork/cowplot grid) | Descriptives/example-[^/]*/combined-plot-grid | ^jaspPlotBuilder\|plotGrid |
dist.pdf | jaspDistributions | Continuous distributions (.ldPlotPDF) | 11 | single | BP | | Distributions/ld[^/]*/density-plot | ^LD[^|]*\|pdfPlot |
dist.pmf | jaspDistributions | Discrete distributions (.ldPlotPMF) | 11 | single | P | | Distributions/ld[^/]*/probability-mass | ^LD[^|]*\|pmfPlot |
dist.cdf | jaspDistributions | Continuous distributions (.ldPlotCDF) | 11 | single | BP | | Distributions/ld(?!bernoulli|betabinomial|binomial|geometric|hypergeometric|negbinomial|poisson)[^/]*/cumulative-probability | ^LD[^|]*\|cdfPlot |
dist.cmf | jaspDistributions | Discrete distributions (.ldPlotCMF) | 11 | single | P | | Distributions/ld(bernoulli|betabinomial|binomial|geometric|hypergeometric|negbinomial[^/]*|poisson[^/]*)/cumulative-probability | ^LD[^|]*\|cmfPlot |
dist.qf | jaspDistributions | Continuous distributions (.ldPlotQF) | 11 | single | P | | Distributions/ld[^/]*/quantile-plot | ^LD[^|]*\|qfPlot |
dist.data.histogram | jaspDistributions | Data checks: histogram or bar plot (.ldPlotHistogram) | 11 | single | | | Distributions/ld[^/]*/(histogram|bar-plot)\.svg | ^LD[^|]*\|histogram |
dist.data.ecdf | jaspDistributions | Data checks: empirical CDF (.ldPlotECDF) | 11 | single | | | Distributions/ld[^/]*/empirical-cumulative | ^LD[^|]*\|ecdf |
dist.fit.hist | jaspDistributions | Fit assessment: histogram vs theoretical PDF/PMF (.ldFitPlots) | 11 | single | | | Distributions/ld[^/]*/histogram-vs | ^LD[^|]*\|estP[DM]F |
dist.fit.ecdf | jaspDistributions | Fit assessment: empirical vs theoretical CDF (.ldFitPlots) | 11 | single | | | Distributions/ld[^/]*/empirical-vs | ^LD[^|]*\|estCDF |
dist.fit.qq | jaspDistributions | Fit assessment: Q-Q plot (.ldFitPlots) | 11 | single | B | | Distributions/ld[^/]*/q-q-plot | ^LD[^|]*\|qqplot |
dist.fit.pp | jaspDistributions | Fit assessment: P-P plot (.ldFitPlots) | 11 | single | B | | Distributions/ld[^/]*/p-p-plot | ^LD[^|]*\|ppplot |
dist.compare.hist | jaspDistributions | Compare Continuous Distributions (.ccdEmpiricalPlots) | 11 | single | L | | Distributions/comparecontinuousdistributions/hist | |
dist.compare.ecdf | jaspDistributions | Compare Continuous Distributions (.ccdEmpiricalPlots) | 11 | single | L | | Distributions/comparecontinuousdistributions/ecdf | |
dist.compare.qq | jaspDistributions | Compare Continuous Distributions (.ccdEmpiricalPlots) | 11 | single | L | | Distributions/comparecontinuousdistributions/qq | |
dist.compare.pp | jaspDistributions | Compare Continuous Distributions (.ccdEmpiricalPlots) | 11 | single | L | | Distributions/comparecontinuousdistributions/pp | |
eq.bounds | jaspEquivalenceTTests | Equivalence t-tests, frequentist (.equivalencePlotInd, .equivalenceOnePlot, .equivalenceBoundsPlotPaired) | 2 | single | E | | EquivalenceTTests/(equivalence(independent|onesample|paired)|example-) | | CI against shaded equivalence region
eq.bayes.prior-posterior | jaspEquivalenceTTests | Bayesian equivalence t-tests (.equivalencePriorandPosterior) | 3 | single | LTBP | | EquivalenceTTests/equivalencebayesian | | snapshots per variable also hold the sequential plot
eq.bayes.sequential | jaspEquivalenceTTests | Bayesian equivalence t-tests (.equivalencePlotSequentialAnalysis) | 3 | single | LTP | | | |
esci.describe | jaspEsci | esci Describe (jasp_histogram_create) | 1 | single | L | | Esci/jasp_describe/ | | histogram or dot plot with markers
esci.estimation | jaspEsci | esci estimate mean/proportion/correlation differences (jasp_plot_m_prep) | 2 | single | LTECK | | Esci/jasp_estimate_(mdiff_(one|two|paired|ind)|pdiff|r|rdiff)[^/]*/(?!.*scatterplot) | | difference axis, raw data, CI
esci.mdiff-2x2 | jaspEsci | esci 2x2 designs (jasp_estimate_mdiff_2x2) | 2 | single | LECK | | Esci/jasp_estimate_mdiff_2x2/ | | interaction and main-effect figures
esci.scatter | jaspEsci | esci correlation scatterplots (jasp_estimate_r, rdiff_two) | 1 | single | LB | | Esci/.*scatterplot | |
esci.forest | jaspEsci | esci meta-analysis (jasp_forest_plot_prep) | 7 | single | LTEC | | Esci/jasp_meta | |
factor.path | jaspFactor | EFA, PCA path diagrams (.efaPathDiagram, .pcaPathDiagram) | 5 | single | T | qgraph | Factor/(exploratoryfactoranalysis|principalcomponentanalysis|verified-exploratoryfactoranalysis|library-G Factor)/path-diagram | ^(exploratoryFactorAnalysis|principalComponentAnalysis)\|[^|]*path |
factor.scree | jaspFactor | EFA, PCA, number of factors (.efaScreePlot, .pcaScreePlot) | 1 | single | L | | Factor/.*/scree | ^(exploratoryFactorAnalysis|principalComponentAnalysis)\|[^|]*scree |
factor.cfa.path | jaspFactor | CFA model plot (.cfaPlotPath) | 5 | single | T | qgraph (semPlot) | Factor/library-Mental Ability/model-plot | ^confirmatoryFactorAnalysis\|[^|]*pathplot |
factor.cfa.misfit | jaspFactor | CFA misfit plot (.cfaPlotMisfit) | 4 | matrix | T | grob (ggMatrixPlot) | | |
factor.lca.items | jaspFactor | Latent Class Analysis (.lcaItemProbabilitiesPlot) | 2 | multi | LCK | | Factor/latentclassanalysis/ | |
freq.binom.descriptives | jaspFrequencies | Binomial Test (.binomPlotsDescriptive) | 2 | single | ECK | | | ^BinomialTest\|containerPlots |
freq.multinom.descriptives | jaspFrequencies | Multinomial Test, Bayesian Multinomial, informed variants (.multinomialDescriptivesPlot and friends) | 2 | single | ECK | | Frequencies/multinomialtest(bayesian)?/ | ^MultinomialTest[^|]*\|[^|]*descriptivesPlot |
freq.binom.bayes.prior-posterior | jaspFrequencies | Bayesian Binomial Test (.bayesBinomPriorPosteriorPlot) | 3 | multi | LTP | | Frequencies/binomialtestbayesian/prior-posterior | ^BinomialTestBayesian\|[^|]*priorposterior |
freq.binom.bayes.sequential | jaspFrequencies | Bayesian Binomial Test (.bayesBinomSequentialPlot) | 3 | multi | LTP | | Frequencies/binomialtestbayesian/sequential | ^BinomialTestBayesian\|[^|]*sequential |
freq.abtest.prior-posterior | jaspFrequencies | Bayesian A/B Test (.abTestPlotPriorPosterior, .abTestPlotPriorOnly) | 3 | single | LTP | | | |
freq.abtest.robustness | jaspFrequencies | Bayesian A/B Test (.abTestPlotRobustness) | 4 | single | LP | | Frequencies/abtestbayesian/robustness | | heat map of BF over prior settings
freq.abtest.sequential | jaspFrequencies | Bayesian A/B Test (.abTestPlotSequential) | 3 | single | LP | | Frequencies/abtestbayesian/sequential | | posterior model probabilities over n
freq.conttab.bayes.logodds | jaspFrequencies | Bayesian Contingency Tables (.contTabBasLogOddsPlot) | 3 | multi | LTP | | Frequencies/contingencytablesbayesian/ | ^ContingencyTablesBayesian\| |
freq.informed.posterior | jaspFrequencies | Informed Bayesian binomial/multinomial (.createInformed*PosteriorPlot) | 3 | single | LECK | | | |
freq.informed.sequential | jaspFrequencies | Informed Bayesian binomial/multinomial (.createInformed*SequentialAnalysisPlot) | 3 | single | LP | | | |
jags.trace | jaspJags | JAGS (.JAGSInitContainerWithPlots) | 12 | single | L | | Jags/jagsmodule/plottrace | |
jags.density | jaspJags | JAGS | 12 | single | L | | Jags/jagsmodule/plotdensity | |
jags.histogram | jaspJags | JAGS | 12 | single | L | | Jags/jagsmodule/plothistogram | |
jags.autocor | jaspJags | JAGS | 12 | single | L | | Jags/jagsmodule/plotautocor | |
jags.bivariate | jaspJags | JAGS bivariate scatter (.JAGSInitPlotsContainers) | 4 | matrix | | grob (ggMatrixPlot) | Jags/jagsmodule/bivariate | |
jags.stacked-density | jaspJags | JAGS stacked density (.JAGSstackedDensityPlot) | 12 | single | LC | | Jags/jags-customizableInference/ | |
lb.bc.estimates | jaspLearnBayes | Binary Classification (.bcPlotEstimates) | 11 | single | ECK | | LearnBayes/lsbinaryclassification/estimates | |
lb.bc.icon | jaspLearnBayes | Binary Classification (.bcPlotIconPlot) | 11 | single | L | | LearnBayes/lsbinaryclassification/icon | |
lb.bc.ppvnpv-prevalence | jaspLearnBayes | Binary Classification (.bcPlotVaryingPrevalence) | 11 | single | LB | | LearnBayes/lsbinaryclassification/ppv-and-npv | |
lb.bc.ppvnpv-threshold | jaspLearnBayes | Binary Classification (.bcPlotPpvNpv) | 11 | single | LB | | | |
lb.bc.prob-positive | jaspLearnBayes | Binary Classification (.bcPlotPriorPosteriorPositive) | 11 | single | LC | | LearnBayes/lsbinaryclassification/probability-positive | |
lb.bc.roc | jaspLearnBayes | Binary Classification (.bcPlotROC) | 11 | single | B | | LearnBayes/lsbinaryclassification/receiving | |
lb.bc.signal | jaspLearnBayes | Binary Classification (.bcPlotSignal) | 11 | single | LB | | LearnBayes/lsbinaryclassification/signal | |
lb.bc.test-characteristics | jaspLearnBayes | Binary Classification (.bcPlotTestCharacteristics) | 11 | single | LB | | LearnBayes/lsbinaryclassification/test-characteristics | |
lb.bc.alluvial | jaspLearnBayes | Binary Classification (.bcPlotAlluvial) | 11 | single | LTC | | | |
lb.bc.area | jaspLearnBayes | Binary Classification (.bcPlotAreaPlot) | 11 | single | LT | | | |
lb.bc.pr | jaspLearnBayes | Binary Classification (.bcPlotPR) | 11 | single | B | | | |
lb.bc.toc | jaspLearnBayes | Binary Classification (.bcPlotTOC) | 11 | single | B | | | |
lb.est.prior-posterior | jaspLearnBayes | Binomial/Gaussian Estimation prior and posterior (.plotsSimple*, .plotsIndividual*, .plotsBoth*) | 11 | single/multi | LTBP | | LearnBayes/lsbinomialestimation/(models|posterior-plot|prior-plot|titleless) | |
lb.est.predictions | jaspLearnBayes | Binomial/Gaussian Estimation predictions (.plotsPredictions*) | 11 | single/multi | LTC | | LearnBayes/lsbinomialestimation/prediction | |
lb.est.sequential | jaspLearnBayes | Binomial/Gaussian Estimation sequential (.plotsIterativeOverlying*, .plotsIterativeStacked*) | 11 | single/multi | LBP | | LearnBayes/lsbinomialestimation/sequential-plot | |
lb.est.sequential-interval | jaspLearnBayes | Binomial/Gaussian Estimation sequential intervals (.plotsIterativeInterval*) | 11 | single/multi | LBP | | LearnBayes/lsbinomialestimation/seq[a-z]*ntial-interval | |
lb.test.prior-posterior | jaspLearnBayes | Binomial Testing prior and posterior (.plots*Binomial2LS) | 11 | single/multi | LTBP | | LearnBayes/lsbinomialtesting/(hypothesis|posterior-plot|prior-plot|prior-and-posterior|titleless) | |
lb.test.predictions | jaspLearnBayes | Binomial Testing predictions (.plotsPredictionsBinomial2LS) | 11 | single/multi | LTC | | LearnBayes/lsbinomialtesting/(posterior|prior)-prediction | ^LSbinomialtesting\|priorPredictive |
lb.test.predictive-accuracy | jaspLearnBayes | Binomial Testing predictive accuracy (.plotsPredAccuracyBinomial2LS) | 11 | single | LTC | | LearnBayes/lsbinomialtesting/predic[it]+ve-accuracy | |
lb.test.sequential | jaspLearnBayes | Binomial Testing sequential (.plotsIterativeOverlyingBinomial2LS) | 11 | single | LP | | LearnBayes/lsbinomialtesting/sequential | ^LSbinomialtesting\|sequential |
lb.buffon.needle | jaspLearnBayes | Buffon's Needle simulation (.buffonsNeedleSimulationNeedlePlot) | 11 | single | | | LearnBayes/lsbuffonsneedlesimulation/needle | |
lb.buffon.prop | jaspLearnBayes | Buffon's Needle (.buffonsNeedle*PropDistPlot) | 11 | single | LTBP | | LearnBayes/lsbuffonsneedle[^/]*/prior-and-posterior-for-proportion | |
lb.buffon.pi | jaspLearnBayes | Buffon's Needle (.buffonsNeedle*PiDistPlot) | 11 | single | LTBP | | LearnBayes/lsbuffonsneedle[^/]*/implied | |
lb.game.win-prob | jaspLearnBayes | Game of Chance, Game of Skill | 11 | single | LCK | | LearnBayes/lsgameof | |
ls.clt.parent | jaspLearnStats | Central Limit Theorem (.cltParentDistribution) | 11 | single | | | | |
ls.clt.samples | jaspLearnStats | Central Limit Theorem (.cltPlotSamples) | 11 | multi | | | | |
ls.clt.sampling | jaspLearnStats | Central Limit Theorem (.cltSamplingDistribution) | 11 | single | L | | | |
ls.desc.explanation | jaspLearnStats | Descriptive statistics demo (.descExplanation) | 11 | single | LT | | | |
ls.desc.dotplot | jaspLearnStats | Descriptive statistics demo (.lstDescCreateDotplot) | 11 | single | T | | | |
ls.desc.histbar | jaspLearnStats | Descriptive statistics demo (.lstDescCreateHistogramOrBarplot) | 11 | single | T | | | |
ls.reliability.convergence | jaspLearnStats | Reliability demo (.plotConvergencePlot) | 11 | single | L | | | |
ls.reliability.samples | jaspLearnStats | Reliability demo (.plotDatasets) | 11 | multi | | | | |
ls.reliability.tree | jaspLearnStats | Reliability demo (.plotTreePlot) | 5 | single | T | | | |
ls.pvalues.pvalues | jaspLearnStats | p-value demo (.pvPlotPValues) | 11 | single | | | | |
ls.pvalues.teststats | jaspLearnStats | p-value demo (.pvPlotTestStatistics) | 11 | single | | | | |
ls.pvalues.theoretical | jaspLearnStats | p-value demo (.pvPlotTheoreticalDistribution) | 11 | single | BT | | | |
ls.sampling.population | jaspLearnStats | Sampling variability (.svPlotFinitePopulation) | 11 | single | | | | |
ls.sampling.samples | jaspLearnStats | Sampling variability (.svPlotFiniteSamples) | 11 | multi | | | | |
ls.effectsize.dist | jaspLearnStats | Effect size demos for delta, phi, rho (.tsDeltaPlot, .tsPhiPlot, .tsRhoPlot) | 11 | single | LT | | | | includes a raincloud variant
ls.decision-tree | jaspLearnStats | Test choice decision tree (LSTdecisionTree) | 5 | single | T | | | |
ml.datasplit | jaspMachineLearning | All ML analyses (.mlPlotDataSplit) | 13 | single | TC | | MachineLearning/.*/data-split | ^ml[^|]*\|plotDataSplit |
ml.boost.deviance | jaspMachineLearning | Boosting (.mlBoostingPlotDeviance) | 13 | single | L | | MachineLearning/.*/deviance-plot | |
ml.boost.oob | jaspMachineLearning | Boosting (.mlBoostingPlotOobImprovement) | 13 | single | | | MachineLearning/.*/out-of-bag-improvement | |
ml.relinf | jaspMachineLearning | Boosting (.mlBoostingPlotRelInf) | 13 | single | CK | | MachineLearning/.*/relative-influence | |
ml.rf.decrease-acc | jaspMachineLearning | Random Forest (.mlRandomForestPlotDecreaseAccuracy) | 13 | single | CK | | MachineLearning/.*/mean-decrease-in-accuracy | |
ml.rf.node-purity | jaspMachineLearning | Random Forest (.mlRandomForestPlotIncreasePurity) | 13 | single | CK | | MachineLearning/.*/total-increase-in-node-purity | |
ml.rf.oob-error | jaspMachineLearning | Random Forest (.mlRandomForestPlotError) | 13 | single | L | | MachineLearning/.*/out-of-bag-(classification-accuracy|mean-squared) | |
ml.error | jaspMachineLearning | KNN, SVM, Decision Tree, Neural Network error/accuracy plots | 13 | single | L | | MachineLearning/.*/(classification-accuracy-plot|mean-squared-error-plot) | ^ml[^|]*\|errorVsKPlot |
ml.lda.matrix | jaspMachineLearning | LDA (.mlClassificationLdaPlotDiscriminants) | 4 | matrix | L | grob (ggMatrixPlot) | MachineLearning/.*/linear-discriminant-matrix | |
ml.andrews | jaspMachineLearning | Classification (.mlClassificationPlotAndrews) | 13 | single | LK | | MachineLearning/.*/andrews-curves | |
ml.boundary | jaspMachineLearning | Classification decision boundary matrix (.mlClassificationPlotBoundaries) | 4 | matrix | LK | grob (ggMatrixPlot) | | |
ml.roc | jaspMachineLearning | Classification (.mlClassificationPlotRoc) | 13 | single | LK | | MachineLearning/.*/roc-curves | ^ml[^|]*\|rocCurve |
ml.knn.weights | jaspMachineLearning | KNN weights (.mlKnnPlotWeights) | 13 | single | | | MachineLearning/.*/rectangular-weight | |
ml.nn.activation | jaspMachineLearning | Neural Network (.mlNeuralNetworkPlotActivationFunction) | 13 | single | | | | |
ml.nn.structure | jaspMachineLearning | Neural Network (.mlNeuralNetworkPlotStructure) | 5 | single | LT | | | |
ml.tree | jaspMachineLearning | Decision Tree (.mlDecisionTreePlotTree) | 5 | single | T | | MachineLearning/.*/decision-tree-plot | ^ml[^|]*\|decisionTreePlot | ggparty-style tree in ggplot
ml.predperf | jaspMachineLearning | Regression analyses (.mlRegressionPlotPredictedPerformance) | 13 | single | | | MachineLearning/.*/predictive-performance | ^ml[^|]*\|predictedPerformancePlot |
ml.reg.lambda | jaspMachineLearning | Regularized regression (.mlRegressionRegularizedPlotLambda) | 13 | single | LB | | MachineLearning/.*/lambda-evaluation | |
ml.reg.trace | jaspMachineLearning | Regularized regression (.mlRegressionRegularizedPlotVariableTrace) | 13 | single | L | | MachineLearning/.*/variable-trace | |
ml.cluster.features | jaspMachineLearning | Clustering: all features (.mlClusteringPlotDensities, .mlClusteringPlotMeans) | 13 | multi | LECK | | MachineLearning/.*/all-predictors | ^ml[^|]*\|oneFigure | density ridges or cluster means
ml.cluster.elbow | jaspMachineLearning | Clustering (.mlClusteringPlotElbow) | 13 | single | L | | MachineLearning/.*/elbow | ^ml[^|]*\|optimPlot |
ml.cluster.kdist | jaspMachineLearning | Density-based clustering (.mlClusteringDensityBasedPlotError) | 13 | single | | | MachineLearning/.*/k-distance | |
ml.cluster.dendrogram | jaspMachineLearning | Hierarchical clustering (.mlClusteringHierarchicalDendogram) | 5 | single | | | MachineLearning/.*/dendogram | |
ml.cluster.tsne | jaspMachineLearning | Clustering t-SNE plot (.mlClusteringPlotTsne) | 13 | single | LK | | | ^ml[^|]*\|plot2dCluster |
ml.cluster.matrix | jaspMachineLearning | Clustering matrix plot (.mlClusteringMatrixPlot) | 4 | matrix | LK | grob (ggMatrixPlot) | | |
ma.forest | jaspMetaAnalysis | Classical meta-analysis, multilevel/multivariate (.maUltimateForestPlot) | 7 | single | TEC | | MetaAnalysis/(library-|other-)(?!Forest Plot|EuroSCORE)[^/]*/(forest-plot|subgroup) | ^ClassicalMetaAnalysis[^|]*\|forestPlot | estimates and CI text columns on the right
ma.forest.standalone | jaspMetaAnalysis | Forest Plot analysis (.fpStandaloneForestPlot) | 7 | single | TEC | | MetaAnalysis/other-Forest Plot | |
ma.funnel | jaspMetaAnalysis | Funnel Plot analysis (.fpPlot) | 7 | single | LT | | | ^FunnelPlot\| |
ma.funnel.trimfill | jaspMetaAnalysis | Funnel Plot analysis trim and fill (.fpTrimAndFillPlot) | 7 | single | LT | | | |
ma.bubble | jaspMetaAnalysis | Meta-regression bubble plots (.maBubblePlotFun) | 7 | single | LBK | | MetaAnalysis/.*/bubble-plots | ^ClassicalMetaAnalysis[^|]*\|bubblePlot |
ma.baujat | jaspMetaAnalysis | Classical meta-analysis diagnostics (.maBaujatPlotFun) | 7 | single | T | | MetaAnalysis/.*/baujat | |
ma.profile | jaspMetaAnalysis | Profile likelihood (.maProfileLikelihoodPlotFun) | 7 | single | P | | MetaAnalysis/.*/profile-plot | ^ClassicalMetaAnalysis[^|]*\|plot\d | sigma[1]^2 plotmath titles
ma.residual-funnel | jaspMetaAnalysis | Classical meta-analysis diagnostics (.maResidualFunnelPlotFun) | 7 | single | | | MetaAnalysis/.*/residual-funnel | |
ma.masem.path | jaspMetaAnalysis | Meta-analytic SEM (.masemModelPathDiagram) | 5 | single | T | qgraph (semPlot) | | |
ma.metamisc.funnel-asym | jaspMetaAnalysis | Prediction model performance funnel asymmetry (.metamiscFitFunnelAsymmetryPlot) | 7 | single | L | | MetaAnalysis/(classicalpredictionperformance|library-EuroSCORE II)/(debray|egger|macaskill|peters) | ^ClassicalPredictionPerformance\|(?!forestPlot) |
ma.metamisc.forest | jaspMetaAnalysis | Prediction model performance (.metamiscForestPlot) | 7 | single | TEC | | MetaAnalysis/(classicalpredictionperformance|library-EuroSCORE II)/forest-plot | ^ClassicalPredictionPerformance\|forestPlot |
ma.metamisc.prior-posterior | jaspMetaAnalysis | Bayesian prediction model performance (.metamiscPriorAndPosteriorPlot) | 3 | single | L | | | |
ma.metamisc.mcmc | jaspMetaAnalysis | Bayesian prediction model performance (.metamiscAcPlot, .metamiscGelmanRubinPlot, .metamiscRmPlot) | 12 | single | L | | | |
ma.bma.prior-posterior | jaspMetaAnalysis | Bayesian Meta-Analysis (.bmaPriorAndPosteriorPlot) | 3 | single | LTP | | MetaAnalysis/bayesianmetaanalysisdeprecated/(effect-size|heterogeneity) | |
ma.bma.prior | jaspMetaAnalysis | Bayesian Meta-Analysis (.bmaPriorPlot) | 3 | single | LP | | | |
ma.bma.forest | jaspMetaAnalysis | Bayesian Meta-Analysis observed/estimated and cumulative forest (.bmaForestPlot) | 7 | single | LTEC | | MetaAnalysis/bayesianmetaanalysisdeprecated/observed | |
ma.bma.sequential | jaspMetaAnalysis | Bayesian Meta-Analysis (.bmaSequentialPlot) | 3 | single | LP | | | |
ma.robma.prior-posterior | jaspMetaAnalysis | Robust Bayesian Meta-Analysis (.robmaPriorAndPosteriorPlotEstimateFun) | 3 | single | LTP | | MetaAnalysis/other-Acute Respiratory Infections/(heterogeneity|pooled-effect)|MetaAnalysis/library-Acculturation[^/]*/pooled-effect | ^RobustBayesianMetaAnalysis\| |
ma.robma.diagnostics | jaspMetaAnalysis | Robust Bayesian Meta-Analysis MCMC diagnostics (.robmaDiagnosticsStorePlot) | 12 | single | L | | | |
ma.pema.diagnostics | jaspMetaAnalysis | Penalized meta-analysis MCMC diagnostics (.pemaDiagnostics) | 12 | single | L | | | |
ma.pema.posterior | jaspMetaAnalysis | Penalized meta-analysis posterior of selected terms (.pemaposteriorPlotsSelectedTerms) | 3 | single | L | | | |
ma.rob.summary | jaspMetaAnalysis | Risk of Bias (.robSummaryPlot) | 7 | single | LCK | | MetaAnalysis/.*/risk-of-bias-summary | | stacked bars
ma.rob.trafficlight | jaspMetaAnalysis | Risk of Bias (.robTrafficLightPlot) | 7 | matrix | LTCK | | MetaAnalysis/.*/risk-of-bias-traffic | | tile grid with symbols
ma.sm.estimates | jaspMetaAnalysis | Selection models, WAAP-WLS mean estimates (.smEstimatesPlot, .wwppEstimatesPlot) | 7 | single | ECK | | MetaAnalysis/.*/selection-parameter | |
ma.sm.weights | jaspMetaAnalysis | Selection models weight function (.smWeightsPlot) | 7 | single | LB | | MetaAnalysis/.*/weight-function | |
ma.wwpp.regression | jaspMetaAnalysis | PET-PEESE regression (.wwppRegressionPlot) | 7 | single | LB | | MetaAnalysis/.*/regression-plot | |
mm.plot | jaspMixedModels | Linear/Generalized Linear Mixed Models (.mmPlot) | 2 | single/multi | LECK | | MixedModels/ | ^MixedModels[^|]*\|plots | estimated means with raw data in the background
mm.diagnostics | jaspMixedModels | Mixed models residual diagnostics (.mmDiagnostics) | 1 | single | | | | |
net.network | jaspNetwork | Network Analysis (.networkAnalysisNetworkPlot) | 5 | single/multi | LT | qgraph | Network/networkanalysis/(.*-network-plot|parcor-threshold) | ^NetworkAnalysis\|Network |
net.centrality | jaspNetwork | Network Analysis (.networkAnalysisCentralityPlot) | 4 | multi | LCK | | | ^NetworkAnalysis\|centralityPlot | facets per measure, nodes on y axis
net.clustering | jaspNetwork | Network Analysis (.networkAnalysisClusteringPlot) | 4 | multi | LCK | | | |
net.bootstrap.edges | jaspNetwork | Network Analysis bootstrap (.networkAnalysisBootstrapPlot) | 2 | single | LBCK | | Network/networkanalysis/.*-bootstrapped-edges | |
net.bootstrap.centrality | jaspNetwork | Network Analysis centrality stability (.networkAnalysisBootstrapPlot) | 1 | single | LB | | Network/networkanalysis/.*-bootstrapped-centrality | |
net.bayes.structure | jaspNetwork | Bayesian Network Analysis (.bayesianNetworkAnalysisStructurePlot) | 5 | single | LT | qgraph | | |
net.bayes.evidence | jaspNetwork | Bayesian Network Analysis (.bayesianNetworkAnalysisEvidencePlot) | 5 | single | LT | qgraph | | |
net.bayes.centrality | jaspNetwork | Bayesian Network Analysis (.bayesianNetworkAnalysisCentralityPlot) | 4 | multi | LECK | | | |
net.bayes.hdi | jaspNetwork | Bayesian Network Analysis (.bayesianNetworkAnalysisParameterHdiPlot) | 2 | single | ECK | | | |
net.bayes.complexity | jaspNetwork | Bayesian Network Analysis (.bayesianNetworkAnalysisPosteriorComplexityPlot) | 3 | single | | | | |
net.bayes.posterior-structure | jaspNetwork | Bayesian Network Analysis (.bayesianNetworkAnalysisPosteriorStructurePlot) | 3 | single | | | | |
net.bayes.cocluster | jaspNetwork | Bayesian Network Analysis SBM (.bayesianNetworkAnalysisSbmCoclusteringPlot) | 4 | matrix | LCK | | | |
power.contour | jaspPower | Power analyses (.preparePowerContour*) | 14 | single | LP | | Power/Power/(default|mac)-power-contour | |
power.curve-es | jaspPower | Power analyses (.preparePowerCurveES*) | 14 | single | LP | | Power/Power/power-curve-by-(effect-size|variance-ratio) | |
power.curve-n | jaspPower | Power analyses (.preparePowerCurveN*) | 14 | single | LP | | Power/Power/power-curve-by-n | |
power.demo | jaspPower | Power analyses (.preparePowerDist*) | 14 | single | LBP | | Power/Power/power-demonstration | |
power.bayes.prior | jaspPower | Bayes factor design analysis (analysis and design prior) | 14 | single | LB | | Power/other-BayesFactor-Tutorial/(analysis|design)-prior | | not in the deparsed dump (newer code)
power.bayes.decision | jaspPower | Bayes factor design analysis (cumulative decision probabilities) | 14 | single | L | | Power/other-BayesFactor-Tutorial/cumulative | | not in the deparsed dump (newer code)
power.gs.boundaries | jaspPower | Group sequential design (stopping boundaries) | 14 | single | L | | Power/other-GroupSequential[^/]*/stopping | | not in the deparsed dump (newer code)
power.gs.crossing | jaspPower | Group sequential design (boundary crossing probabilities) | 14 | single | L | | Power/other-GroupSequential[^/]*/boundary | | not in the deparsed dump (newer code)
pa.mvar.binomial | jaspPredictiveAnalytics | Multivariate control (.mVarContMultiBinomialPlot) | 9 | single | LB | | | |
pa.mvar.prediction | jaspPredictiveAnalytics | Multivariate control (.mVarContMultiBinomialPredictionPlot) | 9 | single | LB | | | |
pa.mvar.summary | jaspPredictiveAnalytics | Multivariate control (.mVarContSummaryPlotFill) | 9 | multi | L | | | |
pa.acf | jaspPredictiveAnalytics | Predictive Analytics (.predanACFPlots) | 9 | single | B | | | |
pa.forecast-plan | jaspPredictiveAnalytics | Forecast evaluation plan (.predanForecastVerificationHelper) | 9 | single | LC | | | |
pa.forecast-result | jaspPredictiveAnalytics | Forecast evaluation prediction plots (.predanForecastVerificationResultPlot) | 9 | multi | LB | | | |
pa.future-prediction | jaspPredictiveAnalytics | Future prediction (.predanFuturePredictionPlot) | 9 | single | LB | | | |
pa.histogram | jaspPredictiveAnalytics | Predictive Analytics (.predanHistogramPlot) | 1 | single | | | | |
pa.pit | jaspPredictiveAnalytics | PIT binned density (.predanPitPlots) | 9 | single | | | | |
pa.control | jaspPredictiveAnalytics | Basic control plot (.predanPlotsDescriptives) | 9 | single | LB | | | |
proc.conceptual | jaspProcess | Classic/Bayesian Process (.procConceptPathPlot) | 5 | single | T | | Process/.*/conceptual-path-plot | ^(ClassicProcess|BayesianProcess)\|conceptPathPlot | ggraph (ggplot based) node and edge layers
proc.statistical | jaspProcess | Classic/Bayesian Process (.procStatPathPlot) | 5 | single | T | | Process/.*/statistical-path-plot | ^(ClassicProcess|BayesianProcess)\|statPathPlot | ggraph (ggplot based)
proc.residuals.qq | jaspProcess | Classic Process residual Q-Q | 1 | single | B | | Process/.*/residuals-qq | | not in the deparsed dump (newer code)
proc.residuals.predicted | jaspProcess | Classic Process residuals vs predicted | 1 | single | | | Process/.*/residuals-vs-predicted | | not in the deparsed dump (newer code)
prophet.history | jaspProphet | Prophet (.prophetCreateHistoryPlot) | 9 | single | B | | Prophet/prophet/history | ^Prophet\|historyPlot |
prophet.forecast | jaspProphet | Prophet overall and trend forecast (.prophetCreateOverallForecastPlot, .prophetCreateTrendForecastPlot) | 9 | single | B | | Prophet/prophet/(overall|trend)-forecast | ^Prophet\|prophet(Overall|Trend) |
prophet.changepoint | jaspProphet | Prophet (.prophetCreateParameterPlotDelta) | 9 | single | E | | Prophet/prophet/changepoint | |
prophet.parameter | jaspProphet | Prophet posterior of growth, offset, residual variance (.prophetCreateParameterPlotMarginal) | 3 | single | | | Prophet/prophet/(growth-rate|offset|residual-variance) | ^Prophet\|(k|m|obs)\| |
prophet.performance | jaspProphet | Prophet MAPE, MSE, RMSE (.prophetCreatePerformancePlot*) | 9 | single | | | Prophet/prophet/r?(mape|mse) | |
prophet.seasonality | jaspProphet | Prophet seasonality (.prophetCreateSeasonalityPlot) | 9 | single | B | | Prophet/prophet/custom-seasonality | ^Prophet\|Weekly |
prophet.covariate | jaspProphet | Prophet covariates (.prophetCreateCovariatePlot) | 9 | single | B | | Prophet/prophet/covariate | |
qc.attr.chart | jaspQualityControl | Attributes control charts: p, np, c, u, Laney, I-MR (attributesChartsInternal) | 6 | single | T | | QualityControl/(attributesCharts|example-PAttributes[^/]*)/ | ^attributesCharts\| | control limits labelled on the right edge
qc.var.individuals | jaspQualityControl | Variables charts for individuals, X-mR (variablesChartsIndividualsInternal) | 6 | multi | T | | QualityControl/(variablesChartsIndividuals|example-IndividualChartStages|processCapabilityStudies)/x-(bar-)?mr-control | ^(variablesChartsIndividuals|processCapabilityStudies)\|plot\|X-mR | two stacked charts
qc.var.subgroups | jaspQualityControl | Variables charts for subgroups, X-bar & R / s (variablesChartsSubgroupsInternal) | 6 | multi | T | | QualityControl/(variablesChartsSubgroups|processCapabilityStudies|example-(ProcessCapability|SubgroupChart)[^/]*)/x-bar-[rs]-control | ^(variablesChartsSubgroups|processCapabilityStudies)\|plot\|X-bar | also drawn inside Process Capability
qc.report.control | jaspQualityControl | Control chart reports (variables, rare event, time weighted) | 6 | multi | T | grob (report layout) | QualityControl/(variablesCharts[^/]*/(report|x-bar-[rs]-report)|rareEventCharts/rare-event-charts-report|timeWeightedCharts/time-weighted-charts-report) | | report pages combine charts and text tables
qc.report.capability | jaspQualityControl | Process capability report | 6 | multi | T | grob (report layout) | QualityControl/processCapabilityStudies/process-capability-report | |
qc.report.gaugerr | jaspQualityControl | Gauge r&R report, crossed and non-replicable | 6 | multi | T | grob (report layout) | QualityControl/msaGaugeRR(nonrep)?/.*gauge-r-r(-non-replicable)?-report | |
qc.autocorrelation | jaspQualityControl | Variables charts for individuals (.autocorrelationPlot) | 9 | single | B | | QualityControl/variablesChartsIndividuals/autocorrelation | ^variablesChartsIndividuals\|[^|]*\|Autocorrelation |
qc.cusum | jaspQualityControl | Time weighted charts (.Cusumchart) | 6 | single | T | | QualityControl/timeWeightedCharts/cumulative-sum | |
qc.ewma | jaspQualityControl | Time weighted charts (.EWMA) | 6 | single | T | | QualityControl/timeWeightedCharts/exponentially | |
qc.rare-event | jaspQualityControl | Rare event charts, G and T charts (.gChart, .tChart) | 6 | single | T | | QualityControl/rareEventCharts/[gt]-chart | |
qc.hotelling | jaspQualityControl | Multivariate control charts (.multivariateTsqChart) | 6 | single | TP | | QualityControl/multivariateControlCharts/ | |
qc.capability.histogram | jaspQualityControl | Process capability histogram with spec limits (.qcDistributionPlot) | 6 | single | LT | | QualityControl/processCapabilityStudies/histogram | ^processCapabilityStudies\|histogram |
qc.capability.probability | jaspQualityControl | Process capability probability plot (.qcProbabilityPlot) | 6 | single | B | | QualityControl/processCapabilityStudies/probability-plot | ^processCapabilityStudies\|ProbabilityPlot |
qc.capability.plot | jaspQualityControl | Capability of the process (.qcProcessCapabilityPlot) | 6 | single | LTC | | QualityControl/processCapabilityStudies/capability-of-the-process | ^processCapabilityStudies\|capabilityPlot |
qc.doe.contour | jaspQualityControl | DOE analysis contour and surface (.doeAnalysisPlotContourSurface) | 6 | single | L | | QualityControl/doeAnalysis/contour | | surface variant is base graphics (persp)
qc.doe.effects-normal | jaspQualityControl | DOE analysis (.doeAnalysisPlotEffectNormalDistribution) | 6 | single | LT | | QualityControl/doeAnalysis/normal-plot-of-effects | |
qc.doe.pareto | jaspQualityControl | DOE analysis (.doeAnalysisPlotPareto) | 6 | single | CK | | QualityControl/doeAnalysis/pareto-chart | |
qc.doe.residuals | jaspQualityControl | DOE analysis residual plots: vs fitted, histogram, normal probability, run order | 6 | single | | | QualityControl/doeAnalysis/(histogram-of-residuals|normal-probability-plot-of-residuals|residuals-versus) | |
qc.doe.residual-matrix | jaspQualityControl | DOE analysis four-in-one residual plot (.doeAnalysisPlotMatrixResidualPlot) | 4 | matrix | | grob (arranged panels) | QualityControl/doeAnalysis/matrix-residual | |
qc.doe.optimizer | jaspQualityControl | DOE response optimizer summary plot (.doeResponseOptimizerPlots) | 4 | matrix | T | grob (arranged panels) | QualityControl/doeAnalysis/summary-plot | |
qc.msa.attr.agreement | jaspQualityControl | Attribute agreement analysis (.aaaTableGraphs) | 2 | single | LECK | | QualityControl/(msaAttribute|example-AttributesAgreement[^/]*)/ | ^msaAttribute\| |
qc.msa.type1.bias-hist | jaspQualityControl | Type 1 instrument capability (.biasHistogram) | 6 | single | | | QualityControl/(msaType1Gauge|example-Type1[^/]*)/.*bias-histogram | ^msaType1Gauge\|biasHistogram |
qc.msa.type1.run-chart | jaspQualityControl | Type 1 instrument capability (.biasRunChart) | 6 | single | LT | | QualityControl/(msaType1Gauge|example-Type1[^/]*)/.*run-chart | ^msaType1Gauge\|biasRun |
qc.msa.components | jaspQualityControl | Gauge r&R components of variation (.gaugeANOVA, .gaugeRRNonRep) | 6 | single | LCK | | QualityControl/(msaGaugeRR(nonrep)?|example-GaugerR[^/]*)/.*components-of-variation | ^msaGaugeRR(nonrep)?\|[^|]*\|Components |
qc.msa.interaction | jaspQualityControl | Gauge r&R part by operator interaction (.gaugeByInteractionGraph) | 6 | single | LCK | | QualityControl/msaGaugeRR/.*part-by-operator | ^msaGaugeRR\|gaugeByInteraction |
qc.msa.by-operator | jaspQualityControl | Gauge r&R measurements by operator (.gaugeByOperatorGraph) | 6 | single | CK | | QualityControl/msaGaugeRR(nonrep)?/.*measurements-by-operator | ^msaGaugeRR(nonrep)?\|(gaugeByOperator|NRoperatorGraph) |
qc.msa.by-part | jaspQualityControl | Gauge r&R measurements by part (.gaugeByPartGraph) | 6 | single | CK | | QualityControl/msaGaugeRR/.*measurements-by-part | ^msaGaugeRR\|gaugeByPart |
qc.msa.part-x-operator | jaspQualityControl | Gauge r&R non-replicable, measurements by part per operator (.gaugeMeasurmentsByPartXOperator) | 6 | single | CK | | QualityControl/msaGaugeRRnonrep/.*operator-[abc] | ^msaGaugeRRnonrep\|NRpartOperatorGraph |
qc.msa.scatter-operators | jaspQualityControl | Gauge r&R matrix plot for operators (.gaugeScatterPlotOperators) | 4 | matrix | | grob (ggMatrixPlot) | QualityControl/msaGaugeRR/.*matrix-plot-for-operators | ^msaGaugeRR\|gaugeScatterOperators |
qc.msa.control-chart | jaspQualityControl | Gauge r&R and test-retest average and range charts by operator or part | 6 | single | T | | QualityControl/(msaGaugeRR(nonrep)?|msaTestRetest|example-(GaugerR|RangeMethod)[^/]*)/.*(average-chart|range-chart) | ^msa(GaugeRR(nonrep)?|TestRetest)\|(rChart|xBarChart)_plot |
qc.msa.traffic | jaspQualityControl | Gauge r&R and test-retest traffic light plot (.trafficplot) | 6 | single | TCK | | QualityControl/(msaGaugeRR|msaTestRetest)/.*traffi | ^msa(GaugeRR|TestRetest)\|trafficPlot | horizontal bars with coloured zones
qc.msa.linearity | jaspQualityControl | Gauge linearity bias and linearity (.linearityAndBias) | 6 | single | LB | | QualityControl/(msaGaugeLinearity|example-LinearityStudy)/.*bias-and-linearity | ^msaGaugeLinearity\|plotBias |
qc.msa.process-variation | jaspQualityControl | Gauge linearity percentage process variation (.linearityAndBias) | 6 | single | C | | QualityControl/(msaGaugeLinearity|example-LinearityStudy)/.*percentage-process | ^msaGaugeLinearity\|plotProcessVar |
qc.msa.retest.scatter | jaspQualityControl | Test-retest 1st vs 2nd measurement (.ScatterPlotOperators) | 6 | single | L | | QualityControl/msaTestRetest/.*scatterplot-of-1st | ^msaTestRetest\|ScatterOperators\| |
qc.msa.retest.run | jaspQualityControl | Test-retest run chart of parts (.ScatterPlotOperatorParts) | 6 | single | LC | | QualityControl/(msaTestRetest|example-RangeMethod[^/]*)/.*run-chart-of-parts | ^msaTestRetest\|ScatterOperatorParts |
qc.pod.detection | jaspQualityControl | Probability of detection (.podDetectionPlot) | 6 | single | B | | QualityControl/probabilityOfDetection/ | |
reg.cor.matrix | jaspRegression | Correlation matrix plot (.corrMatrixPlot) | 4 | matrix | T | grob (ggMatrixPlot) | Regression/(correlation|example-[^/]*)/correlation-plot | ^Correlation\|corrPlot\|Correlation plot |
reg.cor.pairwise | jaspRegression | Correlation pairwise scatter (.corrPairwisePlot) | 1 | single | B | | Regression/example-[^/]*/jaspcolumn\d-vs-jaspcolumn\d | ^Correlation\|[^|]*\|.* vs\. |
reg.cor.heatmap | jaspRegression | Correlation heatmap (.corrHeatmap) | 4 | single | LTCK | | Regression/(correlation/(kendall|pearson|spearman)|example-[^/]*/pearson-s-r-heatmap) | |
reg.corbayes.matrix | jaspRegression | Bayesian Correlation matrix plot (.createMatrixPlotCorBayes) | 4 | matrix | TP | grob (ggMatrixPlot) | Regression/(correlationbayesian|example-Glasgow Norms)/bayesian-correlation-matrix | ^CorrelationBayesian\|matrixPlot |
reg.corbayes.prior-posterior | jaspRegression | Bayesian Correlation pairwise prior and posterior | 3 | multi | LTP | grob (pizza + text) | Regression/(correlationbayesian|example-[^/]*)/prior-and-posterior | ^CorrelationBayesian\|priorPosteriorPlot |
reg.corbayes.robustness | jaspRegression | Bayesian Correlation BF robustness | 3 | multi | LTP | grob (pizza + text) | Regression/(correlationbayesian|example-[^/]*)/bayes-factor-robustness | ^CorrelationBayesian\|bfRobustnessPlot |
reg.corbayes.sequential | jaspRegression | Bayesian Correlation sequential analysis | 3 | multi | LTP | grob (pizza + text) | Regression/(correlationbayesian|example-[^/]*)/sequential-analysis | ^CorrelationBayesian\|bfSequentialPlot |
reg.corbayes.scatter | jaspRegression | Bayesian Correlation pairwise scatterplot | 1 | single | | | Regression/(correlationbayesian|example-[^/]*)/scatterplot | ^CorrelationBayesian\|scatterPlot |
reg.lin.residuals-predicted | jaspRegression | Linear Regression residuals vs predicted (.linregCreateResidualsVsPredictedPlot) | 1 | single | | | Regression/(regressionlinear/(residuals-predicted|field-residuals-predicted|socialanxiety-residuals)|example-[^/]*/residuals-vs-predicted) | ^RegressionLinear\|[^|]*residualsVsPredPlot |
reg.lin.residuals-dependent | jaspRegression | Linear Regression residuals vs dependent | 1 | single | | | Regression/regressionlinear/residuals-dependent | ^RegressionLinear\|[^|]*residualsVsDepPlot |
reg.lin.residuals-covariates | jaspRegression | Linear Regression residuals vs covariates | 1 | single | | | Regression/(regressionlinear/residuals-covariates|example-College[^/]*/residuals-vs-jaspcolumn) | ^RegressionLinear\|[^|]*residualsVsCovContainer |
reg.lin.residuals-hist | jaspRegression | Linear Regression residual histogram (.linregCreateResidualsVsHistogramPlot) | 1 | single | | | Regression/(regressionlinear/(residuals-histogram|field-residuals-histogram)|example-[^/]*/(standardized-)?residuals-histogram) | ^RegressionLinear\|[^|]*residualsVsHistPlot |
reg.lin.residuals-qq | jaspRegression | Linear Regression residual Q-Q (.linregCreateResidualsQQPlot) | 1 | single | B | | Regression/(regressionlinear/(residuals-q-q|field-qq|socialanxiety-qq)|example-[^/]*/q-q-plot-standardized-residuals) | ^RegressionLinear\|[^|]*residualsQQPlot |
reg.lin.partial | jaspRegression | Linear Regression partial plots | 1 | single | B | | Regression/regressionlinear/(field-partial|socialanxiety-partialplot) | ^RegressionLinear\|[^|]*partialPlotContainer |
reg.lin.marginal | jaspRegression | Linear Regression marginal effects plots | 1 | single | B | | Regression/regressionlinear/marginal | ^RegressionLinear\|[^|]*marginalPlotsContainer |
reg.lin.descriptives | jaspRegression | Linear Regression descriptives plots (.linregDescriptivePlots) | 1 | single | LBK | | Regression/regressionlinear/descriptives- | | scatter, separate lines, categorical variants
reg.lin.optimizer | jaspRegression | Linear Regression response optimizer (.linregResponseOptimizerPlots) | 4 | matrix | T | grob (arranged panels) | Regression/example-doe_realDataExample3/optimization-plot | |
reg.glm.partial | jaspRegression | Generalized Linear Model partial residual plots | 1 | single | B | | Regression/(generalizedlinearmodel/partialplot|example-Turbines/partial) | ^GeneralizedLinearModel\|[^|]*\|Partial |
reg.glm.qq | jaspRegression | Generalized Linear Model Q-Q of standardised residuals | 1 | single | | | Regression/(generalizedlinearmodel/[a-z]+resqqplot|example-Turbines/q-q) | ^GeneralizedLinearModel\|quantileResidualQqPlot |
reg.glm.res-fitted | jaspRegression | Generalized Linear Model residuals vs fitted | 1 | single | | | Regression/(generalizedlinearmodel/[a-z]+resvsyplot|example-Turbines/standardized-quantile-residuals-vs-fitted) | ^GeneralizedLinearModel\|quantileResidualVsFittedPlot |
reg.glm.res-predictor | jaspRegression | Generalized Linear Model residuals vs predictor | 1 | single | | | Regression/(generalizedlinearmodel/[a-z]+resvsxplot|example-Turbines/standardized-quantile-residuals-vs-jaspcolumn) | ^GeneralizedLinearModel\|Hours\|Standardized |
reg.glm.zvseta | jaspRegression | Generalized Linear Model working responses vs linear predictor | 1 | single | | | Regression/(generalizedlinearmodel/zvseta|example-Turbines/plot-working) | ^GeneralizedLinearModel\|glmPlotZVsEta |
reg.log.estimates | jaspRegression | Logistic Regression conditional estimates plots (.reglogisticEstimatesPlot) | 1 | single | EBK | | Regression/example-Titanic/jaspcolumn | ^RegressionLogistic\|estimatesPlot | continuous predictor gives a band, factor gives error bars
reg.log.independent-predicted | jaspRegression | Logistic Regression independent vs predicted (.reglogisticIndependentPredictedPlot) | 1 | single | | | | |
reg.log.performance | jaspRegression | Logistic Regression ROC and PR plots (.reglogisticPerformancePlot) | 13 | single | | | Regression/regressionlogistic/(pr|roc)plot | |
reg.log.predicted-residuals | jaspRegression | Logistic Regression predicted vs residuals (.reglogisticPredictedResidualsPlot) | 1 | single | | | | |
reg.log.predictor-residuals | jaspRegression | Logistic Regression predictor vs residuals (.reglogisticPredictorResidualsPlot) | 1 | single | | | | |
reg.log.squared-pearson | jaspRegression | Logistic Regression squared Pearson residuals (.reglogisticSquaredPearsonResidualsPlot) | 1 | single | | | Regression/example-Titanic/squared-pearson | ^RegressionLogistic\|[^|]*squaredPearson |
reg.bayes.inclusion | jaspRegression | Bayesian Linear/Logistic Regression inclusion probabilities | 3 | single | CK | | Regression/regressionlinearbayesian/inclusionprobabilities | | horizontal bars with a 0.5 reference line
reg.bayes.posterior-dist | jaspRegression | Bayesian Linear/Logistic Regression marginal posterior per coefficient | 3 | multi | TP | | Regression/regressionlinearbayesian/posteriorcoefficients\.svg | | spike at zero plus density
reg.bayes.posterior-summary | jaspRegression | Bayesian Linear/Logistic Regression coefficients with credible intervals | 3 | single | ECK | | Regression/(regressionlinearbayesian/posteriorcoefficientswithcri|regressionlogisticbayesian/|example-Auction/) | ^RegressionLinearBayesian\|postSumPlot |
reg.bayes.complexity | jaspRegression | Bayesian Linear/Logistic Regression log P(data given M) vs model size | 3 | single | P | | | |
reg.bayes.model-probs | jaspRegression | Bayesian Linear/Logistic Regression cumulative model probabilities | 3 | single | | | | |
reg.bayes.log-odds | jaspRegression | Bayesian Linear/Logistic Regression posterior log odds (model ranks) | 3 | single | CK | | | |
reg.bayes.qq | jaspRegression | Bayesian Linear/Logistic Regression model-averaged Q-Q | 1 | single | | | Regression/regressionlinearbayesian/qqplot | |
reg.bayes.res-fitted | jaspRegression | Bayesian Linear/Logistic Regression residuals vs fitted | 1 | single | | | Regression/regressionlinearbayesian/residualsvsfitted | |
rel.blandaltman | jaspReliability | Bland-Altman (.blandAltmanPlots) | 1 | single | TB | | Reliability/blandAltman/ | |
rel.bayes.posterior | jaspReliability | Bayesian uni- and multidimensional reliability, rater agreement posteriors | 3 | single | LBP | | Reliability/(reliabilityUnidimensionalBayesian/(?!.*-(item|tp)(\.svg|-mean)|posterior-predictive)|reliabilityMultidimensionalBayesian/posterior-omega|raterAgreementBayesian/) | |
rel.bayes.ifitem | jaspReliability | Bayesian reliability if item dropped (.BayesianIfItemPlot) | 3 | multi | LCK | | Reliability/reliabilityUnidimensionalBayesian/.*-item | | ridge densities per item
rel.bayes.trace | jaspReliability | Bayesian reliability trace plots (.BayesianTracePlot, .multiDimTracePlot) | 12 | single | L | | Reliability/reliability[^/]*Bayesian/(.*-tp\.svg|trace-) | |
rel.bayes.ppc | jaspReliability | Bayesian reliability posterior predictive check (.multiDimPPCPlot, .omegaPosteriorPredictive) | 3 | single | LB | | Reliability/reliability[^/]*Bayesian/posterior-predictive | |
rel.sem.ci | jaspReliability | Standard error of measurement CI plots (.semMakeSingleCiPlot) | 2 | single | EC | | Reliability/(standardErrorOfMeasurement/.*-ci-plot|library-ADD symptoms/(anova|feldt|irt-grm|mollenkopf-feldt|thorndike)) | ^standardErrorOfMeasurement\|ciPlotsContainer_ | library snapshots mix CI and point plots
rel.sem.point | jaspReliability | Standard error of measurement per sum score (.semMakeSinglePointPlot) | 1 | single | | | | ^standardErrorOfMeasurement\|pointPlotsContainer_ |
rel.sem.combined | jaspReliability | Standard error of measurement combined plot (.semCombinedPointPlot) | 1 | single | L | | Reliability/library-ADD symptoms/combined | ^standardErrorOfMeasurement\|combinedPlot |
rel.sem.hist | jaspReliability | Standard error of measurement counts per sum score (.semHistPlot) | 1 | single | | | Reliability/library-ADD symptoms/histogram | ^standardErrorOfMeasurement\|histPlot |
rob.descriptives | jaspRobust | Robust ANOVA, ANCOVA, RM descriptives | 2 | single | LECK | | Robust/(ancova|anova)robust/.*descriptives | |
rob.raincloud | jaspRobust | Robust ANOVA, ANCOVA, RM raincloud | 2 | single | LCK | | Robust/anovarobust/.*raincloud | |
rob.cor.scatter | jaspRobust | Robust correlation scatter plots | 1 | single | B | | Robust/correlationrobust/ | |
rob.reg.qq | jaspRobust | Robust linear regression Q-Q | 1 | single | B | | Robust/regressionlinearrobust/regrobust-qq | |
rob.reg.res-fitted | jaspRobust | Robust linear regression residuals vs fitted | 1 | single | | | Robust/regressionlinearrobust/regrobust-resvfitted | |
rob.reg.weights | jaspRobust | Robust linear regression robust weights | 1 | single | | | Robust/regressionlinearrobust/regrobust-weights | |
robtt.priors | jaspRobustTTests | Robust Bayesian t-test prior plots (.robttPriorsPlots) | 3 | single | LP | | | |
robtt.estimates | jaspRobustTTests | Robust Bayesian t-test model-averaged estimates (.robttEstimatesPlot) | 3 | single | LTP | | RobustTTests/.*/model-averaged | |
robtt.diagnostics | jaspRobustTTests | Robust Bayesian t-test MCMC diagnostics (.robttDiagnosticsPlots) | 12 | single | L | | | |
sem.path | jaspSem | SEM, Mediation, MIMIC, Latent Growth path diagrams (semPlot) | 5 | single | T | qgraph (semPlot) | Sem/library-Grand Point Average/model-plot | ^(SEM|LatentGrowthCurve|MediationAnalysis|MIMIC)\|(Path diagram|pathplot) |
sem.lgcm.curve | jaspSem | Latent Growth curve plot (.lgcmCurvePlot) | 9 | single | | | Sem/library-Grand Point Average/curve-plot | ^LatentGrowthCurve\|curveplot |
sem.lgcm.misfit | jaspSem | Latent Growth misfit plot (.lgcmMisfitPlot) | 4 | matrix | T | grob (ggMatrixPlot) | | |
sem.mnlfa | jaspSem | Moderated Nonlinear Factor Analysis parameter plots (.mnlfaPlot) | 1 | single | LB | | Sem/ModeratedNonLinearFactorAnalysis/ | |
ss.prior-posterior | jaspSummaryStatistics | Summary stats Bayesian t-tests, correlation, z-test prior and posterior | 3 | multi | LTP | grob (pizza + text) | SummaryStatistics/summarystats(ttest|correlation)[^/]*/prior-and-posterior | | same jaspGraphs composite as the raw-data t-test
ss.robustness | jaspSummaryStatistics | Summary stats Bayesian t-tests, correlation, z-test BF robustness | 3 | multi | LTP | grob (pizza + text) | SummaryStatistics/summarystats(ttest|correlation)[^/]*/bayes-factor-robustness | |
ss.binom.prior-posterior | jaspSummaryStatistics | Summary stats Bayesian binomial (.summaryStatsBinomialPlot) | 3 | multi | LTP | grob (pizza + text) | SummaryStatistics/summarystatsbinomialtestbayesian/ | ^SummaryStatsBinomialTestBayesian\| |
ss.reg.robustness | jaspSummaryStatistics | Summary stats Bayesian linear regression (.summaryStatsRegressionRobustnessPlot) | 3 | single | LTP | | SummaryStatistics/summarystatsregressionlinearbayesian/ | |
ss.tests.distributions | jaspSummaryStatistics | General Bayesian tests prior, posterior, predictive plots | 3 | single | LBP | | SummaryStatistics/summarystatsgeneralbayesiantests/(?!likelihood) | |
ss.tests.likelihood | jaspSummaryStatistics | General Bayesian tests likelihood plot | 3 | single | B | | SummaryStatistics/summarystatsgeneralbayesiantests/likelihood | |
surv.km | jaspSurvival | Non-parametric and Cox survival plots: survival, risk, cumulative hazard, cloglog (.saSurvivalPlot) | 1 | single | LBK | | Survival/(library-Leukemia|other-coxph_full_output)/survival-plot | ^NonParametricSurvivalAnalysis\| | step curves, optional risk table and censoring ticks
surv.ph-test | jaspSurvival | Cox proportional hazards test plots (.saspProportionalHazardsPlots) | 1 | single | B | | Survival/other-coxph_full_output/jaspcolumn | |
surv.residuals.hist | jaspSurvival | Cox and parametric residual histograms | 1 | single | | | Survival/.*/residuals-histogram | |
surv.residuals.scatter | jaspSurvival | Cox and parametric residuals vs predicted, time, predictors | 1 | single | | | Survival/.*/residuals-vs- | |
surv.parametric.prediction | jaspSurvival | Parametric survival predictions: survival, hazard, cumulative hazard, RMST, quantiles (.sapCreatePredictionPlotWrapper) | 1 | single/multi | LBK | | Survival/(other-flexsurv[^/]*|other-parametric_mixture|verified-vassiliou2003-2)/(?!residuals|probability-plot) | | per-subgroup and per-predictor copies merged
surv.parametric.probability | jaspSurvival | Parametric survival probability plot (.sapProbabilityPlotFun) | 1 | single | LB | | Survival/.*/probability-plot | |
tt.descriptives | jaspTTests | t-tests descriptives plots, classical and Bayesian | 2 | single | ECK | | TTests/(ttest[a-z]*/(descriptives|mischief-descriptives)|library-[^/]*/(drp|criticalrecall|mischief|moon-other|logfusetime)) | ^TTest[^|]*\|[^|]*(ttestDescriptives_plots_|descriptivesContainer_plots_) | one-sample variant adds a test-value line
tt.bar | jaspTTests | t-tests bar plots, classical and Bayesian | 2 | single | ECK | | TTests/ttest[a-z]*/barplot | ^TTest[^|]*\|[^|]*barPlots |
tt.raincloud | jaspTTests | t-tests raincloud plots, classical and Bayesian | 2 | single | LCK | | TTests/ttest[a-z]*/(raincloud(-horizontal|-vertical|-missing)?\.svg|mischief-raincloud) | ^TTest[^|]*\|[^|]*plotsRainCloud_ |
tt.raincloud-diff | jaspTTests | Paired t-test raincloud of differences | 2 | single | | | TTests/ttest[a-z]*/raincloud-diff | ^TTest[^|]*\|[^|]*plotsRainCloudDifference |
tt.qq | jaspTTests | t-tests Q-Q plots (.ttestQQPlot) | 1 | single | B | | | ^TTest[^|]*\|[^|]*QQPlots |
tt.bayes.prior-posterior | jaspTTests | Bayesian t-tests prior and posterior | 3 | multi | LTBP | grob (pizza + text) | TTests/(ttestbayesian[a-z]*|library-[^/]*)/(.*-)?prior-(and-)?posterior | ^TTestBayesian[^|]*\|[^|]*priorAndPosteriorPlot |
tt.bayes.robustness | jaspTTests | Bayesian t-tests BF robustness check | 3 | multi | LTP | grob (pizza + text) | TTests/(ttestbayesian[a-z]*|library-[^/]*)/(.*-)?(bayes-factor-)?robustness-check | ^TTestBayesian[^|]*\|[^|]*robustnessPlot |
tt.bayes.sequential | jaspTTests | Bayesian t-tests sequential analysis | 3 | multi | LTP | grob (pizza + text) | TTests/ttestbayesian[a-z]*/(.*-)?sequential-analysis | ^TTestBayesian[^|]*\|[^|]*sequential |
ts.timeseries | jaspTimeSeries | ARIMA, Stationarity, Descriptives time series plots (.tsTimeSeriesPlot) | 9 | single | | | TimeSeries/(ARIMATimeSeries/time-series|DescriptivesTimeSeries/time-series|StationarityTimeSeries/|example-[^/]*/time-series) | |
ts.acf | jaspTimeSeries | Time series ACF (.tsACFTransformation, residual ACF) | 9 | single | B | | TimeSeries/(DescriptivesTimeSeries|example-[^/]*)/autocorrelation | |
ts.pacf | jaspTimeSeries | Time series PACF (.tsPACFTransformation) | 9 | single | B | | TimeSeries/DescriptivesTimeSeries/partial | |
ts.lag | jaspTimeSeries | Time series lag plot | 9 | single | | | TimeSeries/DescriptivesTimeSeries/lag-plot | |
ts.forecast | jaspTimeSeries | ARIMA forecast (.tsForecastPlot) | 9 | single | B | | TimeSeries/ARIMATimeSeries/forecast | |
ts.ljungbox | jaspTimeSeries | ARIMA residual diagnostics Ljung-Box | 9 | single | | | TimeSeries/ARIMATimeSeries/ljung-box | |
ts.residual-qq | jaspTimeSeries | ARIMA residual diagnostics Q-Q | 1 | single | B | | TimeSeries/ARIMATimeSeries/q-q-plot | |
ts.psd | jaspTimeSeries | Spectral analysis power spectral density (.tsPowerSpectralDensity) | 9 | single | | | TimeSeries/SpectralTimeSeries/ | |
vm.flexplot | jaspVisualModeling | Flexplot (flexplot package .flexPlotRes) | 4 | single/multi | LBK | | | | plot code lives in the flexplot package, not in the module
vm.model | jaspVisualModeling | Linear, Generalized Linear, Mixed Modeling: plot of the statistical model | 4 | single/multi | LBK | | | |
vm.univariate | jaspVisualModeling | Linear, Generalized Linear, Mixed Modeling: univariate plots | 4 | multi | | grob (arranged panels) | | |
vm.avp | jaspVisualModeling | Linear Modeling added variable plot | 1 | single | B | | | |
vm.residuals | jaspVisualModeling | Linear and Mixed Modeling diagnostic plots | 4 | multi | | grob (arranged panels) | | |
"""
