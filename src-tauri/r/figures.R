# Coralline figures: reruns every analysis in a .jasp file with JASP's own R and draws its plots as APA 7 figures.
#   Rscript figures.R <file.jasp> <out folder> <work folder> [modules folder]
# Writes <out>/figures.json (analyses, plots with their picture, size and facts) and <out>/rerun.json (the rerun's
# results, so the caller can check them against the file's saved ones), plus one PNG per plot.
args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 3) stop("usage: figures.R <file.jasp> <out folder> <work folder> [modules folder]")
jaspFile <- args[1]; outDir <- args[2]; workDir <- args[3]
modulesRoot <- if (length(args) >= 4) args[4] else "/app/Modules/module_libs"
here <- dirname(normalizePath(sub("^--file=", "", grep("^--file=", commandArgs(FALSE), value = TRUE)[1])))
dir.create(outDir, showWarnings = FALSE, recursive = TRUE); dir.create(workDir, showWarnings = FALSE, recursive = TRUE)

# jaspTools writes its set-up into its own folder, which is read-only inside JASP: use a copy in the work folder
libs <- list.dirs(modulesRoot, recursive = FALSE)
rlib <- file.path(workDir, "rlib")
src <- Filter(dir.exists, file.path(libs, "jaspTools"))[1]
if (is.na(src)) stop("jaspTools not found in JASP's modules")
# copied again when JASP brings a different jaspTools (an update), so the copy never goes stale
same <- function(a, b) isTRUE(tryCatch(identical(readLines(a, warn = FALSE), readLines(b, warn = FALSE)), error = function(e) FALSE))
if (!same(file.path(src, "DESCRIPTION"), file.path(rlib, "jaspTools", "DESCRIPTION"))) {
  unlink(rlib, recursive = TRUE)
  dest <- file.path(rlib, "jaspTools"); dir.create(dest, recursive = TRUE)
  # the module library holds a link to a folder with a hash name: copy its contents under the package's own name
  file.copy(list.files(normalizePath(src), full.names = TRUE, all.files = TRUE, no.. = TRUE), dest, recursive = TRUE)
}
.libPaths(c(rlib, libs, .libPaths()))
suppressPackageStartupMessages({ library(jaspTools); library(jaspBase); library(jaspGraphs) })
if (!jaspTools:::.isSetupComplete()) suppressMessages(setupJaspTools(installJaspModules = FALSE, installJaspCorePkgs = FALSE, quiet = TRUE))
suppressMessages({ setPkgOption("module.dirs", file.path(libs, basename(libs))); setPkgOption("reinstall.modules", FALSE) })
oldwd <- setwd(here); source("readjasp.R"); source("apastyle.R"); setwd(oldwd)
source(file.path(here, "engine.R"))   # what JASP's engine provides: globals, name encoding, decoding, drawing

