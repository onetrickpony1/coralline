# jAPAsp figures: reruns every analysis in a .jasp file with JASP's own R and draws its plots as APA 7 figures.
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
if (!dir.exists(file.path(rlib, "jaspTools"))) {
  src <- Filter(dir.exists, file.path(libs, "jaspTools"))[1]
  if (is.na(src)) stop("jaspTools not found in JASP's modules")
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

pt <- 10; maxw <- 6.5; dpi <- 300; k <- 5 / (530 / 72)   # one scale: a 530 px JASP plot becomes 5 in, its text 10 pt
jaspGraphs::graphOptions(fontsize = pt / k, family = apaFamily, axis.title.cex = 1.1, legend.cex = 1)
opts <- analysisOptions(jaspFile); if (!is.null(attr(opts, "analysisName"))) opts <- list(opts)
ds <- readJaspData(jaspFile)
apaVariables <- colnames(ds)   # title case leaves the data's own names alone
analyses <- list(); figures <- list(); rerun <- vector("list", length(opts))
for (i in seq_along(opts)) {
  o <- opts[[i]]; err <- NULL; t0 <- Sys.time()
  setTimeLimit(elapsed = 180, transient = TRUE)
  res <- tryCatch(runJasp(o, ds), error = function(e) { err <<- conditionMessage(e); NULL })
  setTimeLimit(elapsed = Inf)
  if (!is.null(res)) rerun[[i]] <- res$results
  decode <- get(".decodeColNamesLax", envir = globalenv())
  for (fig in res$state$figures) {
    w <- fig$width / 72; h <- fig$height / 72
    if (w * k > maxw) { h <- h * maxw / (w * k); w <- maxw / k }   # too wide for the page: drawn smaller, same text size
    png <- sprintf("a%d-%s.png", i, gsub("[^A-Za-z0-9_.-]", "_", fig$getUnique))
    q <- NULL
    drawn <- if (inherits(fig$obj, "jaspGraphsPlot") && dataPanels(fig$obj) > 15) {
      "too many panels to fit a page with readable text"   # big correlation matrices: JASP's own picture is better
    } else tryCatch({
      q <- apaPlot(fig$obj)
      ragg::agg_png(file.path(outDir, png), width = w, height = h, units = "in", res = dpi * k); drawJasp(q); dev.off()
      # a picture of one flat colour means nothing was drawn (some plot kinds draw outside ggplot)
      pixels <- png::readPNG(file.path(outDir, png))
      if (sd(as.vector(pixels[, , 1:min(3, dim(pixels)[3])])) < 1e-6) "nothing was drawn" else TRUE
    }, error = function(e) { while (dev.cur() > 1) dev.off(); conditionMessage(e) })
    # names decoded for the caller (titles, facts), but the picture's file name stays as written
    entry <- rapply(list(analysis = i, name = fig$getUnique, title = fig$title, error = if (isTRUE(drawn)) NULL else drawn,
      widthIn = w * k, heightIn = h * k, facts = plotFacts(fig$obj), changes = if (is.null(q)) NULL else attr(q, "apaChanges")),
      decode, classes = "character", how = "replace")
    entry$png <- if (isTRUE(drawn)) png else NULL
    figures[[length(figures) + 1]] <- entry
  }
  analyses[[i]] <- list(analysis = i, name = attr(o, "analysisName"), status = if (is.null(res)) "error" else as.character(res$status),
    error = err, seconds = round(as.numeric(Sys.time() - t0, units = "secs"), 1))
}
jsonlite::write_json(list(file = basename(jaspFile), analyses = analyses, figures = figures), file.path(outDir, "figures.json"), auto_unbox = TRUE, null = "null", na = "null", pretty = TRUE)
jsonlite::write_json(rerun, file.path(outDir, "rerun.json"), auto_unbox = TRUE, digits = NA, null = "null", na = "null")
cat("done\n")
