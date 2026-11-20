# Reads the data of a .jasp file (JASP 0.20+ layout: DataSet_1 with Column_<id>), like src-tauri/src/data.rs
readJaspData <- function(jaspFile) {
  td <- tempfile("jasp_"); dir.create(td); on.exit(unlink(td, recursive = TRUE), add = TRUE)
  utils::unzip(jaspFile, files = "internal.sqlite", exdir = td)
  con <- DBI::dbConnect(RSQLite::SQLite(), file.path(td, "internal.sqlite")); on.exit(DBI::dbDisconnect(con), add = TRUE)
  cols <- DBI::dbGetQuery(con, "SELECT id, name, columnType FROM Columns WHERE dataSet = 1 ORDER BY colIdx")
  labs <- DBI::dbGetQuery(con, "SELECT columnId, value, label, originalValueJson, ordering FROM Labels ORDER BY columnId, ordering")
  raw  <- DBI::dbGetQuery(con, "SELECT * FROM DataSet_1 ORDER BY rowNumber")
  # only the rows that pass JASP's filter (Filter_<id> = 1), as JASP gives the analyses
  fcol <- grep("^Filter_", names(raw), value = TRUE)
  if (length(fcol)) raw <- raw[raw[[fcol[1]]] == 1, , drop = FALSE]
  # strings JASP treats as missing (".", "NA", ...): the file's list, or a column's own list where it has one
  emptyAll <- tryCatch(jsonlite::fromJSON(DBI::dbGetQuery(con, "SELECT emptyValuesJson FROM DataSets")[[1]][1])$strings, error = function(e) character())
  cf <- DBI::dbListFields(con, "Columns")
  colInfo <- DBI::dbGetQuery(con, sprintf("SELECT id%s%s FROM Columns", if ("emptyValuesJson" %in% cf) ", emptyValuesJson" else "", if ("dropLevels" %in% cf) ", dropLevels" else ""))
  out  <- data.frame(row.names = seq_len(nrow(raw)))
  for (i in seq_len(nrow(cols))) {
    v <- raw[[paste0("Column_", cols$id[i])]]
    l <- labs[labs$columnId == cols$id[i], ]
    if (nrow(l) == 0) {
      v <- suppressWarnings(as.numeric(v)); v[v == -2147483648] <- NA
      out[[cols$name[i]]] <- v
    } else {
      txt <- ifelse(nzchar(l$label), l$label, trimws(gsub("^\"|\"$", "", l$originalValueJson)))
      m <- txt[match(v, l$value)]
      ci <- colInfo[colInfo$id == cols$id[i], , drop = FALSE]
      empty <- emptyAll
      e <- tryCatch(jsonlite::fromJSON(ci$emptyValuesJson[1]), error = function(e) NULL)
      if (is.list(e) && isTRUE(e$custom)) empty <- e$strings
      m[is.na(v) | (v == -1 & !(-1 %in% l$value)) | m %in% empty] <- NA
      num <- suppressWarnings(as.numeric(m))
      if (cols$columnType[i] == "scale" || all(is.na(m) | !is.na(num))) {
        # numbers stay numbers, so analyses that read the column as a scale get the values, not group codes
        out[[cols$name[i]]] <- num
      } else {
        # groups keep JASP's own order (Labels.ordering); R would otherwise sort them alphabetically
        out[[cols$name[i]]] <- factor(m, levels = setdiff(if (isTRUE(as.logical(ci$dropLevels[1]))) intersect(unique(txt), m) else unique(txt), empty))
        # JASP's own order; missing-value labels left out, unused groups dropped when the column says so
      }
    }
  }
  out
}
