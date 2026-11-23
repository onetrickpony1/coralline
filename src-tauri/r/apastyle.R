apaScaleK <- 5 / (530 / 72)   # how much figures.R shrinks every plot (a 530 px JASP plot becomes 5 in)
apaVariables <- character()   # the data's column names, set by figures.R: title case leaves them as they are
# APA 7 touches on a finished JASP plot (ggplot or jaspGraphsPlot), applied after the rerun.
apaFamily <- "Liberation Sans"
minorWords <- c("a","an","and","as","at","but","by","for","if","in","nor","of","off","on","or","per","so","the","to","up","via","vs.","vs","yet")
apaTitleCase <- function(s) {
  if (!is.character(s) || length(s) != 1 || !nzchar(trimws(s))) return(s)
  # spaces at the ends stay (in plotmath they separate the parts: paste("Mean of the ", italic(x)))
  # (regmatches, not sub: "." skips line breaks, so sub("^.*?(\\s*)$", ...) gave a wrapped title back whole, doubled)
  lead <- regmatches(s, regexpr("^\\s*", s)); trail <- regmatches(s, regexpr("\\s*$", s))
  s <- trimws(s)
  # words and what separates them: a space, or the line break of a wrapped title (each line's words count)
  seps <- regmatches(s, gregexpr("[ \n]+", s))[[1]]
  w <- strsplit(s, "[ \n]+")[[1]]
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
  paste0(lead, paste0(w, c(seps, ""), collapse = ""), trail)
}
trueMinus <- function(l) { if (is.numeric(l)) l <- as.character(l); if (is.character(l)) gsub("(^|[^A-Za-z])-(?=[0-9.])", "\\1\u2212", l, perl = TRUE) else l }
# APA 6.36: no zero before the decimal point of a number that can't exceed 1 (".25", "\u2212.50"); only plain numbers
dropZero <- function(l) if (is.character(l)) sub("^(\u2212|-)?0\\.([0-9])", "\\1.\\2", l) else l
# Numbers on one axis written with the same decimals, so zero reads ".00" beside ".05", not "0" (APA 6.36 then drops
# the zeros before the point). Labels that aren't all plain numbers stay as they are.
sameDecimals <- function(l) {
  if (!is.character(l)) return(l)
  t <- sub("^\u2212", "-", trimws(l))
  ok <- !is.na(l) & nzchar(t)
  if (!any(ok) || !all(grepl("^-?[0-9]*\\.?[0-9]+$", t[ok]))) return(l)
  d <- max(nchar(sub("^[^.]*\\.?", "", t[ok])))
  l[ok] <- trueMinus(formatC(as.numeric(t[ok]), format = "f", digits = d))
  l
}
# Quantities that can't exceed 1, named in an axis or legend title, or in a plot's x axis title for the text drawn in
# it (isBoundedPlot): one list for both. Words that can also name unbounded values stay out: theta (IRT abilities),
# "cumulative" (cumulative hazards and counts), tau alone (a meta-analysis's heterogeneity). Statistical power stays.
# (perl: "Log(Power)" is no power, a log can exceed 1)
boundedTitle <- paste0("probabilit|proportion|correlation|\\bcor\\b|\\brho\\b|\u03c1|kendall|cronbach|(?<!log\\()\\bpower\\b|p-value|\\bp value|",
  "(?<!decrease in )\\baccuracy\\b|guttman|\u03bb[2-6\u2082-\u2086]|\\blambda\\W*[2-6]|\\bomega\\b|\u03c9|split-half|\\bacf\\b|",
  "\\bcdf\\b|\\bP-P\\b|\\bR\\^2|R\u00b2|R-squared|(positive|negative|error|hit|false alarm|success|failure|acceptance|rejection|",
  "misclassification|classification) rate|sensitivity|specificity|\\bauc\\b|outgoing quality|misstatement|relative frequenc|true positive|false positive")
titleText <- function(v) if (is.null(v) || inherits(v, "waiver") || is.function(v)) "" else if (is.character(v)) paste(v, collapse = " ") else
  paste(deparse(if (is.expression(v) && length(v) == 1) v[[1]] else v), collapse = " ")
# A scale (axis or legend) shows a quantity that can't exceed 1: its values all lie within [-1, 1], and either its title
# names such a quantity or (y) it shows an empirical CDF. The values come from the built plot: the title alone is not
# enough ("Probability" over a density axis that runs to 2.5 keeps its zeros).
boundedScale <- function(built, a, title, ecdf = FALSE) {
  if (is.null(built)) return(FALSE)
  # trained scales: an axis's per panel in the layout, a legend's in the plot
  scales <- if (a %in% c("x", "y")) built$layout[[paste0("panel_scales_", a)]] else list(tryCatch(built$plot$scales$get_scales(a), error = function(e) NULL))
  v <- numeric()
  for (bs in scales) {
    if (is.null(bs) || !inherits(bs, "ScaleContinuous")) return(FALSE)
    tr <- tryCatch(bs$get_transformation()$name, error = function(e) "identity")
    if (!identical(tr, "identity")) return(FALSE)
    lim <- tryCatch(bs$get_limits(), error = function(e) NULL)
    br <- tryCatch(bs$get_breaks(), error = function(e) NULL)
    v <- c(v, if (is.numeric(lim)) lim, if (is.numeric(br)) br)
  }
  v <- v[is.finite(v)]
  # (breaks within [-1, 1]; the limits may run a little past them for room, as an ROC curve's y axis to 1.1 does)
  brs <- unlist(lapply(scales, function(bs) { b <- tryCatch(bs$get_breaks(), error = function(e) NULL); if (is.numeric(b)) b }))
  brs <- as.numeric(brs[is.finite(brs)])
  if (!length(v) || any(abs(brs) > 1 + 1e-9) || any(abs(v) > 1.15 + 1e-9)) return(FALSE)
  if (ecdf || grepl(boundedTitle, titleText(title), ignore.case = TRUE, perl = TRUE)) return(TRUE)
  # a P-P plot's axes ("Theoretical", "Sample") are cumulative probabilities, with ticks from 0 to 1
  grepl("^\\s*(theoretical|sample)( cumulative)?( probabilit(y|ies))?\\s*$", titleText(title), ignore.case = TRUE) &&
    length(brs) >= 3 && isTRUE(all.equal(range(brs), c(0, 1)))
}
# The title a scale shows: its own name, else the plot's label for the aesthetic
scaleTitle <- function(p, s, a) if (!is.null(s$name) && !inherits(s$name, "waiver")) s$name else p$labels[[a]]
apaScales <- function(p) {
  built <- tryCatch(suppressMessages(suppressWarnings(ggplot2::ggplot_build(p))), error = function(e) NULL)
  # every axis gets a scale of its own, so the labels below get true minus signs: ggplot adds default scales only
  # when it builds the plot, after these changes (date and discrete axes stay as they are)
  if (!is.null(built)) for (a in c("x", "y")) if (is.null(p$scales$get_scales(a))) {
    bs <- tryCatch(built$layout[[paste0("panel_scales_", a)]][[1]], error = function(e) NULL)
    if (inherits(bs, "ScaleContinuousPosition") && !inherits(bs, c("ScaleContinuousDate", "ScaleContinuousDatetime")) &&
        identical(tryCatch(bs$get_transformation()$name, error = function(e) "identity"), "identity"))
      # the scale ggplot itself would add: it looks the function up where the plot was made, and JASP's plots find
      # jaspGraphs' own scale_x_continuous there (its breaks cover the data, and the axis runs to its end ticks)
      p <- p + tryCatch(ggplot2:::find_scale(a, 1, p$plot_env), error = function(e) NULL) %||%
        (if (a == "x") ggplot2::scale_x_continuous() else ggplot2::scale_y_continuous())
  }
  ecdf <- any(vapply(p$layers, function(l) inherits(l$stat, "StatEcdf"), FALSE))
  sc <- p$scales$scales
  for (i in seq_along(sc)) {
    s <- sc[[i]]
    if (!inherits(s, "ScaleContinuous")) next
    a <- s$aesthetics[1]
    bounded <- boundedScale(built, a, scaleTitle(p, s, a), ecdf = ecdf && a == "y")
    sc[[i]] <- local({   # local(): each label function keeps its own scale (loop closures share variables)
      orig <- s; s <- s$clone(); lab <- s$labels; tr <- s$get_transformation(); fix <- if (bounded) function(l) dropZero(sameDecimals(trueMinus(l))) else trueMinus
      s$apaBounded <- bounded   # read by fillBreaks and thinBreaks, which set labels of their own
      # a second axis (ESCI's difference axis) gets true minus signs too
      # (no leading zeros when it names a quantity that can't exceed 1 and its values stay within [-1, 1]: LearnBayes'
      # "Probability" beside a density)
      sa <- s$secondary.axis
      if (inherits(sa, "AxisSecondary")) {
        sa <- copyLayer(sa); s$secondary.axis <- sa   # (a copy: the original scale keeps its own)
        sl <- sa$labels
        secBound <- grepl(boundedTitle, titleText(sa$name), ignore.case = TRUE, perl = TRUE)
        sfix <- function(l, x) { l <- trueMinus(l); if (secBound && is.numeric(x) && all(abs(x[is.finite(x)]) <= 1 + 1e-9)) dropZero(l) else l }
        # (numbers formatted together, so zero reads ".0" like the other axis's ticks, not "0")
        if (is.numeric(sl)) sa$labels <- sfix(format(sl, trim = TRUE, scientific = FALSE), sl)
        else if (is.character(sl)) sa$labels <- sfix(sl, suppressWarnings(as.numeric(sl)))
        else if (is.function(sl)) sa$labels <- function(x) sfix(sl(x), x)
        else if (inherits(sl, "waiver")) sa$labels <- function(x) sfix(format(x, trim = TRUE, scientific = FALSE), x)
      }
      # ask the untouched original for its labels: methods on the clone would call this wrapper again
      if (is.character(lab) || is.numeric(lab)) s$labels <- fix(lab)
      # ggplot hands label functions breaks in data space, get_labels wants them transformed (log, reverse axes)
      else if (!is.null(lab)) s$labels <- function(b) fix(orig$get_labels(tr$transform(b)))
      s
    })
  }
  p$scales <- ownScales(p$scales)
  p$scales$scales <- sc
  p
}
# A theme element set without breaking the plot: ggplot2 4 can't merge a plain element into one of another class
# (ggtext's element_markdown in ESCI's plots, other packages' own elements), so such an element gets the new
# fields in place, or stays as it is
setElement <- function(p, e, el) {
  out <- tryCatch(p + do.call(ggplot2::theme, setNames(list(el), e)), error = function(x) NULL)
  if (!is.null(out)) return(out)
  tryCatch({
    own <- p$theme[[e]]
    if (is.list(own) && !inherits(own, "S7_object") && inherits(el, "element_text")) {
      for (f in c("family", "size", "angle", "hjust", "vjust", "margin")) { v <- tryCatch(el[[f]], error = function(x) NULL); if (!is.null(v)) own[[f]] <- v }
      p$theme[[e]] <- own
    }
    p
  }, error = function(x) p)
}
# Printed width in inches of each label at `pt` points (plotmath shown as the text it draws)
textWidthIn <- function(v, pt, family = apaFamily) {
  if (is.expression(v) || is.list(v)) v <- vapply(v, function(x) paste(deparse(x), collapse = ""), "")
  if (!length(v)) return(numeric())
  v <- as.character(v); v[is.na(v)] <- ""
  shown <- gsub('italic\\(|bold\\(|paste\\(|\\)$|"|~|\\*', "", v)
  shown <- gsub("\\b(alpha|beta|gamma|delta|theta|rho|tau|mu|sigma|lambda|omega|phi|chi|eta)\\b", "x", shown)
  lines <- strsplit(shown, "\n", fixed = TRUE)
  w <- tryCatch(systemfonts::string_width(unlist(lines), family = family, size = pt, res = 72) / 72,
    error = function(e) nchar(unlist(lines)) * pt * 0.55 / 72)
  ends <- cumsum(lengths(lines))
  vapply(seq_along(lines), function(i) if (!length(lines[[i]])) 0 else max(w[(ends[i] - length(lines[[i]]) + 1):ends[i]]), 0)
}
# The font for a plot's text: Liberation Sans, unless the text has characters it can't draw (Chinese level labels
# drew as boxes); then a font the system has for them, or the system's own sans-serif font. `missing`: those characters
# (`fallback` and `fonts` are systemfonts' own: a test passes stand-ins for a machine with a CJK font installed)
plotGlyphs <- function(p, fallback = systemfonts::font_fallback, fonts = systemfonts::system_fonts) {
  strs <- character()
  add <- function(v) if (is.factor(v)) strs <<- c(strs, levels(v)) else if (is.character(v)) strs <<- c(strs, unique(v))
  for (d in c(list(p$data), lapply(p$layers, function(l) l$data))) if (is.data.frame(d)) for (v in d) add(v)
  for (l in p$layers) add(l$aes_params$label)
  for (v in p$labels) add(v)
  for (s in p$scales$scales) { add(if (is.character(s$labels)) s$labels); add(if (is.character(s$name)) s$name) }
  strs <- strs[!is.na(strs)]
  none <- list(family = apaFamily, missing = character())
  if (!length(strs)) return(none)
  ch <- unique(unlist(strsplit(enc2utf8(strs), "")))
  ch <- ch[vapply(ch, function(x) isTRUE(utf8ToInt(x)[1] > 127), FALSE)]
  if (!length(ch)) return(none)
  gi <- tryCatch(systemfonts::glyph_info(ch, family = apaFamily), error = function(e) NULL)
  if (is.null(gi) || !any(gi$index == 0)) return(none)
  miss <- unique(gi$glyph[gi$index == 0])
  fb <- tryCatch(fallback(paste(miss, collapse = ""), family = apaFamily)$path, error = function(e) NA_character_)
  installed <- tryCatch(fonts(), error = function(e) NULL)
  fam <- if (is.null(installed)) NA_character_ else installed$family[match(fb, installed$path)]
  found <- !is.na(fam) && !identical(fam, apaFamily)
  list(family = if (found) fam else "sans", missing = miss, found = found)
}
plotFamily <- function(p) plotGlyphs(p)$family
# The font for one part of the plot (tick labels, a legend, a text layer): the fallback only where its own text has
# characters Liberation Sans lacks; the rest of the figure keeps the APA font
partFamily <- function(glyphs, strs) {
  if (!length(glyphs$missing)) return(apaFamily)
  strs <- unlist(lapply(strs, function(x) if (is.factor(x)) levels(x) else if (is.character(x)) x
    else if (is.language(x) || is.expression(x)) paste(deparse(x), collapse = "") else NULL))
  strs <- strs[!is.na(strs)]
  if (length(strs) && any(vapply(glyphs$missing, function(m) any(grepl(m, strs, fixed = TRUE)), FALSE))) glyphs$family else apaFamily
}
# Clean axes (APA 7.26: no gridlines unless they help, no decoration): other packages' themes (bsts, network,
# audit, survival) bring gridlines and grey panels
plainTheme <- function(p, changes) {
  th <- tryCatch(ggplot2:::plot_theme(p), error = function(e) NULL)
  if (is.null(th)) return(p)
  el <- function(e) tryCatch(ggplot2::calc_element(e, th), error = function(x) NULL)
  shown <- function(e) { x <- el(e); !is.null(x) && !inherits(x, "element_blank") }
  plainFill <- function(f) is.null(f) || length(f) != 1 || is.na(f) || grepl("^(white|transparent|grey100|gray100|#ffffff(ff)?|#[0-9a-f]{6}00)$", tolower(f))
  grid <- Filter(shown, c("panel.grid.major.x", "panel.grid.major.y", "panel.grid.minor.x", "panel.grid.minor.y"))
  if (length(grid)) {
    for (e in grid) p <- setElement(p, e, ggplot2::element_blank())
    changes$add("gridlines removed")
  }
  pb <- el("panel.background")
  if (inherits(pb, "element_rect") && !plainFill(pb$fill)) {
    p <- setElement(p, "panel.background", ggplot2::element_rect(fill = "white"))
    # the shaded panel stood in for the axes: draw them
    rangeFrame <- any(vapply(p$layers, function(l) grepl("RangeFrame", class(l$geom)[1]), FALSE))
    if (!rangeFrame && !shown("axis.line.x") && !shown("axis.line.y")) p <- setElement(p, "axis.line", ggplot2::element_line(colour = "black"))
    changes$add(sprintf("panel background (%s) made white", pb$fill))
  }
  sb <- el("strip.background")
  if (inherits(sb, "element_rect") && !plainFill(sb$fill)) p <- setElement(p, "strip.background", ggplot2::element_blank())
  p
}
# A scale of the plot changed on a copy (the plot's own may be shared between aesthetics)
editScale <- function(p, a, f) {
  i <- which(vapply(p$scales$scales, function(s) a %in% s$aesthetics, FALSE))[1]
  if (is.na(i)) return(p)
  # f gets the copy and the original: a copy is a ggproto child, so it must ask the original, not itself, for what
  # it had (labels set on the copy would otherwise call themselves)
  orig <- p$scales$scales[[i]]
  # (the plot's own list of scales: a plot shares it with the plot it was made from)
  p$scales <- ownScales(p$scales)
  p$scales$scales[[i]] <- f(orig$clone(), orig)
  p
}
defaultScale <- function(a) switch(a, x = ggplot2::scale_x_discrete(), y = ggplot2::scale_y_discrete(),
  colour = ggplot2::scale_colour_discrete(), fill = ggplot2::scale_fill_discrete(), shape = ggplot2::scale_shape(),
  linetype = ggplot2::scale_linetype(), NULL)
