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
  enc <- tryCatch(suppressWarnings(encodeOptionsAndDataset(o, ds)), error = function(e) NULL)
  if (is.null(enc) || nrow(enc$encodingMap) == 0) { setDecoders(NULL); return(runAnalysis(name, ds, o, view = FALSE, quiet = TRUE)) }
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
drawJasp <- function(p) { d <- jaspBase:::decodeplot(p); if (inherits(d, "grob")) grid::grid.draw(d) else print(d) }
