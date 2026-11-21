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
runJasp <- function(o, ds) {
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
