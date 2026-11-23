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
# a title wrapped onto two lines (long y titles) comes back once, each line's words in title case
check(apaTitleCase("Rel. freq (normal100(mu=0) in\nbin)"), "Rel. Freq (normal100(mu=0) in\nBin)", "a two-line title is not doubled")
check(apaTitleCase("pretest and posttest data,\nmean and 95% confidence\ninterval"),
  "Pretest and Posttest Data,\nMean and 95% Confidence\nInterval", "each line of a wrapped title")
check(apaTitleCase(" mean of the "), " Mean of the ", "spaces at the ends stay")

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
check(quotedMinus(c(NA, '"-1"')), c(NA, '"\u22121"'), "a missing label stays missing (decision tree crash)")
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
# B7: every axis gets true minus signs, also one ggplot adds by itself; no leading zero only where values can't exceed 1
labelsOf <- function(q, a) { b <- ggplot_build(q)$layout$panel_params[[1]][[a]]; b$get_labels() }
p <- ggplot(data.frame(x = c(-2, 2), y = c(0, 1)), aes(x, y)) + geom_point() + labs(y = "Probability")
check(any(grepl("−", labelsOf(apaScales(p), "x"))), TRUE, "a default x axis gets true minus signs")
check(labelsOf(apaScales(p), "y"), c(".00", ".25", ".50", ".75", "1.00"), "a probability axis within [0, 1] loses its zeros")
check(labelsOf(apaScales(p + labs(y = "Density")), "y"), c("0.00", "0.25", "0.50", "0.75", "1.00"), "a density axis keeps its zeros")
p2 <- ggplot(data.frame(x = 1:3, y = c(0, 1, 2.5)), aes(x, y)) + geom_point() + labs(y = "Probability")
check(any(grepl("^\\.", labelsOf(apaScales(p2), "y"))), FALSE, "values past 1: zeros stay, whatever the title")
check(labelsOf(apaScales(p + scale_y_continuous("Proportion", breaks = c(0, .5, 1))), "y"), c(".0", ".5", "1.0"), "a title set on the scale")
pe <- ggplot(data.frame(x = c(-1, 0, 3)), aes(x)) + stat_ecdf()
check(labelsOf(apaScales(pe), "y")[1:2], c(".00", ".25"), "an empirical CDF's y axis")
check(labelsOf(apaScales(ggplot(data.frame(x = 1:2, y = c(-.5, .5)), aes(x, y)) + geom_point() + labs(y = expression("Pearson's" ~ rho))), "y")[1],
  "−.50", "a plotmath correlation title, negative values")
sec <- ggplot(data.frame(x = 1:2, y = c(-5, 5)), aes(x, y)) + geom_point() + scale_y_continuous(sec.axis = sec_axis(~ . * 2))
check(any(grepl("\u2212", ggplot_build(apaScales(sec))$layout$panel_params[[1]]$y.sec$get_labels())), TRUE, "a second axis gets true minus signs")
pd <- ggplot(data.frame(x = as.Date(c("2020-01-01", "2021-01-01")), y = 1:2), aes(x, y)) + geom_point()
check(is.null(apaScales(pd)$scales$get_scales("x")), TRUE, "a date axis is left to ggplot")
check(labelsOf(thinBreaks(apaScales(ggplot(data.frame(x = 1:2, y = c(0, 1)), aes(x, y)) + geom_point() +
  scale_y_continuous("Probability", breaks = seq(0, 1, .1)))), "y"), c(".0", ".5", "1.0"), "thinned ticks: no leading zeros, decimals alike")
# numbers drawn in the plot: a correlation heatmap's cells, a correlation's interval
hm <- ggplot(data.frame(x = 1:2, y = 1, v = c(-0.059, 0.161)), aes(x, y, fill = v, label = v)) + geom_tile() + geom_text() +
  scale_fill_gradient2(name = "cor", limits = c(-1, 1))
hq <- apaText(apaScales(hm))
check(ggplot_build(hq)$data[[2]]$label, c("−.059", ".161"), "heatmap numbers: true minus, no leading zero")
check(any(grepl("^\\.", labelsOf(hq, "x"))), FALSE, "the heatmap's own axes keep their zeros")
nt <- ggplot(data.frame(x = 1:2, y = c(-3, 3), v = c(-3.5, 0.5)), aes(x, y, label = v)) + geom_text()
check(ggplot_build(apaText(apaScales(nt)))$data[[1]]$label, c("−3.5", "0.5"), "numbers elsewhere: true minus, zeros stay")
ct <- ggplot(data.frame(x = 1, y = 1:2, lab = c("r = 0.5", "95% CI: [-0.25, 0.13]")), aes(x, y, label = lab)) + geom_text()
check(ggplot_build(apaText(ct))$data[[1]]$label, c("r = .5", "95% CI [−.25, .13]"), "an interval next to r loses its zeros")
ct2 <- ggplot(data.frame(x = 1, y = 1:2, lab = c("M = 0.5", "95% CI: [-0.25, 0.13]")), aes(x, y, label = lab)) + geom_text()
check(ggplot_build(apaText(ct2))$data[[1]]$label[2], "95% CI [−0.25, 0.13]", "an interval of a mean keeps them")
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
# themes of other packages: no crash on elements of another class (ggtext's element_markdown, ggplot2 4), no gridlines
noChanges <- list(add = function(x) NULL)
if (requireNamespace("ggtext", quietly = TRUE)) {
  md <- ggplot(data.frame(x = 1:2, y = 1:2, g = c("a", "b")), aes(x, y, colour = g)) + geom_point() +
    theme(legend.text = ggtext::element_markdown(), axis.title.x = ggtext::element_markdown(family = "serif"))
  q <- tryCatch(apaGgplot(md, noChanges), error = function(e) conditionMessage(e))
  check(inherits(q, "ggplot"), TRUE, "element_markdown in the theme: no crash")
  check(inherits(tryCatch(ggplotGrob(q), error = function(e) NULL), "gtable"), TRUE, "and the plot still draws")
}
grey <- apaGgplot(ggplot(data.frame(x = 1:3, y = 1:3), aes(x, y)) + geom_point() + theme_grey(), noChanges)
gth <- ggplot2:::plot_theme(grey)
check(vapply(c("panel.grid.major.x", "panel.grid.minor.y"), function(e) inherits(calc_element(e, gth), "element_blank"), FALSE),
  c(panel.grid.major.x = TRUE, panel.grid.minor.y = TRUE), "gridlines removed")
check(calc_element("panel.background", gth)$fill, "white", "grey panel made white")
check(inherits(calc_element("axis.line.x", gth), "element_line"), TRUE, "axis lines where the grey panel stood in for them")
# a font that has the characters: Chinese labels are not forced into Liberation Sans
check(plotFamily(ggplot(data.frame(x = c("a", "b"), y = 1:2), aes(x, y)) + geom_point()), "Liberation Sans", "Latin text: the APA font")
check(plotFamily(ggplot(data.frame(x = c("选中", "未选中"), y = 1:2), aes(x, y)) + geom_point()) != "Liberation Sans", TRUE,
  "Chinese levels: another font")
check(plotFamily(ggplot(data.frame(x = 1:2, y = 1:2), aes(x, y)) + geom_point() + labs(x = "ρ − ≤")), "Liberation Sans", "Greek and maths symbols: the APA font")
# category labels and legend words in title case (owner decision 1); codes and variable names stay
apaVariables <- c("hse")
cat3 <- ggplot(data.frame(x = c("young adult", "older adult", "hse"), y = 1:3, g = c("in group", "a", "b")), aes(x, y, colour = g)) + geom_point()
cb <- ggplot_build(apaGgplot(cat3, noChanges))
check(cb$layout$panel_params[[1]]$x$get_labels(), c("hse", "Older Adult", "Young Adult"), "category ticks in title case, a variable name stays")
check(get_guide_data(cb, "colour")$.label, c("a", "b", "In Group"), "legend words in title case, one-letter codes stay")
check(levels(factor(cat3$data$x)), c("hse", "older adult", "young adult"), "the data itself is not renamed")
fc <- ggplot(data.frame(x = 1:2, y = 1:2, f = c("strength", "closeness")), aes(x, y)) + geom_point() + facet_wrap(~f)
fg <- ggplotGrob(apaGgplot(fc, noChanges))
stripText <- unlist(lapply(fg$grobs[grepl("strip", fg$layout$name)], function(g) unlist(lapply(g$grobs, function(h) {
  tx <- NULL; walk <- function(x) { if (inherits(x, "text")) tx <<- c(tx, x$label); if (!is.null(x$children)) for (ch in x$children) walk(ch); if (!is.null(x$grobs)) for (ch in x$grobs) walk(ch) }; walk(h); tx }))))
