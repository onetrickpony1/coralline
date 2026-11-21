//! Counts the sample size of an analysis from the data saved in the `.jasp` file (`internal.sqlite`).
//!
//! Used only when the analysis's own tables don't report N. The count is the number of rows that pass the
//! data filter and have a value in every variable the analysis uses. It is given only when it is the N the
//! analysis used: when none of those variables has missing values, or when the analysis drops incomplete
//! rows (listwise). With missing values and pairwise or per-variable handling, N differs per test.

use rusqlite::Connection;
use serde::Serialize;
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum SampleSize {
    /// One N for the whole analysis
    N(u64),
    /// Each test has its own N, from min to max (missing values handled per variable or pair)
    Range { min: u64, max: u64 },
    /// Variables have different numbers of values, and how they combine isn't known
    Varies,
    /// A meta-analysis: rows are studies (or effects, in a multilevel model), not people.
    /// APA's sample note: "Number of studies = 120, number of effects = 782, total N = 52,578."
    Meta {
        #[serde(skip_serializing_if = "Option::is_none")]
        studies: Option<u64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        effects: Option<u64>,
        #[serde(skip_serializing_if = "Option::is_none")]
        total: Option<u64>,
    },
}

/// The dataset: column names and their stored columns, plus the filter column
pub struct Data {
    connection: Connection,
    table: String,
    filter: Option<String>,
    /// (name, stored column, column id)
    columns: Vec<(String, String, i64)>,
    /// Stored columns of nominal or ordinal type (they mark a missing level with -1)
    categorical: BTreeSet<String>,
    /// Stored columns that hold the values themselves, never label codes: the `_DBL` half of JASP 0.95 and
    /// 0.96 files, whose `_INT` half holds the codes
    plain: BTreeSet<String>,
    /// Each stored column's own missing-value list (Columns.emptyValuesJson when it is custom), which JASP joins
    /// with the file's list
    own_empties: BTreeMap<String, Vec<String>>,
    /// Text that JASP reads as missing ("NaN", ".", "NA", ...), from the file's settings
    empty_values: Vec<String>,
}

/// JASP's integer code for a missing value in nominal and ordinal columns
const MISSING_INT: i64 = i32::MIN as i64;

