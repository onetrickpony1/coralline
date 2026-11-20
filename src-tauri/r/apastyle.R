# APA 7 touches on a finished JASP plot (ggplot or jaspGraphsPlot), applied after the rerun.
apaFamily <- "Liberation Sans"
minorWords <- c("a","an","and","as","at","but","by","for","if","in","nor","of","off","on","or","per","so","the","to","up","via","vs.","vs","yet")
apaTitleCase <- function(s) {
  if (!is.character(s) || length(s) != 1 || !nzchar(s)) return(s)
  w <- strsplit(s, " ", fixed = TRUE)[[1]]
  for (i in seq_along(w)) {
    x <- w[i]
    if (grepl("[A-Z].*[A-Z]|[0-9_]", x) || grepl("^[a-z]+[A-Z]", x)) next   # acronyms, codes, camelCase names stay
    if (i > 1 && tolower(x) %in% minorWords) { w[i] <- tolower(x); next }
    w[i] <- paste0(toupper(substr(x, 1, 1)), substr(x, 2, nchar(x)))
  }
  paste(w, collapse = " ")
}
trueMinus <- function(l) { if (is.numeric(l)) l <- as.character(l); if (is.character(l)) gsub("(^|[^A-Za-z])-(?=[0-9.])", "\\1\u2212", l, perl = TRUE) else l }
apaScales <- function(p) {
  sc <- p$scales$scales
  for (i in seq_along(sc)) {
    s <- sc[[i]]
    if (!inherits(s, "ScaleContinuous")) next
    sc[[i]] <- local({   # local(): each label function keeps its own scale (loop closures share variables)
      orig <- s; s <- s$clone(); lab <- s$labels
      # ask the untouched original for its labels: methods on the clone would call this wrapper again
      if (is.character(lab) || is.numeric(lab)) s$labels <- trueMinus(lab)
      else if (!is.null(lab)) s$labels <- function(b) trueMinus(orig$get_labels(b))
      s
    })
  }
  p$scales$scales <- sc
  p
}
apaGgplot <- function(p, changes) {
  p <- apaText(apaScales(p))
  for (i in seq_along(p$layers)) {           # text drawn in the plot gets the same font as the axes
    if (inherits(p$layers[[i]]$geom, c("GeomText", "GeomLabel")) || grepl("Text", class(p$layers[[i]]$geom)[1])) {
      # set in place: the plot comes from our own rerun, and a ggproto child copy of a layer loops in ggplot2 4
      p$layers[[i]]$aes_params$family <- apaFamily
    }
  }
  for (a in c("x", "y")) {
    old <- p$labels[[a]]; new <- apaTitleCase(old)
    if (is.character(old) && !identical(old, new)) { p$labels[[a]] <- new; changes$add(sprintf("axis title '%s' -> '%s'", old, new)) }
    sc <- p$scales$get_scales(a)   # titles set on the scale (cloned in apaScales, so safe to change)
    if (!is.null(sc) && is.character(sc$name) && length(sc$name) == 1) {
      new <- apaTitleCase(sc$name)
      if (!identical(sc$name, new)) { changes$add(sprintf("axis title '%s' -> '%s'", sc$name, new)); sc$name <- new }
    }
  }
  p
}
apaPlot <- function(p) {
  changes <- local({ v <- character(); list(add = function(x) v <<- c(v, x), get = function() v) })
  if (inherits(p, "ggplot")) p <- apaGgplot(p, changes)
  else if (inherits(p, "jaspGraphsPlot")) for (i in seq_along(p$subplots)) if (inherits(p$subplots[[i]], "ggplot")) {
    q <- apaGgplot(p$subplots[[i]], changes)
    p$subplots[[i]] <- if (length(p$subplots) >= 4) thinBreaks(q) else q   # matrix layouts: little room per panel
  }
  attr(p, "apaChanges") <- changes$get()
  p
}