check(sort(stripText), c("Closeness", "Strength"), "panel headings in title case")
# category tick labels that collide: wrapped, then on two rows
apaPanelIn <- 3
long <- ggplot(data.frame(x = c("Mannequin", "Human", "Shapeshifter", "Alien", "Werewolf"), y = 1:5), aes(x, y)) + geom_point()
lq <- apaGgplot(long, noChanges)
check(lq$scales$get_scales("x")$guide$params$n.dodge, 2, "crowded single-word ticks go on two rows")
spaced <- ggplot(data.frame(x = c("very young adult", "older adult person", "middle aged adult"), y = 1:3), aes(x, y)) + geom_point()
check(any(grepl("\n", ggplot_build(apaGgplot(spaced, noChanges))$layout$panel_params[[1]]$x$get_labels())), TRUE, "long labels with spaces wrap")
check(any(grepl("\n", ggplot_build(apaGgplot(ggplot(data.frame(x = c("ab", "cd"), y = 1:2), aes(x, y)) + geom_point(), noChanges))$layout$panel_params[[1]]$x$get_labels())), FALSE,
  "short ticks stay on one row")
apaPanelIn <- Inf
# colour contrast (D4): groups told apart by colour alone reach 3:1 (2 or 3 groups); shapes too: left alone
lumOf <- function(q, a, alpha = 1) { b <- ggplot_build(q); d <- get_guide_data(b, a); wcagLum(d[[a]], alpha) }
two <- ggplot(data.frame(x = 1:4, y = 1:4, g = rep(c("a", "b"), 2)), aes(x, y, colour = g)) + geom_line() +
  scale_colour_manual(values = c("#E41A1C", "#377EB8"))
l2 <- lumOf(apaGgplot(two, noChanges), "colour")
check(minPair(l2) >= 3 && all(vapply(l2, contrastRatio, 1, 1) >= 3), TRUE, "two line colours: 3:1 apart and against white")
three <- ggplot(data.frame(x = c("a", "b", "c"), y = 1:3), aes(x, y, fill = x)) + geom_col(alpha = 0.5)
tq <- apaGgplot(three, noChanges)
check(tq$layers[[1]]$aes_params$alpha > 0.5, TRUE, "translucent fills get enough opacity")
check(minPair(lumOf(tq, "fill", tq$layers[[1]]$aes_params$alpha)) >= 3, TRUE, "three fills: 3:1 apart")
four <- ggplot(data.frame(x = letters[1:4], y = 1:4), aes(x, y, fill = x)) + geom_col()
check(minPair(lumOf(apaGgplot(four, noChanges), "fill")) > minPair(lumOf(four, "fill")), TRUE, "four fills: as far apart as possible")
shp <- ggplot(data.frame(x = 1:2, y = 1:2, g = c("a", "b")), aes(x, y, colour = g, shape = g)) + geom_point()
check(lumOf(apaGgplot(shp, noChanges), "colour"), lumOf(shp, "colour"), "groups that differ in shape keep their colours")
hue <- grDevices::convertColor(t(grDevices::col2rgb(get_guide_data(ggplot_build(apaGgplot(two, noChanges)), "colour")$colour[1])) / 255, from = "sRGB", to = "Luv")
check(abs(atan2(hue[3], hue[2]) * 180 / pi - 12) < 25, TRUE, "a group keeps its hue (red stays red)")
lab <- 'italic(r) ~ "=" ~ "0.5"'; cilab <- "95% CI: [-0.25, 0.13]"   # JASP's correlation matrix maps labels to its own variables
cm <- ggplot() + geom_text(aes(1, 1, label = lab), data = data.frame(a = 1), parse = TRUE) + geom_text(aes(1, 2, label = cilab), data = data.frame(a = 1))
check(ggplot_build(apaText(cm))$data[[2]]$label, "95% CI [\u2212.25, .13]", "an interval beside a mapped r label")
mkFive <- function() ggplot(data.frame(x = rep(1:2, 5), y = 1:10, g = rep(c("a1", "b1", "c1", "d1", "e1"), each = 2)), aes(x, y, colour = g)) + geom_line() + geom_point()
five <- ggplot(data.frame(x = rep(1:2, 5), y = 1:10, g = rep(c("a1", "b1", "c1", "d1", "e1"), each = 2)), aes(x, y, colour = g)) + geom_line() + geom_point()
fb <- ggplot_build(apaGgplot(five, noChanges))
check(c(length(unique(fb$data[[1]]$linetype)), length(unique(fb$data[[2]]$shape))), c(5L, 5L), "five groups: line styles and shapes too")
check(sum(vapply(c("colour", "shape", "linetype"), function(a) nrow(get_guide_data(fb, a)) == 5, FALSE)) == 3, TRUE, "one legend lists all five")
check("shape" %in% names(ggplot_build(apaGgplot(mkFive() + theme(legend.position = "none"), noChanges))$plot$layers[[2]]$mapping), FALSE, "no legend (labelled directly): no shapes")
check(is.null(apaGgplot(two, noChanges)$layers[[1]]$mapping$linetype), TRUE, "two groups: colour steps only")
box <- ggplot(data.frame(g = rep(c("a", "b"), each = 5), y = 1:10), aes(g, y, fill = g)) + geom_boxplot() + scale_fill_manual(values = c("#E41A1C", "#D7301F"))
bl <- lumOf(apaGgplot(box, noChanges), "fill")
rain <- ggplot(data.frame(g = rep(c("a", "b"), each = 5), y = 1:10), aes(g, y, fill = g)) + geom_violin(alpha = 0.65) + geom_boxplot(width = 0.1) +
  scale_fill_manual(values = c("#E41A1C", "#D7301F"))
check(min(lumOf(apaGgplot(rain, noChanges), "fill")) >= 0.1, TRUE, "rain cloud: the opaque boxes stay light enough for their black lines")
check(min(bl) >= 0.1 && minPair(bl) >= 3, TRUE, "fills under black boxes stay light enough for the boxes (D7)")
dens <- ggplot(data.frame(v = c(rnorm(50), rnorm(50, 1)), g = rep(c("a", "b"), each = 50)), aes(v, fill = g)) + geom_density(alpha = 0.3)
check(apaGgplot(dens, noChanges)$layers[[1]]$aes_params$alpha, 0.3, "overlapping translucent densities stay see-through")
both <- ggplot(data.frame(x = rep(1:2, 2), y = 1:4, g = rep(c("a", "b"), each = 2)), aes(x, y, colour = g, fill = g)) + geom_area(position = "identity") + geom_line() +
  scale_fill_manual(values = c("#E41A1C", "#D7301F")) + scale_colour_manual(values = c("#E41A1C", "#D7301F"))
bq <- ggplot_build(apaGgplot(both, noChanges))
check(unique(bq$data[[1]]$colour), "#333333", "outlined areas of pale steps: a dark outline")
bars <- ggplot(data.frame(x = c("a", "b"), y = 1:2), aes(x, y, colour = x, fill = x)) + geom_col() + geom_line(aes(group = 1)) +
  scale_fill_manual(values = c("#A82918", "#B82918")) + scale_colour_manual(values = c("#A82918", "#B82918"))
bb <- ggplot_build(apaGgplot(bars, noChanges))
check(all(vapply(wcagLum(unique(bb$data[[2]]$colour)), contrastRatio, 1, 1) >= 3), TRUE, "colour and fill of one variable, pale steps: the line takes darker ones")
# rain clouds: points coloured, boxes and clouds filled by the same groups; each group one colour on every layer,
# and the boxes' black lines still readable on the fills (D7)
rc <- ggplot(data.frame(g = rep(c("0", "1"), each = 5), y = 1:10, xj = rep(1:2, each = 5)), aes(y = y)) +
  geom_point(aes(x = xj, colour = g)) + geom_boxplot(aes(x = xj + 2, group = g, fill = g), width = 0.2) +
  scale_fill_manual(values = c("#1B9E77", "#D95F02")) + scale_colour_manual(values = c("#1B9E77", "#D95F02"))
