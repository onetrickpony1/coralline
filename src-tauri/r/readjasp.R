# Reads the data of a .jasp file as JASP gives it to an analysis, like src-tauri/src/data.rs. Two layouts of DataSet_1:
# - JASP 0.97 and later (and a few late 0.96 files): one column per variable, Column_<id>, holding a label code
#   (Labels.value) for a column with labels and the value itself for one without.
# - JASP 0.95 and 0.96 (archive version 5): two columns per variable, Column_<id>_INT (the label code) and
#   Column_<id>_DBL (the value as a double, or the text "nan" or "inf"). This follows 0.96's own reading
#   (Column::dataAsRLevels and dataAsRDoubles): groups from the codes in label order, scale columns from the doubles.
# Missing-value strings are the data set's list joined with a column's own list (EmptyValues: a column list adds
# to its parent's). dropLevels is 0 (no choice yet), 1 (drop) or 2 (keep); only 2 keeps unused groups.

# A number as JASP reads text (ColumnUtils::getDoubleValue): "∞", "inf", "infinity", "nan" and plain decimals
jaspParseNumber <- function(s) {
  s <- as.character(s)
  out <- rep(NA_real_, length(s))
  ok <- !is.na(s) & grepl("^[+-]?(([0-9]+\\.?[0-9]*|\\.[0-9]+)([eE][+-]?[0-9]+)?|[iI][nN][fF]([iI][nN][iI][tT][yY])?|[nN][aA][nN])$", s)
  dec <- ok & grepl("[0-9]", s)
  out[ok & !dec] <- suppressWarnings(as.numeric(s[ok & !dec]))   # inf, infinity, nan
  out[dec] <- jaspDecimal(s[dec])
  out[!is.na(s) & s == "\u221e"] <- Inf
  out[!is.na(s) & s == "-\u221e"] <- -Inf
  out
}

# Decimals parsed to the nearest double, as JASP's boost and Qt parsers do. R's as.numeric can miss it by one
# unit in the last place ("1.558231115"); jsonlite's parser does not, once the text is JSON ("+1", "01", ".5", "1.")
jaspDecimal <- function(s) {
  if (!length(s)) return(numeric())
  j <- sub("^\\+", "", s)
  j <- sub("^(-?)0+([0-9])", "\\1\\2", j)
  j <- sub("^(-?)\\.", "\\10.", j)
  j <- sub("\\.([eE]|$)", "\\1", j)
  one <- function(x) tryCatch(as.numeric(unlist(jsonlite::parse_json(paste0("[", paste(x, collapse = ","), "]")))), error = function(e) NULL)
  out <- one(j)
  if (length(out) == length(s)) return(out)
  # one by one when a number is one JSON can't hold (1e+9999): R's parser for those
  vapply(seq_along(j), function(k) { x <- one(j[k]); if (length(x) == 1) x else suppressWarnings(as.numeric(s[k])) }, numeric(1))
}

# A double as JASP writes it (ColumnUtils::doubleToString): 10 significant digits, no trailing zeros, "∞" for infinity
jaspNumberText <- function(x) ifelse(is.infinite(x), ifelse(x > 0, "\u221e", "-\u221e"), sprintf("%.10g", x))

