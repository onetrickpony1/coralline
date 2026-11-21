# What JASP's engine provides around an analysis, for reruns outside JASP
# Values JASP's engine sets before an analysis runs (some modules read them): number of decimals and the version
assign(".numDecimals", 3L, envir = globalenv())
assign(".jaspVersion", Sys.getenv("JASP_VERSION", "0.98.1"), envir = globalenv())

# Like JASP, encode the variable names (names with spaces break model formulas), run, then decode: the decoders are
# the two functions JASP's engine defines and jaspBase looks up by name (also used by jaspBase::decodeplot)
setDecoders <- function(map) {
  enc <- if (is.null(map)) character() else map$encoded; orig <- if (is.null(map)) character() else map$original
  o <- order(-nchar(enc)); enc <- enc[o]; orig <- orig[o]   # jaspColumn12 before jaspColumn1
  lax <- function(x) { if (!is.character(x)) return(x); for (i in seq_along(enc)) x <- gsub(enc[i], orig[i], x, fixed = TRUE); x }
  strict <- function(x) { if (!is.character(x)) return(x); m <- match(x, enc); ifelse(is.na(m), x, orig[m]) }
  assign(".decodeColNamesLax", lax, envir = globalenv()); assign(".decodeColNamesStrict", strict, envir = globalenv())
  lax
}
# ggplot2 4 hashes each guide's title to tell guides apart. JASP's plots can give a function as the title (jaspBase's
# column-name decoder), and in a rerun outside JASP, jaspTools' copy of jaspBase makes that function serialise to
# hundreds of MB, so every guide took seconds (a correlation matrix: minutes). Hash functions by their code instead:
# ggplot2 only compares the hashes, and the same code means the same title function.
local({
  imp <- parent.env(asNamespace("ggplot2"))
  if (exists("hash", envir = imp, inherits = FALSE)) {
    full <- get("hash", envir = imp)
    light <- function(x) {
      if (is.function(x)) return(c("<function>", deparse(x)))
      if (is.list(x) && !is.object(x)) return(lapply(x, light))
      x
    }
    unlockBinding("hash", imp)
    assign("hash", function(x) full(light(x)), envir = imp)
    lockBinding("hash", imp)
  }
})