rq <- ggplot_build(apaGgplot(rc, noChanges))
check(rq$data[[1]]$fill[c(1, 6)], unique(rq$data[[2]]$fill), "rain cloud: a group's points and box share one colour")
check(c(unique(rq$data[[1]]$shape), unique(rq$data[[1]]$colour)), c("21", "#333333"), "rain cloud: pale points get a dark outline (3:1 on the white page)")
check(min(wcagLum(unique(rq$data[[2]]$fill))) >= 0.1 && minPair(wcagLum(unique(rq$data[[2]]$fill))) >= 3, TRUE, "rain cloud: 3:1 apart, boxes readable (D7)")
sep <- ggplot(data.frame(x = rep(1:2, 2), y = 1:4, g = rep(c("a", "b"), each = 2), h = rep(c("c", "d"), 2)), aes(x, y, colour = g, fill = h)) + geom_area(position = "identity") + geom_line() +
  scale_fill_manual(values = c("#E41A1C", "#D7301F")) + scale_colour_manual(values = c("#E41A1C", "#D7301F"))
sq <- ggplot_build(apaGgplot(sep, noChanges))
check(identical(get_guide_data(sq, "fill")$fill, get_guide_data(sq, "colour")$colour), FALSE, "colour and fill of different variables: steps of their own")
# Bain's pies: labels of thin slices share one label instead of overlapping
pie <- ggplot(data.frame(x = "", y = c(.97, .02, .01), h = c("H1", "H2", "H3")), aes(x, y, fill = h)) + geom_col(width = 1) +
  coord_polar(theta = "y") + scale_y_continuous(breaks = c(.485, .98, .995), labels = c("H1", "H2", "H3"))
pl <- pieLabels(pie, apaFamily)$scales$get_scales("y")
check(pl$labels, c("H1", "H2, H3"), "thin slices share a label")
# a pie drawn with its outline over a narrower copy of its slices (Bain): the copy gets no outline, no ring in the pie
pie2 <- ggplot(data.frame(x = "", y = c(.97, .02, .01), h = c("H1", "H2", "H3")), aes(x, y, fill = h)) + geom_bar(stat = "identity", width = 1e10, colour = "black") +
  geom_col() + coord_polar(theta = "y") + scale_fill_manual(values = c("#FFFFE0", "#377EB8", "#4DAF4A"))
p2 <- outlineFills(pie2, ggplot_build(pie2), c("#FFFFE0", "#377EB8", "#4DAF4A"), noChanges)
check(is.null(p2$layers[[2]]$aes_params$colour), TRUE, "a pie's narrower copy gets no outline ring")
# a figure's panels share colours: one hypothesis, one colour in every pie; the three every panel shows reach 3:1
pieOf <- function(h) ggplot(data.frame(x = "", y = rep(1, length(h)), h = h), aes(x, y, fill = h)) + geom_col(width = 1, colour = "black") +
  coord_polar(theta = "y") + scale_fill_manual(values = setNames(c("#E41A1C", "#377EB8", "#4DAF4A", "#984EA3")[seq_along(h)], h))
pp <- apaPlot(jaspGraphs::ggMatrixPlot(list(pieOf(c("H1", "H2", "H3")), pieOf(c("H1", "H2", "H3", "Hu"))), layout = matrix(1:2, 1)))
f1 <- ggplot_build(pp$subplots[[1]])$data[[1]]$fill; f2 <- ggplot_build(pp$subplots[[2]])$data[[1]]$fill
check(f1, f2[1:3], "panels: one colour per hypothesis in every panel")
check(minPair(wcagLum(f1)) >= 3, TRUE, "panels: the groups every panel shows reach 3:1")
check(length(unique(f2)), 4L, "panels: the extra group gets a colour of its own")
check(length(apaShared), 0L, "panels: the shared colours are cleared after the figure")
# a matrix cell's text fits the cell (8 pt at least) and is not cut at the panel's edge
cell <- ggplot(data.frame(x = 0.5, y = 0.5, l = "95% CI [−.253, .139]"), aes(x, y, label = l)) + geom_text(size = 9 / (2.845 * apaScaleK))
fq <- fitCellText(cell, 0.9, apaFamily)
check(fq$layers[[1]]$aes_params$size * 2.845 * apaScaleK < 9 && fq$layers[[1]]$aes_params$size * 2.845 * apaScaleK >= 8 - 1e-9, TRUE, "cell text smaller, 8 pt at least")
check(fq$coordinates$clip, "off", "cell text not cut at the panel's edge")
check(ggplot_build(apaText(ggplot(data.frame(x = 1, y = 1, l = "95% CI: [1.2, 3.4]"), aes(x, y, label = l)) + geom_text()))$data[[1]]$label,
  "95% CI [1.2, 3.4]", "an interval without the colon (6.43)")
# panel letters on a figure of several plots; none on a plot with a header or a pie beside it
pa <- ggplot(data.frame(x = 1:2, y = 1:2), aes(x, y)) + geom_point()
mp <- jaspGraphs::ggMatrixPlot(list(pa, pa), layout = matrix(1:2, 1))
lp <- apaPlot(mp)
check(attr(lp, "apaPanelLetters"), c("A", "B"), "two panels: A and B")
check(vapply(lp$subplots, function(s) s$labels$tag, ""), c("A", "B"), "each panel's tag")
check(plotFacts(lp)$panelLetters, c("A", "B"), "the facts record the letters")
hd <- ggplot(data.frame(x = 0, y = 0, l = "BF = 3"), aes(x, y, label = l)) + geom_text()
check(is.null(attr(apaPlot(jaspGraphs::ggMatrixPlot(list(hd, pa), layout = matrix(1:2, 1))), "apaPanelLetters")), TRUE, "a header and one plot: no letters")
# facts as JSON: named subplots (jaspGraphsPlot's mainPlot) and lists of one must stay arrays
facts <- list(panels = 1L, plots = list(mainPlot = list(geoms = "GeomPoint", x = "a", text = "r = .5")))
check(as.character(jsonlite::toJSON(factsArrays(facts), auto_unbox = TRUE, null = "null")),
  '{"panels":1,"plots":[{"geoms":["GeomPoint"],"x":"a","text":["r = .5"]}]}', "facts: named plots and single geoms become arrays")
check(as.character(jsonlite::toJSON(factsArrays(list(panels = 0L, plots = setNames(list(), character()))), auto_unbox = TRUE)),
  '{"panels":0,"plots":[]}', "facts: no plots is an empty array")
check(factsArrays(NULL), NULL, "facts: none")
# ML's decision tree: each leaf label drawn twice (a plain label and ggparty's node label); both in one font, so
# the copies sit on top of each other
GeomNodeLabel <- ggproto("GeomNodeLabel", GeomLabel)
tree <- ggplot(data.frame(x = 1, y = 1, info = "setosa\nn = 30")) + geom_label(aes(x, y, label = info)) +
  layer(geom = GeomNodeLabel, stat = "identity", position = "identity", mapping = aes(x, y, label = info), params = list(alpha = 0.3))
tq <- apaGgplot(tree, noChanges)
check(tq$layers[[1]]$aes_params$family, tq$layers[[2]]$aes_params$family, "decision tree: both copies of a leaf label in one font")
edge <- ggplot(data.frame(x = 1:2, y = 1:2, lab = I(list('NA >= NA*" -0.741"', 'NA <  NA*" 0.591"')))) + geom_text(aes(x, y, label = unlist(lab)), parse = TRUE)
edge2 <- ggplot(data.frame(x = 1:2, y = 1:2)) + geom_text(aes(x, y, label = as.list(c('NA >= NA*" -0.741"', 'NA <  NA*" 0.591"'))), parse = TRUE)
check(grepl("−", ggplot_build(apaText(edge2))$data[[1]]$label[[1]]), TRUE, "decision tree edges (a list of labels): true minus")
# crowded ticks staggered in the order the axis shows them (JASP gives the breaks in another order than the levels)
apaPanelIn <- 2.83
ent <- data.frame(x = factor(c("Mannequin", "Human", "Shapeshifter", "Alien"), levels = c("Mannequin", "Human", "Shapeshifter", "Alien")), y = 1:4)
eq <- apaGgplot(ggplot(ent, aes(x, y)) + geom_point() + scale_x_discrete(breaks = c("Alien", "Human", "Mannequin", "Shapeshifter")) +
  theme(axis.text = element_text(size = 10 / apaScaleK)), noChanges)