pt <- 10; portraitw <- 6.5; landscapew <- 9; portraith <- 8; landscapeh <- 6.5; dpi <- 300; k <- 5 / (530 / 72)   # one scale: a 530 px JASP plot becomes 5 in, its text 10 pt
jaspGraphs::graphOptions(fontsize = pt / k, family = apaFamily, axis.title.cex = 1.1, legend.cex = 1)
opts <- tryCatch(analysisOptions(jaspFile), error = function(e) list())   # a file without analyses
if (!is.null(attr(opts, "analysisName"))) opts <- list(opts)
# files of summary statistics have no data; their analyses get an empty data set
ds <- tryCatch(readJaspData(jaspFile), error = function(e) data.frame())
apaVariables <- colnames(ds)   # title case leaves the data's own names alone
analyses <- list(); figures <- list(); rerun <- vector("list", length(opts))
for (i in seq_along(opts)) {
  o <- opts[[i]]; err <- NULL; t0 <- Sys.time()
  setTimeLimit(elapsed = 180, transient = TRUE)
  res <- tryCatch(runJasp(o, ds), error = function(e) { err <<- conditionMessage(e); NULL })
  setTimeLimit(elapsed = Inf)
  if (!is.null(res)) rerun[i] <- list(res$results)   # [i] <- list(): a NULL result must not shift the others
  decode <- get(".decodeColNamesLax", envir = globalenv())
  decodeNames <- function(x) if (is.character(x)) decode(x) else x
  for (fig in res$state$figures) {
    size <- function(v, fallback) if (is.numeric(v) && length(v) == 1 && is.finite(v) && v > 0) v else fallback
    w <- size(fig$width, 480) / 72; h <- size(fig$height, 320) / 72   # JASP's default size when a plot has none
    # Busy plots of many panels (correlation matrices) grow until each panel is about 1.5 in wide, so their 8 to
    # 10 pt text fits; a plot wider than a portrait page (6.5 in) keeps its width up to a landscape page's (9 in),
    # and the figure asks for a landscape page. Only beyond that is a plot drawn smaller than JASP's size.
    cols <- if (inherits(fig$obj, "jaspGraphsPlot") && dataPanels(fig$obj) >= 4) ceiling(sqrt(length(fig$obj$subplots))) else 1
    if (cols > 1 && w * k < min(cols * 1.5, landscapew)) { f <- min(cols * 1.5, landscapew) / (w * k); w <- w * f; h <- h * f }
    if (w * k > landscapew) { h <- h * landscapew / (w * k); w <- landscapew / k }
    landscape <- w * k > portraitw + 0.01
    maxh <- if (landscape) landscapeh else portraith
    if (h * k > maxh) { w <- w * maxh / (h * k); h <- maxh / k }   # too tall for a page with its title and note
    landscape <- w * k > portraitw + 0.01
    apaPanelIn <- w * k / cols   # read by thinBreaks (apastyle.R)
    png <- sprintf("a%d-%d-%s.png", i, length(figures) + 1, substr(gsub("[^A-Za-z0-9_.-]", "_", fig$getUnique), 1, 80))
    q <- NULL
    drawn <- if (is.null(fig$obj)) {
      "JASP couldn't draw this plot either"
    } else if (cols > 8) {
      "too many panels to fit even a landscape page with readable text"   # JASP's own picture is better
    } else tryCatch({
      q <- nameYAxis(apaPlot(fig$obj), decodeNames(fig$title))
      ragg::agg_png(file.path(outDir, png), width = w, height = h, units = "in", res = dpi * k); drawJasp(q); dev.off()
      # a picture of one flat colour means nothing was drawn (some plot kinds draw outside ggplot)
      pixels <- png::readPNG(file.path(outDir, png))
      if (sd(as.vector(pixels[, , 1:min(3, dim(pixels)[3])])) < 1e-6) "nothing was drawn" else TRUE
    }, error = function(e) { while (dev.cur() > 1) dev.off(); conditionMessage(e) })
    # names decoded for the caller (titles, facts), but the picture's file name stays as written
    entry <- rapply(list(analysis = i, name = fig$getUnique, title = fig$title, error = if (isTRUE(drawn)) NULL else drawn,
      widthIn = w * k, heightIn = h * k, landscape = landscape, facts = tryCatch(plotFacts(if (is.null(q)) fig$obj else q), error = function(e) NULL), changes = if (is.null(q)) NULL else attr(q, "apaChanges")),
      decode, classes = "character", how = "replace")
    entry$png <- if (isTRUE(drawn)) png else NULL
    figures[[length(figures) + 1]] <- entry
  }
  if (is.null(err) && !is.null(res) && !identical(as.character(res$status), "complete")) {
    # JASP's own message (an analysis that stops with a fatal error), as plain text: the first line that says something
    m <- unlist(res$results); m <- m[grepl("errorMessage", names(m))]
    if (length(m)) err <- head(Filter(nzchar, trimws(gsub("<[^>]+>", "", strsplit(m[[1]], "<br>", fixed = TRUE)[[1]]))), 2) |> paste(collapse = " ")
  }
  analyses[[i]] <- list(analysis = i, name = attr(o, "analysisName"), status = if (is.null(res)) "error" else as.character(res$status),
    error = err, seconds = round(as.numeric(Sys.time() - t0, units = "secs"), 1))
}
jsonlite::write_json(list(file = basename(jaspFile), analyses = analyses, figures = figures), file.path(outDir, "figures.json"), auto_unbox = TRUE, null = "null", na = "null", pretty = TRUE)
jsonlite::write_json(rerun, file.path(outDir, "rerun.json"), auto_unbox = TRUE, digits = NA, null = "null", na = "null")
cat("done\n")