# Options the file doesn't have, because a newer JASP added them (JASP 0.99 added descriptivePlotHorizontalAxis to
# linear regression, for example): JASP fills them from the analysis form's defaults when it opens an older file, so
# the rerun does the same. The defaults come from the form (QML) of the installed module, through jaspTools; when
# JASP bundles two versions of a module, the one whose version is installed is used. Saved options always win.
moduleRoot <- Sys.getenv("JASP_MODULES", "/app/Modules/binary_pkgs")
formDefaults <- function(name) {
  forms <- list.files(moduleRoot, pattern = paste0("^", name, "\\.qml$"), recursive = TRUE, full.names = TRUE)
  dirs <- unique(dirname(dirname(forms)))
  installed <- function(d) {
    desc <- tryCatch(read.dcf(file.path(d, "DESCRIPTION"), fields = c("Package", "Version")), error = function(e) NULL)
    !is.null(desc) && isTRUE(tryCatch(as.character(packageVersion(desc[1, "Package"])) == desc[1, "Version"], error = function(e) FALSE))
  }
  dirs <- c(Filter(installed, dirs), Filter(Negate(installed), dirs))
  for (d in dirs) {
    old <- jaspTools:::getPkgOption("module.dirs")
    jaspTools::setPkgOption("module.dirs", d)
    defaults <- tryCatch(suppressMessages(jaspTools::analysisOptions(name)), error = function(e) NULL)
    jaspTools::setPkgOption("module.dirs", old)
    if (is.list(defaults)) return(defaults)
  }
  NULL
}
# JASP's upgrade rules (each module's Upgrades.qml): when JASP opens an older file it renames analyses and options
# that later versions renamed. The rerun applies the two simple kinds, a new function name and ChangeRename; rules
# written in JavaScript (ChangeJS) can't run here, and an analysis they would change falls back to JASP's picture
# through the trust check. A rule applies only when its old name is in the options (or the old function is gone)
# and the new one isn't (an analysis that still has its old name predates the rename), so newer files aren't touched.
upgradeRules <- local({
  rules <- NULL
  function() {
    if (!is.null(rules)) return(rules)
    rules <<- list()
    for (f in list.files(moduleRoot, pattern = "^Upgrades\\.qml$", recursive = TRUE, full.names = TRUE)) {
      text <- paste(readLines(f, warn = FALSE), collapse = "\n")
      for (block in strsplit(text, "\\bUpgrade\\s*\\{")[[1]][-1]) {
        field <- function(key) { m <- regmatches(block, regexec(paste0("\\b", key, ":\\s*\"([^\"]+)\""), block))[[1]]; if (length(m) > 1) m[2] else NA }
        fn <- field("functionName"); if (is.na(fn)) next
        renames <- regmatches(block, gregexpr("ChangeRename\\s*\\{[^}]*\\}", block))[[1]]
        pairs <- lapply(renames, function(r) c(sub('.*from:\\s*"([^"]+)".*', "\\1", r), sub('.*to:\\s*"([^"]+)".*', "\\1", r)))
        rules[[length(rules) + 1]] <<- list(fn = fn, newFn = field("newFunctionName"), renames = pairs)
      }
    }
    rules
  }
})
applyUpgrades <- function(o) {
  name <- attr(o, "analysisName")
  for (step in 1:5) {   # renames can chain (an analysis renamed, then its options)
    changed <- FALSE
    for (r in upgradeRules()) {
      if (r$fn != name) next
      for (pair in r$renames) if (pair[1] %in% names(o) && !pair[2] %in% names(o)) { names(o)[names(o) == pair[1]] <- pair[2]; changed <- TRUE }
      if (!is.na(r$newFn) && r$newFn != name) {   # a file that still uses the old name predates the rename
        name <- r$newFn; changed <- TRUE
      }
    }
    if (!changed) break
  }
  attr(o, "analysisName") <- name
  o
}

fillDefaults <- function(o) {
  defaults <- tryCatch(suppressMessages(formDefaults(attr(o, "analysisName"))), error = function(e) NULL)
  missing <- setdiff(names(defaults), c(names(o), ".meta"))
  if (length(missing) == 0) return(o)
  a <- attributes(o)
  o[missing] <- defaults[missing]
  for (k in setdiff(names(a), "names")) attr(o, k) <- a[[k]]
  attr(o, "filledDefaults") <- missing
  o
}