ev <- ggplot_build(eq)$layout$panel_params[[1]]$x
check(as.numeric(ev$break_positions()), sort(as.numeric(ev$break_positions())), "stagger: breaks in the order the axis shows them, so the dodge alternates left to right")
check(eq$scales$get_scales("x")$guide$params$n.dodge, 2, "stagger: two rows")
many <- data.frame(x = factor(c("Mannequinesque", "Humanoidal", "Shapeshifterish", "Alienated", "Werewolfish", "Vampiresque")), y = 1:6)
mq <- apaGgplot(ggplot(many, aes(x, y)) + geom_point() + theme(axis.text = element_text(size = 10 / apaScaleK)), noChanges)
check(calc_element("axis.text.x", ggplot2:::plot_theme(mq))$angle, 45, "labels that still collide on two rows: angled")
check(as.numeric(calc_element("axis.title.x", ggplot2:::plot_theme(eq))$margin)[1] > as.numeric(calc_element("axis.title.x", ggplot2:::plot_theme(ggplot(ent, aes(x, y)) + geom_point()))$margin)[1],
  TRUE, "stagger: the axis title moves clear of the lower row")
# crowded x labels and a legend of the same groups: the x labels' wrap survives the legend's turn in the loop
crowd <- ggplot(ent, aes(x, y, colour = x)) + geom_point() + theme(axis.text = element_text(size = 10 / apaScaleK))
check(inherits(tryCatch(ggplotGrob(apaGgplot(crowd, noChanges)), error = function(e) e), "gtable"), TRUE, "crowded ticks plus a legend: still draws")
apaPanelIn <- Inf
# a correlation heat map with its legend hidden: numbers in the tiles are correlations
hm2 <- ggplot(data.frame(a = c("u", "v", "u", "v"), b = c("u", "u", "v", "v"), r = c(1, -0.059, -0.059, 1)), aes(a, b, fill = r, label = r)) +
  geom_tile() + geom_text() + theme(legend.position = "none")
check(ggplot_build(apaText(apaScales(hm2)))$data[[2]]$label[2], "−.059", "heat map with a hidden legend: no leading zero")
grid2 <- ggplot(data.frame(a = c("u", "v"), b = c("p", "q"), r = c(0.5, 2.5)), aes(a, b, fill = r, label = r)) + geom_tile() + geom_text()
check(ggplot_build(apaText(apaScales(grid2)))$data[[2]]$label[1], "0.5", "tiles over different variables: zeros stay")
# room on the right for the last tick label, centred on the panel's edge
wide <- ggplot(data.frame(x = c(0, 10000), y = 1:2), aes(x, y)) + geom_point() + scale_x_continuous(breaks = c(0, 5000, 10000), expand = c(0, 0)) +
  theme(axis.text = element_text(size = 10 / apaScaleK))
check(rightRoom(wide, ggplot_build(wide)) > 6, TRUE, "a wide last tick label at the edge gets more room than 6 pt")
check(rightRoom(wide + scale_x_continuous(breaks = c(0, 5000), limits = c(0, 10000), expand = c(0, 0)), ggplot_build(wide + scale_x_continuous(breaks = c(0, 5000), limits = c(0, 10000), expand = c(0, 0)))), 6,
  "a last tick well inside the panel: 6 pt")
# plotmath with single quotes: the interval's colon goes, the label still parses
pm <- "'mean'==' 0.500; '~'95% CI':' [0.050, 0.950] '"
pq <- ggplot_build(apaText(ggplot(data.frame(x = 1, y = 1, l = pm), aes(x, y, label = l)) + geom_text(parse = TRUE)))$data[[1]]$label
check(grepl("CI'\\s*:", pq) || grepl("CI:", pq), FALSE, "plotmath interval: no colon")
check(is.expression(parse(text = pq)), TRUE, "plotmath interval: still parses")
check(quotedMinus("'a'~'-1'"), "'a'~'−1'", "plotmath in single quotes: true minus")
# panel letters on a faceted plot; JASP's "a) " before the headings goes
fw <- ggplot(data.frame(x = 1:4, y = 1:4, f = rep(c("a) Prior", "b) Posterior"), each = 2)), aes(x, y)) + geom_point() + facet_wrap(~f, ncol = 1)
fp <- apaPlot(fw)
check(attr(fp, "apaPanelLetters"), c("A", "B"), "facets: letters A and B")
check(plotFacts(fp)$panelLetters, c("A", "B"), "facets: the facts record the letters")
fgb <- ggplotGrob(fp)
fstrips <- unlist(lapply(fgb$grobs[grepl("strip", fgb$layout$name)], function(g) { tx <- NULL; walk <- function(x) { if (inherits(x, "text")) tx <<- c(tx, x$label); for (ch in c(x$children, x$grobs)) walk(ch) }; walk(g); tx }))
check(sort(fstrips), c("Posterior", "Prior"), "facets: JASP's a) and b) give way to the letters")
check(is.null(attr(apaPlot(fw + coord_cartesian(xlim = c(1, 3))), "apaPanelLetters")), TRUE, "zoomed facets: no letters (they would need the clipping off)")
# groupMarks: one shape scale; a filled-shape layer beside plain points keeps its own shape
mix <- ggplot(data.frame(x = rep(1:2, 5), y = 1:10, g = rep(letters[1:5], each = 2)), aes(x, y, colour = g)) + geom_point(shape = 21, fill = "white") + geom_point(size = 1)
mb <- ggplot_build(apaGgplot(mix, noChanges))
check(c(unique(mb$data[[1]]$shape), length(unique(mb$data[[2]]$shape))), c(21, 5), "mixed point layers: filled shapes kept, plain points get shapes")
# an interval is a correlation's only beside an r in the same layer, or in a text cell
mixed <- ggplot(data.frame(x = 1:2, y = 1:2), aes(x, y)) + geom_point() + annotate("text", x = 1, y = 2, label = "r = 0.5") + annotate("text", x = 2, y = 1, label = "95% CI: [0.25, 0.40]")
check(ggplot_build(apaText(mixed))$data[[3]]$label, "95% CI [0.25, 0.40]", "an interval in another layer of a data plot keeps its zeros")
# the fallback font only for the parts that need it
cjk <- apaGgplot(ggplot(data.frame(x = c("选中", "未选中"), y = 1:2), aes(x, y)) + geom_point() + labs(x = "Selected"), noChanges)
cth <- ggplot2:::plot_theme(cjk)
check(c(calc_element("axis.text.x", cth)$family != apaFamily, calc_element("axis.title.x", cth)$family), c(TRUE, apaFamily), "CJK ticks: fallback font there only")
# numbers written at their own height beside a probability axis (Distributions' CDF: "0.08" at .08)
cdf <- ggplot(data.frame(x = c(-3, 3), y = c(0, 1)), aes(x, y)) + geom_line() + labs(y = "Probability") +
  geom_text(data = data.frame(x = c(-3, 1), y = c(0.08, 0.9), label = c("0.08", "0.5")), aes(x, y, label = label))
cq <- ggplot_build(apaText(apaScales(cdf)))$data[[2]]$label
check(cq, c(".08", "0.5"), "a number at its own height on a probability axis loses its zero; other numbers keep theirs")
check(isBoundedPlot(ggplot(data.frame(x = 1, y = 1), aes(x, y)) + labs(x = "Population misstatement")), TRUE, "Audit's misstatement is bounded")
check(isBoundedPlot(ggplot(data.frame(x = 1, y = 1), aes(x, y)) + labs(x = expression(paste("Kendall's", ~tau)))), TRUE, "Kendall's tau is bounded")
check(isBoundedPlot(ggplot(data.frame(x = 1, y = 1), aes(x, y)) + labs(x = expression(tau))), FALSE, "tau alone (heterogeneity) is not")
# a second axis titled by a bounded quantity, its values within [0, 1]
sec2 <- ggplot(data.frame(x = 1:2, y = c(0, .6)), aes(x, y)) + geom_point() + labs(y = "Density") +
  scale_y_continuous(sec.axis = sec_axis(~ . / 1.2, name = "Probability", breaks = c(0, .25, .5)))
check(ggplot_build(apaScales(sec2))$layout$panel_params[[1]]$y.sec$get_labels(), c(".00", ".25", ".50"), "a probability second axis loses its zeros, zero written like the others")
# colour and fill shared, with lines (QC's operator plot: lines coloured, points filled): the lines take darker steps
# of the same hues, 3:1 against white; points keep the fill colours
log <- local({ v <- character(); list(add = function(x) v <<- c(v, x), get = function() v) })
ops <- ggplot(data.frame(x = rep(1:3, 3), y = c(1:3, 2:4, 3:5), g = rep(c("A", "B", "C"), each = 3)), aes(x, y)) +
  geom_line(aes(group = g, colour = g)) + geom_point(aes(fill = g), shape = 21, size = 3) +
  scale_colour_manual(values = c("#F8766D", "#00BA38", "#619CFF")) + scale_fill_manual(values = c("#F8766D", "#00BA38", "#619CFF"))
