//! Counts the sample size of an analysis from the data saved in the `.jasp` file (`internal.sqlite`).
//!
//! Used only when the analysis's own tables don't report N. The count is the number of rows that pass the
//! data filter and have a value in every variable the analysis uses. It is given only when it is the N the
//! analysis used: when none of those variables has missing values, or when the analysis drops incomplete
//! rows (listwise). With missing values and pairwise or per-variable handling, N differs per test.

use rusqlite::Connection;
use serde::Serialize;
use serde_json::Value;
use std::collections::BTreeSet;

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum SampleSize {
    /// One N for the whole analysis
    N(u64),
    /// Variables have different numbers of values
    Varies,
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
        let categorical: BTreeSet<String> = {
            let mut statement =
                connection.prepare("SELECT id FROM Columns WHERE dataSet = ?1 AND columnType IN ('nominal', 'ordinal', 'nominalText')")?;
            let ids = statement.query_map([data_set], |r| r.get::<_, i64>(0))?.collect::<Result<Vec<_>, _>>()?;
            ids.into_iter().map(|id| format!("Column_{id}")).collect()
        };
        let columns = {
            let mut statement = connection.prepare("SELECT id, name FROM Columns WHERE dataSet = ?1")?;
            let rows = statement
                .query_map([data_set], |r| {
                    let id = r.get::<_, i64>(0)?;
                    Ok((r.get::<_, String>(1)?, format!("Column_{id}"), id))
                })?
                .collect::<Result<Vec<_>, _>>()?;
            rows.into_iter().filter(|(_, stored_as, _)| stored.contains(stored_as)).collect()
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
        Ok(Data { connection, table, filter, columns, categorical, empty_values })
    }

    fn stored(&self, name: &str) -> Option<&str> {
        self.columns.iter().find(|(n, _, _)| n == name).map(|(_, s, _)| s.as_str())
    }

    /// SQL that is true when a stored column has a value: not NULL, not JASP's missing code, not one of the
    /// empty-value texts, and not a label that is one of them (nominal columns keep "." as a label)
    fn present(&self, column: &str) -> String {
        let id = self.columns.iter().find(|(_, s, _)| s == column).map_or(-1, |(_, _, id)| *id);
        let quote = |v: &String| format!("'{}'", v.replace('\'', "''"));
        let empties = self.empty_values.iter().map(quote).collect::<Vec<_>>().join(", ");
        // Every value has a label row, "" when it has no label: only real labels can mark a missing value
        let empty_labels = self.empty_values.iter().filter(|v| !v.is_empty()).map(quote).collect::<Vec<_>>().join(", ");
        // Nominal and ordinal columns mark a missing level with -1, unless -1 is a real level
        let no_level = if self.categorical.contains(column) {
            format!(" AND (\"{column}\" <> -1 OR EXISTS (SELECT 1 FROM Labels WHERE columnId = {id} AND value = -1))")
        } else {
            String::new()
        };
        format!(
            "\"{column}\" IS NOT NULL AND \"{column}\" <> {MISSING_INT} \
             AND NOT (typeof(\"{column}\") = 'text' AND \"{column}\" IN ({empties})) \
             AND \"{column}\" NOT IN (SELECT value FROM Labels WHERE columnId = {id} AND label IN ({empty_labels})){no_level}"
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

    /// N for an analysis, from its options. None when it uses no known variables.
    pub fn sample_size(&self, options: &Value) -> Option<SampleSize> {
        // Wide-format measurement data (quality control) has several measurements per row: rows aren't N
        if options.get("dataFormat").and_then(Value::as_str) == Some("wideFormat") {
            return None;
        }
        // With a counts, frequency or weights variable, each row stands for many cases: rows aren't N
        for key in ["counts", "count", "frequency", "weights", "weight", "frequencyVariable", "countVariable"] {
            let mut weighted = BTreeSet::new();
            if let Some(value) = options.get(key) {
                strings(value, &mut weighted);
            }
            if weighted.iter().any(|n| self.stored(n).is_some()) {
                return None;
            }
        }
        let mut names = BTreeSet::new();
        variables(options, &mut names);
        let stored: Vec<&str> = names.iter().filter_map(|n| self.stored(n)).collect();
        if stored.is_empty() {
            return None;
        }
        let complete = self.count(&stored).ok()?;
        let rows = self.count(&[]).ok()?;
        let any_missing = stored.iter().any(|c| self.count(&[c]).map_or(true, |n| n != rows));
        let listwise = options.get("naAction").and_then(Value::as_str).is_none_or(|a| a == "listwise");
        if !any_missing || listwise {
            Some(SampleSize::N(complete))
        } else {
            Some(SampleSize::Varies)
        }
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
             CREATE TABLE Labels (id INTEGER PRIMARY KEY, columnId INT, value INT, label TEXT);
             INSERT INTO DataSets VALUES (1);
             INSERT INTO Filters VALUES (1, 1);
             INSERT INTO Columns VALUES (1, 1, 'x', 'scale'), (2, 1, 'y', 'scale'), (3, 1, 'group', 'nominal'), (4, 1, 'z', 'scale'), (5, 1, 'sex', 'nominal'), (6, 1, 'w', 'scale'), (7, 1, 'g2', 'nominal');
             INSERT INTO Labels VALUES (1, 5, 0, 'F'), (2, 5, 1, 'M'), (3, 5, 2, '.'), (4, 2, 2, ''), (5, 2, 3, '');
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
        let o = options(json!({ "types": ["scale", "scale"], "value": ["x", "y"] }), Some("pairwise"));
        assert_eq!(data.sample_size(&o), Some(SampleSize::Varies));
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
    fn a_counts_variable_means_rows_are_not_cases() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("d.sqlite");
        sample_db(&path);
        let data = Data::open(&path).unwrap();
        let mut o = options(json!({ "types": ["scale"], "value": ["y"] }), None);
        o["counts"] = json!({ "types": ["scale"], "value": "x" });
        assert_eq!(data.sample_size(&o), None);
        o["counts"] = json!({ "types": [], "value": "" });  // the option is there but empty
        assert_eq!(data.sample_size(&o), Some(SampleSize::N(4)));
        o["dataFormat"] = json!("wideFormat");
        assert_eq!(data.sample_size(&o), None);
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