# What JASP makes of each label (Label::setInformation, label(), originalValueAsDouble(), isEmptyValue())
jaspLabelInfo <- function(l, empty, emptyNum) {
  n <- nrow(l); dbl <- rep(NA_real_, n); ori <- character(n); real <- logical(n)
  for (k in seq_len(n)) {
    j <- trimws(if (is.na(l$originalValueJson[k])) "" else l$originalValueJson[k])
    if (startsWith(j, "\"")) {                              # a string: read as a number when it is one
      s <- tryCatch(jsonlite::parse_json(j), error = function(e) gsub("^\"|\"$", "", j))
      ori[k] <- s; dbl[k] <- jaspParseNumber(s)
    } else if (grepl("^-?[0-9]+$", j)) {                    # an integer: exact
      ori[k] <- j; dbl[k] <- jaspDecimal(j)
    } else if (nzchar(j) && j != "null") {
      x <- jaspParseNumber(j)
      if (is.na(x)) { ori[k] <- j; dbl[k] <- NA }             # text that isn't JSON: that text
      else { ori[k] <- jaspNumberText(x); dbl[k] <- jaspParseNumber(ori[k]); real[k] <- TRUE }   # a real: rounded to the 10 digits JASP writes
    }
  }
  # the original value as shown: "" when it is a missing value
  oriShown <- ifelse(ori %in% empty | (real & (is.na(dbl) | dbl %in% emptyNum)), "", ori)
  lab <- ifelse(is.na(l$label), "", l$label)
  stored <- ifelse(is.na(dbl) | lab != oriShown, lab, "")   # JASP drops a label that only repeats its number
  txt <- ifelse(nzchar(stored) | is.na(dbl), stored, jaspNumberText(dbl))
  list(dbl = dbl, txt = txt, empty = !nzchar(oriShown) | oriShown %in% empty | !nzchar(txt) | txt %in% empty)
}