ob <- ggplot_build(apaGgplot(ops, log))
check(all(vapply(wcagLum(unique(ob$data[[1]]$colour)), contrastRatio, 1, 1) >= 3), TRUE, "shared colours: lines 3:1 against white")
lineHue <- function(c) { l <- grDevices::convertColor(t(grDevices::col2rgb(c)) / 255, from = "sRGB", to = "Luv"); atan2(l[3], l[2]) }
check(abs(lineHue(ob$data[[1]]$colour[4]) - lineHue(ob$data[[2]]$fill[4])) < 0.6, TRUE, "shared colours: a group's line keeps its points' hue")
check(sum(grepl("stepped in lightness", log$get())), 1L, "shared colours: one change-log line, not two")
pale <- ggplot(data.frame(x = c("a", "b", "c"), y = 1:3), aes(x, y, fill = x)) + geom_col() + scale_fill_manual(values = c("#F8766D", "#00BA38", "#619CFF"))
pb <- ggplot_build(apaGgplot(pale, noChanges))
check(unique(pb$data[[1]]$colour), "#333333", "fills too pale for the page get a dark outline")
# narrow facet panels: the letter goes into the heading; the headings are recorded for the note
apaPanelIn <- 2.2
nar <- ggplot(data.frame(x = 1:6, y = 1:6, f = rep(c("strength", "betweenness", "closeness"), 2)), aes(x, y)) + geom_point() + facet_wrap(~f, nrow = 1) +
  theme(strip.text = element_text(size = 10 / apaScaleK))
np <- apaPlot(nar)
ng <- ggplotGrob(np)
nstrips <- unlist(lapply(ng$grobs[grepl("strip", ng$layout$name)], function(g) { tx <- NULL; walk <- function(x) { if (inherits(x, "text")) tx <<- c(tx, x$label); for (ch in c(x$children, x$grobs)) walk(ch) }; walk(g); tx }))
check(sort(gsub("-\n", "", sub("^\n", "", nstrips))), c("Betweenness", "Closeness", "Strength"), "narrow panels: headings left on a line below the letters' line")
pieces <- unlist(strsplit(nstrips, "-\n"))
check(all(grepl("[aeiouy]", pieces, ignore.case = TRUE)), TRUE, "very narrow panels: a word split only where both halves have a vowel")
check(calc_element("strip.text.x", ggplot2:::plot_theme(np))$size * apaScaleK >= 7 - 1e-9, TRUE, "very narrow panels: headings shrink to 7 pt at the least")
check(calc_element("strip.clip", ggplot2:::plot_theme(np)), "off", "very narrow panels: a heading's hyphen is never cut off")
# a word fits at a smaller size: shrunk, not split
apaPanelIn <- 2.6
sp <- ggplotGrob(apaPlot(nar))
sps <- unlist(lapply(sp$grobs[grepl("strip", sp$layout$name)], function(g) { tx <- NULL; walk <- function(x) { if (inherits(x, "text")) tx <<- c(tx, x$label); for (ch in c(x$children, x$grobs)) walk(ch) }; walk(g); tx }))
check(any(grepl("-\n", sps)), FALSE, "a word that fits once the heading shrinks is not split")
apaPanelIn <- 2.2
nl <- Filter(function(l) ".apaLetter" %in% names(l$data), np$layers)
check(length(nl) == 1 && identical(nl[[1]]$aes_params$fontface, "bold") && identical(nl[[1]]$aes_params$hjust, 0), TRUE, "narrow panels: the letters bold at the left, as on wider panels")
check(identical(calc_element("strip.text.x", ggplot2:::plot_theme(np))$hjust, 0), TRUE, "narrow panels: headings left-aligned under the letters")
check(plotFacts(np)$panelHeadings, c("Betweenness", "Closeness", "Strength"), "facets: the headings for the note")
apaPanelIn <- Inf
check(plotFacts(fp)$panelHeadings, c("Prior", "Posterior"), "facets: headings without JASP's a) and b)")
check(any(grepl("Text", plotFacts(fp)$plots[[1]]$geoms)), FALSE, "facets: the letters are not the plot's own text")
check(as.character(jsonlite::toJSON(factsArrays(list(panels = 2L, plots = list(), panelLetters = c("A", "B"), panelHeadings = c("Prior", NA))), auto_unbox = TRUE, na = "null")),
  '{"panels":2,"plots":[],"panelLetters":["A","B"],"panelHeadings":["Prior",null]}', "facts: headings an array, null where unknown")
titled <- pa + ggtitle("Prior")
hp <- apaPlot(jaspGraphs::ggMatrixPlot(list(titled, pa), layout = matrix(1:2, 1)))
check(attr(hp, "apaPanelHeadings"), c("Prior", NA), "panels: each lettered plot's own title, NA without one")
zl <- local({ v <- character(); list(add = function(x) v <<- c(v, x), get = function() v) })
invisible(facetLetters(fw + coord_flip(), zl))
check(any(grepl("panel letters not added", zl$get())), TRUE, "facets on flipped axes: no letters, said in the change log")
# a default axis is the one ggplot would add where the plot was made (jaspGraphs' own scale_x_continuous)
envPlot <- local({ scale_x_continuous <- function(...) ggplot2::scale_x_continuous(breaks = c(0, 5, 10), limits = c(0, 10)); ggplot(data.frame(x = c(1, 9), y = 1:2), aes(x, y)) + geom_point() })
check(as.numeric(ggplot_build(apaScales(envPlot))$layout$panel_params[[1]]$x$get_breaks()), c(0, 5, 10), "default axis: the plot's own scale function, its ticks kept")
# characters Liberation Sans lacks: the fallback names the font installed for them (stand-ins for a CJK font)
fakeFallback <- function(str, family) data.frame(path = "/fonts/NotoSansCJK.ttc", index = 0)
fakeFonts <- function() data.frame(path = c("/fonts/NotoSansCJK.ttc", "/fonts/LiberationSans.ttf"), family = c("Noto Sans CJK SC", "Liberation Sans"))
check(plotGlyphs(ggplot(data.frame(x = c("选中", "未选中"), y = 1:2), aes(x, y)) + geom_point(), fakeFallback, fakeFonts)$family,
  "Noto Sans CJK SC", "CJK labels: the installed CJK font is picked")
# a covariance matrix (diagonal not 1) keeps its zeros; a heat map titled r loses them
cov <- ggplot(data.frame(a = c("u", "v", "u", "v"), b = c("u", "u", "v", "v"), v = c(0.8, -0.059, -0.059, 0.6)), aes(a, b, fill = v, label = v)) +
  geom_tile() + geom_text() + theme(legend.position = "none")
check(ggplot_build(apaText(apaScales(cov)))$data[[2]]$label[2], "−0.059", "covariance heat map: zeros stay")
check(ggplot_build(apaText(apaScales(cov + labs(fill = "r"))))$data[[2]]$label[2], "−.059", "heat map with a fill titled r: no leading zero")
# one bounded axis, one set of decimals: zero reads like the other ticks
check(sameDecimals(c("0", "0.05", "0.1", "−0.05")), c("0.00", "0.05", "0.10", "−0.05"), "same decimals on one axis")
check(labelsOf(apaScales(ggplot(data.frame(x = 1:2, y = c(-.05, .15)), aes(x, y)) + geom_point() + labs(y = "Cronbach's alpha") +
  scale_y_continuous(breaks = c(-.05, 0, .05, .1, .15), labels = function(b) format(b, drop0trailing = TRUE, trim = TRUE))), "y"),
  c("−.05", ".00", ".05", ".10", ".15"), "Cronbach's alpha axis: bounded, decimals alike")
check(isBoundedPlot(ggplot(data.frame(x = 1, y = 1), aes(x, y)) + labs(x = expression(theta))), FALSE, "theta alone (an IRT ability) is not bounded")
check(isBoundedPlot(ggplot(data.frame(x = 1, y = 1), aes(x, y)) + labs(x = "Cumulative hazard")), FALSE, "a cumulative hazard is not bounded")
# facets side by side with free x axes: the gap holds the end labels of both neighbours
apaPanelIn <- 4
fx <- ggplot(data.frame(x = c(-1.5, 1.5, -1.5, 1.5), y = 1:4, f = rep(c("a", "b"), each = 2)), aes(x, y)) + geom_point() +
  facet_wrap(~f, scales = "free_x") + scale_x_continuous(breaks = c(-1.5, 0, 1.5), expand = c(0, 0)) + theme(axis.text = element_text(size = 10 / apaScaleK))
