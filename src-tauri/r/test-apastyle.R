# Tests for the text helpers in apastyle.R. Run with JASP's R:
#   flatpak run --command=Rscript --filesystem=$PWD org.jaspstats.JASP test-apastyle.R
libs <- list.dirs("/app/Modules/module_libs", recursive = FALSE); .libPaths(c(libs, .libPaths()))
suppressPackageStartupMessages(library(ggplot2))
source("apastyle.R")
check <- function(got, want, what) if (!identical(got, want)) { cat("FAIL", what, "\n  got: ", deparse(got), "\n  want:", deparse(want), "\n"); failed <<- failed + 1 }
failed <- 0

# title case
apaVariables <- c("hse", "income level", "Box Office ($M)")
check(apaTitleCase("mean of the scores"), "Mean of the Scores", "minor words stay lower case")
check(apaTitleCase("the mean"), "The Mean", "the first word is capitalised")
check(apaTitleCase("density: a look"), "Density: A Look", "the word after a colon")
check(apaTitleCase("self-esteem score"), "Self-Esteem Score", "both parts of a hyphenated word")
check(apaTitleCase("n"), "n", "single letters are symbols")
check(apaTitleCase("standardized residuals, z"), "Standardized Residuals, z", "a symbol at the end")
check(apaTitleCase("hse"), "hse", "a variable name")
check(apaTitleCase("mean income level"), "Mean income level", "a variable name with a space")
check(apaTitleCase("ANOVA residuals"), "ANOVA Residuals", "acronyms stay")
check(apaTitleCase("logLik"), "logLik", "camelCase stays")
check(apaTitleCase(""), "", "empty")

# minus signs and leading zeros
check(trueMinus(c("-1", "0", "2.5", "-0.3")), c("−1", "0", "2.5", "−0.3"), "minus on numbers")
check(trueMinus("Ref. - 0.10 * tol."), "Ref. - 0.10 * tol.", "a spaced dash is not a minus")
check(trueMinus("t(9) = -2.04"), "t(9) = −2.04", "minus after an equals sign")
check(trueMinus("x-1"), "x-1", "a hyphen inside a name stays")
check(noLeadingZero("r = 0.578"), "r = .578", "r loses its zero")
check(noLeadingZero("r = -0.578"), "r = -.578", "negative r")
check(noLeadingZero("p < 0.001"), "p < .001", "p")
check(noLeadingZero("t = 0.578"), "t = 0.578", "t keeps its zero")
check(noLeadingZero("r = 10.5"), "r = 10.5", "only a lone zero")
check(noLeadingZero('italic(r) ~ "=" ~ "0.578"'), 'italic(r) ~ "=" ~ ".578"', "plotmath")
check(quotedMinus('italic(t) ~ "=" ~ "-2.04"'), 'italic(t) ~ "=" ~ "−2.04"', "plotmath minus inside quotes")
check(quotedMinus('a - b'), 'a - b', "no quotes: nothing changes")
check(is.expression(parse(text = quotedMinus('italic(t) ~ "=" ~ "-2.04"'))), TRUE, "still parses")

# thinning keeps JASP's own ticks and both ends
p <- ggplot(data.frame(x = 0:10, y = 0:10), aes(x, y)) + geom_point() + scale_x_continuous(breaks = 0:10) + scale_y_continuous(breaks = seq(0, 10, 2.5))
t <- thinBreaks(p)
xb <- t$scales$get_scales("x")$breaks
check(as.numeric(c(head(xb, 1), tail(xb, 1))), c(0, 10), "both ends kept")
check(all(xb %in% 0:10), TRUE, "only JASP's own ticks")
check(length(xb) <= 5, TRUE, "fewer ticks")
check(t$scales$get_scales("y")$breaks, seq(0, 10, 2.5), "five ticks or fewer stay")
check(as.numeric(thinBreaks(p + scale_x_continuous(breaks = 0:6))$scales$get_scales("x")$breaks), c(0, 2, 4, 6), "seven ticks: every other one")

# reversed and log axes keep the right numbers
p <- ggplot(data.frame(x = c(1, 100), y = c(0, 0.5)), aes(x, y)) + geom_point() + scale_x_log10() + scale_y_reverse()
b <- ggplot_build(apaScales(p))$layout$panel_params[[1]]; a <- ggplot_build(p)$layout$panel_params[[1]]
check(b$y$get_labels(), a$y$get_labels(), "reverse axis labels as ggplot's own")
check(b$x$get_labels(), a$x$get_labels(), "log axis labels as ggplot's own")
check(ggplot_build(apaScales(p + scale_y_continuous(limits = c(-1, 1))))$layout$panel_params[[1]]$y$get_labels(),
  c("\u22121.0", "\u22120.5", "0.0", "0.5", "1.0"), "a linear axis gets true minus signs")
t6 <- thinBreaks(p + scale_x_continuous(breaks = seq(0, 2500, 500)))$scales$get_scales("x")
check(as.numeric(t6$breaks), c(0, 1500, 3000), "long labels, no even step: 3 ticks, axis one step longer")
check(as.numeric(t6$limits), c(0, 3000), "the axis still covers the data")
t8 <- thinBreaks(p + scale_x_continuous(breaks = seq(0, 70, 10)))$scales$get_scales("x")
check(as.numeric(t8$breaks), c(0, 20, 40, 60, 80), "short labels, no even step: every other tick")
q <- apaGgplot(ggplot(data.frame(x = 1, y = 1), aes(x, y)) + geom_point() + theme(axis.text = element_text(size = 10), axis.title = element_text(size = 10)), list(add = function(x) NULL))
check(calc_element("axis.title.y", ggplot2:::plot_theme(q))$size, 11, "axis titles a step above the ticks")
apaVariables <- c("hse")
check(apaTitleCaseAny(quote("Population proportion" ~ theta)), quote("Population Proportion" ~ theta), "plotmath: words change, theta stays")
check(apaTitleCaseAny(quote(Effect ~ size ~ delta)), quote(Effect ~ Size ~ delta), "plotmath: bare words")
check(apaTitleCaseAny(quote("Linear predictor," ~ hat(eta))), quote("Linear Predictor," ~ hat(eta)), "plotmath: hat stays")
check(apaTitleCaseAny(quote(paste("mean of the ", italic(x)))), quote(paste("Mean of the ", italic(x))), "plotmath: one-letter symbol stays")
check(apaTitleCaseAny(quote("BF" ~ "of" ~ "the" ~ "model")), quote("BF" ~ "of" ~ "the" ~ "Model"), "plotmath: minor words later in the title")
check(apaTitleCaseAny(expression("replication effect")), expression("Replication Effect"), "expression objects")
check(apaTitleCaseAny(quote(hse ~ score)), quote(hse ~ Score), "plotmath: variable names stay")
check(apaTitleCaseAny(""), "", "empty text")
check(apaTitleCaseAny(5), 5, "a number is left alone")
cat(if (failed) paste(failed, "failed\n") else "all passed\n"); quit(status = failed > 0)