# A discrete scale's labels as ggplot works them out from its `labels` (waiver, function, named or plain vector),
# passed through `post`. Worked out here: the plot's own scale is never trained, and an untrained discrete scale
# gives no labels at all
discreteLabels <- function(lab, post) {
  force(lab); force(post)
  function(b) {
    v <- if (is.null(lab) || inherits(lab, "waiver")) { if (!is.null(names(b))) names(b) else as.character(b) }
      else if (is.function(lab)) lab(b)
      else if (is.character(lab) && !is.null(names(lab))) { m <- unname(lab[match(as.character(b), names(lab))]); ifelse(is.na(m), as.character(b), m) }
      else lab
    post(v)
  }
}
builtScale <- function(built, a) tryCatch(if (a %in% c("x", "y")) built$layout[[paste0("panel_scales_", a)]][[1]] else built$plot$scales$get_scales(a), error = function(e) NULL)
# Category labels (tick labels of a group axis, legend entries) in title case (owner decision 1): only the case
# changes; codes (one letter, numbers), the data's own variable names and camelCase names stay
caseLabels <- function(v) {
  one <- function(x) if (is.na(x) || nchar(gsub("[^A-Za-z]", "", x)) <= 1) x else apaTitleCase(x)
  if (is.character(v)) { out <- v; out[] <- vapply(v, one, "", USE.NAMES = FALSE); return(out) }
  if (is.expression(v)) return(as.expression(lapply(v, function(x) tryCatch(apaTitleCaseAny(x), error = function(e) x))))
  if (is.list(v)) return(lapply(v, function(x) if (is.character(x)) one(x) else tryCatch(apaTitleCaseAny(x), error = function(e) x)))
  v
}
# Long category tick labels that run into each other: words wrap onto lines first, then every other label (in the
# order the axis shows them, `pos`) moves to a second row; labels that still collide on a row are angled instead
fitCategoryTicks <- function(p, built, labels, family, changes, slotFrac = 1 / length(labels), pos = seq_along(labels)) {
  th <- tryCatch(ggplot2:::plot_theme(p), error = function(e) NULL)
  el <- tryCatch(ggplot2::calc_element("axis.text.x", th), error = function(e) NULL)
  pt <- el$size
  if (!is.numeric(pt) || !is.finite(apaPanelIn) || length(labels) < 2) return(list(p = p, wrap = NULL))
  if (isTRUE(tryCatch(inherits(built$layout$coord, "CoordFlip"), error = function(e) FALSE))) return(list(p = p, wrap = NULL))
  if (is.numeric(el$angle) && isTRUE(abs(el$angle) > 1)) return(list(p = p, wrap = NULL))   # angled by the plot itself
  pt <- pt * apaScaleK
  cols <- tryCatch(max(built$layout$layout$COL), error = function(e) 1)
  if (length(pos) == length(labels) && !anyNA(pos)) labels <- labels[order(pos)]
  # the panel: the picture less the y axis and a legend at the side
  legendW <- 0
  if (!identical(tryCatch(if (is.null(th$legend.position)) "right" else th$legend.position, error = function(e) "right"), "none"))
    for (a in c("colour", "fill", "shape", "linetype")) {
      bs <- builtScale(built, a)
      # (a legend that shows nothing, JASP's one-group scales with blank labels or no guide, takes no room)
      lw <- if (inherits(bs, "ScaleDiscrete") && !identical(bs$guide, "none") && !inherits(bs$guide, "GuideNone"))
        max(c(0, textWidthIn(tryCatch(bs$get_labels(), error = function(e) ""), pt, family))) else 0
      if (lw > 0) legendW <- max(legendW, lw + 0.45)
    }
  slot <- (apaPanelIn - 0.9 - legendW) / cols * slotFrac
  collide <- function(w, step) length(w) > step && any(head(w, -step) / 2 + tail(w, -step) / 2 + 0.06 > step * slot)
  w <- textWidthIn(labels, pt, family)
  if (!collide(w, 1)) return(list(p = p, wrap = NULL))
  # markdown tick labels (ESCI) break with <br>: a new line starting "- " would read as a list
  markdown <- inherits(el, "element_markdown")
  br <- if (markdown) "<br>" else "\n"
  wrap <- NULL
  if (is.character(labels) && any(grepl(" ", labels))) {
    width <- max(4, floor(max(nchar(labels)) / 2))
    wrap <- function(v) if (is.character(v)) vapply(v, function(x) paste(strwrap(x, width = width), collapse = br), "", USE.NAMES = FALSE) else v
    w <- textWidthIn(wrap(labels), pt, family)
    changes$add("long category labels wrapped")
  }
  if (collide(w, 1) && is.character(labels)) {
    # still colliding with every other label on a second row (two labels apart on one row): angled labels instead
    if (collide(w, 2)) {
      changes$add("crowded category labels angled")
      p <- setElement(p, "axis.text.x", ggplot2::element_text(angle = 45, hjust = 1, vjust = 1))
      return(list(p = p, wrap = NULL))
    }
    # every other label on a second row (ggplot's own dodged axis, so each label is measured as drawn), in the order
    # the axis shows them: the caller puts the breaks in that order (JASP may give them in another, and the axis
    # then dodged neighbours onto one row)
    # the axis title clear of the lower row
    tm <- tryCatch(ggplot2::calc_element("axis.title.x", th)$margin, error = function(e) NULL)
    if (!inherits(tm, "unit") || length(tm) != 4) tm <- ggplot2::margin()
    p <- setElement(p, "axis.title.x", ggplot2::element_text(margin = tm + grid::unit(c(0.5 * el$size, 0, 0, 0), "pt")))
    changes$add("crowded category labels on two rows")
    return(list(p = p, wrap = wrap, dodge = TRUE))
  }
  list(p = p, wrap = wrap, dodge = FALSE)
}
# Colour contrast (D4, owner decision 2): groups told apart only by colour get colours of
# their own hue stepped in lightness, so 2 or 3 groups reach 3:1 against each other (WCAG 2 for graphics); lines
# also against the white page. Translucent fills get enough opacity for the steps. 4 or more groups can't all reach
# 3:1: they get the widest steps possible, and their own point shapes or line styles (groupMarks)
wcagLum <- function(col, alpha = 1) {
  m <- grDevices::col2rgb(col, alpha = TRUE) / 255
  a <- m[4, ] * alpha
  rgb <- m[1:3, , drop = FALSE] * rep(a, each = 3) + (1 - rep(a, each = 3))
  lin <- ifelse(rgb <= 0.03928, rgb / 12.92, ((rgb + 0.055) / 1.055)^2.4)
  colSums(c(0.2126, 0.7152, 0.0722) * lin)
}
contrastRatio <- function(l1, l2) (max(l1, l2) + 0.05) / (min(l1, l2) + 0.05)
minPair <- function(l) if (length(l) < 2) Inf else min(combn(l, 2, function(x) contrastRatio(x[1], x[2])))
lumTargets <- function(n, lines) {
  if (lines) { if (n == 2) c(0.02, 0.28) else if (n == 3) c(0.005, 0.125, 0.5) else 0.05 * 10^(seq(0, 1, length.out = n)) - 0.05 }
  else { if (n == 2) c(0.10, 0.55) else if (n == 3) c(0.045, 0.26, 0.92) else 0.05 * 19.4^(seq(0, 1, length.out = n)) - 0.05 }
}
# a colour of the same hue (and chroma where the gamut allows) with the given luminance once drawn at `alpha`
withLum <- function(col, target, alpha = 1) {
  luv <- grDevices::convertColor(t(grDevices::col2rgb(col)) / 255, from = "sRGB", to = "Luv")
  h <- atan2(luv[3], luv[2]) * 180 / pi; cc <- sqrt(luv[2]^2 + luv[3]^2)
  # the colour at lightness L with this hue: its own chroma where sRGB can show it, else the most it can show.
  # (hcl's fixup clips each channel instead, and a saturated blue at low lightness then turns red-brown)
  at <- function(L) {
    if (!is.na(grDevices::hcl(h, cc, L, fixup = FALSE))) return(grDevices::hcl(h, cc, L, fixup = FALSE))
    lo <- 0; hi <- cc
    for (k in 1:25) { mid <- (lo + hi) / 2; if (is.na(grDevices::hcl(h, mid, L, fixup = FALSE))) hi <- mid else lo <- mid }
    grDevices::hcl(h, lo, L, fixup = TRUE)
  }
  f <- function(L) wcagLum(at(L), alpha)
  if (f(0) > target) return(NA_character_)
  lo <- 0; hi <- 100
  if (f(hi) < target) return(NA_character_)
  for (k in 1:30) { mid <- (lo + hi) / 2; if (f(mid) < target) lo <- mid else hi <- mid }
  at((lo + hi) / 2)
}
layerAlpha <- function(l) {
  a <- l$aes_params$alpha
  if (is.null(a)) a <- tryCatch(l$geom$default_aes$alpha, error = function(e) NULL)
  if (is.numeric(a) && length(a) == 1 && !is.na(a)) a else 1
}
pointGeom <- function(l) grepl("Point", class(l$geom)[1])
lineGeom <- function(l) grepl("^Geom(Jasp)?(Line|Path|Step|Smooth|Density|Segment|Freqpoly)$", class(l$geom)[1])
groupMarks <- function(p, built, a, bs, uses, n, changes) {
  th <- tryCatch(ggplot2:::plot_theme(p), error = function(e) NULL)
  pos <- tryCatch(if (is.null(th$legend.position)) "right" else th$legend.position, error = function(e) "right")
  if (identical(pos, "none") || identical(bs$guide, "none") || inherits(bs$guide, "GuideNone")) return(p)
  title <- { s <- p$scales$get_scales(a); if (!is.null(s) && !is.null(s$name) && !inherits(s$name, "waiver")) s$name else p$labels[[a]] }
  added <- character()
  # one shape scale for every point layer: filled shapes (21 to 25, which keep the fill) only when every point layer
  # draws them; with a mix, the filled layers keep their own shape and the others get shapes
  filledLayer <- function(l) is.numeric(l$aes_params$shape) && isTRUE(l$aes_params$shape %in% 21:25)
  pts <- Filter(function(l) pointGeom(l) && !is.null(layerMapping(l)[[a]]), uses)
  allFilled <- length(pts) > 0 && all(vapply(pts, filledLayer, FALSE))
  vals <- if (allFilled) 21:25 else c(16, 17, 15, 18, 3, 4, 8, 1, 2, 0, 5, 6)
  for (l in uses) {
    m <- layerMapping(l)
    v <- m[[a]]
    if (is.null(v)) next
    if (pointGeom(l) && n <= 12) {
      if (filledLayer(l) && (n > 5 || !allFilled)) next
      l$aes_params$shape <- NULL; l$mapping$shape <- v; added <- union(added, "shape")
    } else if (lineGeom(l) && n <= 13) {
      l$aes_params$linetype <- NULL; l$mapping$linetype <- v; added <- union(added, "linetype")
    }
  }
  if ("shape" %in% added && is.null(p$scales$get_scales("shape")))
    p <- p + ggplot2::scale_shape_manual(values = vals[seq_len(n)], name = if (is.null(title)) ggplot2::waiver() else title, labels = discreteLabels(bs$labels, caseLabels))
  if ("linetype" %in% added && is.null(p$scales$get_scales("linetype")))
    p <- p + ggplot2::scale_linetype_discrete(name = if (is.null(title)) ggplot2::waiver() else title, labels = discreteLabels(bs$labels, caseLabels))
  if (length(added)) changes$add(sprintf("%d groups: %s added beside colour (owner decision 2)", n, paste(added, collapse = " and ")))
  p
}
layerMapping <- function(l) if (is.null(l$computed_mapping)) l$mapping else l$computed_mapping
# the layers that draw an aesthetic
aesLayers <- function(layers, a) Filter(function(l) { m <- names(layerMapping(l)); a %in% m || (a == "colour" && "color" %in% m) }, layers)
# the variable a plot's layers map to an aesthetic, when they all map the same one (else NA)
aesVariable <- function(layers, a) {
  v <- unique(unlist(lapply(aesLayers(layers, a), function(l) { m <- layerMapping(l); e <- if (!is.null(m[[a]])) m[[a]] else m[["color"]]; rlang::quo_text(e) })))
  if (length(v) == 1) v else NA_character_
}
# a palette of the plot's scale for `a` replaced by `new` (a scale of its own when the plot had none)
setPalette <- function(p, a, new) {
  i <- which(vapply(p$scales$scales, function(s) a %in% s$aesthetics, FALSE))[1]
  if (is.na(i)) return(p + (if (a == "fill") ggplot2::scale_fill_manual(values = new) else ggplot2::scale_colour_manual(values = new)))
  # (the colours copied into the local scope: callers reuse their variables; the plot's own list of scales, which
  # it shares with the plot it was made from)
  p$scales <- ownScales(p$scales)
  p$scales$scales[[i]] <- local({ mine <- new; s <- p$scales$scales[[i]]$clone(); s$palette <- function(k) mine[seq_len(k)]; s$palette.cache <- NULL; s })
  p
}
# Colours stepped in lightness, each group keeping its hue: the targets, and the opacity the fills need to reach them
stepTargets <- function(n, lines, marks) {
  # with such marks, fills no darker than 3:1 against black; three fills then can't all reach 3:1 against each other
  t <- if (!lines && marks) { if (n == 2) c(0.11, 0.6) else 0.16 * (0.97 / 0.16)^(seq(0, 1, length.out = n)) - 0.05 }
  else lumTargets(n, lines)
  # no fill near white (a group's bar or cell would vanish into the page): the lightest at 0.85 luminance. Two or three
  # groups without marks move down by the same contrast, so they stay 3:1 apart; the others (with marks, or four or more:
  # 3:1 out of reach) keep their darkest
  # step, light enough for black error bars and box lines on it (D7), and the steps above it close up evenly
  top <- 0.85
  if (!lines && length(t) && max(t) > top) {
    if (n <= 3 && !marks) t <- (t + 0.05) * (top + 0.05) / (max(t) + 0.05) - 0.05
    else {
      lo <- log(min(t) + 0.05); hi <- log(max(t) + 0.05)
      t <- exp(lo + (log(t + 0.05) - lo) * (log(top + 0.05) - lo) / (hi - lo)) - 0.05
    }
  }
  t
}
# `core`: the groups every panel of the figure shows. They get the widest steps (3:1 where 2 or 3 of them), and the
# groups only some panels show go in between, where 3:1 can't be reached anyway
steppedColours <- function(cols, alpha, lines, marks, core = rep(TRUE, length(cols))) {
  n <- length(cols)
  lum <- wcagLum(cols, alpha)
  if (all(core) || sum(core) < 2) {
    # the darkest group stays the darkest: steps follow JASP's own order of lightness
    target <- stepTargets(n, lines, marks)[rank(lum, ties.method = "first")]
  } else {
    ct <- stepTargets(sum(core), lines, marks)
    target <- numeric(n); target[core] <- ct[rank(lum[core], ties.method = "first")]
    # the others spread evenly (in contrast) over the widest gap between the core's steps
    g <- which.max(diff(log(ct + 0.05)))
    ex <- exp(seq(log(ct[g] + 0.05), log(ct[g + 1] + 0.05), length.out = sum(!core) + 2))[-c(1, sum(!core) + 2)] - 0.05
    target[!core] <- ex[rank(lum[!core], ties.method = "first")]
  }
  need <- alpha
  if (wcagLum("#000000", need) > min(target)) {
    lo <- alpha; hi <- 1
    for (k in 1:20) { mid <- (lo + hi) / 2; if (wcagLum("#000000", mid) > min(target)) lo <- mid else hi <- mid }
    need <- min(1, hi + 0.02)
  }
  list(new = vapply(seq_len(n), function(j) { x <- withLum(cols[j], target[j], need); if (is.na(x)) cols[j] else x }, ""), need = need, target = target)
}
# Colour and fill share one set of steps, but the light steps fills need (boxes readable on them, D7) are too pale for
# points and outlines on the white page: the group's colour moves to the fill of outlined points (shape 21, dark
# outline), and shapes drawn with both (bars, areas) get a dark outline, so each group still has one colour
outlineGroups <- function(p, built, changes) {
  done <- character()
  for (i in seq_along(built$plot$layers)) {
    l <- built$plot$layers[[i]]; m <- layerMapping(l)
    col <- if (!is.null(m$colour)) m$colour else m$color
    if (is.null(col)) next
    # (points first: their geom has a fill too, unused by plain shapes; and a layer inherits the plot's fill mapping
    # whether or not its geom draws fills: a line doesn't)
    if (pointGeom(l)) {
      l$mapping$fill <- col; l$mapping$colour <- NULL; l$mapping$color <- NULL
      l$aes_params$colour <- "#333333"
      if (!(is.numeric(l$aes_params$shape) && isTRUE(l$aes_params$shape %in% 21:25))) l$aes_params$shape <- 21
      done <- union(done, "points")
    } else if ("fill" %in% names(m) && "fill" %in% names(l$geom$default_aes)) { l$aes_params$colour <- "#333333"; done <- union(done, "outlines") }
  }
  if (length(done)) changes$add(sprintf("group colours too pale for the white page: %s drawn with a dark outline, filled in the group's colour",
    paste(done, collapse = " and ")))
  p
}
# The colour scale when colour and fill map one variable: the fills' steps, unless they are too pale for the white
# page. Points and filled shapes then take the fill with a dark outline (outlineGroups); lines can't, so lines get
# darker steps of the same hues, 3:1 against white (QC's Operator B line had gone pale mint)
# Lines and points drawn in one fixed colour too light for the white page (QC's #00FF00 centre line, 1.37:1):
# the same hue, darker, about 5:1 against white (#00FF00 becomes a green near #008000)
darkenSingles <- function(p, changes) {
  done <- character()
  for (l in p$layers) {
    if (!grepl("Line|Path|Step|Hline|Vline|Segment|Abline|Point|Errorbar|Linerange", class(l$geom)[1])) next
    m <- layerMapping(l)
    if (!is.null(m$colour) || !is.null(m$color)) next
    oc <- l$aes_params$colour
    if (!is.character(oc) || length(oc) != 1 || is.na(oc)) next
    rgb <- tryCatch(grDevices::col2rgb(oc, alpha = TRUE)[, 1], error = function(e) NULL)
    if (is.null(rgb) || rgb[4] < 128 || diff(range(rgb[1:3])) < 20) next   # see-through or grey: left alone
    if (contrastRatio(wcagLum(oc), 1) >= 3) next
    x <- withLum(oc, 0.16)
    if (is.na(x)) next
    l$aes_params$colour <- x; done <- c(done, oc)
  }
  if (length(done)) changes$add(sprintf("light line colours (%s) darkened to at least 3:1 against the white page", paste(unique(done), collapse = ", ")))
  p
}
# Steps of the same hues from black up to 3:1 against white, spaced evenly in contrast (3 lines about 2.6:1 apart,
# 2 lines 6.6:1), in the colours' own order of lightness
darkSteps <- function(cols) {
  tg <- 0.05 * 6.6^seq(0, 1, length.out = length(cols)) - 0.05
  tg <- tg[rank(wcagLum(cols), ties.method = "first")]
  vapply(seq_along(cols), function(j) { x <- withLum(cols[j], tg[j]); if (is.na(x)) cols[j] else x }, "")
}
sharedColour <- function(p, built, cols, new, changes) {
  pale <- any(vapply(wcagLum(new), contrastRatio, 1, 1) < 3)
  if (!pale) return(setPalette(p, "colour", new))
  lines <- any(vapply(aesLayers(built$plot$layers, "colour"), function(l) lineGeom(l) || grepl("Path|Step|Line", class(l$geom)[1]), FALSE))
  # (steps between black and 3:1 against white: 2 lines reach 3:1 apart too, 3 or more can't, the points tell them apart)
  colourNew <- if (lines) darkSteps(cols) else new
  p <- setPalette(p, "colour", colourNew)
  if (lines) changes$add("lines in darker steps of the same colours, 3:1 against the white page")
  outlineGroups(p, built, changes)
}
# Fills stepped so light they vanish on the white page (a bar at .92 luminance): shapes drawn without an outline get
# a dark one
outlineFills <- function(p, built, new, changes) {
  if (!any(vapply(wcagLum(new), contrastRatio, 1, 1) < 1.5)) return(p)
  done <- FALSE
  # the outline drawn now: the layer's own, else the geom's default; one under 3:1 against white (JASP's white
  # outline on bars) counts as none
  outlined <- function(l) {
    oc <- l$aes_params$colour %||% tryCatch(l$geom$default_aes$colour, error = function(e) NULL)
    is.character(oc) && length(oc) && !all(is.na(oc)) && !all(oc %in% c("transparent", "NA")) &&
      all(vapply(oc[!is.na(oc)], function(c) tryCatch(contrastRatio(wcagLum(c), 1) >= 3, error = function(e) FALSE), FALSE))
  }
  # a pie already drawn with its outline: a second copy of its slices under it (Bain's pies, a narrower bar under the
  # full one) gets none, as an outline there draws a ring inside the pie
  polar <- inherits(built$plot$coordinates, c("CoordPolar", "CoordRadial"))
  pieOutlined <- polar && any(vapply(built$plot$layers, function(l) grepl("Bar|Col", class(l$geom)[1]) && outlined(l), FALSE))
  for (l in aesLayers(built$plot$layers, "fill")) {
    if (pointGeom(l) || !grepl("Bar|Col|Rect|Tile|Area|Ribbon|Density|Polygon|Violin|Boxplot", class(l$geom)[1])) next
    m <- layerMapping(l)
    if (!is.null(m$colour) || !is.null(m$color)) next
    if (outlined(l) || pieOutlined) next
    l$aes_params$colour <- "#333333"; done <- TRUE
  }
  if (done) changes$add("pale fills given a dark outline, so they show on the white page")
  p
}
meaningfulColours <- function(names, cols) {
  names <- tolower(trimws(names[!is.na(names) & nzchar(trimws(names))]))
  levelWord <- "^(low|some|some concerns|moderate|serious|critical|high|unclear|no information|ni|severe|good|fair|poor|pass|fail|warning|very high|very low)( risk( of bias)?)?$"
  if (length(names) >= 2 && sum(grepl(levelWord, names)) >= 2 && mean(grepl(levelWord, names)) >= 0.5) return(TRUE)
  if (!is.character(cols) || anyNA(cols) || length(cols) < 3) return(FALSE)
  # a red, an amber or yellow and a green, all saturated: a traffic light
  hsv <- grDevices::rgb2hsv(grDevices::col2rgb(cols))
  sat <- hsv["s", ] > 0.6 & hsv["v", ] > 0.4
  hue <- hsv["h", ] * 360
  any(sat & (hue < 15 | hue > 345)) && any(sat & hue > 40 & hue < 70) && any(sat & hue > 90 & hue < 150)
}
# A list of scales of the plot's own: the same scale objects in a new list (entries are replaced, never changed in
# place). ScalesList's own clone() makes a child list and clones every scale, so used again and again the chain of
# parents grows until R's stack overflows
ownScales <- function(sl) {
  n <- tryCatch(ggplot2:::scales_list(), error = function(e) NULL)
  if (is.null(n)) return(sl$clone())
  n$scales <- sl$scales
  n
}
# A layer of its own (a ggproto layer is an environment: changing a shared one changes every plot that holds it)
copyLayer <- function(l) {
  if (!is.environment(l)) return(l)
  n <- rlang::env_clone(l)
  attributes(n) <- attributes(l)
  n
}
# One optional restyling step: when it fails, the plot as it was before it, and a line in the change log, so one
# failing step never costs the whole redraw
# A step edits layers in place (through the built plot, whose layers are the plot's own environments), and a
# jaspGraphsPlot is an R6 object: so the layers' contents, the figure's fields and the change log are saved first and
# put back on an error, and a failed step leaves no trace but its "left as JASP drew it" line.
safeStep <- function(p, what, changes, f) {
  snap <- stepSnapshot(p)
  logged <- if (is.function(changes$get)) changes$get() else NULL
  tryCatch(f(p), error = function(e) {
    stepRestore(snap)
    if (is.function(changes$set) && !is.null(logged)) changes$set(logged)
    changes$add(sprintf("%s left as JASP drew it (%s)", what, conditionMessage(e)))
    p
  })
}
stepLayers <- function(p) {
  if (inherits(p, "ggplot")) return(Filter(is.environment, p$layers))
  if (inherits(p, "R6") && is.list(tryCatch(p$subplots, error = function(e) NULL)))
    return(unlist(lapply(p$subplots, stepLayers), recursive = FALSE))
  list()
}
stepSnapshot <- function(p) {
  ls_ <- stepLayers(p)
  list(layers = ls_, saved = lapply(ls_, function(l) as.list(l, all.names = TRUE)),
    r6 = if (inherits(p, "R6")) p else NULL, attrs = if (inherits(p, "R6")) attributes(p) else NULL,
    fields = if (inherits(p, "R6")) list(subplots = tryCatch(p$subplots, error = function(e) NULL), plotArgs = tryCatch(p$plotArgs, error = function(e) NULL)) else NULL)
}
stepRestore <- function(snap) {
  for (k in seq_along(snap$layers)) {
    env <- snap$layers[[k]]; old <- snap$saved[[k]]
    extra <- setdiff(ls(env, all.names = TRUE), names(old))
    if (length(extra)) rm(list = extra, envir = env)
    for (n in names(old)) assign(n, old[[n]], envir = env)
  }
  if (!is.null(snap$r6)) {
    for (n in names(snap$fields)) if (!is.null(snap$fields[[n]])) tryCatch(snap$r6[[n]] <- snap$fields[[n]], error = function(e) NULL)
    # (attributes set on the figure, such as its panel letters, live on the R6 environment itself)
    for (n in setdiff(names(attributes(snap$r6)), names(snap$attrs))) attr(snap$r6, n) <- NULL
    for (n in setdiff(names(snap$attrs), c("class", "names"))) attr(snap$r6, n) <- snap$attrs[[n]]
  }
}
apaKeyPanel <- FALSE   # set by apaPlot while it restyles a figure with a hand-drawn legend panel
# A panel that is a hand-drawn legend: point or line keys beside their names, nothing else
keyPanel <- function(q) {
  if (!inherits(q, "ggplot") || !length(q$layers)) return(FALSE)
  g <- vapply(q$layers, function(l) class(l$geom)[1], "")
  if (!all(g %in% c("GeomPoint", "GeomText", "GeomLabel", "alignedtext", "GeomSegment"))) return(FALSE)
  if (!any(g %in% c("GeomText", "GeomLabel", "alignedtext"))) return(FALSE)
  maps <- unique(c(names(q$mapping), unlist(lapply(q$layers, function(l) names(l$mapping)))))
  any(c("fill", "colour", "color", "shape", "linetype") %in% maps)
}
apaShared <- list()   # colours shared by the panels of one figure (set by apaPlot), by aesthetic: level -> colour
apaContrast <- function(p, built, changes) {
  # a figure whose legend JASP draws as a panel of its own: the keys there and the marks in the plot must stay alike,
  # and the two panels are restyled one at a time, so their group colours and shapes stay as JASP drew them
  if (isTRUE(apaKeyPanel)) return(p)
  done <- integer()
  # colour and fill mapped to one variable (rain clouds: points coloured, boxes and clouds filled): one set of steps
  # for both, so each group keeps one colour on every layer
  together <- FALSE
  bf <- builtScale(built, "fill"); bc <- builtScale(built, "colour")
  if (inherits(bf, "ScaleDiscrete") && inherits(bc, "ScaleDiscrete") && !inherits(bf, "ScaleDiscreteIdentity") && !inherits(bc, "ScaleDiscreteIdentity")) {
    vf <- aesVariable(built$plot$layers, "fill"); vc <- aesVariable(built$plot$layers, "colour")
    together <- !is.na(vf) && identical(vf, vc) && identical(tryCatch(bf$get_limits(), error = function(e) 1), tryCatch(bc$get_limits(), error = function(e) 2))
  }
  for (a in c("fill", "colour")) {
    if (together && a == "colour") next
    bs <- builtScale(built, a)
    if (!inherits(bs, "ScaleDiscrete") || inherits(bs, "ScaleDiscreteIdentity")) next
    i <- which(vapply(p$scales$scales, function(s) a %in% s$aesthetics, FALSE))[1]
    if (!is.na(i) && i %in% done) next
    lv <- tryCatch(bs$get_limits(), error = function(e) NULL)
    n <- length(lv)
    if (n < 1 || n > 12) next
    cols <- tryCatch(bs$map(lv), error = function(e) NULL)
    # colours that carry meaning stay: risk-of-bias or traffic-light levels (low, some concerns, high, critical),
    # judged by their names or labels, or by a red, an amber and a green together
    labs <- tryCatch(as.character(bs$get_labels()), error = function(e) character())
    if (meaningfulColours(c(as.character(lv), labs), cols)) next
    # one colour mapped as a constant (QC's limits: aes(colour = "red"), drawn #F8766D, 2.69:1): a line too light for
    # the white page darkens, its hue kept
    if (n == 1) {
      if (a == "colour" && is.character(cols) && !is.na(cols) && contrastRatio(wcagLum(cols), 1) < 3 &&
          any(vapply(aesLayers(built$plot$layers, a), function(l) lineGeom(l) || grepl("Path|Step|Line|Segment", class(l$geom)[1]), FALSE))) {
        x <- withLum(cols, 0.25)
        if (!is.na(x)) { p <- setPalette(p, a, x); changes$add(sprintf("light line colour (%s) darkened to 3:1 against the white page", cols)) }
      }
      next
    }
    if (!is.character(cols) || length(cols) != n || anyNA(cols)) next
    # the layers that draw this aesthetic; groups that also differ in shape or line type are told apart already
    uses <- aesLayers(built$plot$layers, a)
    if (!length(uses)) next
    # groups named by text in the plot (ML's data split: "Train: 96" on its bar) are labelled directly, and text
    # drawn on a fill needs the fill light
    if (a == "fill" && any(vapply(built$plot$layers, function(l) grepl("Text|Label", class(l$geom)[1]), FALSE))) next
    if (any(vapply(uses, function(l) any(c("shape", "linetype") %in% names(layerMapping(l))), FALSE))) {
      # told apart by line style too, but a line too light for the white page (QC's limits in JASP's #F8766D,
      # 2.69:1) still darkens, its hue kept
      if (a == "colour" && any(vapply(uses, function(l) lineGeom(l) || grepl("Path|Step|Line", class(l$geom)[1]), FALSE))) {
        dark <- vapply(cols, function(c) if (contrastRatio(wcagLum(c), 1) < 3) { x <- withLum(c, 0.25); if (is.na(x)) c else x } else c, "", USE.NAMES = FALSE)
        if (!identical(dark, cols)) { p <- setPalette(p, a, dark); changes$add("light group line colours darkened to 3:1 against the white page") }
      }
      next
    }
    # the figure's panels share their colours (Bain's pies: one hypothesis, one colour in every panel)
    # (keyed by JASP's own colours: JASP gives groups that never meet in one panel the same colour, Bain's Hu and Hc)
    sh <- apaShared[[a]]
    if (!is.null(sh) && all(cols %in% names(sh))) {
      new <- unname(sh[cols])
      need <- attr(sh, "need")
      if (is.numeric(need)) for (l in uses) if (layerAlpha(l) < need) l$aes_params$alpha <- need
      p <- setPalette(p, a, new)
      if (together) p <- sharedColour(p, built, cols, new, changes)
      p <- outlineFills(p, built, new, changes)
      if (!identical(new, cols)) changes$add(sprintf("%d %s colours stepped in lightness, one colour per group across the panels", n, a))
      next
    }
    # (after the shared colours: a figure keeps one colour per group in every panel)
    # 4 or more outlined fills (bars with a dark edge): each shape shows on its own, stepping them only blurs a palette
    # chosen for its order
    if (a == "fill" && n >= 4 && all(vapply(aesLayers(built$plot$layers, a), function(l) {
      oc <- l$aes_params$colour %||% tryCatch(l$geom$default_aes$colour, error = function(e) NULL)
      is.character(oc) && length(oc) && !anyNA(oc) && all(vapply(oc, function(c) tryCatch(contrastRatio(wcagLum(c), 1) >= 3, error = function(e) FALSE), FALSE))
    }, FALSE))) next
    # a scale shared with fill colours areas too: it takes the steps for fills
    lines <- a == "colour" && (is.na(i) || !"fill" %in% p$scales$scales[[i]]$aesthetics)
    # dark error bars, whiskers or boxes drawn over the fills (rain cloud plots) must stay visible against them
    # (D7): the opaque boxes set the steps then, not the translucent clouds
    marks <- any(vapply(built$plot$layers, function(l) grepl("Errorbar|Boxplot|Linerange|Crossbar|Pointrange", class(l$geom)[1]), FALSE))
    alpha <- if (marks && !lines) max(vapply(uses, layerAlpha, 1)) else min(vapply(uses, layerAlpha, 1))
    lum <- wcagLum(cols, alpha)
    ok <- minPair(lum) >= 3 && (!lines || all(vapply(lum, contrastRatio, 1, 1) >= 3))
    if (ok) next
    st <- steppedColours(cols, alpha, lines, marks)
    need <- st$need
    # overlapping translucent shapes (prior and posterior densities on one axis) must stay see-through: their fills
    # keep their opacity, and when the steps can't be reached that way the coloured outlines tell the groups apart
    seeThrough <- any(vapply(uses, function(l) grepl("Density|Area|Ribbon|Polygon|Violin", class(l$geom)[1]) && layerAlpha(l) < 1, FALSE))
    if (seeThrough && need > alpha) next
    if (need > alpha) for (l in uses) if (layerAlpha(l) < need) l$aes_params$alpha <- need
    new <- st$new
    # 2 or 3 lines: 3:1 against the white page first (3 lines can't also be 3:1 apart: as far apart as they can be,
    # about 2.6:1; no line styles for 3 groups, owner decision 2)
    if (lines && n <= 3 && any(vapply(wcagLum(new), contrastRatio, 1, 1) < 3)) { new <- darkSteps(cols); need <- alpha }
    p <- setPalette(p, a, new)
    if (!is.na(i)) done <- c(done, i)
    if (together) p <- sharedColour(p, built, cols, new, changes)
    if (a == "fill") p <- outlineFills(p, built, new, changes)
    changes$add(sprintf("%d %s colours stepped in lightness for contrast (lowest pair %.2f:1 -> %.2f:1)%s", n, a,
      minPair(lum), minPair(wcagLum(new, need)), if (together) ", the same colours for points and lines" else ""))
    # 4 or more groups can't all reach 3:1 (owner decision 2): points also differ in shape, lines in line style,
    # mapped to the same variable so one legend shows both. Not when the legend is hidden (groups labelled directly)
    # (once: colour and fill on one variable mark the points and lines through the colour layers)
    if (n >= 4) p <- if (together) groupMarks(p, built, "colour", bc, aesLayers(built$plot$layers, "colour"), n, changes)
      else groupMarks(p, built, a, bs, uses, n, changes)
  }
  p
}
# Pie labels of slices too thin to hold them apart ("H1H2H3" on top of each other in Bain's pies): neighbours
# that would overlap share one label
pieLabels <- function(p, family) {
  if (!inherits(p$coordinates, c("CoordPolar", "CoordRadial"))) return(p)
  theta <- if (identical(p$coordinates$theta, "y")) "y" else "x"
  s <- p$scales$get_scales(theta)
  if (is.null(s) || !is.numeric(s$breaks) || !is.character(s$labels) || length(s$breaks) != length(s$labels) || length(s$breaks) < 2) return(p)
  lim <- if (is.numeric(s$limits)) s$limits else range(s$breaks)
  pos <- (s$breaks - lim[1]) / diff(lim)
  o <- order(pos); pos <- pos[o]; lab <- s$labels[o]
  w <- textWidthIn(lab, 10, family)
  r <- 0.8   # about a pie's radius once printed, inches
  groups <- list(1)
  for (j in seq_along(pos)[-1]) {
    g <- groups[[length(groups)]]
    if ((pos[j] - pos[max(g)]) * 2 * pi * r < (w[j] + w[max(g)]) / 2 + 0.05) groups[[length(groups)]] <- c(g, j)
    else groups[[length(groups) + 1]] <- j
  }
  if (length(groups) == length(pos)) return(p)
  editScale(p, theta, function(sc, orig) {
    sc$breaks <- vapply(groups, function(g) mean(s$breaks[o][g]), 0)
    sc$labels <- vapply(groups, function(g) paste(lab[g][order(o[g])], collapse = ", "), "")
    sc
  })
}
apaGgplot <- function(p, changes) {
  # the caller's plot stays as it was: a list of scales and layers of this plot's own (a layer copied as a child, so
  # what is set on it here doesn't reach the original; ggplot objects share both otherwise)
  p$scales <- ownScales(p$scales)
  p$layers <- lapply(p$layers, copyLayer)
  p <- safeStep(p, "axis labels (minus signs and leading zeros)", changes, apaScales)
  p <- safeStep(p, "text sizes and fonts", changes, apaText)
  built <- tryCatch(suppressMessages(suppressWarnings(ggplot2::ggplot_build(p))), error = function(e) NULL)
  # the APA font on every text element: some of JASP's plots set a family of their own on the tick labels.
  # Elements a plot hides (element_blank) stay hidden. A plot with characters Liberation Sans lacks keeps a font
  # that has them.
  glyphs <- plotGlyphs(p)
  if (length(glyphs$missing) && !isTRUE(glyphs$found))
    changes$add(sprintf("to-do: no installed font draws %s, so they show as boxes: install a font that has them (for Chinese, Japanese or Korean, Noto Sans CJK) and copy again",
      paste(head(glyphs$missing, 5), collapse = " ")))
  family <- apaFamily
  # the strings each text element of the theme draws
  axisLabels <- function(a) tryCatch(unlist(lapply(built$layout$panel_params, function(pp) pp[[a]]$get_labels())), error = function(e) NULL)
  scaleName <- function(a) { s <- p$scales$get_scales(a); if (!is.null(s) && !inherits(s$name, "waiver")) s$name }
  legendAes <- c("colour", "fill", "shape", "linetype", "size", "alpha")
  dataStrings <- unlist(lapply(c(list(p$data), lapply(p$layers, function(l) l$data)), function(d) if (is.data.frame(d))
    unlist(lapply(d, function(v) if (is.factor(v)) levels(v) else if (is.character(v)) unique(v)))))
  parts <- list(
    axis.text.x = axisLabels("x"), axis.text.y = axisLabels("y"),
    axis.title.x = list(p$labels$x, scaleName("x")), axis.title.y = list(p$labels$y, scaleName("y")),
    legend.text = unlist(lapply(legendAes, function(a) tryCatch(builtScale(built, a)$get_labels(), error = function(e) NULL))),
    legend.title = c(p$labels[intersect(names(p$labels), legendAes)], lapply(legendAes, scaleName)),
    strip.text = dataStrings, strip.text.x = dataStrings, strip.text.y = dataStrings, plot.title = list(p$labels$title))
  partFam <- lapply(parts, function(v) partFamily(glyphs, v))
  fallback <- names(partFam)[vapply(partFam, function(f) !identical(f, apaFamily), FALSE)]
  if (length(fallback)) changes$add(sprintf("font '%s' for %s: characters %s lacks", glyphs$family, paste(unique(sub("\\.[xy]$", "", fallback)), collapse = ", "), apaFamily))
  p <- setElement(p, "text", ggplot2::element_text(family = apaFamily))
  thf <- tryCatch(ggplot2:::plot_theme(p), error = function(e) NULL)
  if (!is.null(thf)) for (e in c("axis.text", "axis.text.x", "axis.text.y", "axis.title.x", "axis.title.y", "legend.text", "legend.title", "strip.text", "strip.text.x", "strip.text.y", "plot.title")) {
    el <- tryCatch(ggplot2::calc_element(e, thf), error = function(x) NULL)
    f <- if (is.null(partFam[[e]])) apaFamily else partFam[[e]]
    if (inherits(el, "element_text") && !identical(el$family, f)) p <- setElement(p, e, ggplot2::element_text(family = f))
  }
  # axis titles a step above the tick labels (11 and 10 pt): JASP's theme takes the step as an argument that
  # defaults to 1, so its titles come out at tick size
  th <- tryCatch(ggplot2:::plot_theme(p), error = function(e) NULL)
  if (!is.null(th)) for (a in c("x", "y")) {
    tick <- tryCatch(ggplot2::calc_element(paste0("axis.text.", a), th)$size, error = function(e) NULL)
    title <- tryCatch(ggplot2::calc_element(paste0("axis.title.", a), th)$size, error = function(e) NULL)
    if (is.numeric(tick) && is.numeric(title) && length(tick) == 1 && length(title) == 1 && abs(title - tick) < 1e-6)
      p <- setElement(p, paste0("axis.title.", a), ggplot2::element_text(size = tick * 1.1))
  }
  # text set by the theme (tick labels, legends, panel strips, tables built as plots) at 8 pt or more once printed
  if (!is.null(th)) for (e in c("axis.text.x", "axis.text.y", "legend.text", "legend.title", "strip.text.x", "strip.text.y", "plot.title")) {
    size <- tryCatch(ggplot2::calc_element(e, th)$size, error = function(e) NULL)
    if (is.numeric(size) && length(size) == 1 && isTRUE(size * apaScaleK < 8)) p <- setElement(p, e, ggplot2::element_text(size = 8 / apaScaleK))
  }
  p <- plainTheme(p, changes)
  # long y axis titles wrap onto two lines instead of running off the picture; a little room on the right for
  # the last tick label
  ytitle <- p$labels$y
  if (is.character(ytitle) && length(ytitle) == 1 && nchar(ytitle) > 40 && !grepl("\n", ytitle))
    p$labels$y <- paste(strwrap(ytitle, width = max(25, ceiling(nchar(ytitle) / 2) + 3)), collapse = "\n")
  margin <- tryCatch(ggplot2::calc_element("plot.margin", th), error = function(e) NULL)
  textOnly <- length(p$layers) > 0 && all(grepl("Text|Label|Blank", vapply(p$layers, function(l) class(l$geom)[1], "")))
  if (!is.null(margin) && !textOnly) p <- safeStep(p, "room for the last tick label", changes, function(p) setElement(p, "plot.margin", margin + grid::unit(c(0, rightRoom(p, built, partFam$axis.text.x), 0, 0), "pt")))
  # facets side by side, each with its own x axis: the end tick labels of neighbouring panels ("1.5" and "−1.5")
  # meet across the gap between them; the gap grows to hold both halves
  p <- safeStep(p, "fewer ticks on side-by-side panels", changes, function(p) thinFacetTicks(p, built, partFam$axis.text.x, changes))
  p <- safeStep(p, "the gap between side-by-side panels", changes, function(p) {
    gap <- facetGap(p, built, partFam$axis.text.x)
    if (gap > 0) setElement(p, "panel.spacing.x", grid::unit(gap, "pt")) else p
  })
  # text drawn in the plot at 8 pt or more once printed (ggplot sizes text layers in mm; 1 mm = 2.845 pt)
  minSize <- 8 / (2.845 * apaScaleK)
  # a plot whose text sizes follow the data (ML's decision tree draws each node label twice, one layer sized by a
  # mapping): resizing only the fixed layers would pull the two copies apart
  sizedText <- any(vapply(p$layers, function(l) grepl("Text|Label", class(l$geom)[1]) && "size" %in% names(l$mapping), FALSE))
  if (!sizedText) for (i in seq_along(p$layers)) if (grepl("Text|Label", class(p$layers[[i]]$geom)[1])) {
    size <- p$layers[[i]]$aes_params$size
    if (is.null(size) && is.null(p$layers[[i]]$mapping$size)) size <- p$layers[[i]]$geom$default_aes$size
    # (isTRUE: some geoms' default size is NA, which ML's decision tree labels have)
    if (is.numeric(size) && length(size) == 1 && isTRUE(size < minSize)) p$layers[[i]]$aes_params$size <- minSize
    if (is.numeric(size) && length(size) == 1 && isTRUE(size > 14 / (2.845 * apaScaleK))) p$layers[[i]]$aes_params$size <- 14 / (2.845 * apaScaleK)
  }
  for (i in seq_along(p$layers)) {           # text drawn in the plot gets the same font as the axes
    # (also ggparty's node labels, GeomNodeLabel: ML's decision tree draws each leaf label twice, once as a plain
    # label and once as a node label, and two fonts pulled the copies apart)
    if (inherits(p$layers[[i]]$geom, c("GeomText", "GeomLabel")) || grepl("Text|Label", class(p$layers[[i]]$geom)[1])) {
      # set in place: the plot comes from our own rerun, and a ggproto child copy of a layer loops in ggplot2 4
      bl <- if (!is.null(built) && i <= length(built$data)) built$data[[i]]$label
      p$layers[[i]]$aes_params$family <- partFamily(glyphs, list(bl, p$layers[[i]]$aes_params$label))
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
    sc <- p$scales$get_scales(a)   # titles set on the scale (a clone of it is renamed: the caller's plot holds the scale)
    if (!is.null(sc) && !is.null(sc$name) && !inherits(sc$name, "waiver") && (is.language(sc$name) || is.expression(sc$name) || (is.character(sc$name) && length(sc$name) == 1))) {
      new <- tryCatch(apaTitleCaseAny(sc$name), error = function(e) sc$name)
      if (!identical(sc$name, new)) {
        changes$add(sprintf("%s '%s' -> '%s'", what, show(sc$name), show(new)))
        sc <- sc$clone(); sc$name <- new
        p$scales <- ownScales(p$scales)
        k <- which(vapply(p$scales$scales, function(x) any(a %in% x$aesthetics), FALSE))
        if (length(k)) p$scales$scales[[k[1]]] <- sc
      }
    }
  }
  if (!is.null(built)) p <- safeStep(p, "category labels (title case, fitting the axis)", changes, function(p) {
    # category tick labels and legend entries in title case (owner decision 1), and group axes whose labels collide
    for (a in c("x", "y", "colour", "fill", "shape", "linetype")) {
      bs <- builtScale(built, a)
      ps <- p$scales$get_scales(a)
      # a number axis that shows names at its ticks (ESCI's "Reference", "Comparison", "Difference")
      if (a == "x" && inherits(bs, "ScaleContinuousPosition") && !is.null(ps) && is.character(ps$labels) && is.numeric(ps$breaks) &&
          length(ps$breaks) == length(ps$labels) && length(ps$labels) >= 2 && any(grepl("[A-Za-z]{2}", ps$labels))) {
        rng <- tryCatch(built$layout$panel_params[[1]]$x$continuous_range, error = function(e) NULL)
        if (!is.numeric(rng) || diff(rng) <= 0) next
        new <- caseLabels(ps$labels)
        fit <- fitCategoryTicks(p, built, new, partFam$axis.text.x, changes, slotFrac = min(diff(sort(ps$breaks))) / diff(rng), pos = ps$breaks)
        p <- fit$p
        if (!identical(new, ps$labels)) changes$add("x axis labels in title case")
        if (!identical(new, ps$labels) || !is.null(fit$wrap) || isTRUE(fit$dodge)) {
          final <- if (is.null(fit$wrap)) new else fit$wrap(new)
          o <- if (isTRUE(fit$dodge)) order(ps$breaks) else seq_along(ps$breaks)
          dodge <- isTRUE(fit$dodge)
          p <- editScale(p, "x", function(s, orig) {
            s$labels <- final[o]; s$breaks <- ps$breaks[o]
            if (dodge) s$guide <- ggplot2::guide_axis(n.dodge = 2)
            s
          })
        }
        next
      }
      if (!inherits(bs, "ScaleDiscrete") || inherits(bs, "ScaleDiscreteIdentity")) next
      old <- tryCatch(bs$get_labels(), error = function(e) NULL)
      if (is.null(old) || !length(old)) next
      new <- caseLabels(old)
      # the labels as the axis shows them, left to right (JASP may give the breaks in another order than the levels)
      shown <- if (a == "x") tryCatch({ vs <- built$layout$panel_params[[1]]$x
        list(l = caseLabels(vs$get_labels()), pos = as.numeric(vs$break_positions()), b = vs$get_breaks()) }, error = function(e) NULL)
      fit <- if (a == "x" && is.character(shown$l) && length(shown$l) == length(shown$pos)) fitCategoryTicks(p, built, shown$l, partFam$axis.text.x, changes, pos = shown$pos)
        else if (a == "x") fitCategoryTicks(p, built, new, partFam$axis.text.x, changes) else list(p = p, wrap = NULL)
      p <- fit$p
      if (identical(old, new) && is.null(fit$wrap) && !isTRUE(fit$dodge)) next
      if (!identical(old, new)) changes$add(sprintf("%s labels in title case", if (a %in% c("x", "y")) paste(a, "axis") else "legend"))
      if (is.null(p$scales$get_scales(a))) { d <- defaultScale(a); if (is.null(d)) next; p <- p + d }
      # (the wrap copied into its own scope: the loop's next aesthetic replaces `fit`, and a closure over it then
      # called NULL, "attempt to apply non-function")
      post <- local({ wrap <- fit$wrap; if (is.null(wrap)) caseLabels else function(v) wrap(caseLabels(v)) })
      dodge <- isTRUE(fit$dodge) && length(shown$b) == length(shown$pos)
      shownBreaks <- if (dodge) shown$b[order(shown$pos)]
      p <- editScale(p, a, function(s, orig) {
        s$labels <- discreteLabels(orig$labels, post)
        if (dodge) { s$breaks <- shownBreaks; s$guide <- ggplot2::guide_axis(n.dodge = 2) }
        s
      })
    }
    # panel headings (facet strips) in title case
    lab <- tryCatch(p$facet$params$labeller, error = function(e) NULL)
    if (is.function(lab) && !inherits(p$facet, "FacetNull")) {
      wrapped <- function(labels) { out <- lab(labels); out[] <- lapply(out, function(v) if (is.character(v)) caseLabels(v) else v); out }
      attributes(wrapped) <- attributes(lab)
      attr(wrapped, "apaJaspLabeller") <- attr(lab, "apaJaspLabeller") %||% lab   # JASP's own, for the note's case
      p$facet <- copyLayer(p$facet)   # the caller's facet is an environment it still holds
      p$facet$params$labeller <- wrapped
    }
    p
  })
  if (!is.null(built)) {
    p <- safeStep(p, "group colours (contrast, shapes and line styles)", changes, function(p) apaContrast(p, built, changes))
    p <- safeStep(p, "light line colours", changes, function(p) darkenSingles(p, changes))
    p <- safeStep(p, "a wide legend in two rows", changes, function(p) legendRows(p, built, changes))
  }
  pieLabels(p, family)
}
# Room on the right (plot points) for the last x tick label, centred on its tick: half its width (all of its height
# when the labels are turned on end), less the panel's own room past the tick; 6 pt at least
rightRoom <- function(p, built, family = apaFamily) {
  th <- tryCatch(ggplot2:::plot_theme(p), error = function(e) NULL)
  el <- tryCatch(ggplot2::calc_element("axis.text.x", th), error = function(e) NULL)
  if (is.null(built) || !inherits(el, "element_text") || !is.numeric(el$size)) return(6)
  if (isTRUE(tryCatch(inherits(built$layout$coord, "CoordFlip"), error = function(e) FALSE))) return(6)
  lay <- built$layout$layout
  right <- if (!is.null(lay$COL)) which(lay$COL == max(lay$COL)) else seq_along(built$layout$panel_params)
  need <- 0
  for (k in right) {
    v <- tryCatch(built$layout$panel_params[[k]]$x, error = function(e) NULL)
    lab <- tryCatch(v$get_labels(), error = function(e) NULL); br <- tryCatch(v$get_breaks(), error = function(e) NULL)
    rng <- tryCatch(v$continuous_range, error = function(e) NULL)
    if (is.null(lab) || !length(lab) || !is.numeric(br) || !is.numeric(rng)) next
    ok <- !is.na(br) & !is.na(lab)
    if (!any(ok)) next
    j <- max(which(ok)); last <- if (is.list(lab) || is.expression(lab)) lab[j] else as.character(lab[j])
    pt <- el$size * apaScaleK
    angle <- if (is.numeric(el$angle)) el$angle %% 180 else 0
    ext <- if (abs(angle - 90) < 20) pt * 1.2 / 72 * (if (is.numeric(el$vjust) && abs(el$vjust - 0.5) < 0.1) 0.5 else 1)
      else textWidthIn(last, pt, family) / 2
    # the panel runs on past the last tick by this share of its width
    past <- if (diff(rng) > 0) (max(rng) - br[j]) / diff(rng) else 0
    panelIn <- if (is.finite(apaPanelIn)) (apaPanelIn - 0.9) / max(lay$COL %||% 1) else 3
    need <- max(need, (ext - past * panelIn) * 72 / apaScaleK)
  }
  max(6, need + 2)
}
# Facets side by side whose x tick labels crowd their narrow panels ("−2−1.5−1"): every other tick from the
# first (the panel's own breaks, worked out per panel as before)
thinFacetTicks <- function(p, built, family, changes) {
  if (is.null(built) || inherits(p$facet, "FacetNull") || is.null(built$layout$layout$COL) || max(built$layout$layout$COL) < 2) return(p)
  sc <- p$scales$get_scales("x")
  if (is.null(sc) || !inherits(sc, "ScaleContinuousPosition")) return(p)
  th <- tryCatch(ggplot2:::plot_theme(p), error = function(e) NULL)
  el <- tryCatch(ggplot2::calc_element("axis.text.x", th), error = function(e) NULL)
  if (!inherits(el, "element_text") || !is.numeric(el$size)) return(p)
  pt <- el$size * apaScaleK
  panelW <- panelWidthIn(p, (if (is.finite(apaPanelIn)) apaPanelIn else 5) / apaScaleK)
  if (!is.finite(panelW)) return(p)
  crowded <- any(vapply(built$layout$panel_params, function(pp) {
    lab <- tryCatch(pp$x$get_labels(), error = function(e) NULL); lab <- lab[!is.na(lab)]
    length(lab) >= 4 && sum(textWidthIn(as.character(lab), pt, family)) + 0.06 * length(lab) > panelW
  }, FALSE))
  if (!crowded) return(p)
  changes$add("crowded x ticks of the side-by-side panels: every other one")
  editScale(p, "x", function(s, orig) {
    s$get_breaks <- function(self, limits = self$get_limits()) {
      # (the parent's method on this copy: free facet scales train each copy on its own panel)
      b <- ggplot2::ggproto_parent(orig, self)$get_breaks(limits)
      ok <- which(!is.na(b))
      if (length(ok) < 5) return(b)   # (never fewer than 3 ticks)
      # (the half that holds zero, when zero is a tick)
      z <- match(TRUE, abs(b[ok]) < 1e-9)
      from <- if (is.na(z)) 1 else 2 - z %% 2
      if (length(seq(from, length(ok), by = 2)) < 3) from <- 1
      drop <- setdiff(ok, ok[seq(from, length(ok), by = 2)])
      b[drop] <- NA
      b
    }
    s
  })
}
facetGap <- function(p, built, family = apaFamily) {
  if (is.null(built) || inherits(p$facet, "FacetNull")) return(0)
  lay <- built$layout$layout
  if (is.null(lay$COL) || max(lay$COL) < 2) return(0)
  th <- tryCatch(ggplot2:::plot_theme(p), error = function(e) NULL)
  el <- tryCatch(ggplot2::calc_element("axis.text.x", th), error = function(e) NULL)
  if (!inherits(el, "element_text") || !is.numeric(el$size) || (is.numeric(el$angle) && abs(el$angle %% 180) > 1)) return(0)
  pt <- el$size * apaScaleK
  panelW <- panelWidthIn(p, (if (is.finite(apaPanelIn)) apaPanelIn else 5) / apaScaleK)
  if (!is.finite(panelW)) return(0)
  # how far each panel's first and last tick labels reach past its sides (inches)
  over <- function(k) {
    v <- built$layout$panel_params[[k]]$x
    lab <- tryCatch(v$get_labels(), error = function(e) NULL); br <- tryCatch(v$get_breaks(), error = function(e) NULL)
    rng <- tryCatch(v$continuous_range, error = function(e) NULL)
    ok <- if (is.numeric(br) && length(lab) == length(br)) which(!is.na(br) & !is.na(lab)) else integer()
    if (!length(ok) || !is.numeric(rng) || diff(rng) <= 0) return(c(0, 0))
    w <- textWidthIn(as.character(lab[c(min(ok), max(ok))]), pt, family) / 2
    c(w[1] - (br[min(ok)] - min(rng)) / diff(rng) * panelW, w[2] - (max(rng) - br[max(ok)]) / diff(rng) * panelW)
  }
  o <- lapply(seq_len(nrow(lay)), function(k) over(lay$PANEL[k]))
  need <- 0
  for (k in seq_len(nrow(lay))) {
    nb <- which(lay$ROW == lay$ROW[k] & lay$COL == lay$COL[k] + 1)
    if (length(nb)) need <- max(need, max(o[[k]][2], 0) + max(o[[nb[1]]][1], 0))
  }
  sp <- tryCatch(grid::convertWidth(ggplot2::calc_element("panel.spacing.x", th), "pt", valueOnly = TRUE), error = function(e) 5.5)
  want <- (need * 72 + 4) / apaScaleK
  if (want > sp) want else 0
}
dataPanels <- function(p) sum(vapply(p$subplots, function(s) inherits(s, "ggplot") &&
  any(!grepl("Text|Label|Blank|RangeFrame", vapply(s$layers, function(l) class(l$geom)[1], ""))), logical(1)))
# Plots of a correlation (rho) or a proportion (theta): every number in their text is bounded by 1, so it loses
# its leading zero ("Median: .653", "95% CI: [.072, .243]"). Bayes factor labels keep theirs: BFs exceed 1.
# A lone number drawn inside a shaded area under a density (jaspDistributions' "highlight probability") is that
# area's probability: it loses its leading zero, while the density values beside the axis keep theirs
areaProbabilityText <- function(g) {
  if (!inherits(g, "ggplot")) return(g)
  areas <- which(vapply(g$layers, function(l) grepl("GeomArea|GeomRibbon", class(l$geom)[1]), FALSE))
  if (!length(areas)) return(g)
  b <- tryCatch(suppressMessages(suppressWarnings(ggplot2::ggplot_build(g))), error = function(e) NULL)
  if (is.null(b)) return(g)
  # only areas down to zero, under a curve: a confidence band (a ribbon from its lower to its upper bound) is not a
  # probability, and a number in it keeps its zero
  areas <- areas[vapply(areas, function(i) { d <- b$data[[i]]; !is.null(d$ymin) && length(d$ymin) && all(abs(d$ymin) < 1e-9, na.rm = TRUE) }, FALSE)]
  if (!length(areas)) return(g)
  ad <- do.call(rbind, lapply(areas, function(i) { d <- b$data[[i]]; data.frame(x = d$x, top = if (!is.null(d$ymax)) d$ymax else d$y) }))
  if (!nrow(ad)) return(g)
  for (i in seq_along(g$layers)) {
    l <- g$layers[[i]]
    if (!grepl("^GeomText$|^GeomLabel$", class(l$geom)[1]) || !is.data.frame(l$data) || nrow(l$data) != 1 || !is.data.frame(b$data[[i]])) next
    d <- b$data[[i]]
    lab <- as.character(d$label); v <- suppressWarnings(as.numeric(lab))
    if (length(v) != 1 || !is.finite(v) || v < 0 || v > 1 || !grepl("^0\\.[0-9]+$", lab)) next
    if (!is.finite(d$x) || d$x < min(ad$x) || d$x > max(ad$x)) next
    top <- stats::approx(ad$x, ad$top, d$x, ties = max)$y
    if (!is.finite(top) || d$y < 0 || d$y > top) next
    # (the column the label is drawn from: an earlier step may have moved it to .apaLabel)
    cols <- intersect(c("label", ".apaLabel"), names(l$data))
    if (!length(cols)) next
    l <- copyLayer(l)
    # (a parsed label, as jaspDistributions draws it, reads ".2" as the number 0.2: it gets the text in quotes)
    parsed <- isTRUE(l$geom_params$parse)
    for (cc in cols) l$data[[cc]] <- vapply(sub("^0\\.", ".", as.character(l$data[[cc]])), function(v) if (parsed) paste0("\"", v, "\"") else v, "", USE.NAMES = FALSE)
    g$layers[[i]] <- l
  }
  g
}
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
    # (and only when the axis's values lie within [-1, 1]: a title alone can mislead)
    rng <- tryCatch(ggplot2::ggplot_build(g)$layout$panel_scales_x[[1]]$range$range, error = function(e) NULL)
    if (is.numeric(rng) && length(rng) == 2 && all(is.finite(rng)) && (min(rng) < -1 - 1e-9 || max(rng) > 1 + 1e-9)) NULL
    else c(words(sc), words(g$labels$x))
  }))
  any(grepl(boundedTitle, titles, ignore.case = TRUE, perl = TRUE))
}
# Text drawn in the plot no bigger than this many points once printed (and still 8 pt or more)
capText <- function(g, pt) {
  most <- pt / (2.845 * apaScaleK)
  for (i in seq_along(g$layers)) if (grepl("Text|Label", class(g$layers[[i]]$geom)[1])) {
    size <- g$layers[[i]]$aes_params$size
    if (is.null(size)) size <- g$layers[[i]]$geom$default_aes$size
    if (is.numeric(size) && length(size) == 1 && isTRUE(size > most)) g$layers[[i]]$aes_params$size <- most
  }
  g
}
# A single plot whose y axis has no title (JASP's one-sample and paired t test plots): the variable's name, when
# the plot's own title is one of the data's variables; otherwise left for the figure note to ask about
nameYAxis <- function(p, plotTitle) {
  if (!inherits(p, "ggplot") || inherits(p, "patchwork")) return(p)
  sc <- p$scales$get_scales("y"); has <- function(v) !is.null(v) && !inherits(v, "waiver") && (!is.character(v) || any(nzchar(trimws(v))))
  if (has(if (!is.null(sc)) sc$name) || has(p$labels$y)) return(p)
  # the variable: the plot's title, or the one label on its x axis (JASP's one-sample plots put it there)
  name <- if (is.character(plotTitle) && length(plotTitle) == 1 && plotTitle %in% apaVariables) plotTitle else {
    lab <- tryCatch(ggplot2::ggplot_build(p)$layout$panel_params[[1]]$x$get_labels(), error = function(e) NULL)
    lab <- if (is.character(lab)) unique(lab[!is.na(lab) & nzchar(lab)]) else character()
    # the plot still holds JASP's encoded names (they are decoded when it's drawn)
    decode <- get0(".decodeColNamesLax", envir = globalenv(), ifnotfound = identity)
    if (length(lab) == 1 && decode(lab) %in% apaVariables) decode(lab) else NULL
  }
  if (!is.null(name)) {
    if (!is.null(sc)) sc$name <- name else p <- p + ggplot2::ylab(name)
    attr(p, "apaChanges") <- c(attr(p, "apaChanges"), sprintf("y axis title '%s' added", name))
  }
  p
}
apaPanelIn <- Inf   # printed width of one panel in a matrix layout, set by figures.R; narrow panels get fewer ticks
apaFigureIn <- c(NA_real_, NA_real_)   # the printed picture's width and height (inches), set by figures.R
# Text in a matrix cell no wider than the cell (8 pt at least), and free to use the cell's empty axis room instead of
# being cut at the panel's edge ("95% CI: [-0.253, 0.1")
fitCellText <- function(q, widthIn, family) {
  if (!is.finite(widthIn)) return(q)
  built <- tryCatch(suppressWarnings(ggplot2::ggplot_build(q))$data, error = function(e) NULL)
  if (is.null(built)) return(q)
  for (j in seq_along(q$layers)) {
    l <- q$layers[[j]]
    if (!grepl("Text|Label", class(l$geom)[1]) || j > length(built) || is.null(built[[j]]$label)) next
    size <- l$aes_params$size
    if (!is.numeric(size) || length(size) != 1 || is.na(size)) next
    pt <- size * 2.845 * apaScaleK
    widest <- max(textWidthIn(built[[j]]$label, pt, family), 0)
    avail <- 0.92 * widthIn
    if (widest > avail) l$aes_params$size <- max(8, pt * avail / widest) / (2.845 * apaScaleK)
  }
  # (a coord of this plot's own: the caller's plot holds the same coord object)
  if (inherits(q$coordinates, "CoordCartesian") && !inherits(q$coordinates, c("CoordFlip", "CoordFixed"))) q$coordinates <- ggplot2::ggproto(NULL, q$coordinates, clip = "off")
  q
}
# Panel letters (owner decision 3): a figure of several plots gets a capital letter at the top left of each. Text
# headers, a pie beside its main plot (JASP's prior and posterior plots) and the small density plots on the margins of a
# scatter plot are parts of one panel; matrix layouts are labelled by their variables' names.
panelLetters <- function(p) {
  if (!inherits(p, "jaspGraphsPlot") || inherits(p, "jaspMatrixPlot") && dataPanels(p) >= 4) return(p)
  drawsData <- function(s) inherits(s, "ggplot") && any(!grepl("Text|Label|Blank|RangeFrame", vapply(s$layers, function(l) class(l$geom)[1], "")))
  polar <- function(s) inherits(s$coordinates, c("CoordPolar", "CoordRadial"))
  data <- which(vapply(p$subplots, drawsData, FALSE))
  main <- data[!vapply(p$subplots[data], polar, FALSE)]
  panels <- if (length(main) >= 2) main else if (!length(main) && length(data) >= 2) data else integer()
  # a scatter plot with its margins: the layout gives the margins a smaller share of the width or height
  widths <- p$plotArgs$widths; heights <- p$plotArgs$heights
  if (length(panels) && (is.numeric(widths) && length(unique(widths)) > 1 || is.numeric(heights) && length(unique(heights)) > 1)) return(p)
  if (length(panels) < 2 || length(panels) > 26) return(p)
  for (k in seq_along(panels)) {
    q <- p$subplots[[panels[k]]]
    q <- q + ggplot2::labs(tag = LETTERS[k])
    # (a little in from the picture's edge: at the edge itself the letter read as cut)
    q <- setElement(q, "plot.tag", ggplot2::element_text(face = "bold", size = 11 / apaScaleK, family = apaFamily, hjust = 0, vjust = 1,
      margin = ggplot2::margin(t = 2 / apaScaleK, l = 4 / apaScaleK, unit = "pt")))
    q <- setElement(q, "plot.tag.position", "topleft")
    p$subplots[[panels[k]]] <- q
  }
  attr(p, "apaPanelLetters") <- LETTERS[seq_along(panels)]
  # each lettered panel's own title, for the note ("Panel A shows ..."); NA where it has none
  title1 <- function(t) if (is.character(t) && length(t) == 1 && nzchar(trimws(t))) t else NA_character_
  attr(p, "apaPanelHeadings") <- vapply(panels, function(i) title1(p$subplots[[i]]$labels$title), "")
  jt <- attr(p, "apaJaspTitles")
  attr(p, "apaPanelHeadingsJasp") <- vapply(panels, function(i) if (i <= length(jt)) title1(jt[[i]]) else NA_character_, "")
  p
}
# The colours a figure's panels share (Bain's pies: one hypothesis, one colour in every panel): each panel stepped on
# its own gave a group a different colour in each. Groups are keyed by JASP's own colour for them. NULL: nothing to
# share, or every panel already reaches 3:1.
sharedColours <- function(p) {
  out <- list()
  subs <- Filter(function(s) inherits(s, "ggplot"), p$subplots)
  if (length(subs) < 2) return(out)
  builds <- lapply(subs, function(s) tryCatch(suppressMessages(suppressWarnings(ggplot2::ggplot_build(s))), error = function(e) NULL))
  for (a in c("fill", "colour")) {
    panels <- list(); alpha <- 1; marks <- FALSE; fails <- FALSE
    for (b in builds) {
      bs <- builtScale(b, a)
      if (!inherits(bs, "ScaleDiscrete") || inherits(bs, "ScaleDiscreteIdentity")) next
      lv <- tryCatch(bs$get_limits(), error = function(e) NULL)
      cols <- tryCatch(bs$map(lv), error = function(e) NULL)
      uses <- aesLayers(b$plot$layers, a)
      if (!length(uses) || !is.character(cols) || anyNA(cols) || length(cols) != length(lv)) next
      if (anyDuplicated(cols)) { panels <- list(); break }
      if (any(vapply(uses, function(l) any(c("shape", "linetype") %in% names(layerMapping(l))), FALSE))) next
      if (a == "fill" && any(vapply(b$plot$layers, function(l) grepl("Text|Label", class(l$geom)[1]), FALSE))) next
      al <- min(vapply(uses, layerAlpha, 1)); alpha <- min(alpha, al)
      marks <- marks || any(vapply(b$plot$layers, function(l) grepl("Errorbar|Boxplot|Linerange|Crossbar|Pointrange", class(l$geom)[1]), FALSE))
      if (length(cols) >= 2 && minPair(wcagLum(cols, al)) < 3) fails <- TRUE
      panels[[length(panels) + 1]] <- cols
    }
    if (length(panels) < 2 || !fails) next
    keys <- unique(unlist(panels))
    if (length(keys) < 2 || length(keys) > 12) next
    core <- vapply(keys, function(k) all(vapply(panels, function(x) k %in% x, FALSE)), FALSE)
    st <- steppedColours(keys, alpha, a == "colour", marks, core)
    out[[a]] <- structure(setNames(st$new, keys), need = if (st$need > alpha) st$need else NULL)
  }
  out
}
# A device to measure a plot on, as the picture is drawn (ragg, which knows the APA font; on pdf(NULL) the plot's
# grobs pick up a font the PostScript device lacks, and drawing them later fails with "invalid font type")
measureDevice <- function(W) {
  f <- tempfile(fileext = ".png")
  ok <- tryCatch({ ragg::agg_png(f, width = W, height = W, units = "in", res = 72); TRUE }, error = function(e) FALSE)
  if (!ok) grDevices::pdf(NULL, width = W, height = W)
}
# A legend below or above the plot, in one row wider than the picture (MetaAnalysis' risk-of-bias summary cut off its
# last key): two rows
legendRows <- function(p, built, changes) {
  W <- if (length(apaFigureIn) == 2 && is.finite(apaFigureIn[1])) apaFigureIn[1] else if (is.finite(apaPanelIn)) apaPanelIn else NA
  if (!is.finite(W) || is.null(built)) return(p)
  th <- tryCatch(ggplot2:::plot_theme(p), error = function(e) NULL)
  pos <- tryCatch(th$legend.position, error = function(e) NULL)
  if (!(is.character(pos) && length(pos) == 1 && pos %in% c("bottom", "top"))) return(p)
  # the legend measured as ggplot draws it, against the picture's width (both at the drawing's own scale)
  Wd <- W / apaScaleK
  old <- grDevices::dev.cur()
  measureDevice(Wd)
  on.exit({ grDevices::dev.off(); if (old > 1) grDevices::dev.set(old) }, add = TRUE)
  # (ggplot centres the legend under the panels, which long axis labels push to the right: the legend runs past the
  # picture's edge when half of it is wider than the room on either side of the panels' centre)
  over <- tryCatch({
    g <- ggplot2::ggplotGrob(p)
    k <- which(g$layout$name == paste0("guide-box-", pos))
    gw <- if (!length(k)) NA_real_ else grid::convertWidth(sum(g$grobs[[k[1]]]$widths), "in", valueOnly = TRUE)
    fixed <- grid::convertWidth(g$widths, "in", valueOnly = TRUE)   # the panels' "null" columns count 0
    pc <- range(c(g$layout$l[grepl("^panel", g$layout$name)], g$layout$r[grepl("^panel", g$layout$name)]))
    panelsW <- Wd - sum(fixed)
    centre <- sum(fixed[seq_len(pc[1] - 1)]) + (sum(fixed[pc[1]:pc[2]]) + panelsW) / 2
    is.finite(gw) && (gw > Wd * 0.98 || gw / 2 > min(centre, Wd - centre) * 0.98)
  }, error = function(e) FALSE)
  if (!isTRUE(over)) return(p)
  for (a in c("fill", "colour")) {
    s <- tryCatch(built$plot$scales$get_scales(a), error = function(e) NULL)
    if (is.null(s) || !inherits(s, "ScaleDiscrete")) next
    labs <- tryCatch(s$get_labels(), error = function(e) NULL)
    if (!is.character(labs) || length(labs) < 3) next
    g <- tryCatch(p$guides$guides[[a]], error = function(e) NULL)
    if (is.character(g) && identical(g, "none")) next
    g2 <- if (inherits(g, "Guide")) ggplot2::ggproto(NULL, g) else ggplot2::guide_legend()
    pr <- g2$params; pr$nrow <- 2L; pr$ncol <- NULL; g2$params <- pr
    p$guides <- copyLayer(p$guides)   # the caller's guides are an environment it still holds
    p <- p + do.call(ggplot2::guides, setNames(list(g2), a))
    changes$add(sprintf("the %s legend in two rows, as one row ran past the picture's edge", a))
    break
  }
  p
}
# The printed width (inches) of the narrowest panel of a plot drawn `W` inches wide: fixed parts (axes, legend,
# strips) first, the rest shared by the panels (JASP's fixed-size plots leave little to them)
panelWidthIn <- function(p, W) {
  old <- grDevices::dev.cur()
  measureDevice(W)
  on.exit({ grDevices::dev.off(); if (old > 1) grDevices::dev.set(old) }, add = TRUE)
  g <- tryCatch(suppressMessages(suppressWarnings(ggplot2::ggplotGrob(p))), error = function(e) NULL)
  if (is.null(g)) return(NA_real_)
  ws <- g$widths
  isNull <- vapply(seq_along(ws), function(i) identical(grid::unitType(ws[i]), "null"), FALSE)
  if (!any(isNull)) return(NA_real_)
  fixed <- sum(vapply(which(!isNull), function(i) tryCatch(grid::convertWidth(ws[i], "in", valueOnly = TRUE), error = function(e) 0), 0))
  cols <- unique(g$layout$l[grepl("^panel", g$layout$name)])
  cols <- cols[isNull[cols]]
  if (!length(cols)) return(NA_real_)
  share <- as.numeric(ws[isNull]); total <- sum(share)
  min(vapply(cols, function(i) (W - fixed) * as.numeric(ws[i]) / total, 0)) * apaScaleK
}
# A short panel in a JASP layout (QC's report: rows a third of an inch tall once angled labels take their room) whose
# y tick labels would touch: 3 even ticks within the axis's range instead
fewerYTicks <- function(q, h, changes) {
  if (!is.finite(h)) return(q)
  b <- tryCatch(suppressMessages(suppressWarnings(ggplot2::ggplot_build(q))), error = function(e) NULL)
  if (is.null(b)) return(q)
  vs <- tryCatch(b$layout$panel_params[[1]]$y, error = function(e) NULL)
  br <- tryCatch(vs$get_breaks(), error = function(e) NULL); rng <- tryCatch(vs$continuous_range, error = function(e) NULL)
  if (!is.numeric(br) || !is.numeric(rng)) return(q)
  br <- br[is.finite(br) & br >= min(rng) - 1e-9 & br <= max(rng) + 1e-9]   # (the ticks drawn)
  if (length(br) < 4) return(q)
  th <- tryCatch(ggplot2:::plot_theme(q), error = function(e) NULL)
  el <- tryCatch(ggplot2::calc_element("axis.text.y", th), error = function(e) NULL)
  if (!is.numeric(el$size)) return(q)
  lineIn <- el$size * apaScaleK * 1.15 / 72
  angled <- tryCatch(abs(ggplot2::calc_element("axis.text.x", th)$angle %||% 0) > 1, error = function(e) FALSE)
  # the panel: the cell less the x axis (angled labels take their width at 45 degrees) and its title
  xl <- tryCatch(as.character(b$layout$panel_params[[1]]$x$get_labels()), error = function(e) character())
  xw <- if (length(xl)) max(textWidthIn(xl[!is.na(xl)], el$size * apaScaleK, apaFamily), 0) else 0
  panelH <- h - (if (angled) 0.71 * xw + 0.45 else 0.55)
  if (length(br) * lineIn * 1.05 <= panelH) return(q)
  # (ticks that take in all of the old ones, so the axis line still runs past the data, as JASP draws it; only its
  # two ends when even 3 would touch)
  nb <- labeling::extended(min(br), max(br), m = 3, only.loose = TRUE)
  if (length(nb) >= 3 && length(nb) * lineIn * 1.05 > panelH) nb <- range(nb)
  if (length(nb) < 2 || length(nb) >= length(br)) return(q)
  changes$add(sprintf("crowded y ticks of a short panel: %d ticks", length(nb)))
  editScale(q, "y", function(s, orig) {
    s$breaks <- nb; s$labels <- trueMinus(format(nb, trim = TRUE, scientific = FALSE))
    lim <- if (is.numeric(orig$limits) && length(orig$limits) == 2) orig$limits else rng
    s$limits <- range(c(lim, nb), na.rm = TRUE)
    s
  })
}
# A legend JASP draws by hand in its own panel (line samples and their names as text: Equivalence's "user, wide,
# ultrawide"): its names in title case like any legend's
handLegend <- function(q, changes) {
  geoms <- vapply(q$layers, function(l) class(l$geom)[1], "")
  if (!length(geoms) || !any(geoms == "GeomText") || !all(geoms %in% c("GeomText", "GeomSegment", "GeomPoint", "GeomLine"))) return(q)
  if (!any(geoms %in% c("GeomSegment", "GeomLine"))) return(q)
  for (l in q$layers[geoms == "GeomText"]) {
    m <- l$mapping$label %||% q$mapping$label
    if (is.null(m)) next
    nm <- setdiff(all.vars(tryCatch(rlang::quo_get_expr(m), error = function(e) m)), ".data")
    d <- if (is.data.frame(l$data) && length(nm) == 1 && nm %in% names(l$data)) "layer" else if (length(nm) == 1 && nm %in% names(q$data)) "plot" else next
    v <- if (d == "layer") l$data[[nm]] else q$data[[nm]]
    if (!is.character(v) && !is.factor(v)) next
    new <- caseLabels(as.character(v))
    if (identical(new, as.character(v))) next
    if (is.factor(v)) new <- factor(new, levels = unique(caseLabels(levels(v))))
    if (d == "layer") l$data[[nm]] <- new else q$data[[nm]] <- new
    changes$add("hand-drawn legend names in title case")
  }
  q
}
# The height (plot points) of the top strips of a plot drawn `W` inches wide
stripHeightPt <- function(p, W) {
  old <- grDevices::dev.cur()
  measureDevice(W)
  on.exit({ grDevices::dev.off(); if (old > 1) grDevices::dev.set(old) }, add = TRUE)
  g <- tryCatch(suppressMessages(suppressWarnings(ggplot2::ggplotGrob(p))), error = function(e) NULL)
  if (is.null(g)) return(NA_real_)
  t <- g$layout$t[grepl("^strip-t", g$layout$name)]
  if (!length(t)) return(NA_real_)
  tryCatch(grid::convertHeight(g$heights[t[1]], "pt", valueOnly = TRUE), error = function(e) NA_real_)
}
# Panel letters on a faceted plot (owner decision 3: every multi-panel figure): a bold capital at each panel's top
# left, just above the panel (beside its heading, where it has one), drawn as a text layer that runs past the panel.
# JASP's own "a) " before a heading (metaBMA) goes: the letter replaces it. Left alone: flipped or zoomed coordinates
# (letters outside the panel need the clipping off, and zoomed data would then spill), polar plots, more than 26
# panels.
facetLetters <- function(p, changes) {
  if (!inherits(p, "ggplot") || inherits(p$facet, "FacetNull")) return(p)
  co <- p$coordinates
  odd <- !inherits(co, "CoordCartesian") || inherits(co, c("CoordFlip", "CoordFixed", "CoordSf")) || !is.null(co$limits$x) || !is.null(co$limits$y)
  built <- tryCatch(suppressMessages(suppressWarnings(ggplot2::ggplot_build(p))), error = function(e) NULL)
  if (is.null(built)) return(p)
  lay <- built$layout$layout
  if (nrow(lay) < 2 || nrow(lay) > 26) return(p)
  if (odd) {
    changes$add("panel letters not added to the facets (flipped, fixed or zoomed axes): add them by hand")
    return(p)
  }
  lay <- lay[order(lay$ROW, lay$COL), , drop = FALSE]
  fp <- p$facet$params
  vars <- intersect(names(lay), c(names(fp$facets), names(fp$rows), names(fp$cols)))
  if (!length(vars)) return(p)
  df <- lay[, vars, drop = FALSE]
  df$.apaLetter <- LETTERS[seq_len(nrow(lay))]
  # each panel's heading as drawn (the labeller's own output: title case, renamed, JASP's "a) " dropped); headings
  # from more than one variable ("mu, 1") are left for the note's to-do (NA)
  unprefix <- function(v) sub("^\\(?[a-z]\\)\\s+", "", v)
  lab <- p$facet$params$labeller
  drawn <- if (is.function(lab)) tryCatch({
    ld <- df[vars]; attr(ld, "facet") <- if (inherits(p$facet, "FacetWrap")) "wrap" else "cols"; attr(ld, "type") <- "cols"
    out <- lab(ld)
    if (length(out) == 1 && is.character(out[[1]]) && length(out[[1]]) == nrow(df)) unprefix(out[[1]]) else NULL
  }, error = function(e) NULL)
  raw <- unprefix(do.call(paste, c(lapply(df[vars], as.character), sep = ", ")))
  heads <- if (length(vars) > 1) rep(NA_character_, nrow(df)) else drawn %||% raw
  # the headings as JASP wrote them, before Coralline's title case: the note lowers only the words Coralline capitalised
  jl <- attr(lab, "apaJaspLabeller") %||% lab
  jaspHeads <- if (is.function(jl)) tryCatch({
    ld <- df[vars]; attr(ld, "facet") <- if (inherits(p$facet, "FacetWrap")) "wrap" else "cols"; attr(ld, "type") <- "cols"
    out <- jl(ld)
    if (length(out) == 1 && is.character(out[[1]]) && length(out[[1]]) == nrow(df)) unprefix(out[[1]]) else NULL
  }, error = function(e) NULL)
  jaspHeads <- if (length(vars) > 1) rep(NA_character_, nrow(df)) else jaspHeads %||% raw
  shownHeads <- drawn %||% raw
  th <- tryCatch(ggplot2:::plot_theme(p), error = function(e) NULL)
  topStrips <- inherits(p$facet, "FacetWrap") && !identical(p$facet$params$strip.position, "bottom") ||
    inherits(p$facet, "FacetGrid") && length(p$facet$params$cols) > 0
  oneWay <- inherits(p$facet, "FacetWrap") || inherits(p$facet, "FacetGrid") && !length(p$facet$params$rows)
  # where the letters go (always bold, at the panel's left): beside a centred heading; before a heading moved to
  # the left when they would meet (at 8 pt if that makes it fit); on a line of their own above a left-aligned
  # heading on panels too narrow for both ("stack")
  place <- "corner"; headPt <- NA
  letterW <- 15 / 72
  if (topStrips) {
    st <- tryCatch(ggplot2::calc_element("strip.text.x", th), error = function(e) NULL)
    panelW <- panelWidthIn(p, (if (is.finite(apaPanelIn)) apaPanelIn else 5) / apaScaleK)
    if (!is.finite(panelW)) panelW <- if (is.finite(apaPanelIn)) (apaPanelIn - 0.9) / max(lay$COL) else 3
    s0 <- if (is.numeric(st$size)) st$size * apaScaleK else NA
    if (is.finite(s0)) {
      sizes <- unique(c(s0, if (s0 > 8) 8))
      for (sz in sizes) {
        hw <- max(textWidthIn(shownHeads, sz, apaFamily), 0)
        if (hw / 2 + letterW + 0.04 <= panelW * 0.95 / 2) { place <- "corner"; headPt <- sz; break }
        # (the strip's own margins, and the panel measured a little wide: 5% off)
        if (hw + letterW + 0.1 <= panelW * 0.95) { place <- "left"; headPt <- sz; break }
        place <- if (oneWay && is.function(lab)) "stack" else "corner"; headPt <- min(sizes)
      }
      if (!is.na(headPt) && abs(headPt - s0) > 0.01) p <- setElement(p, "strip.text.x", ggplot2::element_text(size = headPt / apaScaleK))
    }
  }
  if (place == "stack") {
    # a heading wider than its panel: wrapped at its spaces first, then after a hyphen it already has
    # ("Between-" / "Study"), and only as a last resort a long word split with a hyphen of its own
    # (the heading is left-aligned 1 pt in from the panel's edge; 10% kept free so a line's last letter, or a hyphen,
    # never runs into the next panel)
    wide <- function(h, pt = headPt) textWidthIn(h, pt, apaFamily) > panelW * 0.9 - 1 / 72
    # before any word is split, the heading shrinks (to 7 pt at the least) until its longest word fits
    words0 <- unlist(strsplit(unprefix(as.character(shownHeads)), "[ \n-]"))
    words0 <- words0[nzchar(words0)]
    if (length(words0) && any(vapply(words0, wide, FALSE))) {
      for (pt in seq(headPt, 7, by = -0.5)) { headPt <- pt; if (!any(vapply(words0, wide, FALSE, pt = pt))) break }
      p <- setElement(p, "strip.text.x", ggplot2::element_text(size = headPt / apaScaleK))
    }
    vowel <- function(x) grepl("[aeiouyAEIOUY]", x)
    split <- function(h) {
      if (!wide(h)) return(h)
      words <- unlist(lapply(strsplit(h, " ", fixed = TRUE)[[1]], function(w) {
        if (!wide(w)) return(w)
        parts <- regmatches(w, gregexpr("[^-]+-?", w))[[1]]   # "Between-", "Study"
        if (length(parts) > 1 && !any(vapply(parts, wide, FALSE))) return(paste(parts, collapse = "\u0001"))
        # the last resort: a hyphen of its own, at a suffix if there is one, and only where both halves have a vowel
        # ("Between-ness", never "Stre-ngth"); a word with no such place stays whole
        m <- regexpr("(ness|ment|tion|sion|ity|ance|ence|ing|ship|ality)$", w)
        ks <- unique(c(if (m > 3) m - 1, ceiling(nchar(w) / 2) + c(0, -1, 1, -2, 2, -3, 3)))
        ks <- ks[ks >= 2 & ks <= nchar(w) - 2]
        # (the first half, with its hyphen, may use the panel's whole width: the strip doesn't clip it)
        ok <- ks[vapply(ks, function(k) vowel(substr(w, 1, k)) && vowel(substr(w, k + 1, nchar(w))) &&
          textWidthIn(paste0(substr(w, 1, k), "-"), headPt, apaFamily) <= panelW - 1 / 72, FALSE)]
        if (!length(ok)) return(w)
        k <- ok[1]
        paste0(substr(w, 1, k), "-\u0001", substr(w, k + 1, nchar(w)))
      }))
      # greedy lines: pieces joined by a space, or with nothing after a hyphen (\u0001 marks such a break)
      tokens <- unlist(lapply(words, function(w) { t <- strsplit(w, "\u0001", fixed = TRUE)[[1]]; if (length(t) > 1) c(paste0(head(t, -1), "\u0002"), tail(t, 1)) else t }))
      lines <- character(); cur <- ""
      for (t in tokens) {
        glue <- endsWith(t, "\u0002"); t <- sub("\u0002$", "", t)
        sep <- if (!nzchar(cur) || endsWith(cur, "\u0002")) "" else " "
        trial <- paste0(sub("\u0002$", "", cur), sep, t)
        if (nzchar(cur) && wide(trial)) { lines <- c(lines, sub("\u0002$", "", cur)); cur <- t } else cur <- trial
        if (glue) cur <- paste0(cur, "\u0002")
      }
      paste(c(lines, sub("\u0002$", "", cur)), collapse = "\n")
    }
  }
  # JASP's "a) " before each heading: the letters stand in for it
  if (is.function(lab)) {
    stack <- place == "stack"
    plain <- function(labels) {
      out <- lab(labels)
      out[] <- lapply(out, function(v) if (is.character(v)) unprefix(v) else v)
      if (stack && is.character(out[[1]])) out[[1]] <- vapply(out[[1]], split, "", USE.NAMES = FALSE)
      out
    }
    attributes(plain) <- attributes(lab)
    p$facet <- copyLayer(p$facet)   # the caller's facet is an environment it still holds
    p$facet$params$labeller <- plain
  }
  sm <- if (topStrips) st$margin
  if (!inherits(sm, "unit") || length(sm) != 4) sm <- ggplot2::margin()
  if (place == "left") p <- setElement(p, "strip.text.x", ggplot2::element_text(hjust = 0, margin = sm + grid::unit(c(0, 0, 0, 15 / apaScaleK), "pt")))
  if (place == "stack") {
    p <- setElement(p, "strip.text.x", ggplot2::element_text(hjust = 0, margin = sm * c(1, 1, 1, 0) + grid::unit(c(0, 0, 0, 1), "pt")))
    # a heading's last letter or hyphen is never cut off at the strip's edge
    p <- tryCatch(p + ggplot2::theme(strip.clip = "off"), error = function(e) p)
  }
  size <- 11 / (2.845 * apaScaleK)
  vj <- -0.35
  if (place == "stack") {
    # the letter above the heading: up from the panel by the strip's height and 2 pt (room made above each row)
    sh <- stripHeightPt(p, (if (is.finite(apaPanelIn)) apaPanelIn else 5) / apaScaleK)
    h <- 0.72 * 11 / apaScaleK
    if (is.finite(sh)) vj <- -(sh + 2 / apaScaleK) / h
  }
  p <- p + ggplot2::geom_text(data = df[c(vars, ".apaLetter")], mapping = ggplot2::aes(x = -Inf, y = Inf, label = .apaLetter), inherit.aes = FALSE,
    hjust = 0, vjust = vj, fontface = "bold", size = size, family = apaFamily)
  p$coordinates <- ggplot2::ggproto(NULL, co, clip = "off")
  if (!topStrips || place == "stack") {
    # room above every row for the letters: plots without headings above their panels (facet_grid with row headings
    # only) have only the panels' spacing between rows
    room <- grid::unit(11 / apaScaleK * 1.3, "pt")
    sp <- tryCatch(ggplot2::calc_element("panel.spacing.y", th), error = function(e) NULL)
    if (inherits(sp, "unit")) p <- setElement(p, "panel.spacing.y", sp + room)
    m <- tryCatch(ggplot2::calc_element("plot.margin", th), error = function(e) NULL)
    if (inherits(m, "unit") && length(m) == 4) p <- setElement(p, "plot.margin", m + grid::unit.c(room, grid::unit(c(0, 0, 0), "pt")))
  }
  attr(p, "apaPanelHeadings") <- heads
  attr(p, "apaPanelHeadingsJasp") <- jaspHeads
  attr(p, "apaPanelLetters") <- df$.apaLetter
  changes$add(sprintf("panel letters %s added to the facets", paste(df$.apaLetter, collapse = ", ")))
  p
}
apaPlot <- function(p) {
  # measuring text and units opens R's default device when none is open (a pdf, "Rplots.pdf" in Rscript); left open,
  # it becomes the current device when a later device closes (jaspBase's decodeplot closes its own png), and the
  # picture is then drawn on the pdf, which lacks the APA font ("invalid font type"). Devices opened here are closed.
  devs <- grDevices::dev.list(); cur <- grDevices::dev.cur()
  on.exit({
    for (d in setdiff(grDevices::dev.list(), devs)) grDevices::dev.off(d)
    if (cur > 1 && cur %in% grDevices::dev.list()) grDevices::dev.set(cur)
  }, add = TRUE)
  changes <- local({ v <- character(); list(add = function(x) v <<- c(v, x), get = function() v, set = function(x) v <<- x) })
  bounded <- isBoundedPlot(p)
  if (inherits(p, "ggplot")) {
    p <- apaGgplot(p, changes)
    p <- safeStep(p, "zeros on bounded values", changes, function(p) areaProbabilityText(fillBreaks(boundedText(p, bounded))))
    p <- safeStep(p, "panel letters", changes, function(p) facetLetters(p, changes))
  }
  else if (inherits(p, "jaspGraphsPlot")) {
    # the panels' titles as JASP wrote them, before any restyling (the note's sentence case)
    attr(p, "apaJaspTitles") <- lapply(p$subplots, function(q) if (inherits(q, "ggplot")) q$labels$title else NULL)
    apaShared <<- sharedColours(p)
    on.exit(apaShared <<- list(), add = TRUE)
    if (any(vapply(p$subplots, keyPanel, FALSE))) {
      apaKeyPanel <<- TRUE
      on.exit(apaKeyPanel <<- FALSE, add = TRUE)
      changes$add("group colours and shapes kept as JASP drew them: the figure's legend is a panel of its own, and it must match the plot")
    }
    # each panel's own printed width from JASP's layout (its columns' share of the picture): the guess figures.R
    # makes (a square grid) is far off for reports laid out in 2 columns of 6 rows
    gridIn <- apaPanelIn
    on.exit(apaPanelIn <<- gridIn, add = TRUE)
    lay <- tryCatch(p$plotArgs$layout, error = function(e) NULL); wd <- tryCatch(p$plotArgs$widths, error = function(e) NULL)
    cellIn <- function(i) {
      if (!is.matrix(lay) || length(apaFigureIn) != 2 || !all(is.finite(apaFigureIn))) return(gridIn)
      cc <- unique(which(lay == i, arr.ind = TRUE)[, 2])
      if (!length(cc)) return(gridIn)
      ws <- if (is.numeric(wd) && length(wd) == ncol(lay)) wd else rep(1, ncol(lay))
      apaFigureIn[1] * sum(ws[cc]) / sum(ws)
    }
    hs <- tryCatch(p$plotArgs$heights, error = function(e) NULL)
    cellH <- function(i) {
      if (!is.matrix(lay) || length(apaFigureIn) != 2 || !all(is.finite(apaFigureIn))) return(NA_real_)
      rr <- unique(which(lay == i, arr.ind = TRUE)[, 1])
      if (!length(rr)) return(NA_real_)
      h <- if (is.numeric(hs) && length(hs) == nrow(lay)) hs else rep(1, nrow(lay))
      apaFigureIn[2] * sum(h[rr]) / sum(h)
    }
    # (the tick-label fitting keeps figures.R's narrower guess: it measures labels smaller than JASP draws them in
    # these reports, so a wider panel let "Operator A" run into "Operator B")
    for (i in seq_along(p$subplots)) if (inherits(p$subplots[[i]], "ggplot")) {
      q <- apaGgplot(p$subplots[[i]], changes)
      q <- safeStep(q, "zeros on bounded values", changes, function(q) boundedText(q, bounded))
      q <- safeStep(q, "legend names in title case", changes, function(q) handLegend(q, changes))
      # matrix layouts: little room per panel, so fewer ticks and text in the panels at 9 pt (JASP sizes it for its
      # own, larger panels; "r = .43" and "rho = .46" then overlap)
      if (dataPanels(p) >= 4) {
        q <- safeStep(q, "fewer ticks and smaller text in a matrix", changes, function(q) capText(thinBreaks(q), 9))
        # more room on the right: the last column's end tick label ("800") is centred on the panel's edge
        # (only on panels that draw data: a text-only cell's label fills it, and a margin would cut the label)
        drawsData <- any(!grepl("Text|Label|Blank|RangeFrame", vapply(q$layers, function(l) class(l$geom)[1], "")))
        m <- tryCatch(ggplot2::calc_element("plot.margin", ggplot2:::plot_theme(q)), error = function(e) NULL)
        if (drawsData && !is.null(m)) q <- setElement(q, "plot.margin", m + grid::unit(c(0, 8, 0, 0), "pt"))
        if (!drawsData) q <- safeStep(q, "text fitted to its cell", changes, function(q) fitCellText(q, apaPanelIn, apaFamily))
      }
      q <- safeStep(q, "fewer ticks on a short panel", changes, function(q) fewerYTicks(q, cellH(i), changes))
      p$subplots[[i]] <- q
    }
    apaPanelIn <<- gridIn
    p <- safeStep(p, "panel letters", changes, panelLetters)
    if (length(attr(p, "apaPanelLetters"))) changes$add(sprintf("panel letters %s added", paste(attr(p, "apaPanelLetters"), collapse = ", ")))
    else {
      # one faceted plot in the figure (with headers or margins beside it): letters on its facets
      data <- which(vapply(p$subplots, function(s) inherits(s, "ggplot") && !inherits(s$facet, "FacetNull"), FALSE))
      if (length(data) == 1 && dataPanels(p) == 1) {
        apaPanelIn <<- cellIn(data)
        q <- safeStep(p$subplots[[data]], "panel letters", changes, function(q) facetLetters(q, changes))
        apaPanelIn <<- gridIn
        if (length(attr(q, "apaPanelLetters"))) {
          attr(p, "apaPanelLetters") <- attr(q, "apaPanelLetters"); attr(p, "apaPanelHeadings") <- attr(q, "apaPanelHeadings")
          attr(p, "apaPanelHeadingsJasp") <- attr(q, "apaPanelHeadingsJasp")
          p$subplots[[data]] <- q
        }
      }
    }
  }
  attr(p, "apaChanges") <- changes$get()
  p
}