check(facetGap(fx, ggplot_build(fx)) > 5.5, TRUE, "neighbouring facets: a wider gap for their end tick labels")
apaPanelIn <- Inf
# round 4
# bars with JASP's white outline count as unoutlined: pale fills get a dark one
wb <- ggplot(data.frame(x = c("a", "b", "c"), y = 1:3), aes(x, y, fill = x)) + geom_col(colour = "white") + scale_fill_manual(values = c("#F8766D", "#00BA38", "#619CFF"))
check(unique(ggplot_build(apaGgplot(wb, noChanges))$data[[1]]$colour), "#333333", "white outlines count as none: pale fills get a dark outline")
# headings for the note as drawn: lower-case values in title case; two facet variables give no heading (NA)
low <- ggplot(data.frame(x = 1:4, y = 1:4, f = rep(c("trend", "seasonal"), each = 2)), aes(x, y)) + geom_point() + facet_wrap(~f)
check(plotFacts(apaPlot(low))$panelHeadings, c("Seasonal", "Trend"), "headings for the note as the strips show them (title case)")
two <- ggplot(data.frame(x = 1:4, y = 1:4, f = c("mu", "mu", "tau", "tau"), g = c("1", "2", "1", "2")), aes(x, y)) + geom_point() + facet_wrap(f ~ g)
check(plotFacts(apaPlot(two))$panelHeadings, rep(NA_character_, 4), "two facet variables: no heading (the note's to-do)")
# 3 lines: all 3:1 against white, as far apart as they can be
l3 <- ggplot(data.frame(x = rep(1:3, 3), y = c(1:3, 2:4, 3:5), g = rep(c("1", "2", "3"), each = 3)), aes(x, y, colour = g)) + geom_line() +
  scale_colour_manual(values = c("#F8766D", "#00BA38", "#619CFF"))
lc <- unique(ggplot_build(apaGgplot(l3, noChanges))$data[[1]]$colour)
check(all(vapply(wcagLum(lc), contrastRatio, 1, 1) >= 3), TRUE, "3 lines: each 3:1 against white")
check(min(combn(wcagLum(lc), 2, function(v) contrastRatio(v[1], v[2]))) > 2.4, TRUE, "3 lines: about 2.6:1 apart")
check(any(grepl("linetype", names(ggplot_build(apaGgplot(l3, noChanges))$data[[1]]))) && length(unique(ggplot_build(apaGgplot(l3, noChanges))$data[[1]]$linetype)) > 1, FALSE, "3 lines: no line styles")
# a fixed light line colour (QC's green centre line) darkened, its hue kept
gl <- ggplot(data.frame(x = 1:3, y = 1:3), aes(x, y)) + geom_step(colour = "#00FF00")
gc <- unique(ggplot_build(apaGgplot(gl, noChanges))$data[[1]]$colour)
check(contrastRatio(wcagLum(gc), 1) >= 3 && abs(lineHue(gc) - lineHue("#00FF00")) < 0.3, TRUE, "light fixed line colour darkened to 3:1, same hue")
# facet tick thinning keeps at least 3 ticks
apaPanelIn <- 2
ft <- ggplot(data.frame(x = c(0, 30, 0, 30), y = 1:4, f = rep(c("a", "b"), each = 2)), aes(x, y)) + geom_point() + facet_wrap(~f) +
  scale_x_continuous(breaks = c(0, 10, 20, 30)) + theme(axis.text = element_text(size = 14 / apaScaleK))
fb <- ggplot_build(thinFacetTicks(ft, ggplot_build(ft), apaFamily, noChanges))
check(sum(!is.na(fb$layout$panel_params[[1]]$x$get_breaks())), 4L, "facet ticks: 4 stay 4 (thinning would leave 2)")
apaPanelIn <- Inf
# bounded titles: reliability coefficients and ACF in, Log(Power) out; an axis running past 1 is not bounded
bt <- function(t, x = c(0, 1)) isBoundedPlot(ggplot(data.frame(x = x, y = 1:2), aes(x, y)) + geom_point() + labs(x = t))
check(c(bt("Guttman's λ2"), bt("McDonald's ω"), bt("Split-half reliability"), bt("ACF"), bt("Log(Power)"), bt("Probability", c(0, 5))),
  c(TRUE, TRUE, TRUE, TRUE, FALSE, FALSE), "bounded: lambda 2, omega, split-half, ACF; not Log(Power) nor an axis past 1")
# a square matrix of values within [-1, 1] with neither a title nor a diagonal of ones is not a correlation map
sq <- ggplot(data.frame(a = c("u", "v", "u", "v"), b = c("u", "u", "v", "v"), r = c(0.2, -0.3, 0.4, 0.5)), aes(a, b, fill = r)) + geom_tile() + labs(fill = "Weight")
check(corrHeatmap(sq), FALSE, "square matrix without a correlation sign: no correlation map")
check(corrHeatmap(ggplot(data.frame(a = c("u", "u", "v"), b = c("v", "w", "w"), cor = c(0.2, -0.3, 0.4)), aes(a, b, fill = cor)) + geom_tile()), FALSE,
  "not square: no correlation map")
tri <- ggplot(data.frame(a = c("u", "u", "v", "v", "w", "w"), b = c("v", "w", "w", "u", "u", "v"), cor = c(0.2, -0.3, 0.4, 0.2, -0.3, 0.4)), aes(a, b, fill = cor)) + geom_tile()
check(corrHeatmap(tri), TRUE, "no diagonal, but the fill shows a column named cor: a correlation map")
# the facets' log line only when there are panels to letter
ol <- local({ v <- character(); list(add = function(x) v <<- c(v, x), get = function() v) })
invisible(facetLetters(ggplot(data.frame(x = 1, y = 1, f = "a"), aes(x, y)) + geom_point() + facet_wrap(~f) + coord_flip(), ol))
check(length(ol$get()), 0L, "one facet on flipped axes: nothing to letter, nothing logged")
# a legend JASP draws by hand (line samples and names) in title case
hl <- ggplot(data.frame(x = 0, xend = 1, y = 1:3, yend = 1:3, l = c("user", "wide", "ultrawide")), aes(x = x, y = y, xend = xend, yend = yend, label = l)) +
  geom_segment() + geom_text(aes(x = xend), hjust = 0)
check(handLegend(hl, noChanges)$data$l, c("User", "Wide", "Ultrawide"), "hand-drawn legend names in title case")
# no installed font for some characters: a to-do in the change log
cj <- local({ v <- character(); list(add = function(x) v <<- c(v, x), get = function() v) })
cjk <- ggplot(data.frame(x = c("选中", "未选中"), y = 1:2), aes(x, y)) + geom_point()
if (!isTRUE(plotGlyphs(cjk)$found)) { invisible(apaGgplot(cjk, cj)); check(any(grepl("^to-do: no installed font", cj$get())), TRUE, "CJK without a font: a to-do") }
check(plotGlyphs(cjk, function(str, family) data.frame(path = "/x/LiberationSans.ttf", index = 0), function() data.frame(path = "/x/LiberationSans.ttf", family = "Liberation Sans"))$found,
  FALSE, "fallback to Liberation Sans: no font found")
# a short panel in a JASP layout: y ticks cut to 3 (or the two ends)
sh <- ggplot(data.frame(x = 1:2, y = c(-9, 0)), aes(x, y)) + geom_point() + scale_y_continuous(breaks = c(-9, -6, -3, 0)) + theme(axis.text = element_text(size = 9 / apaScaleK))
check(length(na.omit(ggplot_build(fewerYTicks(sh, 0.9, noChanges))$layout$panel_params[[1]]$y$get_breaks())) < 4, TRUE, "short panel: fewer y ticks")
check(length(na.omit(ggplot_build(fewerYTicks(sh, 4, noChanges))$layout$panel_params[[1]]$y$get_breaks())), 4L, "tall panel: y ticks kept")
# group lines told apart by line style as well: a light one still darkens
qs <- ggplot(data.frame(x = rep(1:3, 2), y = c(1:3, 2:4), g = rep(c("UCL", "LCL"), each = 3)), aes(x, y, colour = g, linetype = g)) + geom_step() +
  scale_colour_manual(values = c("#F8766D", "#00BFC4"))
