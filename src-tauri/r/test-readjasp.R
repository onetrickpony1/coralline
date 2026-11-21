# Tests for readjasp.R: both layouts of the data in a .jasp file, read as JASP gives the data to R. Run with JASP's R:
#   flatpak run --command=Rscript --filesystem=$PWD org.jaspstats.JASP test-readjasp.R
libs <- list.dirs("/app/Modules/module_libs", recursive = FALSE); .libPaths(c(libs, .libPaths()))
source("readjasp.R")
check <- function(got, want, what) if (!identical(got, want)) { cat("FAIL", what, "\n  got: ", deparse(got), "\n  want:", deparse(want), "\n"); failed <<- failed + 1 }
failed <- 0

# Writes a .jasp (a zip with internal.sqlite) from Columns and Labels rows and the SQL that makes DataSet_1
makeJasp <- function(cols, labs, dataSql, emptyValues = '{ "custom" : true, "strings" : [".", "NA", "NaN", "nan"] }') {
  dir <- tempfile("jasp_"); dir.create(dir)
  con <- DBI::dbConnect(RSQLite::SQLite(), file.path(dir, "internal.sqlite"))
  DBI::dbWriteTable(con, "DataSets", data.frame(id = 1, emptyValuesJson = emptyValues))
  DBI::dbWriteTable(con, "Columns", cols)
  DBI::dbWriteTable(con, "Labels", labs)
  for (q in dataSql) DBI::dbExecute(con, q)
  DBI::dbDisconnect(con)
  f <- file.path(dir, "test.jasp")
  old <- setwd(dir); utils::zip(f, "internal.sqlite", flags = "-q"); setwd(old)
  f
}
column <- function(id, name, type, empty = NA_character_, drop = 1) data.frame(id = id, dataSet = 1, name = name, columnType = type, colIdx = id - 1, emptyValuesJson = empty, dropLevels = drop)
label <- function(columnId, value, label, ori) data.frame(columnId = columnId, value = value, ordering = seq_along(value) - 1, label = label, originalValueJson = paste0(ori, "\n"))
idLabels <- function(l) { l$id <- seq_len(nrow(l)); l[, c("id", "columnId", "value", "ordering", "label", "originalValueJson")] }

## 1. The same data in both layouts, five rows, row 5 filtered out
#   x      scale, values -1, 2.5, missing, Inf, 7 (labels with JASP's thousands separator text)
#   sex    nominal, text labels in JASP's order (M before F), "." is a missing-value label; row 2 has no value
#   dose   ordinal with number labels written 1.0 and 2.0 by JASP
#   age    scale whose codes are broken in the old layout (code 1 stands for three values, as JASP 0.18 wrote)
cols <- rbind(column(1, "x", "scale"), column(2, "sex", "nominal"), column(3, "dose", "ordinal"), column(4, "age", "scale"))
labsOld <- idLabels(rbind(label(1, 0:2, c("-1", "2.5", "1,000"), c("-1", "2.5", "1000")), label(2, c(5, 3, 4), c("M", "F", "."), c("\"M\"", "\"F\"", "\".\"")),
                          label(3, 0:1, "", c("1.0", "2.0")), label(4, 1, "", "30")))
labsNew <- idLabels(rbind(label(1, 0:3, c("-1", "2.5", "1,000", ""), c("-1", "2.5", "1000", "1e+9999")), label(2, c(5, 3, 4), c("M", "F", "."), c("\"M\"", "\"F\"", "\".\"")),
                          label(3, 0:1, "", c("1.0", "2.0")), label(4, 0:2, "", c("30", "31", "32"))))