# What a plot actually draws, for the figure note: error bars, bands, text in the plot, titles, legends, panels.
plotFacts <- function(p) {
  one <- function(g) {
    # the panel letters drawn as a text layer (facetLetters) are not the plot's own text
    g$layers <- Filter(function(l) !(is.data.frame(l$data) && ".apaLetter" %in% names(l$data)), g$layers)
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
      if (is.expression(v) && length(v) == 1) v <- v[[1]]   # ggplot2 4 keeps some titles as expression(...)
      if (is.character(v)) v[1] else if (is.null(v)) NA_character_ else paste(deparse(v), collapse = "")
    }
    # points in a box plot: outliers (every point beyond its box's whiskers, as JASP's Descriptives draws them in a
    # layer of their own) or individual scores (jittered)
    boxOutliers <- local({
      box <- which(vapply(g$layers, function(l) inherits(l$geom, "GeomBoxplot"), FALSE))
      pts <- which(vapply(g$layers, function(l) inherits(l$geom, "GeomPoint") && !inherits(l$position, "PositionJitter"), FALSE))
      if (!length(box) || !length(pts) || max(c(box, pts)) > length(built)) return(FALSE)
      b <- built[[box[1]]]
      all(vapply(pts, function(j) {
        d <- built[[j]]; if (!nrow(d) || is.null(d$x) || is.null(d$y)) return(FALSE)
        all(vapply(seq_len(nrow(d)), function(k) {
          r <- b[which.min(abs(b$x - d$x[k])), ]
          isTRUE(d$y[k] < r$ymin - 1e-9 || d$y[k] > r$ymax + 1e-9)
        }, FALSE))
      }, FALSE))
    })
    # an axis the plot hides (JASP's dot plots hide the count axis) needs no title
    th <- tryCatch(ggplot2:::plot_theme(g), error = function(e) NULL)
    hidden <- function(a) !is.null(th) && isTRUE(tryCatch(inherits(ggplot2::calc_element(paste0("axis.text.", a), th), "element_blank"), error = function(e) FALSE))
    tag <- g$labels$tag
    list(geoms = unique(geoms), x = lab("x"), y = lab("y"), colour = lab("colour"), fill = lab("fill"), shape = lab("shape"),
         linetype = lab("linetype"), text = unique(txt), xHidden = hidden("x"), yHidden = hidden("y"), boxOutliers = boxOutliers,
         panelLetter = if (is.character(tag) && length(tag) == 1) tag else NULL)
  }
  if (inherits(p, "ggplot")) return(list(panels = 1L, plots = list(one(p)), panelLetters = attr(p, "apaPanelLetters"),
    panelHeadings = attr(p, "apaPanelHeadings"), panelHeadingsJasp = attr(p, "apaPanelHeadingsJasp")))
  if (inherits(p, "jaspGraphsPlot")) {
    subs <- Filter(function(s) inherits(s, "ggplot"), p$subplots)
    # unnamed: jaspGraphsPlot names its subplots (mainPlot, ...), and a named list becomes a JSON object, not an array
    # panelLetters: the capital letters drawn at the panels' top left (owner decision 3), in order, for the note
    return(list(panels = length(subs), plots = unname(lapply(subs, one)), panelLetters = attr(p, "apaPanelLetters"),
      panelHeadings = attr(p, "apaPanelHeadings"), panelHeadingsJasp = attr(p, "apaPanelHeadingsJasp")))
  }
  list(panels = NA, plots = list(), class = class(p)[1])
}