check(all(vapply(wcagLum(unique(ggplot_build(apaGgplot(qs, noChanges))$data[[1]]$colour)), contrastRatio, 1, 1) >= 3), TRUE, "group lines with line styles: 3:1 against white")
check(c(bt("Accuracy", c(0.5, 1)), bt("Mean Decrease in Accuracy", c(-0.05, 0.2))), c(TRUE, FALSE), "accuracy bounded; a decrease in accuracy is not (it can pass 1)")
# one constant colour mapped (aes(colour = "red")): a light line darkens
cr <- ggplot(data.frame(x = 1:3, y = 1:3), aes(x, y)) + geom_step(aes(colour = "red"))
check(contrastRatio(wcagLum(unique(ggplot_build(apaGgplot(cr, noChanges))$data[[1]]$colour)), 1) >= 3, TRUE, "constant mapped line colour: 3:1 against white")
# round 5
# lightness steps keep the hue: blue stays blue at low lightness (no clipping into red-brown)
hueDeg <- function(c) { l <- grDevices::convertColor(t(grDevices::col2rgb(c)) / 255, from = "sRGB", to = "Luv"); atan2(l[3], l[2]) * 180 / pi }
hueOff <- function(a, b) { d <- abs(hueDeg(a) - hueDeg(b)) %% 360; min(d, 360 - d) }
for (c0 in c("#619CFF", "#00BA38", "#F8766D", "#0000FF", "#00FF00")) for (tg in c(0.02, 0.06, 0.15, 0.3)) {
  x <- withLum(c0, tg)
  if (!is.na(x)) check(hueOff(x, c0) < 5 && abs(wcagLum(x) - tg) < 0.01, TRUE, sprintf("withLum keeps the hue of %s at %.2f", c0, tg))
}
dl <- unique(ggplot_build(apaGgplot(ggplot(data.frame(x = c("a", "b", "c"), y = 1:3), aes(x, y, fill = x)) + geom_col(), noChanges))$data[[1]]$fill)
check(all(mapply(function(a, b) hueOff(a, b) < 5, dl, c("#F8766D", "#00BA38", "#619CFF"))), TRUE, "ggplot's 3 default colours stepped: hues kept")
# a legend drawn as a panel of its own: the plot and its keys keep JASP's colours and shapes alike
keyP <- ggplot(data.frame(x = 1, y = 1:4, g = factor(1:4)), aes(x, y, fill = g)) + geom_point(shape = 21) + geom_text(aes(label = g), hjust = 0) + theme_void()
mainP <- ggplot(data.frame(x = 1:4, y = 1:4, g = factor(1:4)), aes(x, y, fill = g)) + geom_point(shape = 21) +
  scale_fill_manual(values = c("white", "grey", "black", "red"))
keyP <- keyP + scale_fill_manual(values = c("white", "grey", "black", "red"))
kp <- apaPlot(jaspGraphs::ggMatrixPlot(list(keyP, mainP), layout = matrix(1:2, 2)))
check(c(unique(ggplot_build(kp$subplots[[1]])$data[[1]]$fill), unique(ggplot_build(kp$subplots[[2]])$data[[1]]$shape)),
  c("white", "grey", "black", "red", "21"), "hand-drawn legend panel: keys and points keep JASP's colours and shapes")
# colours that carry meaning stay (risk of bias)
rob <- ggplot(data.frame(x = c("D1", "D1", "D1", "D1"), w = 1, j = c("Low", "Some concerns", "Serious", "Critical")), aes(x, w, fill = j)) +
  geom_col(colour = "black") + scale_fill_manual(values = c(Low = "#02C100", "Some concerns" = "#E2DF07", Serious = "#BF0000", Critical = "#820000"))
check(sort(unique(ggplot_build(apaGgplot(rob, noChanges))$data[[1]]$fill)), sort(c("#02C100", "#E2DF07", "#BF0000", "#820000")), "risk-of-bias colours stay")
o4 <- ggplot(data.frame(x = letters[1:4], y = 1:4), aes(x, y, fill = x)) + geom_col(colour = "black")
check(unique(ggplot_build(apaGgplot(o4, noChanges))$data[[1]]$fill), unique(ggplot_build(o4)$data[[1]]$fill), "4 outlined fills: not stepped")
# long headings on narrow panels: wrapped at spaces, broken after their own hyphen, never "--"
apaPanelIn <- 2.4
lh <- ggplot(data.frame(x = 1:4, y = 1:4, f = rep(c("Posterior Distribution of the Between-Study Standard Deviation", "Prior Mean"), each = 2)), aes(x, y)) +
  geom_point() + facet_wrap(~f, nrow = 1) + theme(strip.text = element_text(size = 10 / apaScaleK))
lg <- ggplotGrob(apaPlot(lh))
ls <- unlist(lapply(lg$grobs[grepl("strip", lg$layout$name)], function(g) { tx <- NULL; walk <- function(x) { if (inherits(x, "text")) tx <<- c(tx, x$label); for (ch in c(x$children, x$grobs)) walk(ch) }; walk(g); tx }))
check(any(grepl("-\n-|--", ls)) || !any(grepl("\n", ls)), FALSE, "long heading: wrapped, no doubled hyphen")
check(gsub("\n", " ", gsub("-\n", "-", ls[1])), "Posterior Distribution of the Between-Study Standard Deviation", "long heading: broken at spaces or after its own hyphen, words whole")
check(any(grepl(" \n|\n ", ls)), FALSE, "long heading: no stray spaces at the breaks")
apaPanelIn <- Inf
# leading zeros: rates, relative frequencies and an ROC axis padded to 1.1 can't exceed 1; a probability drawn in a
# shaded area under a density loses its zero, the density values beside the axis keep theirs
roc <- ggplot(data.frame(x = c(0, .5, 1), y = c(0, .8, 1)), aes(x, y)) + geom_line() + labs(x = "False Positive Rate", y = "True Positive Rate") +
  scale_y_continuous(limits = c(0, 1.1), breaks = seq(0, 1, .2))
rb <- ggplot_build(apaPlot(roc))
check(c(rb$layout$panel_params[[1]]$y$get_labels()[2], rb$layout$panel_params[[1]]$x$get_labels()[2]), c(".2", ".25"), "ROC axes: rates without leading zeros, y padded to 1.1")
rf <- ggplot(data.frame(x = 1:9, y = seq(.05, .3, length.out = 9)), aes(x, y)) + geom_col() + labs(y = "Relative frequency")
check(ggplot_build(apaPlot(rf))$layout$panel_params[[1]]$y$get_labels()[2], ".1", "relative frequency: no leading zero")
dx <- seq(0, 3, .05)
pdfp <- ggplot(data.frame(x = dx, y = dnorm(dx, 1.5, .7)), aes(x, y)) + geom_line() +
  geom_area(data = data.frame(x = dx[dx >= 1 & dx <= 2], y = dnorm(dx[dx >= 1 & dx <= 2], 1.5, .7)), aes(x, y), fill = "grey") +
  geom_text(data = data.frame(x = 1.5, y = .1, label = "0.52"), aes(x, y, label = label)) +
  geom_text(data = data.frame(x = c(0, 0), y = c(.31, .13), label = c("0.31", "0.13")), aes(x, y, label = label)) + labs(y = "Density")
pq <- apaPlot(pdfp)
check(c(pq$layers[[3]]$data$label, pq$layers[[4]]$data$label), c(".52", "0.31", "0.13"), "a probability in a shaded area loses its zero; density values keep theirs")
band <- ggplot(data.frame(x = dx, y = .5 + .1 * sin(dx)), aes(x, y)) + geom_ribbon(aes(ymin = y - .2, ymax = y + .2), fill = "grey80") + geom_line() +
  geom_text(data = data.frame(x = 1.5, y = .5, label = "0.52"), aes(x, y, label = label)) + labs(y = "Score")
check(apaPlot(band)$layers[[3]]$data$label, "0.52", "a number inside a confidence band keeps its zero")
pdfParsed <- pdfp; pdfParsed$layers[[3]] <- geom_text(data = data.frame(x = 1.5, y = .1, label = "0.52"), aes(x, y, label = label), parse = TRUE)
check(ggplot_build(apaPlot(pdfParsed))$data[[3]]$label, "\".52\"", "a parsed probability label keeps its form (.52, not the number 0.52)")
# a P-P plot's axes (Theoretical, Sample, ticks from 0 to 1) lose their zeros; a Q-Q plot's keep theirs
pp <- ggplot(data.frame(x = seq(0, 1, .1), y = seq(0, 1, .1)), aes(x, y)) + geom_point() + labs(x = "Theoretical", y = "Sample") +
  scale_x_continuous(breaks = seq(0, 1, .25)) + scale_y_continuous(breaks = seq(0, 1, .25))