readJaspData <- function(jaspFile) {
  td <- tempfile("jasp_"); dir.create(td); on.exit(unlink(td, recursive = TRUE), add = TRUE)
  utils::unzip(jaspFile, files = "internal.sqlite", exdir = td)
  con <- DBI::dbConnect(RSQLite::SQLite(), file.path(td, "internal.sqlite")); on.exit(DBI::dbDisconnect(con), add = TRUE)
  cols <- DBI::dbGetQuery(con, "SELECT id, name, columnType FROM Columns WHERE dataSet = 1 ORDER BY colIdx")
  labs <- DBI::dbGetQuery(con, "SELECT columnId, value, label, originalValueJson, ordering FROM Labels ORDER BY columnId, ordering")
  fields <- DBI::dbListFields(con, "DataSet_1")
  old <- any(grepl("^Column_[0-9]+_INT$", fields))
  valueField <- function(id) if (old) paste0("Column_", id, "_DBL") else paste0("Column_", id)
  # value columns can mix numbers with text ("nan", "inf", or text in a column without labels): numbers and
  # text are read apart, so RSQLite neither rounds the numbers to 15 digits nor turns them into text
  parts <- vapply(fields, function(f) if (!f %in% valueField(cols$id)) sprintf('"%s"', f) else
    sprintf('CASE WHEN typeof("%1$s") IN (\'real\', \'integer\') THEN CAST("%1$s" AS REAL) END AS "%1$s", CASE WHEN typeof("%1$s") = \'text\' THEN "%1$s" END AS "%1$s__txt"', f),
    character(1))
  raw <- DBI::dbGetQuery(con, sprintf("SELECT %s FROM DataSet_1 ORDER BY rowNumber", paste(parts, collapse = ", ")))
  # only the rows that pass JASP's filter (Filter_<id> = 1), as JASP gives the analyses
  fcol <- grep("^Filter_", names(raw), value = TRUE)
  keep <- if (length(fcol)) raw[[fcol[1]]] == 1 else rep(TRUE, nrow(raw))
  keep[is.na(keep)] <- FALSE
  emptyList <- function(json) tryCatch(as.character(unlist(jsonlite::fromJSON(json)$strings)), error = function(e) character())
  emptyAll <- emptyList(DBI::dbGetQuery(con, "SELECT emptyValuesJson FROM DataSets")[[1]][1])
  cf <- DBI::dbListFields(con, "Columns")
  colInfo <- DBI::dbGetQuery(con, sprintf("SELECT id%s%s FROM Columns", if ("emptyValuesJson" %in% cf) ", emptyValuesJson" else "", if ("dropLevels" %in% cf) ", dropLevels" else ""))
  out  <- data.frame(row.names = seq_len(sum(keep)))
  for (i in seq_len(nrow(cols))) {
    id <- cols$id[i]; name <- cols$name[i]; type <- cols$columnType[i]
    l <- labs[labs$columnId == id, ]
    ci <- colInfo[colInfo$id == id, , drop = FALSE]
    empty <- emptyAll
    e <- tryCatch(jsonlite::fromJSON(ci$emptyValuesJson[1]), error = function(e) NULL)
    if (is.list(e) && isTRUE(e$custom)) empty <- union(empty, as.character(unlist(e$strings)))
    emptyNum <- jaspParseNumber(empty); emptyNum <- emptyNum[!is.na(emptyNum)]
    dl <- ci$dropLevels
    drop <- is.null(dl) || length(dl) == 0 || is.na(dl[1]) || dl[1] != 2
    num <- raw[[valueField(id)]]; txt <- raw[[paste0(valueField(id), "__txt")]]
    if (is.null(num)) next
    num <- as.numeric(num)
    tnum <- jaspParseNumber(txt)
    num[is.na(num) & !is.na(tnum)] <- tnum[is.na(num) & !is.na(tnum)]
    num[is.nan(num)] <- NA
    text <- ifelse(!is.na(txt) & is.na(tnum), txt, NA_character_)   # values that are no number at all
    if (old) {
      codes <- raw[[paste0("Column_", id, "_INT")]]
      # This check follows 0.98's Column::dbLoadOldIndex (0.96 itself trusted the codes). JASP's check, over all rows, missing codes and filtered rows included: the codes
      # count only when each stands for one value and some exist in Labels (0.18 and 0.19 wrote broken codes)
      key <- ifelse(is.na(num), "NaN", sprintf("%.17g", num))
      cc <- ifelse(is.na(codes), -2147483648, codes)
      pairs <- unique(data.frame(cc, key))
      labelled <- nrow(l) > 0 && !anyDuplicated(pairs$cc) && any(codes %in% l$value)
      codes[codes %in% -2147483648] <- NA
      if (type == "scale") {
        # 0.96 gives a scale column its doubles, missing-value numbers left out (Column::dataAsRDoubles)
        v <- num[keep]; v[v %in% emptyNum] <- NA
        out[[name]] <- v
        next
      }
      if (!labelled) {
        # groups without usable labels: their values, numbers first in number order, then text in sorted order
        nv <- num[keep]; tv <- text[keep]
        nv[nv %in% emptyNum] <- NA; tv[tv %in% empty | !nzchar(tv)] <- NA
        nl <- sort(unique(nv[!is.na(nv)])); tl <- sort(unique(tv[!is.na(tv)]), method = "radix")   # text by bytes
        shown <- ifelse(!is.na(nv), jaspNumberText(nv), tv)
        out[[name]] <- factor(shown, levels = unique(c(jaspNumberText(nl), tl)))
        next
      }
      v <- codes[keep]
    } else {
      v <- num[keep]
      if (nrow(l) == 0) {
        v[v == -2147483648] <- NA   # 0.98.1 keeps numbers on the missing-value list as values here
        out[[name]] <- v
        next
      }
    }
    info <- jaspLabelInfo(l, empty, emptyNum)
    idx <- match(v, l$value)
    if (type == "scale") {
      # a scale column gets its labels' values (Column::dataAsRDoubles), not their text
      val <- info$dbl[idx]; val[is.na(idx) | info$empty[idx] %in% TRUE] <- NA
      out[[name]] <- val
    } else {
      # nominal and ordinal columns are groups, also when their labels are numbers (engine.R makes an analysis
      # that reads one as a scale get the numbers, not the group codes). Groups keep JASP's label order
      # (Labels.ordering); labels with the same text are one group; with dropLevels only the groups in use
      # (missing-value labels never count as in use), otherwise every label, missing-value labels included.
      used <- unique(info$txt[idx[!is.na(idx) & !info$empty[idx]]])
      levels <- unique(info$txt[if (drop) info$txt %in% used else rep(TRUE, length(info$txt))])
      m <- info$txt[idx]; m[!m %in% levels] <- NA
      out[[name]] <- factor(m, levels = levels)
    }
  }
  out
}