impl Data {
    pub fn open(path: &std::path::Path) -> rusqlite::Result<Data> {
        let connection = Connection::open_with_flags(path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)?;
        let data_set: i64 = connection.query_row("SELECT id FROM DataSets ORDER BY id LIMIT 1", [], |r| r.get(0))?;
        let table = format!("DataSet_{data_set}");
        let stored: BTreeSet<String> = {
            let mut statement = connection.prepare(&format!("PRAGMA table_info(\"{table}\")"))?;
            let names = statement.query_map([], |r| r.get::<_, String>(1))?.collect::<Result<_, _>>()?;
            names
        };
        let filter = connection
            .query_row("SELECT id FROM Filters WHERE dataSet = ?1 ORDER BY id LIMIT 1", [data_set], |r| r.get::<_, i64>(0))
            .ok()
            .map(|id| format!("Filter_{id}"))
            .filter(|name| stored.contains(name));
        // JASP 0.95 and most 0.96 files keep two columns per variable: Column_<id>_INT, the label code, and
        // Column_<id>_DBL, the value. Groups are counted from their codes, scale columns from their values
        // (their codes can be broken, as JASP's Column::dbLoadOldIndex notes).
        let old_layout = stored.iter().any(|name| name.starts_with("Column_") && name.ends_with("_INT"));
        let mut plain = BTreeSet::new();
        let mut own = BTreeMap::new();
        let has_column_empties = {
            let mut statement = connection.prepare("PRAGMA table_info(Columns)")?;
            let names = statement.query_map([], |r| r.get::<_, String>(1))?.collect::<Result<Vec<_>, _>>()?;
            names.iter().any(|n| n == "emptyValuesJson")
        };
        let own_empties = |id: i64| -> Vec<String> {
            if !has_column_empties {
                return Vec::new();
            }
            connection
                .query_row("SELECT emptyValuesJson FROM Columns WHERE id = ?1", [id], |r| r.get::<_, Option<String>>(0))
                .ok()
                .flatten()
                .and_then(|json| serde_json::from_str::<Value>(&json).ok())
                .filter(|v| v.get("custom").and_then(Value::as_bool) == Some(true))
                .and_then(|v| v.get("strings").and_then(Value::as_array).cloned())
                .map(|list| list.iter().filter_map(|v| v.as_str().map(str::to_string)).collect())
                .unwrap_or_default()
        };
        let mut categorical = BTreeSet::new();
        let columns = {
            let mut statement = connection.prepare(
                "SELECT id, name, columnType IN ('nominal', 'ordinal', 'nominalText'), \
                 EXISTS (SELECT 1 FROM Labels WHERE columnId = Columns.id) FROM Columns WHERE dataSet = ?1",
            )?;
            let rows = statement
                .query_map([data_set], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?, r.get::<_, bool>(2)?, r.get::<_, bool>(3)?)))?
                .collect::<Result<Vec<_>, _>>()?;
            let mut columns = Vec::new();
            for (id, name, is_group, has_labels) in rows {
                let stored_as = if !old_layout {
                    format!("Column_{id}")
                } else if is_group && has_labels {
                    format!("Column_{id}_INT")
                } else {
                    plain.insert(format!("Column_{id}_DBL"));
                    format!("Column_{id}_DBL")
                };
                if is_group {
                    categorical.insert(stored_as.clone());
                }
                if stored.contains(&stored_as) {
                    own.insert(stored_as.clone(), own_empties(id));
                    columns.push((name, stored_as, id));
                }
            }
            columns
        };
        let mut empty_values: Vec<String> = ["", "NaN", "nan", ".", "NA"].iter().map(|s| s.to_string()).collect();
        let settings: Option<String> = connection
            .query_row("SELECT emptyValuesJson FROM DataSets WHERE id = ?1", [data_set], |r| r.get(0))
            .ok()
            .flatten();
        if let Some(list) = settings
            .and_then(|json| serde_json::from_str::<Value>(&json).ok())
            .and_then(|v| v.get("strings").and_then(Value::as_array).cloned())
        {
            empty_values.extend(list.iter().filter_map(|v| v.as_str().map(str::to_string)));
        }
        Ok(Data { connection, table, filter, columns, categorical, plain, own_empties: own, empty_values })
    }

    fn stored(&self, name: &str) -> Option<&str> {
        self.columns.iter().find(|(n, _, _)| n == name).map(|(_, s, _)| s.as_str())
    }

    /// SQL that is true when a stored column has a value: not NULL, not JASP's missing code, not one of the
    /// empty-value texts, and not a label that is one of them (nominal columns keep "." as a label)
    fn present(&self, column: &str) -> String {
        let id = self.columns.iter().find(|(_, s, _)| s == column).map_or(-1, |(_, _, id)| *id);
        let quote = |v: &String| format!("'{}'", v.replace('\'', "''"));
        // the file's missing-value list joined with the column's own
        let list: Vec<&String> =
            self.empty_values.iter().chain(self.own_empties.get(column).into_iter().flatten()).collect();
        let empties = list.iter().map(|v| quote(v)).collect::<Vec<_>>().join(", ");
        // Every value has a label row, "" when it has no label: only real labels can mark a missing value
        let empty_labels = list.iter().filter(|v| !v.is_empty()).map(|v| quote(v)).collect::<Vec<_>>().join(", ");
        // missing-value numbers (such as -99)
        let numbers: Vec<String> = list
            .iter()
            .filter_map(|v| v.trim().parse::<f64>().ok())
            .filter(|n| n.is_finite())
            .map(|n| format!("{n:?}"))
            .collect();
        // Coded columns (nominal, ordinal, or any column with value labels) mark a missing value with -1,
        // unless -1 is a real code
        if self.plain.contains(column) {
            // values, not codes: a missing value is NULL, a missing-value text ("nan"), or a missing-value number
            let numbers = if numbers.is_empty() {
                String::new()
            } else {
                format!(" AND NOT (typeof(\"{column}\") IN ('real', 'integer') AND \"{column}\" IN ({}))", numbers.join(", "))
            };
            return format!(
                "\"{column}\" IS NOT NULL AND NOT (typeof(\"{column}\") = 'text' AND \"{column}\" IN ({empties})){numbers}"
            );
        }
        let coded = self.categorical.contains(column)
            || self
                .connection
                .query_row("SELECT EXISTS (SELECT 1 FROM Labels WHERE columnId = ?1)", [id], |r| r.get::<_, bool>(0))
                .unwrap_or(false);
        let no_level = if coded {
            format!(" AND (\"{column}\" <> -1 OR EXISTS (SELECT 1 FROM Labels WHERE columnId = {id} AND value = -1))")
        } else {
            String::new()
        };
        // a label is a missing value when its text is on the list, or when its original value is a number on it
        let number_labels = if numbers.is_empty() {
            String::new()
        } else {
            format!(
                " OR (trim(originalValueJson, ' ' || char(10)) GLOB '[0-9+.-]*' AND CAST(originalValueJson AS REAL) IN ({}))",
                numbers.join(", ")
            )
        };
        format!(
            "\"{column}\" IS NOT NULL AND \"{column}\" <> {MISSING_INT} \
             AND NOT (typeof(\"{column}\") = 'text' AND \"{column}\" IN ({empties})) \
             AND \"{column}\" NOT IN (SELECT value FROM Labels WHERE columnId = {id} AND (label IN ({empty_labels}){number_labels})){no_level}"
        )
    }

    fn count(&self, columns: &[&str]) -> rusqlite::Result<u64> {
        let mut conditions: Vec<String> = columns.iter().map(|c| self.present(c)).collect();
        if let Some(filter) = &self.filter {
            conditions.push(format!("\"{filter}\" = 1"));
        }
        let condition = if conditions.is_empty() { "1".to_string() } else { conditions.join(" AND ") };
        self.connection
            .query_row(&format!("SELECT COUNT(*) FROM \"{}\" WHERE {condition}", self.table), [], |r| r.get(0))
    }

    fn sum(&self, count_column: &str, columns: &[&str]) -> rusqlite::Result<u64> {
        let mut conditions: Vec<String> = columns.iter().map(|c| self.present(c)).collect();
        conditions.push(self.present(count_column));
        if let Some(filter) = &self.filter {
            conditions.push(format!("\"{filter}\" = 1"));
        }
        // Columns with value labels store codes: the number itself is the label's original value
        let id = self.columns.iter().find(|(_, s, _)| s == count_column).map_or(-1, |(_, _, id)| *id);
        let value = if self.plain.contains(count_column) {
            format!("CAST(\"{count_column}\" AS REAL)")
        } else {
            format!(
            "COALESCE((SELECT CAST(originalValueJson AS REAL) FROM Labels WHERE columnId = {id} AND value = \"{count_column}\" LIMIT 1), CAST(\"{count_column}\" AS REAL))"
            )
        };
        let total: f64 = self.connection.query_row(
            &format!("SELECT COALESCE(SUM({value}), 0) FROM \"{}\" WHERE {}", self.table, conditions.join(" AND ")),
            [],
            |r| r.get(0),
        )?;
        Ok(total.round() as u64)
    }

    /// Rows with a value in at least one of the columns (what full-information maximum likelihood uses)
    fn count_any(&self, columns: &[&str]) -> rusqlite::Result<u64> {
        let any = columns.iter().map(|c| format!("({})", self.present(c))).collect::<Vec<_>>().join(" OR ");
        let filter = self.filter.as_ref().map_or("1".to_string(), |f| format!("\"{f}\" = 1"));
        self.connection
            .query_row(&format!("SELECT COUNT(*) FROM \"{}\" WHERE ({any}) AND {filter}", self.table), [], |r| r.get(0))
    }

    /// Names in an option's value that are columns of the dataset
    fn columns_in(&self, value: Option<&Value>) -> Vec<String> {
        let mut names = BTreeSet::new();
        if let Some(v) = value {
            strings(v, &mut names);
        }
        names.into_iter().filter(|n| self.stored(n).is_some()).collect()
    }

    fn count_distinct(&self, column: &str, columns: &[&str]) -> rusqlite::Result<u64> {
        let mut conditions: Vec<String> = columns.iter().map(|c| self.present(c)).collect();
        conditions.push(self.present(column));
        if let Some(filter) = &self.filter {
            conditions.push(format!("\"{filter}\" = 1"));
        }
        self.connection.query_row(
            &format!("SELECT COUNT(DISTINCT \"{column}\") FROM \"{}\" WHERE {}", self.table, conditions.join(" AND ")),
            [],
            |r| r.get(0),
        )
    }

    /// Meta-analyses: studies (rows with an effect size and its precision), effects in multilevel models,
    /// and the total N when a column gives each study's sample size
    fn meta_analysis(&self, options: &Value) -> Option<SampleSize> {
        let effect = self.columns_in(options.get("effectSize")).into_iter().next()?;
        let precision = self.columns_in(options.get("effectSizeStandardError")).into_iter().next();
        let sizes = self.columns_in(options.get("sampleSize")).into_iter().next();
        let mut used = vec![self.stored(&effect)?];
        if let Some(c) = precision.as_ref().or(sizes.as_ref()) {
            used.push(self.stored(c)?);
        }
        let rows = self.count(&used).ok()?;
        let total = match &sizes {
            Some(c) => Some(self.sum(self.stored(c)?, &used).ok()?),
            None => None,
        };
        if options.get("randomEffectsSpecification").is_some() {
            // Multilevel: rows are effects; studies are the levels of the clustering variable, when one is set
            let studies = match self.columns_in(options.get("clustering")).first() {
                Some(c) => Some(self.count_distinct(self.stored(c)?, &used).ok()?),
                None => None,
            };
            return Some(SampleSize::Meta { studies, effects: Some(rows), total });
        }
        Some(SampleSize::Meta { studies: Some(rows), effects: None, total })
    }

    /// N for an analysis, from its options. None when it uses no known variables or rows aren't cases.
    pub fn sample_size(&self, options: &Value) -> Option<SampleSize> {
        if let Some(n) = user_data_n(options) {
            return Some(SampleSize::N(n));
        }
        // (an effect size variable, not the "effect size" checkbox of t-tests and correlations)
        if !self.columns_in(options.get("effectSize")).is_empty() {
            return self.meta_analysis(options);
        }
        // Measurement-system data (quality control) has several measurements per part, in a row (wide format)
        // or one per row (long format): either way rows aren't N, and the tables give the parts
        if options.get("dataFormat").is_some() {
            return None;
        }
        let mut names = BTreeSet::new();
        variables(options, &mut names);
        let mut known: Vec<String> = names.into_iter().filter(|n| self.stored(n).is_some()).collect();
        if known.is_empty() {
            // Models written as syntax (SEM) don't mark their variables: take option values that are column names
            // (only from JASP's variable lists, { types, value }, so a plot title can't pass for a column)
            let mut all = BTreeSet::new();
            variable_lists(options, &mut all);
            known = all.into_iter().filter(|n| self.stored(n).is_some()).collect();
        }
        if known.is_empty() {
            return None;
        }

        // Frequency data: each row stands for as many cases as its count, so N is the sum of the counts.
        // (Weights in regression and GLM don't make rows into cases: those rows are counted as usual.)
        for key in ["counts", "count", "frequency", "frequencyVariable", "countVariable"] {
            if let Some(counts) = self.columns_in(options.get(key)).first() {
                let counts_stored = self.stored(counts)?.to_string();
                let rest: Vec<&str> = known.iter().filter(|n| *n != counts).filter_map(|n| self.stored(n)).collect();
                return self.sum(&counts_stored, &rest).ok().map(SampleSize::N);
            }
        }

        let stored: Vec<&str> = known.iter().filter_map(|n| self.stored(n)).collect();
        let complete = self.count(&stored).ok()?;
        let rows = self.count(&[]).ok()?;
        let any_missing = stored.iter().any(|c| self.count(&[c]).map_or(true, |n| n != rows));
        let na_action = options.get("naAction").and_then(Value::as_str);
        if !any_missing || na_action.is_none_or(|a| a == "listwise") {
            return Some(SampleSize::N(complete));
        }
        if na_action == Some("fiml") {
            return self.count_any(&stored).ok().map(SampleSize::N);
        }

        // Each test uses its own rows: work out the N of every test
        let mut sizes = Vec::new();
        let dependents = self.columns_in(options.get("dependent"));
        let pairs: Vec<Vec<String>> = options
            .get("pairs")
            .and_then(|p| p.get("value").or(Some(p)))
            .and_then(Value::as_array)
            .map(|list| {
                list.iter()
                    .filter_map(|pair| pair.as_array())
                    .map(|pair| pair.iter().filter_map(|v| v.as_str()).filter(|n| self.stored(n).is_some()).map(str::to_string).collect())
                    .filter(|pair: &Vec<String>| pair.len() == 2)
                    .collect()
            })
            .unwrap_or_default();
        if na_action == Some("perDependent") && !pairs.is_empty() {
            // Paired tests: each pair of measures has its own rows
            for pair in &pairs {
                let columns: Vec<&str> = pair.iter().filter_map(|n| self.stored(n)).collect();
                sizes.push(self.count(&columns).ok()?);
            }
        } else if na_action == Some("perDependent") && !dependents.is_empty() {
            let others: Vec<&str> = known.iter().filter(|n| !dependents.contains(n)).filter_map(|n| self.stored(n)).collect();
            for dependent in &dependents {
                let mut columns = others.clone();
                columns.push(self.stored(dependent)?);
                sizes.push(self.count(&columns).ok()?);
            }
        } else if na_action == Some("pairwise") {
            let pair_vars = self.columns_in(options.get("variables"));
            let partial: Vec<&str> = self.columns_in(options.get("partialOutVariables")).iter().filter_map(|n| self.stored(n)).collect();
            for (i, a) in pair_vars.iter().enumerate() {
                for b in &pair_vars[i + 1..] {
                    let mut columns = partial.clone();
                    columns.push(self.stored(a)?);
                    columns.push(self.stored(b)?);
                    sizes.push(self.count(&columns).ok()?);
                }
            }
        }
        match (sizes.iter().min(), sizes.iter().max()) {
            (Some(&min), Some(&max)) if min == max => Some(SampleSize::N(min)),
            (Some(&min), Some(&max)) => Some(SampleSize::Range { min, max }),
            _ => Some(SampleSize::Varies),
        }
    }
}