qq <- ggplot(data.frame(x = seq(-1.5, 1.5, .5), y = seq(-1.5, 1.5, .5)), aes(x, y)) + geom_point() + labs(x = "Theoretical", y = "Sample") +
  scale_x_continuous(breaks = seq(-1, 1, .5))
check(c(ggplot_build(apaPlot(pp))$layout$panel_params[[1]]$x$get_labels()[2], ggplot_build(apaPlot(qq))$layout$panel_params[[1]]$x$get_labels()[2]),
  c(".25", "\u22120.5"), "P-P axes without leading zeros; Q-Q axes keep them")
# no stepped fill near white: the lightest group at 0.85 luminance at most (ML's cluster means)
check(max(c(stepTargets(3, FALSE, TRUE), stepTargets(4, FALSE, TRUE), stepTargets(3, FALSE, FALSE), stepTargets(5, FALSE, FALSE))) <= 0.85 + 1e-9, TRUE, "stepped fills stay below 0.85 luminance")
check(min(stepTargets(5, FALSE, TRUE)) >= min(0.16 * (0.97 / 0.16)^(seq(0, 1, length.out = 5)) - 0.05) - 1e-9, TRUE, "4 or more fills: the darkest stays light enough for black marks on it")
check(min(c(stepTargets(2, FALSE, TRUE), stepTargets(3, FALSE, TRUE))) >= 0.1, TRUE, "2 or 3 fills with error bars or boxes on them: the darkest stays light enough for black marks on it")
# a continuous axis with no breaks doesn't stop the redraw
nb <- ggplot(data.frame(x = 1:3, y = c(.1, .5, .9)), aes(x, y)) + geom_point() + scale_y_continuous(breaks = NULL) + labs(y = "Proportion")
check(inherits(tryCatch(apaPlot(nb), error = function(e) e), "ggplot"), TRUE, "an axis without breaks: redrawn")
# a bottom legend wider than the picture goes into two rows
apaFigureIn <- c(4, 3)
wl <- ggplot(data.frame(x = c("a", "b", "c", "d"), y = 1:4, g = c("Low Risk of Bias", "Moderate Risk of Bias", "Serious Risk of Bias", "Critical Risk of Bias")), aes(x, y, fill = g)) +
  geom_col() + scale_fill_manual(values = c("#02C100", "#E2DF07", "#BF0000", "#820000")) + theme(legend.position = "bottom")
wq <- apaPlot(wl)
check(any(grepl("legend in two rows", attr(wq, "apaChanges"))), TRUE, "a legend wider than the picture: two rows")
apaFigureIn <- c(NA_real_, NA_real_)
# a failing step leaves the plot as it was and says so
sl <- local({ v <- character(); list(add = function(x) v <<- c(v, x), get = function() v) })
check(identical(safeStep(pa, "a step", sl, function(p) stop("boom")), pa) && grepl("a step left as JASP drew it \\(boom\\)", sl$get()), TRUE, "a failing step: input kept, change-log line")
# a step that changes a layer in place, logs a line and then fails leaves no trace but its own line
hl <- local({ v <- "earlier line"; list(add = function(x) v <<- c(v, x), get = function() v, set = function(x) v <<- x) })
hp <- ggplot(data.frame(x = 1:3, y = 1:3, g = c("a", "b", "c")), aes(x, y, colour = g)) + geom_point(size = 2)
hb <- ggplot_build(hp)
half <- safeStep(hp, "a half step", hl, function(p) {
  l <- hb$plot$layers[[1]]; l$aes_params$size <- 9; l$mapping$fill <- quote(g); hl$add("points outlined"); stop("late failure")
})
check(list(half$layers[[1]]$aes_params$size, is.null(half$layers[[1]]$mapping$fill), hl$get()),
  list(2, TRUE, c("earlier line", "a half step left as JASP drew it (late failure)")), "a failed step: layer edits and its log lines undone")
# letters on facets with date and discrete x axes draw
dt <- ggplot(data.frame(x = as.Date("2020-01-01") + 0:3, y = 1:4, f = rep(c("a", "b"), 2)), aes(x, y)) + geom_line() + facet_wrap(~f)
ds <- ggplot(data.frame(x = c("u", "v", "u", "v"), y = 1:4, f = rep(c("a", "b"), each = 2)), aes(x, y)) + geom_col() + facet_wrap(~f)
check(c(inherits(tryCatch(ggplotGrob(apaPlot(dt)), error = function(e) e), "gtable"), inherits(tryCatch(ggplotGrob(apaPlot(ds)), error = function(e) e), "gtable")),
  c(TRUE, TRUE), "facet letters on date and discrete axes draw")
# the caller's plot stays as it was
cp <- ggplot(data.frame(x = c("a", "b"), y = 1:2), aes(x, y, fill = x)) + geom_col(colour = "white") + scale_fill_manual(values = c("#FFF5B0", "#1A1A80"))
before <- ggplot_build(cp)$data[[1]][, c("fill", "colour")]
invisible(apaPlot(cp))
check(ggplot_build(cp)$data[[1]][, c("fill", "colour")], before, "the caller's plot unchanged")
# the caller's facet labeller stays as it was (a second redraw of the same plot is drawn the same)
apaPanelIn <- 2.2
fc <- ggplot(data.frame(x = 1:4, y = 1:4, f = rep(c("strength", "betweenness"), 2)), aes(x, y)) + geom_point() + facet_wrap(~f, nrow = 1)
labBefore <- fc$facet$params$labeller
invisible(apaPlot(fc))
check(identical(fc$facet$params$labeller, labBefore), TRUE, "the caller's facet labeller unchanged")
# the caller's legend title stays as it was when the redraw title-cases it
lt <- ggplot(data.frame(x = c("a", "b"), y = 1:2), aes(x, y, fill = x)) + geom_col() + scale_fill_manual("group size", values = c("#1A1A80", "#E0E0FF"))
invisible(apaPlot(lt))
check(lt$scales$get_scales("fill")$name, "group size", "the caller's scale title unchanged")
# a failing step on a figure of several plots leaves its attributes (panel letters) as they were
fg <- jaspGraphs::ggMatrixPlot(list(ggplot(data.frame(x = 1:2, y = 1:2), aes(x, y)) + geom_point(), ggplot(data.frame(x = 1:2, y = 1:2), aes(x, y)) + geom_point()), layout = matrix(1:2, 1))
gl <- local({ v <- character(); list(add = function(x) v <<- c(v, x), get = function() v, set = function(x) v <<- x) })
invisible(safeStep(fg, "letters", gl, function(p) { attr(p, "apaPanelLetters") <- c("A", "B"); stop("late") }))
check(is.null(attr(fg, "apaPanelLetters")), TRUE, "a failed step on a figure: its attributes undone")
apaPanelIn <- Inf
# apaPlot leaves no device open: a stray pdf device became the current one when jaspBase closed its own png, and the
# picture then failed on it ("invalid font type", Network centrality plots)
while (grDevices::dev.cur() > 1) grDevices::dev.off()
fw <- ggplot(data.frame(x = c(-1.5, 1.5, -1.5, 1.5), y = 1:4, f = rep(c("a", "b"), each = 2)), aes(x, y)) + geom_point() + facet_wrap(~f, nrow = 1)
invisible(apaPlot(fw))
check(grDevices::dev.cur(), c("null device" = 1L), "apaPlot leaves no device open")
# with a device already open, apaPlot leaves the devices and the current one as they were
ragg::agg_png(tempfile(fileext = ".png")); grDevices::pdf(NULL); ragg::agg_png(tempfile(fileext = ".png")); grDevices::dev.set(3)
devBefore <- list(grDevices::dev.cur(), grDevices::dev.list())
invisible(apaPlot(fw))
check(list(grDevices::dev.cur(), grDevices::dev.list()), devBefore, "apaPlot keeps the caller's devices and current device")
while (grDevices::dev.cur() > 1) grDevices::dev.off()
cat(if (failed) paste(failed, "failed\n") else "all passed\n"); quit(status = failed > 0)