runJasp <- function(o, ds) {
  o <- fillDefaults(applyUpgrades(o))
  name <- attr(o, "analysisName")
  enc <- if (ncol(ds) == 0) NULL else tryCatch(suppressWarnings(encodeOptionsAndDataset(o, ds)), error = function(e) NULL)
  map <- if (is.null(enc)) NULL else enc$encodingMap
  # Options that hold column names without types, which jaspTools doesn't encode: the repeated-measures cells
  untyped <- intersect(c("repeatedMeasuresCells"), names(o))
  extra <- setdiff(unlist(o[untyped]), map$original)
  extra <- extra[extra %in% colnames(ds)]
  if (length(extra)) map <- rbind(map[, c("original", "encoded", "type")], data.frame(original = extra, encoded = "", type = "scale"))
  if (ncol(ds) == 0 || is.null(map) || nrow(map) == 0) { setDecoders(NULL); return(runAnalysis(name, ds, o, view = FALSE, quiet = TRUE)) }
  # Number the encoded names by the variable's place in the data, as JASP does (JaspColumn_<n>_Encoded), not by
  # where it first shows up in the options: analyses that sort variables (pairs like "a-b") then sort like JASP
  pos <- match(map$original, colnames(ds)) - 1L
  if (anyNA(pos)) pos[is.na(pos)] <- 10000L + seq_len(sum(is.na(pos)))
  map$encoded <- ifelse(duplicated(map$original) | duplicated(map$original, fromLast = TRUE),
    sprintf("JaspColumn_%d_Encoded_%s", pos, map$type), sprintf("JaspColumn_%d_Encoded", pos))
  rebuilt <- tryCatch(list(
    options = jaspTools:::encodeOptionsWithMap(o, map, colnames(ds)),
    dataset = jaspTools:::createEncodedDataset(ds, map), encodingMap = map), error = function(e) NULL)
  if (is.null(rebuilt)) { if (is.null(enc) || nrow(enc$encodingMap) == 0) { setDecoders(NULL); return(runAnalysis(name, ds, o, view = FALSE, quiet = TRUE)) } }
  else enc <- rebuilt
  for (u in untyped) {
    v <- enc$options[[u]]
    if (is.character(v)) { k <- match(v, enc$encodingMap$original); v[!is.na(k)] <- enc$encodingMap$encoded[k[!is.na(k)]]; enc$options[[u]] <- v }
  }
  attr(enc$options, "analysisName") <- name
  decode <- setDecoders(enc$encodingMap)
  res <- runAnalysis(name, enc$dataset, enc$options, view = FALSE, quiet = TRUE, encodedDataset = TRUE)
  deep <- function(x) {   # values and names (table column keys hold variable names too)
    if (is.list(x)) { if (!is.null(names(x))) names(x) <- decode(names(x)); for (i in seq_along(x)) if (!is.null(x[[i]])) x[[i]] <- deep(x[[i]]); x }
    else if (is.character(x)) decode(x) else x
  }
  res$results <- deep(res$results)
  res
}
# The plot as JASP draws it: names decoded everywhere (titles, legends, text in the plot), as a grid object
# Raises every font size in a finished drawing to at least `smallest` (in the drawing's own points), in the APA
# font; used for
# patchworks, whose wrapped parts (survival risk tables) are grid drawings the plot theme never reaches
floorFonts <- function(g, smallest) {
  if (!is.null(g$gp) && is.numeric(g$gp$fontsize) && length(g$gp$fontsize) == 1 && g$gp$fontsize < smallest)
    g$gp$fontsize <- smallest
  if (!is.null(g$gp) && !is.null(g$gp$fontfamily) && !identical(g$gp$fontfamily, apaFamily))
    g$gp$fontfamily <- apaFamily   # the APA font also in parts drawn outside ggplot
  if (inherits(g, "text") && (is.null(g$gp) || is.null(g$gp$fontfamily)))
    g$gp <- grid::gpar(fontfamily = apaFamily)
  if (inherits(g, "gtable") && length(g$grobs)) g$grobs <- lapply(g$grobs, floorFonts, smallest = smallest)
  if (inherits(g, "gTree") && length(g$children)) {
    g <- grid::setChildren(g, do.call(grid::gList, unname(lapply(g$children, floorFonts, smallest = smallest))))
  }
  g
}
drawJasp <- function(p) {
  d <- jaspBase:::decodeplot(p)
  if (inherits(d, "patchwork")) {
    g <- tryCatch(floorFonts(patchwork::patchworkGrob(d), 8 / apaScaleK), error = function(e) NULL)
    if (!is.null(g)) { grid::grid.newpage(); grid::grid.draw(g); return(invisible()) }
  }
  if (inherits(d, "grob")) grid::grid.draw(d)
  else if (inherits(d, "qgraph")) plot(d)                     # networks and path diagrams: base graphics
  else if (inherits(d, "recordedplot")) grDevices::replayPlot(d)
  else print(d)
}

# jaspTools turns the data into the types an analysis asks for. A group column (factor) asked for as a scale must
# give its labels' numbers (JASP's ordinal 1-10 ratings), not R's group codes; everything else as jaspTools does.
local({
  original <- get("convertToTypes", envir = asNamespace("jaspTools"))
  fixed <- function(dataset, types, datasetPathOrObject) {
    for (i in seq_along(dataset))
      if (identical(types[i], "scale") && is.factor(dataset[[i]]))
        dataset[[i]] <- suppressWarnings(as.numeric(as.character(dataset[[i]])))
    original(dataset, types, datasetPathOrObject)
  }
  utils::assignInNamespace("convertToTypes", fixed, ns = "jaspTools")
})