/// JAGS models take their data size as a constant the user sets ("n" = 94), which the model loops over
fn user_data_n(options: &Value) -> Option<u64> {
    let table = options.get("userData")?.as_array()?;
    let column = |name: &str| table.iter().find(|c| c.get("name").and_then(Value::as_str) == Some(name)).and_then(|c| c.get("values")).and_then(Value::as_array);
    let (names, values) = (column("Parameter")?, column("R Code")?);
    let i = names.iter().position(|v| matches!(v.as_str(), Some("n" | "N")))?;
    values.get(i)?.as_str()?.trim().parse().ok()
}

/// Strings in every { types, value } object anywhere in the options: JASP's format for lists of variables
fn variable_lists(value: &Value, out: &mut BTreeSet<String>) {
    match value {
        Value::Object(map) => {
            if map.contains_key("types") {
                if let Some(v) = map.get("value") {
                    strings(v, out);
                }
            }
            for (key, v) in map {
                if key != ".meta" {
                    variable_lists(v, out);
                }
            }
        }
        Value::Array(items) => items.iter().for_each(|v| variable_lists(v, out)),
        _ => {}
    }
}

/// The variable names in an analysis's options: the options marked `shouldEncode` in `.meta`.
pub fn variables(options: &Value, out: &mut BTreeSet<String>) {
    let Some(meta) = options.get(".meta").and_then(Value::as_object) else { return };
    for (key, info) in meta {
        if info.get("shouldEncode").and_then(Value::as_bool) == Some(true) {
            if let Some(value) = options.get(key) {
                strings(value, out);
            }
        }
    }
}