# The facts as JSON arrays: jsonlite's auto_unbox writes a list of one as a bare string ("geoms": "GeomPoint"),
# and a named list (jaspGraphsPlot's subplots) as an object. Run after decoding: rapply skips AsIs vectors.
factsArrays <- function(f) {
  if (!is.list(f) || is.null(f$plots)) return(f)
  if (!is.null(f$panelLetters)) f$panelLetters <- I(as.character(f$panelLetters))
  # one heading per letter, null where unknown (written with na = "null")
  if (!is.null(f$panelHeadings)) f$panelHeadings <- I(as.character(f$panelHeadings))
  if (!is.null(f$panelHeadingsJasp)) f$panelHeadingsJasp <- I(as.character(f$panelHeadingsJasp))
  f$plots <- unname(lapply(f$plots, function(p) {
    for (k in c("geoms", "text")) if (!is.null(p[[k]])) p[[k]] <- I(as.character(p[[k]]))
    p
  }))
  f
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
# "r = 0.578", "p < 0.001", and plotmath like italic(r) ~ "=" ~ "0.578"
boundedStat <- function(l) is.character(l) & grepl("^\\s*(italic\\()?(r|rho|tau|p|R\\^2|R\\^\\{2\\}|R²|ρ|τ)\\)?\\s*(~\\s*\"?)?\\s*(=|==|<|>)", l)
noLeadingZero <- function(l) {
  if (!is.character(l)) return(l)
  bounded <- boundedStat(l)
  l[bounded] <- gsub("(^|[^0-9.])(-|\u2212)?0\\.([0-9])", "\\1\\2.\\3", l[bounded])
  l
}
# Crowded multi-panel axes: keep every other tick number (first and last stay, so the axis spans the same range)
# An axis showing fewer than 3 numbers (JASP's one-sample plot: "8" and "16") can't be read: evenly spaced ticks
# between the same two ends (8, 10, 12, 14, 16), only when such ticks land exactly on both ends
# Plain tick labels: true minus signs, and no leading zero on an axis whose values can't exceed 1 (apaScales)
tickFormat <- function(sc) {
  bounded <- isTRUE(sc$apaBounded)
  # (a bounded axis keeps its decimals together, so zero reads ".0" beside ".5", not "0")
  function(x) { l <- trueMinus(format(x, trim = TRUE, drop0trailing = !bounded, scientific = FALSE)); if (bounded) dropZero(l) else l }
}
fillBreaks <- function(p) {
  for (a in c("x", "y")) {
    sc <- p$scales$get_scales(a)
    if (is.null(sc) || !inherits(sc, "ScaleContinuous") || !is.numeric(sc$breaks) || length(sc$breaks) != 2) next
    tr <- tryCatch(sc$get_transformation()$name, error = function(e) "identity")
    if (!identical(tr, "identity") || !(inherits(sc$labels, "waiver") || is.function(sc$labels))) next
    b <- sort(sc$breaks); nb <- pretty(b, n = 4)
    if (length(nb) >= 3 && isTRUE(all.equal(range(nb), b))) {
      sc$breaks <- nb
      sc$labels <- tickFormat(sc)
    }
  }
  p
}
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
    most <- if (max(nchar(format(abs(b), trim = TRUE, scientific = FALSE, drop0trailing = TRUE))) >= 4 || apaPanelIn < 1.3) 3 else 5
    steps <- Filter(function(st) (n - 1) %% st == 0 && (n - 1) / st + 1 <= most && (n - 1) / st + 1 >= 3, seq_len(n - 1))
    lab <- sc$labels
    if (length(steps) > 0) {
      keep <- seq(1, n, by = steps[1])
      sc$breaks <- b[keep]
      if ((is.character(lab) || is.numeric(lab)) && length(lab) == n) sc$labels <- trueMinus(lab[keep])
      else if (!inherits(lab, "waiver")) sc$labels <- tickFormat(sc)
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
      sc$labels <- tickFormat(sc)
    }
  }
  p
}
# plotmath ("italic(r) ~ \"=\" ~ \"-0.3\""): true minus only inside the quoted parts, so the label still parses
quotedMap <- function(v, f) vapply(v, function(x) {
  if (is.na(x)) return(x)   # missing labels (ML's decision tree has some)
  # quoted parts in double or single quotes (LearnBayes: 'mean'==' 0.500; '~'95% CI':' [0.050, 0.950] ')
  m <- gregexpr("\"[^\"]*\"|'[^']*'", x)
  regmatches(x, m) <- lapply(regmatches(x, m), function(q) paste0(substr(q, 1, 1), f(substr(q, 2, nchar(q) - 1)), substring(q, nchar(q))))
  x
}, "", USE.NAMES = FALSE)
quotedMinus <- function(v) quotedMap(v, trueMinus)
# An interval in APA's form, "95% CI [LL, UL]": no colon (6.43). In plotmath only inside the quoted parts
ciColon <- function(v) { v <- gsub("(CI|HDI|CrI):\\s*\\[", "\\1 [", v); sub("(CI|HDI|CrI):$", "\\1", v) }
# plotmath: a colon between two quoted parts ('95% CI':' [0.05, 0.95]') too, the parts then simply joined
plotmathColon <- function(v) quotedMap(gsub("(CI|HDI|CrI)(['\"])\\s*:\\s*(['\"])", "\\1\\2*\\3", v), ciColon)
# A confidence interval in text ("95% CI: [-0.253, 0.139]"): its numbers lose their zeros next to a correlation
ciZero <- function(v) {
  if (!is.character(v)) return(v)
  ci <- grepl("CI", v) & grepl("\\[", v) & !grepl("BF", v)
  v[ci] <- gsub("(^|[^0-9.])(-|−)?0\\.([0-9])", "\\1\\2.\\3", v[ci])
  v
}
# Numbers drawn at their own value on an axis that can't exceed 1 (Distributions' CDF plots write "0.08" beside the
# probability axis, at height .08): they read as that axis's values, so they lose the zero as its ticks do
axisValues <- function(p, l, d, v) {
  if (!is.character(v) || !nrow(d)) return(v)
  for (a in c("y", "x")) {
    sc <- p$scales$get_scales(a)
    if (is.null(sc) || !isTRUE(sc$apaBounded)) next
    map <- l$mapping[[a]]; if (is.null(map) && !isFALSE(l$inherit.aes)) map <- p$mapping[[a]]
    pos <- if (is.null(map)) NULL else tryCatch(rlang::eval_tidy(map, d), error = function(e) NULL)
    if (!is.numeric(pos) || !(length(pos) %in% c(1, length(v)))) next
    num <- suppressWarnings(as.numeric(sub("\u2212", "-", gsub('"', "", trimws(v)))))
    dec <- nchar(sub("^[^.]*\\.?", "", gsub('"', "", trimws(v))))
    at <- !is.na(num) & abs(num) <= 1 & abs(num - rep_len(pos, length(v))) <= 0.5 * 10^-dec + 1e-9
    v[at] <- sub("(^\"?)(\u2212|-)?0\\.", "\\1\\2.", trimws(v[at]))
  }
  v
}
# A correlation heat map (JASP's Regression correlation heatmaps): tiles over the same variables on both axes, its
# legend often hidden and untitled, so the fill scale can't tell
corrHeatmap <- function(p) {
  tiles <- which(vapply(p$layers, function(l) grepl("Tile|Raster", class(l$geom)[1]), FALSE))
  if (!length(tiles)) return(FALSE)
  b <- tryCatch(suppressMessages(suppressWarnings(ggplot2::ggplot_build(p))), error = function(e) NULL)
  if (is.null(b)) return(FALSE)
  pp <- b$layout$panel_params[[1]]
  lx <- tryCatch(pp$x$get_labels(), error = function(e) NULL); ly <- tryCatch(pp$y$get_labels(), error = function(e) NULL)
  square <- is.character(lx) && is.character(ly) && length(lx) >= 2 && setequal(lx, ly) &&
    isTRUE(tryCatch(pp$x$is_discrete() && pp$y$is_discrete(), error = function(e) FALSE))
  if (!square) return(FALSE)
  # the values behind the fill: all within [-1, 1] (a covariance or distance matrix keeps its zeros)
  fill <- tryCatch({ l <- p$layers[[tiles[1]]]; m <- l$mapping$fill; if (is.null(m) && !isFALSE(l$inherit.aes)) m <- p$mapping$fill
    d <- if (is.data.frame(l$data)) l$data else p$data; rlang::eval_tidy(m, d) }, error = function(e) NULL)
  if (!is.numeric(fill) || !any(is.finite(fill)) || any(abs(fill[is.finite(fill)]) > 1 + 1e-9)) return(FALSE)
  # and a sign that the values are correlations: a fill title naming one, or a diagonal of ones (or left blank)
  title <- titleText(scaleTitle(p, p$scales$get_scales("fill") %||% list(name = NULL), "fill"))
  # (a legend without a title: the name of the column the fill shows, JASP's "cor")
  if (!nzchar(title)) title <- tryCatch({ l <- p$layers[[tiles[1]]]; m <- l$mapping$fill %||% p$mapping$fill; rlang::as_label(m) }, error = function(e) "")
  if (grepl("^\\s*(r|rho|tau|\u03c1|\u03c4)\\s*$|corr|\\bcor\\b|kendall|spearman|pearson", title, ignore.case = TRUE)) return(TRUE)
  d <- b$data[[tiles[1]]]
  lab <- function(a, v) { l <- if (a == "x") lx else ly; br <- pp[[a]]$get_breaks(); l[match(round(v), seq_along(br))] }
  diag <- tryCatch(lab("x", d$x) == lab("y", d$y), error = function(e) NULL)
  if (is.null(diag) || length(diag) != length(fill)) return(FALSE)
  # (diagonal cells there, at least one of them a 1, and none anything else: a square alone is no sign)
  dv <- fill[diag %in% TRUE]
  length(dv) > 0 && any(abs(dv - 1) < 1e-9, na.rm = TRUE) && all(is.na(dv) | abs(dv - 1) < 1e-9)
}
isNumberText <- function(v) is.character(v) && length(v) > 0 && all(grepl("^\\s*[-−]?[0-9]*\\.?[0-9]+\\s*$", v[!is.na(v) & nzchar(v)]))
apaText <- function(p) {
  if (is.data.frame(p$data)) for (col in names(p$data)) if (is.character(p$data[[col]])) p$data[[col]] <- noLeadingZero(p$data[[col]])
  texts <- Filter(function(l) grepl("Text|Label", class(l$geom)[1]), p$layers)
  # text next to a correlation (JASP's correlation matrix: "r = .43" over "95% CI: [...]"): its intervals are
  # correlations too
  mapped <- function(l) {   # a label mapped to a variable of JASP's own code (aes(label = lab))
    map <- l$mapping$label
    if (is.null(map) && !isFALSE(l$inherit.aes)) map <- p$mapping$label
    d <- if (is.data.frame(l$data)) l$data else if (is.data.frame(p$data)) p$data else data.frame()
    v <- if (is.null(map)) NULL else tryCatch(rlang::eval_tidy(map, d), error = function(e) NULL)
    if (is.character(v)) v
  }
  labelsOf <- function(l) c(mapped(l), if (is.character(l$aes_params$label)) l$aes_params$label,
    unlist(lapply(list(if (is.data.frame(l$data)) l$data, if (inherits(l$data, "waiver")) p$data), function(d)
      if (is.data.frame(d)) unlist(Filter(is.character, as.list(d))))))
  # an interval is a correlation's when the same layer names r, or the plot is a text cell (JASP's correlation
  # matrix: "r = .43" over "95% CI [...]" in layers of their own)
  textCell <- length(p$layers) > 0 && all(grepl("Text|Label|Blank", vapply(p$layers, function(l) class(l$geom)[1], "")))
  corrCell <- textCell && any(vapply(texts, function(l) any(boundedStat(labelsOf(l))), FALSE))
  # numbers in a plot coloured by a correlation (JASP's correlation heatmap) can't exceed 1 either
  boundedFill <- any(vapply(p$scales$scales, function(s) any(s$aesthetics %in% c("fill", "colour")) && isTRUE(s$apaBounded), FALSE)) ||
    corrHeatmap(p)
  for (l in texts) {
    corr <- corrCell || any(boundedStat(labelsOf(l)))
    fix <- function(v) {
      v <- noLeadingZero(v)
      if (!is.character(v)) return(v)
      if (corr) v <- ciZero(v)
      parse <- isTRUE(l$geom_params$parse)
      v <- if (parse) plotmathColon(v) else ciColon(v)
      v <- if (parse) quotedMinus(v) else trueMinus(v)
      if (boundedFill && isNumberText(v) && all(abs(suppressWarnings(as.numeric(sub("\u2212", "-", v[!is.na(v) & nzchar(v)])))) <= 1, na.rm = TRUE))
        v <- dropZero(trimws(v))
      v
    }
    if (is.character(l$aes_params$label)) l$aes_params$label <- fix(l$aes_params$label)
    # a text layer without data of its own draws the plot's data (JASP's prior/posterior headers do)
    if (inherits(l$data, "waiver") && is.data.frame(p$data))
      for (col in names(p$data)) if (is.character(p$data[[col]])) p$data[[col]] <- fix(p$data[[col]])
    if (is.data.frame(l$data)) for (col in names(l$data)) if (is.character(l$data[[col]])) l$data[[col]] <- fix(l$data[[col]])
    # a label mapped to a variable in JASP's own code (aes(label = lab)), also through the plot's own mapping: evaluate
    # it once and keep the fixed text. Numbers become text as ggplot would draw them ("-0.059"), then get fixed.
    map <- l$mapping$label
    if (is.null(map) && !isFALSE(l$inherit.aes)) map <- p$mapping$label
    own <- is.data.frame(l$data) && nrow(l$data) > 0
    d <- if (own) l$data else if (inherits(l$data, "waiver") && is.data.frame(p$data) && nrow(p$data) > 0) p$data
    if (!is.null(map) && !is.null(d)) {
      val <- tryCatch(rlang::eval_tidy(map, d), error = function(e) NULL)
      if (is.numeric(val) && !is.null(attr(val, "class"))) val <- NULL   # dates and other classes draw their own way
      if (is.numeric(val)) val <- as.character(val)
      # a list of single strings (ggparty's decision tree edges: parse_signs gives one per node)
      if (is.list(val) && length(val) && all(vapply(val, function(x) is.character(x) && length(x) == 1, FALSE))) val <- unlist(val)
      if (is.character(val) && (length(val) == 1 || length(val) == nrow(d))) {
        fixed <- axisValues(p, l, d, fix(val))
        if (own) l$data$.apaLabel <- fixed
        else {   # the plot's data: a layer of its own data keeps the other layers as they were
          l$data <- d; l$data$.apaLabel <- fixed
        }
        l$mapping$label <- ggplot2::aes(label = .apaLabel)$label
      }
    }
  }
  p
}
