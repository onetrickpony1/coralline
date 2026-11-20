apaScaleK <- 5 / (530 / 72)   # how much figures.R shrinks every plot (a 530 px JASP plot becomes 5 in)
apaVariables <- character()   # the data's column names, set by figures.R: title case leaves them as they are
# APA 7 touches on a finished JASP plot (ggplot or jaspGraphsPlot), applied after the rerun.
apaFamily <- "Liberation Sans"
minorWords <- c("a","an","and","as","at","but","by","for","if","in","nor","of","off","on","or","per","so","the","to","up","via","vs.","vs","yet")
apaTitleCase <- function(s) {
  if (!is.character(s) || length(s) != 1 || !nzchar(trimws(s))) return(s)
  # spaces at the ends stay (in plotmath they separate the parts: paste("Mean of the ", italic(x)))
  lead <- sub("^(\\s*).*$", "\\1", s); trail <- sub("^.*?(\\s*)$", "\\1", s, perl = TRUE)
  s <- trimws(s)
  w <- strsplit(s, " ", fixed = TRUE)[[1]]
  # words that belong to one of the data's variable names (also names with spaces, "income level") stay as written
  keep <- logical(length(w))
  for (v in apaVariables[nzchar(apaVariables)]) {
    vw <- strsplit(v, " ", fixed = TRUE)[[1]]; n <- length(vw)
    if (n <= length(w)) for (k in seq_len(length(w) - n + 1))
      if (identical(gsub("[^[:alnum:] $()%-]", "", w[k:(k + n - 1)]), vw) || identical(w[k:(k + n - 1)], vw)) keep[k:(k + n - 1)] <- TRUE
  }
  cap <- function(x) paste0(toupper(substr(x, 1, 1)), substr(x, 2, nchar(x)))
  for (i in seq_along(w)) {
    x <- w[i]
    if (keep[i]) next
    if (grepl("[A-Z].*[A-Z]|[0-9_]", x) || grepl("^[a-z]+[A-Z]", x)) next   # acronyms, codes, camelCase names stay
    afterColon <- i > 1 && grepl(":$", w[i - 1])
    if (tolower(x) == "a" && (i == 1 || afterColon)) { w[i] <- "A"; next }   # the article, not a symbol
    if (nchar(gsub("[^A-Za-z]", "", x)) <= 1) next                          # symbols: n and N, z, x mean different things
    if (i > 1 && !afterColon && tolower(x) %in% minorWords) { w[i] <- tolower(x); next }
    # each part of a hyphenated word ("Self-Esteem"), minor words inside it too only when they are long (APA: 4+ letters)
    parts <- strsplit(x, "-", fixed = TRUE)[[1]]
    w[i] <- paste(vapply(seq_along(parts), function(k) if (k > 1 && tolower(parts[k]) %in% minorWords) parts[k] else cap(parts[k]), ""),
      collapse = "-")
  }
  paste0(lead, paste(w, collapse = " "), trail)
}
trueMinus <- function(l) { if (is.numeric(l)) l <- as.character(l); if (is.character(l)) gsub("(^|[^A-Za-z])-(?=[0-9.])", "\\1\u2212", l, perl = TRUE) else l }
apaScales <- function(p) {
  sc <- p$scales$scales
  for (i in seq_along(sc)) {
    s <- sc[[i]]
    if (!inherits(s, "ScaleContinuous")) next
    sc[[i]] <- local({   # local(): each label function keeps its own scale (loop closures share variables)
      orig <- s; s <- s$clone(); lab <- s$labels; tr <- s$get_transformation()
      # ask the untouched original for its labels: methods on the clone would call this wrapper again
      if (is.character(lab) || is.numeric(lab)) s$labels <- trueMinus(lab)
      # ggplot hands label functions breaks in data space, get_labels wants them transformed (log, reverse axes)
      else if (!is.null(lab)) s$labels <- function(b) trueMinus(orig$get_labels(tr$transform(b)))
      s
    })
  }
  p$scales$scales <- sc
  p
}
apaGgplot <- function(p, changes) {
  p <- apaText(apaScales(p))
  p <- p + ggplot2::theme(text = ggplot2::element_text(family = apaFamily))   # also plots built on other themes (theme_bw)
  # axis titles a step above the tick labels (11 and 10 pt): JASP's theme takes the step as an argument that
  # defaults to 1, so its titles come out at tick size
  th <- tryCatch(ggplot2:::plot_theme(p), error = function(e) NULL)
  if (!is.null(th)) for (a in c("x", "y")) {
    tick <- tryCatch(ggplot2::calc_element(paste0("axis.text.", a), th)$size, error = function(e) NULL)
    title <- tryCatch(ggplot2::calc_element(paste0("axis.title.", a), th)$size, error = function(e) NULL)
    if (is.numeric(tick) && is.numeric(title) && abs(title - tick) < 1e-6)
      p <- p + do.call(ggplot2::theme, setNames(list(ggplot2::element_text(size = tick * 1.1)), paste0("axis.title.", a)))
  }
  # text set by the theme (tick labels, legends, panel strips, tables built as plots) at 8 pt or more once printed
  if (!is.null(th)) for (e in c("axis.text.x", "axis.text.y", "legend.text", "legend.title", "strip.text.x", "strip.text.y", "plot.title")) {
    size <- tryCatch(ggplot2::calc_element(e, th)$size, error = function(e) NULL)
    if (is.numeric(size) && length(size) == 1 && size * apaScaleK < 8)
      p <- p + do.call(ggplot2::theme, setNames(list(ggplot2::element_text(size = 8 / apaScaleK)), e))
  }
  # long y axis titles wrap onto two lines instead of running off the picture; a little room on the right for
  # the last tick label
  ytitle <- p$labels$y
  if (is.character(ytitle) && length(ytitle) == 1 && nchar(ytitle) > 40 && !grepl("\n", ytitle))
    p$labels$y <- paste(strwrap(ytitle, width = max(25, ceiling(nchar(ytitle) / 2) + 3)), collapse = "\n")
  margin <- tryCatch(ggplot2::calc_element("plot.margin", th), error = function(e) NULL)
  if (!is.null(margin)) p <- p + ggplot2::theme(plot.margin = margin + grid::unit(c(0, 6, 0, 0), "pt"))
  # text drawn in the plot at 8 pt or more once printed (ggplot sizes text layers in mm; 1 mm = 2.845 pt)
  minSize <- 8 / (2.845 * apaScaleK)
  for (i in seq_along(p$layers)) if (grepl("Text|Label", class(p$layers[[i]]$geom)[1])) {
    size <- p$layers[[i]]$aes_params$size
    if (is.null(size) && is.null(p$layers[[i]]$mapping$size)) size <- p$layers[[i]]$geom$default_aes$size
    if (is.numeric(size) && length(size) == 1 && size < minSize) p$layers[[i]]$aes_params$size <- minSize
  }
  for (i in seq_along(p$layers)) {           # text drawn in the plot gets the same font as the axes
    if (inherits(p$layers[[i]]$geom, c("GeomText", "GeomLabel")) || grepl("Text", class(p$layers[[i]]$geom)[1])) {
      # set in place: the plot comes from our own rerun, and a ggproto child copy of a layer loops in ggplot2 4
      p$layers[[i]]$aes_params$family <- apaFamily
    }
  }
  show <- function(v) if (is.character(v)) v else paste(deparse(v), collapse = " ")
  for (a in c("x", "y", "colour", "fill", "shape", "linetype")) {
    what <- if (a %in% c("x", "y")) "axis title" else "legend title"
    old <- p$labels[[a]]
    if (!is.null(old) && !inherits(old, "waiver")) {
      new <- tryCatch(apaTitleCaseAny(old), error = function(e) old)
      if (!identical(old, new)) { p$labels[[a]] <- new; changes$add(sprintf("%s '%s' -> '%s'", what, show(old), show(new))) }
    }
    sc <- p$scales$get_scales(a)   # titles set on the scale (cloned in apaScales, so safe to change)
    if (!is.null(sc) && !is.null(sc$name) && !inherits(sc$name, "waiver") && (is.language(sc$name) || is.expression(sc$name) || (is.character(sc$name) && length(sc$name) == 1))) {
      new <- tryCatch(apaTitleCaseAny(sc$name), error = function(e) sc$name)
      if (!identical(sc$name, new)) { changes$add(sprintf("%s '%s' -> '%s'", what, show(sc$name), show(new))); sc$name <- new }
    }
  }
  p
}
dataPanels <- function(p) sum(vapply(p$subplots, function(s) inherits(s, "ggplot") &&
  any(!grepl("Text|Label|Blank|RangeFrame", vapply(s$layers, function(l) class(l$geom)[1], ""))), logical(1)))