# What a plot actually draws, for the figure note: error bars, bands, text in the plot, titles, legends, panels.
plotFacts <- function(p) {
  one <- function(g) {
    geoms <- vapply(g$layers, function(l) class(l$geom)[1], "")
    built <- tryCatch(ggplot2::ggplot_build(g)$data, error = function(e) list())   # labels as ggplot will draw them
    txt <- unlist(lapply(seq_along(g$layers), function(j) {
      if (!grepl("Text|Label", class(g$layers[[j]]$geom)[1]) || j > length(built)) return(NULL)
      v <- built[[j]]$label
      if (is.null(v)) NULL else vapply(v, function(x) paste(deparse(x), collapse = ""), "")
    }))
    lab <- function(x) {   # a title set on the scale wins over the plot's labels, as ggplot draws it
      sc <- tryCatch(g$scales$get_scales(x), error = function(e) NULL)
      v <- if (!is.null(sc) && !inherits(sc$name, "waiver") && !is.null(sc$name)) sc$name else g$labels[[x]]
      if (is.character(v)) v[1] else if (is.null(v)) NA_character_ else paste(deparse(v), collapse = "")
    }
    list(geoms = unique(geoms), x = lab("x"), y = lab("y"), colour = lab("colour"), fill = lab("fill"), shape = lab("shape"),
         linetype = lab("linetype"), text = unique(txt))
  }
  if (inherits(p, "ggplot")) return(list(panels = 1L, plots = list(one(p))))
  if (inherits(p, "jaspGraphsPlot")) {
    subs <- Filter(function(s) inherits(s, "ggplot"), p$subplots)
    return(list(panels = length(subs), plots = lapply(subs, one)))
  }
  list(panels = NA, plots = list(), class = class(p)[1])
}

# Text in the plot such as "r = 0.578" or italic(r) == 0.578: APA drops the leading zero for values that can't
# exceed 1 (correlations, p, R squared). Only labels that name such a statistic are changed.
noLeadingZero <- function(l) {
  if (!is.character(l)) return(l)
  # "r = 0.578", "p < 0.001", and plotmath like italic(r) ~ "=" ~ "0.578"
  bounded <- grepl("^\\s*(italic\\()?(r|rho|tau|p|R\\^2|R\\^\\{2\\}|R²|ρ|τ)\\)?\\s*(~\\s*\"?)?\\s*(=|==|<|>)", l)
  l[bounded] <- gsub("(^|[^0-9.])(-|\u2212)?0\\.([0-9])", "\\1\\2.\\3", l[bounded])
  l
}
# Crowded multi-panel axes: keep every other tick number (first and last stay, so the axis spans the same range)
thinBreaks <- function(p) {
  for (a in c("x", "y")) {
    sc <- p$scales$get_scales(a)
    if (is.null(sc) || !inherits(sc, "ScaleContinuous") || !is.numeric(sc$breaks) || length(sc$breaks) <= 5) next
    # only plain linear axes: log axes (Bayes factors) and fixed labels that aren't numbers keep JASP's ticks
    tr <- tryCatch(sc$get_transformation()$name, error = function(e) "identity")
    if (!identical(tr, "identity") || !(inherits(sc$labels, "waiver") || is.function(sc$labels) || is.character(sc$labels) || is.numeric(sc$labels))) next
    b <- sc$breaks
    nb <- scales::breaks_extended(n = 3)(range(b)); nb <- nb[nb >= min(b) & nb <= max(b)]
    if (length(nb) < 2) next
    if (is.null(sc$limits)) sc$limits <- range(b)   # the axis keeps its length
    sc$breaks <- nb
    # labels written from the new ticks (the old ones, or a wrapper asking the original scale, would not match)
    sc$labels <- function(b) trueMinus(format(b, trim = TRUE, drop0trailing = TRUE, scientific = FALSE))
  }
  p
}
apaText <- function(p) {
  if (is.data.frame(p$data)) for (col in names(p$data)) if (is.character(p$data[[col]])) p$data[[col]] <- noLeadingZero(p$data[[col]])
  for (i in seq_along(p$layers)) {
    l <- p$layers[[i]]
    if (!grepl("Text|Label", class(l$geom)[1])) next
    if (is.character(l$aes_params$label)) l$aes_params$label <- noLeadingZero(l$aes_params$label)
    if (is.data.frame(l$data)) for (col in names(l$data)) if (is.character(l$data[[col]])) l$data[[col]] <- noLeadingZero(l$data[[col]])
    # a label mapped to a variable in JASP's own code (aes(label = lab)): evaluate it once and keep the fixed text
    if (!is.null(l$mapping$label) && is.data.frame(l$data) && nrow(l$data) > 0) {
      val <- tryCatch(rlang::eval_tidy(l$mapping$label, l$data), error = function(e) NULL)
      if (is.character(val) && (length(val) == 1 || length(val) == nrow(l$data))) {
        l$data$.apaLabel <- noLeadingZero(val)
        l$mapping$label <- ggplot2::aes(label = .apaLabel)$label
      }
    }
  }
  p
}