want <- data.frame(row.names = 1:4)
want$x <- c(-1, 2.5, NA, Inf)
want$sex <- factor(c("F", NA, "M", NA), levels = c("M", "F"))
want$dose <- factor(c("1", "2", "2", "1"), levels = c("1", "2"))
want$age <- c(30, 31, 32, NA)
oldFile <- makeJasp(cols, labsOld, c(
  "CREATE TABLE DataSet_1 (rowNumber INTEGER PRIMARY KEY, Filter_1 INT NOT NULL DEFAULT 1,
     Column_1_DBL REAL NULL, Column_1_INT INT NULL, Column_2_DBL REAL NULL, Column_2_INT INT NULL,
     Column_3_DBL REAL NULL, Column_3_INT INT NULL, Column_4_DBL REAL NULL, Column_4_INT INT NULL)",
  "INSERT INTO DataSet_1 VALUES
     (1, 1, -1.0, 0, 'nan', 3, 1.0, 0, 30.0, 1),
     (2, 1, 2.5, 1, 'nan', -2147483648, 2.0, 1, 31.0, 1),
     (3, 1, 'nan', -2147483648, 'nan', 5, 2.0, 1, 32.0, 1),
     (4, 1, 'inf', -1, 'nan', 4, 1.0, 0, 'nan', -2147483648),
     (5, 0, 7.0, -1, 'nan', 3, 1.0, 0, 33.0, 1)"))
newFile <- makeJasp(cols, labsNew, c(
  "CREATE TABLE DataSet_1 (rowNumber INTEGER PRIMARY KEY, Filter_1 INT NOT NULL DEFAULT 1, Column_1 NUM NULL, Column_2 NUM NULL, Column_3 NUM NULL, Column_4 NUM NULL)",
  "INSERT INTO DataSet_1 VALUES (1, 1, 0, 3, 0, 0), (2, 1, 1, -2147483648, 1, 1), (3, 1, -2147483648, 5, 1, 2), (4, 1, 3, 4, 0, -2147483648), (5, 0, 2, 3, 0, 0)"))
for (f in c(old = oldFile, new = newFile)) {
  layout <- if (identical(f, oldFile)) "0.95 layout" else "0.97 layout"
  d <- readJaspData(f)
  check(names(d), names(want), paste(layout, "column names"))
  check(nrow(d), 4L, paste(layout, "filtered rows are left out"))
  check(d$x, want$x, paste(layout, "scale values, missing and Inf"))
  check(d$sex, want$sex, paste(layout, "text groups in JASP's order, missing-value label and missing code"))
  check(d$dose, want$dose, paste(layout, "number labels as JASP writes them"))
  check(d$age, want$age, paste(layout, "scale values even when the codes are broken"))
}

## 2. dropLevels: 0 (no choice) and NULL drop unused groups like 1; 2 keeps every label, missing-value labels too
dropCols <- rbind(column(1, "g0", "nominal", drop = 0), column(2, "gNULL", "nominal", drop = NA), column(3, "g2", "nominal", drop = 2))
dropLabs <- idLabels(do.call(rbind, lapply(1:3, function(k) label(k, 0:2, c("A", "B", "."), c("\"A\"", "\"B\"", "\".\"")))))
d <- readJaspData(makeJasp(dropCols, dropLabs, c(
  "CREATE TABLE DataSet_1 (rowNumber INTEGER PRIMARY KEY, Filter_1 INT NOT NULL DEFAULT 1, Column_1 NUM NULL, Column_2 NUM NULL, Column_3 NUM NULL)",
  "INSERT INTO DataSet_1 VALUES (1, 1, 0, 0, 0), (2, 1, 0, 0, 0), (3, 1, -2147483648, -2147483648, -2147483648)")))
check(levels(d$g0), "A", "dropLevels 0 drops the unused group")
check(levels(d$gNULL), "A", "dropLevels NULL drops the unused group")
check(levels(d$g2), c("A", "B", "."), "dropLevels 2 keeps every label, the missing-value label too")
check(as.character(d$g2), c("A", "A", NA), "dropLevels 2: a missing code stays missing")

## 3. Labels as JASP reads them: reals rounded to 10 digits, integers exact, infinity written "∞", a column's own
##    missing-value list joined with the file's, and a mixed number and text column at full precision
labCols <- rbind(column(1, "r", "scale"), column(2, "big", "scale"), column(3, "inf", "nominal"), column(4, "word", "nominal"),
                 column(5, "codes", "nominal", empty = '{ "custom" : true, "strings" : ["-99"] }'), column(6, "mixed", "scale"))
labLabs <- idLabels(rbind(label(1, 0, "", "0.123456789012345"), label(2, 0, "", "12345678901"), label(3, 0:1, "", c("1e+9999", "2.0")),
                          label(4, 0:1, c("infinity", "cat"), c("\"infinity\"", "\"cat\"")), label(5, 0:2, c("", "", "."), c("1", "-99", "\".\""))))
d <- readJaspData(makeJasp(labCols, labLabs, c(
  "CREATE TABLE DataSet_1 (rowNumber INTEGER PRIMARY KEY, Filter_1 INT NOT NULL DEFAULT 1, Column_1 NUM NULL, Column_2 NUM NULL, Column_3 NUM NULL, Column_4 NUM NULL, Column_5 NUM NULL, Column_6 NUM NULL)",
  "INSERT INTO DataSet_1 VALUES (1, 1, 0, 0, 0, 0, 0, 0.12345678901234567), (2, 1, 0, 0, 1, 1, 1, 'nan'), (3, 1, 0, 0, 1, 1, 2, 'inf')")))
check(d$r, rep(0.1234567890, 3), "a real label's value is rounded to the 10 digits JASP writes")
check(d$big, rep(12345678901, 3), "an integer label's value stays exact")
check(levels(d$inf), c("∞", "2"), "an infinite label is written as JASP writes it")
check(levels(d$word), c("∞", "cat"), "a text label that reads as a number is that number")
check(as.character(d$codes), c("1", NA, NA), "a column's own missing number and the file's \".\" are both missing")
check(d$mixed, c(0.12345678901234567, NA, Inf), "a mixed number and text column keeps full precision")

## 3b. Decimals are parsed to the nearest double, as JASP does (R's own parser misses these by one unit)
ulpCols <- rbind(column(1, "a", "scale"), column(2, "b", "scale"), column(3, "t", "nominal"), column(4, "plainCol", "scale", empty = '{ "custom" : true, "strings" : ["-99"] }'))
ulpLabs <- idLabels(rbind(label(1, 0, "", "1.558231115"), label(2, 0, "", "70.42689515"), label(3, 0, "abc", "abc")))
d <- readJaspData(makeJasp(ulpCols, ulpLabs, c(
  "CREATE TABLE DataSet_1 (rowNumber INTEGER PRIMARY KEY, Filter_1 INT NOT NULL DEFAULT 1, Column_1 NUM NULL, Column_2 NUM NULL, Column_3 NUM NULL, Column_4 NUM NULL)",
  "INSERT INTO DataSet_1 VALUES (1, 1, 0, 0, 0, -99), (2, 1, 0, 0, 0, '1.558231115')")))
check(sprintf("%.17g", d$a), rep("1.5582311150000001", 2), "1.558231115 is the nearest double")
check(sprintf("%.17g", d$b), rep("70.426895149999993", 2), "70.42689515 is the nearest double")
check(as.character(d$t), c("abc", "abc"), "an original value that isn't JSON is its text")
check(sprintf("%.17g", d$plainCol), c("-99", "1.5582311150000001"), "a column without labels keeps missing-value numbers, as 0.98.1 does, and parses text exactly")

## 4. The 0.95 layout: a missing-value number in a scale column, and groups whose codes are broken keep their text
oldCols <- rbind(column(1, "score", "scale", empty = '{ "custom" : true, "strings" : ["-99"] }'), column(2, "kind", "nominal"), column(3, "grp", "nominal"))
oldLabs <- idLabels(rbind(label(1, 0, "", "5"), label(2, 0:1, c("a", "b"), c("\"a\"", "\"b\"")), label(3, 0, "first", "\"first\"")))
d <- readJaspData(makeJasp(oldCols, oldLabs, c(
  "CREATE TABLE DataSet_1 (rowNumber INTEGER PRIMARY KEY, Filter_1 INT NOT NULL DEFAULT 1, Column_1_DBL REAL NULL, Column_1_INT INT NULL,
     Column_2_DBL REAL NULL, Column_2_INT INT NULL, Column_3_DBL REAL NULL, Column_3_INT INT NULL)",
  # kind's code 0 stands for 10, "b" and 2 (broken); grp's missing code stands for "nan" in row 4 and 3 in the
  # filtered row 5, which also makes its codes broken (JASP checks every row, missing codes and filtered rows too)
  "INSERT INTO DataSet_1 VALUES (1, 1, -99.0, 0, 10.0, 0, 'nan', 0), (2, 1, 5.0, 0, 'b', 0, 'nan', 0), (3, 1, 5.0, 0, 2.0, 0, 'nan', 0),
     (4, 1, 'nan', -2147483648, 'a', 1, 'nan', -2147483648), (5, 0, 5.0, 0, 'z', 1, 3.0, -2147483648)")))
check(d$score, c(NA, 5, 5, NA), "0.95 layout: the column's missing number is missing")
check(d$kind, factor(c("10", "b", "2", "a"), levels = c("2", "10", "a", "b")), "0.95 layout: broken codes give the values, numbers first, then text")
check(d$grp, factor(rep(NA_character_, 4), levels = character()), "0.95 layout: a missing code with two values in any row breaks the codes")

## 5. A real 0.96 file from JASP's own examples (jaspRegression, AGPL), when a copy of the module sources is there
ex <- file.path(Sys.getenv("HOME"), "Apps/jAPAsp/scratch/figcorpus/upstream/jaspRegression/examples/Titanic.jasp")
if (file.exists(ex)) {
  d <- readJaspData(ex)
  check(names(d), c("Name", "PClass", "Age", "Sex", "Survived"), "Titanic: column names")
  check(levels(d$PClass), c("1st", "2nd", "3rd"), "Titanic: class groups")
  check(sum(is.na(d$Age)), 557L, "Titanic: missing ages")
  check(levels(d$Survived), c("0", "1"), "Titanic: number groups")
} else cat("SKIPPED the Titanic check: no copy of", ex, "\n")

if (failed) { cat(failed, "failed\n"); quit(status = 1) } else cat("all passed\n")