# Plots of a correlation (rho) or a proportion (theta): every number in their text is bounded by 1, so it loses
# its leading zero ("Median: .653", "95% CI: [.072, .243]"). Bayes factor labels keep theirs: BFs exceed 1.
boundedText <- function(g, bounded) {
  if (!bounded) return(g)
  drop <- function(v) { plain <- !grepl("BF", v); v[plain] <- gsub("(^|[^0-9.])(-|\u2212)?0\\.([0-9])", "\\1\\2.\\3", v[plain]); v }
  for (i in seq_along(g$layers)) {
    l <- g$layers[[i]]
    if (!grepl("Text|Label", class(l$geom)[1])) next
    if (is.data.frame(l$data))
      for (col in names(l$data)) if (is.character(l$data[[col]])) l$data[[col]] <- drop(l$data[[col]])
    if (inherits(l$data, "waiver") && is.data.frame(g$data))   # headers drawn from the plot's own data
      for (col in names(g$data)) if (is.character(g$data[[col]])) g$data[[col]] <- drop(g$data[[col]])
  }
  g
}
isBoundedPlot <- function(p) {
  subs <- if (inherits(p, "jaspGraphsPlot")) p$subplots else list(p)
  titles <- unlist(lapply(subs, function(g) if (inherits(g, "ggplot")) {
    sc <- tryCatch(g$scales$get_scales("x")$name, error = function(e) NULL)
    # axis titles are often plotmath ("Population~correlation~rho"), so expressions count too
    words <- function(v) if (is.null(v) || inherits(v, "waiver")) NULL else if (is.character(v)) v else paste(deparse(v), collapse = " ")
    c(words(sc), words(g$labels$x))
  }))
  any(grepl("rho|\u03c1|correlation|proportion|theta|\u03b8", titles, ignore.case = TRUE))
}
apaPlot <- function(p) {
  changes <- local({ v <- character(); list(add = function(x) v <<- c(v, x), get = function() v) })
  bounded <- isBoundedPlot(p)
  if (inherits(p, "ggplot")) p <- boundedText(apaGgplot(p, changes), bounded)
  else if (inherits(p, "jaspGraphsPlot")) for (i in seq_along(p$subplots)) if (inherits(p$subplots[[i]], "ggplot")) {
    q <- boundedText(apaGgplot(p$subplots[[i]], changes), bounded)
    p$subplots[[i]] <- if (dataPanels(p) >= 4) thinBreaks(q) else q   # matrix layouts: little room per panel
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
# Title case for plotmath titles ("Population" ~ "proportion" ~ theta, or bare words joined by ~): the words
# change, Greek letters, functions and symbols stay. Text and expressions in, the same kind out.
plotmathNames <- c("alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota", "kappa", "lambda", "mu",
  "nu", "xi", "omicron", "pi", "rho", "sigma", "tau", "upsilon", "phi", "chi", "psi", "omega", "italic", "bold", "plain",
  "bolditalic", "hat", "bar", "tilde", "widehat", "widetilde", "paste", "list", "group", "bgroup", "sqrt", "frac", "atop")
apaTitleCaseAny <- function(x) {
  if (is.character(x)) return(apaTitleCase(x))
  if (!is.language(x) && !is.expression(x)) return(x)
  first <- TRUE
  walk <- function(e) {
    if (is.character(e)) {
      if (!any(grepl("[A-Za-z]", e))) return(e)
      # a string after other parts is not the title's first word: title-case it behind a stand-in word
      out <- if (first) apaTitleCase(e) else sub("^x ", "", apaTitleCase(paste("x", e)))
      first <<- FALSE
      return(out)
    }
    if (is.symbol(e)) {
      nm <- as.character(e)
      if (!grepl("^[A-Za-z]{2,}$", nm) || tolower(nm) %in% plotmathNames || nm %in% apaVariables) { if (nzchar(nm)) first <<- FALSE; return(e) }
      out <- if (!first && tolower(nm) %in% minorWords) tolower(nm) else paste0(toupper(substr(nm, 1, 1)), substr(nm, 2, nchar(nm)))
      first <<- FALSE
      return(as.symbol(out))
    }
    if (is.call(e)) {
      f <- as.character(e[[1]])[1]
      # the arguments of a call; the function name itself stays (italic, hat, ...)
      if (length(e) > 1) for (k in 2:length(e)) if (!is.null(e[[k]])) e[[k]] <- walk(e[[k]])
      return(e)
    }
    e
  }
  if (is.expression(x)) as.expression(lapply(x, walk)) else walk(x)
}
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
    tr <- tryCatch(sc$get_transformation()$name, error = function(e) "identity")
    if (!identical(tr, "identity") || !(inherits(sc$labels, "waiver") || is.function(sc$labels) || is.character(sc$labels) || is.numeric(sc$labels))) next
    # keep JASP's own ticks: both ends (the axis line runs between them) and evenly spaced ones in between
    b <- sc$breaks; n <- length(b)
    # the smallest even step that lands on the last tick and leaves 5 ticks or fewer (11 ticks: every 5th)
    # and never fewer than 3 (an axis with only its two ends can't be read): no such step, no thinning
    # long labels ("2000") get 3 ticks at most, short ones 5
    most <- if (max(nchar(format(abs(b), trim = TRUE, scientific = FALSE, drop0trailing = TRUE))) >= 4) 3 else 5
    steps <- Filter(function(st) (n - 1) %% st == 0 && (n - 1) / st + 1 <= most && (n - 1) / st + 1 >= 3, seq_len(n - 1))
    lab <- sc$labels
    if (length(steps) > 0) {
      keep <- seq(1, n, by = steps[1])
      sc$breaks <- b[keep]
      if ((is.character(lab) || is.numeric(lab)) && length(lab) == n) sc$labels <- trueMinus(lab[keep])
      else if (!inherits(lab, "waiver")) sc$labels <- function(x) trueMinus(format(x, trim = TRUE, drop0trailing = TRUE, scientific = FALSE))
    } else {
      # no even step lands on the last tick (0 to 2500 by 500): every other tick, and the axis runs on one step
      # past the data so it still ends on a tick (0, 1000, 2000, 3000)
      d <- diff(b)
      if (!is.numeric(b) || any(abs(d - d[1]) > 1e-9 * max(1, abs(d[1])))) next
      st <- Filter(function(k) ceiling((n - 1) / k) + 1 >= 3 && ceiling((n - 1) / k) + 1 <= most, 2:(n - 1))
      if (length(st) == 0 || !(is.character(lab) || is.numeric(lab) || inherits(lab, "waiver") || is.function(lab))) next
      m <- ceiling((n - 1) / st[1])
      sc$breaks <- b[1] + (0:m) * st[1] * d[1]
      lim <- if (is.numeric(sc$limits)) sc$limits else range(b)
      sc$limits <- range(c(lim, sc$breaks))
      sc$labels <- function(x) trueMinus(format(x, trim = TRUE, drop0trailing = TRUE, scientific = FALSE))
    }
  }
  p
}
# plotmath ("italic(r) ~ \"=\" ~ \"-0.3\""): true minus only inside the quoted parts, so the label still parses
quotedMinus <- function(v) vapply(v, function(x) {
  parts <- strsplit(x, '"', fixed = TRUE)[[1]]
  inside <- seq_along(parts) %% 2 == 0
  parts[inside] <- trueMinus(parts[inside])
  paste0(paste(parts, collapse = '"'), if (endsWith(x, '"')) '"' else "")
}, "", USE.NAMES = FALSE)
apaText <- function(p) {
  if (is.data.frame(p$data)) for (col in names(p$data)) if (is.character(p$data[[col]])) p$data[[col]] <- noLeadingZero(p$data[[col]])
  for (i in seq_along(p$layers)) {
    l <- p$layers[[i]]
    if (!grepl("Text|Label", class(l$geom)[1])) next
    fix <- function(v) {
      v <- noLeadingZero(v)
      if (!is.character(v)) return(v)
      if (isTRUE(l$geom_params$parse)) quotedMinus(v)
      else trueMinus(v)
    }
    if (is.character(l$aes_params$label)) l$aes_params$label <- fix(l$aes_params$label)
    # a text layer without data of its own draws the plot's data (JASP's prior/posterior headers do)
    if (inherits(l$data, "waiver") && is.data.frame(p$data))
      for (col in names(p$data)) if (is.character(p$data[[col]])) p$data[[col]] <- fix(p$data[[col]])
    if (is.data.frame(l$data)) for (col in names(l$data)) if (is.character(l$data[[col]])) l$data[[col]] <- fix(l$data[[col]])
    # a label mapped to a variable in JASP's own code (aes(label = lab)): evaluate it once and keep the fixed text
    if (!is.null(l$mapping$label) && is.data.frame(l$data) && nrow(l$data) > 0) {
      val <- tryCatch(rlang::eval_tidy(l$mapping$label, l$data), error = function(e) NULL)
      if (is.character(val) && (length(val) == 1 || length(val) == nrow(l$data))) {
        l$data$.apaLabel <- fix(val)
        l$mapping$label <- ggplot2::aes(label = .apaLabel)$label
      }
    }
  }
  p
}