/// Every string in an option's value ({ types, value }, lists, nested lists and rows), except type names
fn strings(value: &Value, out: &mut BTreeSet<String>) {
    match value {
        Value::String(s) if !s.is_empty() => {
            out.insert(s.clone());
        }
        Value::Array(items) => items.iter().for_each(|v| strings(v, out)),
        Value::Object(map) => {
            for (key, v) in map {
                if key != "types" && key != "optionKey" && key != "contrast" {
                    strings(v, out);
                }
            }
        }
        _ => {}
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use serde_json::json;

    /// A dataset like JASP's: 5 rows, x has one missing value, row 5 is filtered out
    pub fn sample_db(path: &std::path::Path) {
        let c = Connection::open(path).unwrap();
        c.execute_batch(
            "CREATE TABLE DataSets (id INTEGER PRIMARY KEY);
             CREATE TABLE Filters (id INTEGER PRIMARY KEY, dataSet INT);
             CREATE TABLE Columns (id INTEGER PRIMARY KEY, dataSet INT, name TEXT, columnType TEXT);
             CREATE TABLE Labels (id INTEGER PRIMARY KEY, columnId INT, value INT, label TEXT, originalValueJson TEXT);
             INSERT INTO DataSets VALUES (1);
             INSERT INTO Filters VALUES (1, 1);
             INSERT INTO Columns VALUES (1, 1, 'x', 'scale'), (2, 1, 'y', 'scale'), (3, 1, 'group', 'nominal'), (4, 1, 'z', 'scale'), (5, 1, 'sex', 'nominal'), (6, 1, 'w', 'scale'), (7, 1, 'g2', 'nominal');
             INSERT INTO Labels VALUES (1, 5, 0, 'F', 'F'), (2, 5, 1, 'M', 'M'), (3, 5, 2, '.', '.'), (4, 2, 2, '', '2'), (5, 2, 3, '', '3');
             CREATE TABLE DataSet_1 (rowNumber INTEGER PRIMARY KEY, Filter_1 INT NOT NULL DEFAULT 1, Column_1 NUM NULL, Column_2 NUM NULL, Column_3 NUM NULL, Column_4 NUM NULL, Column_5 INT NULL, Column_6 NUM NULL, Column_7 INT NULL);
             INSERT INTO DataSet_1 VALUES (1, 1, 1.0, 2.0, 0, 'nan', 0, -1, 0), (2, 1, NULL, 3.0, 1, 1.5, 2, -1, -1), (3, 1, 2.0, 4.0, 0, 2.5, 1, 2, 1), (4, 1, 3.0, 5.0, -2147483648, 3.5, 0, 3, 0), (5, 0, 4.0, 6.0, 1, 4.5, 1, 4, 1);",
        )
        .unwrap();
    }

    fn options(vars: Value, na: Option<&str>) -> Value {
        let mut o = json!({ ".meta": { "variables": { "shouldEncode": true }, "plotTitle": {} }, "variables": vars, "plotTitle": "x" });
        if let Some(na) = na {
            o["naAction"] = json!(na);
        }
        o
    }

    #[test]
    fn complete_variables_give_n_without_filtered_rows() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("d.sqlite");
        sample_db(&path);
        let data = Data::open(&path).unwrap();
        // y has no missing values; row 5 is filtered out
        assert_eq!(data.sample_size(&options(json!({ "types": ["scale"], "value": ["y"] }), Some("pairwise"))), Some(SampleSize::N(4)));
    }

    #[test]
    fn listwise_counts_complete_rows() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("d.sqlite");
        sample_db(&path);
        let data = Data::open(&path).unwrap();
        // x is missing in row 2, group in row 4
        let o = options(json!({ "types": ["scale", "nominal"], "value": ["x", "group"] }), Some("listwise"));
        assert_eq!(data.sample_size(&o), Some(SampleSize::N(2)));
    }

    #[test]
    fn pairwise_with_missing_values_varies() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("d.sqlite");
        sample_db(&path);
        let data = Data::open(&path).unwrap();
        // x and y: one pair, x is missing once -> one N
        let o = options(json!({ "types": ["scale", "scale"], "value": ["x", "y"] }), Some("pairwise"));
        assert_eq!(data.sample_size(&o), Some(SampleSize::N(3)));
        // x, y, w: pairs (x,y)=3, (x,w)=3, (y,w)=4 -> 3 to 4
        let o = options(json!({ "types": ["scale", "scale", "scale"], "value": ["x", "y", "w"] }), Some("pairwise"));
        assert_eq!(data.sample_size(&o), Some(SampleSize::Range { min: 3, max: 4 }));
        // per dependent with a grouping variable: x with group (2), y with group (3)
        let o = json!({ ".meta": { "dependent": { "shouldEncode": true }, "group": { "shouldEncode": true } },
            "dependent": { "types": ["scale", "scale"], "value": ["x", "y"] }, "group": { "types": ["nominal"], "value": "group" }, "naAction": "perDependent" });
        assert_eq!(data.sample_size(&o), Some(SampleSize::Range { min: 2, max: 3 }));
        // full-information maximum likelihood uses every row with any value
        let o = options(json!({ "types": ["scale", "scale"], "value": ["x", "z"] }), Some("fiml"));
        assert_eq!(data.sample_size(&o), Some(SampleSize::N(4)));
    }

    #[test]
    fn text_nan_and_empty_value_labels_are_missing() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("d.sqlite");
        sample_db(&path);
        let data = Data::open(&path).unwrap();
        // z is 'nan' in row 1; sex is the "." label in row 2; row 5 is filtered out
        let o = options(json!({ "types": ["scale", "nominal"], "value": ["z", "sex"] }), Some("listwise"));
        assert_eq!(data.sample_size(&o), Some(SampleSize::N(2)));
    }

    #[test]
    fn minus_one_is_missing_only_in_categorical_columns() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("d.sqlite");
        sample_db(&path);
        let data = Data::open(&path).unwrap();
        // w is a scale column where -1 is a value; g2 is nominal with -1 (no level) in row 2
        let o = options(json!({ "types": ["scale", "nominal"], "value": ["w", "g2"] }), Some("listwise"));
        assert_eq!(data.sample_size(&o), Some(SampleSize::N(3)));
    }

    #[test]
    fn old_files_count_groups_by_code_and_scales_by_value() {
        // JASP 0.95 and 0.96 store Column_<id>_INT (codes) and Column_<id>_DBL (values, "nan" when missing)
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("d.sqlite");
        let c = Connection::open(&path).unwrap();
        c.execute_batch(
            "CREATE TABLE DataSets (id INTEGER PRIMARY KEY, emptyValuesJson TEXT);
             CREATE TABLE Filters (id INTEGER PRIMARY KEY, dataSet INT);
             CREATE TABLE Columns (id INTEGER PRIMARY KEY, dataSet INT, name TEXT, columnType TEXT, emptyValuesJson TEXT);
             CREATE TABLE Labels (id INTEGER PRIMARY KEY, columnId INT, value INT, label TEXT, originalValueJson TEXT);
             INSERT INTO DataSets VALUES (1, '{\"custom\": true, \"strings\": [\".\", \"nan\"]}');
             INSERT INTO Filters VALUES (1, 1);
             INSERT INTO Columns VALUES (1, 1, 'x', 'scale', '{\"custom\": true, \"strings\": [\"-99\"]}'), (2, 1, 'sex', 'nominal', NULL), (3, 1, 'n', 'scale', NULL);
             INSERT INTO Labels VALUES (1, 1, 1, '', '-1'), (2, 1, 2, '', '2.5'), (3, 2, 0, 'F', '\"F\"'), (4, 2, 1, 'M', '\"M\"'), (5, 3, 1, '', '10'), (6, 3, 2, '', '20');
             CREATE TABLE DataSet_1 (rowNumber INTEGER PRIMARY KEY, Filter_1 INT NOT NULL DEFAULT 1, Column_1_DBL REAL NULL, Column_1_INT INT NULL, Column_2_DBL REAL NULL, Column_2_INT INT NULL, Column_3_DBL REAL NULL, Column_3_INT INT NULL);
             INSERT INTO DataSet_1 VALUES (1, 1, -1.0, 1, 'nan', 0, 10.0, 1), (2, 1, 2.5, 2, 'nan', -2147483648, 20.0, 2), (3, 1, 'nan', -2147483648, 'nan', 1, 10.0, 1), (4, 1, 2.5, 2, 'nan', 1, 20.0, 2), (5, 0, 2.5, 2, 'nan', 0, 10.0, 1), (6, 1, -99.0, 3, 'nan', 0, 0.0, 3);",
        )
        .unwrap();
        drop(c);
        let data = Data::open(&path).unwrap();
        // x: -1 is a value, 'nan' (row 3) and the column's own missing number -99 (row 6) are missing;
        // sex: row 2 is missing; row 5 is filtered out
        let o = options(json!({ "types": ["scale", "nominal"], "value": ["x", "sex"] }), Some("listwise"));
        assert_eq!(data.sample_size(&o), Some(SampleSize::N(2)));
        // counts add up their values, not their codes: 10 + 20 + 10 + 20 (row 5 is filtered out)
        assert_eq!(data.sum("Column_3_DBL", &[]).ok(), Some(60));
    }

    #[test]
    fn coded_columns_join_their_own_missing_list_with_the_files() {
        // a labelled column whose own list adds -99: the label with original value -99 is missing, and the
        // file's "." still counts
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("d.sqlite");
        let c = Connection::open(&path).unwrap();
        c.execute_batch(
            "CREATE TABLE DataSets (id INTEGER PRIMARY KEY, emptyValuesJson TEXT);
             CREATE TABLE Filters (id INTEGER PRIMARY KEY, dataSet INT);
             CREATE TABLE Columns (id INTEGER PRIMARY KEY, dataSet INT, name TEXT, columnType TEXT, emptyValuesJson TEXT);
             CREATE TABLE Labels (id INTEGER PRIMARY KEY, columnId INT, value INT, label TEXT, originalValueJson TEXT);
             INSERT INTO DataSets VALUES (1, '{\"custom\": true, \"strings\": [\".\"]}');
             INSERT INTO Filters VALUES (1, 1);
             INSERT INTO Columns VALUES (1, 1, 'score', 'ordinal', '{\"custom\": true, \"strings\": [\"-99\"]}'), (2, 1, 'other', 'ordinal', NULL);
             INSERT INTO Labels VALUES (1, 1, 0, '', '1'), (2, 1, 1, '', '-99.0'), (3, 1, 2, '.', '\".\"'), (4, 1, 3, 'abc', 'abc'),
                                       (5, 2, 0, '', '1'), (6, 2, 1, '', '-99');
             CREATE TABLE DataSet_1 (rowNumber INTEGER PRIMARY KEY, Filter_1 INT NOT NULL DEFAULT 1, Column_1 NUM NULL, Column_2 NUM NULL);
             INSERT INTO DataSet_1 VALUES (1, 1, 0, 0), (2, 1, 1, 1), (3, 1, 2, 1), (4, 1, 3, 0), (5, 1, 0, 1);",
        )
        .unwrap();
        drop(c);
        let data = Data::open(&path).unwrap();
        // score: rows 1, 4 and 5 (row 2 is -99, row 3 is ".")
        let o = options(json!({ "types": ["ordinal"], "value": ["score"] }), None);
        assert_eq!(data.sample_size(&o), Some(SampleSize::N(3)));
        // other has no list of its own, so -99 is a value there
        let o = options(json!({ "types": ["ordinal"], "value": ["other"] }), None);
        assert_eq!(data.sample_size(&o), Some(SampleSize::N(5)));
    }

    #[test]
    fn counts_add_up_and_weights_do_not() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("d.sqlite");
        sample_db(&path);
        let data = Data::open(&path).unwrap();
        // y as the counts, group as the factor: rows 1-3 pass (row 4 has no group, row 5 is filtered) -> 2 + 3 + 4
        let mut o = options(json!({ "types": ["nominal"], "value": ["group"] }), None);
        o["count"] = json!({ "types": ["scale"], "value": "y" });
        o[".meta"]["count"] = json!({ "shouldEncode": true });
        assert_eq!(data.sample_size(&o), Some(SampleSize::N(9)));
        // weights in a regression don't change N
        let mut o = options(json!({ "types": ["scale"], "value": ["y"] }), None);
        o["weights"] = json!({ "types": ["scale"], "value": "x" });
        assert_eq!(data.sample_size(&o), Some(SampleSize::N(4)));
        let mut o = options(json!({ "types": ["scale"], "value": ["y"] }), None);
        o["counts"] = json!({ "types": [], "value": "" });  // the option is there but empty
        assert_eq!(data.sample_size(&o), Some(SampleSize::N(4)));
        o["dataFormat"] = json!("wideFormat");
        assert_eq!(data.sample_size(&o), None);
    }

    #[test]
    fn coded_counts_add_up_their_real_values_and_pairs_get_their_own_n() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("d.sqlite");
        sample_db(&path);
        let c = Connection::open(&path).unwrap();
        // column 8: counts stored as codes 1..2 meaning 10 and 20; a -1 code is missing
        c.execute_batch(
            "INSERT INTO Columns VALUES (8, 1, 'freq', 'scale');
             INSERT INTO Labels VALUES (10, 8, 1, '', '10'), (11, 8, 2, '', '20');
             ALTER TABLE DataSet_1 ADD COLUMN Column_8 INT NULL;
             UPDATE DataSet_1 SET Column_8 = CASE rowNumber WHEN 1 THEN 1 WHEN 2 THEN 2 WHEN 3 THEN -1 ELSE 1 END;",
        )
        .unwrap();
        drop(c);
        let data = Data::open(&path).unwrap();
        // factor y (all present in rows 1-4), counts: 10 + 20 + (missing) + 10
        let mut o = options(json!({ "types": ["scale"], "value": ["y"] }), None);
        o["counts"] = json!({ "types": ["scale"], "value": "freq" });
        assert_eq!(data.sample_size(&o), Some(SampleSize::N(40)));
        // pairs: (x, y) = 3 rows, (y, w) = 4 rows
        let o = json!({ ".meta": { "pairs": { "shouldEncode": true } }, "naAction": "perDependent",
            "pairs": { "types": [["scale", "scale"], ["scale", "scale"]], "value": [["x", "y"], ["y", "w"]] } });
        assert_eq!(data.sample_size(&o), Some(SampleSize::Range { min: 3, max: 4 }));
    }

    #[test]
    fn meta_analyses_count_studies_and_jags_takes_its_own_n() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("d.sqlite");
        sample_db(&path);
        let data = Data::open(&path).unwrap();
        // effect size x (present in rows 1, 3, 4), study sizes in y (2, 4, 5): 3 studies, total 11
        let o = json!({ "effectSize": { "types": ["scale"], "value": "x" }, "sampleSize": { "types": ["scale"], "value": "y" } });
        assert_eq!(data.sample_size(&o), Some(SampleSize::Meta { studies: Some(3), effects: None, total: Some(11) }));
        // multilevel, clustered by sex (rows 1, 3, 4 are F, M, F): 3 effects in 2 studies
        let o = json!({ "effectSize": { "types": ["scale"], "value": "x" }, "randomEffectsSpecification": [],
            "clustering": { "types": ["nominal"], "value": "sex" } });
        assert_eq!(data.sample_size(&o), Some(SampleSize::Meta { studies: Some(2), effects: Some(3), total: None }));
        let o = json!({ "userData": [{ "name": "Parameter", "values": ["n"] }, { "name": "R Code", "values": ["94"] }] });
        assert_eq!(data.sample_size(&o), Some(SampleSize::N(94)));
    }

    #[test]
    fn syntax_models_find_their_variables_in_the_options() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("d.sqlite");
        sample_db(&path);
        let data = Data::open(&path).unwrap();
        let o = json!({ ".meta": { "models": {} }, "models": [{ "syntax": { "model": "f =~ y + w", "types": ["scale", "scale"], "value": ["y", "w"] } }] });
        assert_eq!(data.sample_size(&o), Some(SampleSize::N(4)));
    }

    #[test]
    fn unknown_variables_give_nothing() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("d.sqlite");
        sample_db(&path);
        let data = Data::open(&path).unwrap();
        assert_eq!(data.sample_size(&options(json!({ "types": [], "value": [] }), None)), None);
    }

    #[test]
    fn variables_are_found_in_nested_options_but_not_types_or_unmarked_options() {
        let o = json!({
            ".meta": { "contrasts": { "shouldEncode": true }, "modelTerms": { "shouldEncode": true }, "title": {} },
            "contrasts": { "optionKey": "variable", "types": ["nominal"], "value": [{ "contrast": "none", "variable": ["FaceType"] }] },
            "modelTerms": [{ "components": { "types": ["scale"], "value": [["adverts"]] }, "name": "model1" }],
            "title": "sales"
        });
        let mut names = BTreeSet::new();
        variables(&o, &mut names);
        assert!(names.contains("FaceType") && names.contains("adverts"));
        assert!(!names.contains("nominal") && !names.contains("none") && !names.contains("sales"));
    }
}
