//! Reads the results tables out of a saved JASP file.
//!
//! A `.jasp` file is a zip. `analyses.json` holds every analysis with its results tree. The tree's
//! objects are stored with sorted keys, so the on-screen order comes from each level's `.meta` list.

use serde::Serialize;
use serde_json::{Map, Value};
use std::io::{Read, Seek};
use std::path::Path;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("can't open the file: {0}")]
    Io(#[from] std::io::Error),
    #[error("this isn't a JASP file (not a zip archive): {0}")]
    Zip(#[from] zip::result::ZipError),
    #[error("the file has no results in it (analyses.json is missing)")]
    NoResults,
    #[error("the results in the file can't be read: {0}")]
    Json(#[from] serde_json::Error),
}

/// One analysis and its tables, in the order JASP shows them.
#[derive(Debug, Serialize)]
pub struct Analysis {
    pub id: i64,
    pub name: String,
    pub title: String,
    /// JASP's table objects, unchanged: title, schema, data, footnotes, ...
    pub tables: Vec<Value>,
}

#[derive(Debug, Serialize)]
pub struct JaspFile {
    pub analyses: Vec<Analysis>,
}

pub fn read_path(path: &Path) -> Result<JaspFile, Error> {
    read(std::fs::File::open(path)?)
}

pub fn read<R: Read + Seek>(reader: R) -> Result<JaspFile, Error> {
    let mut archive = zip::ZipArchive::new(reader)?;
    let mut text = String::new();
    match archive.by_name("analyses.json") {
        Ok(mut entry) => {
            entry.read_to_string(&mut text)?;
        }
        Err(zip::result::ZipError::FileNotFound) => return Err(Error::NoResults),
        Err(e) => return Err(e.into()),
    }
    parse_analyses(&serde_json::from_str(&text)?)
}

pub fn parse_analyses(root: &Value) -> Result<JaspFile, Error> {
    let list = root
        .get("analyses")
        .and_then(Value::as_array)
        .ok_or(Error::NoResults)?;
    let analyses = list
        .iter()
        .map(|a| {
            let mut tables = Vec::new();
            if let Some(results) = a.get("results").and_then(Value::as_object) {
                let meta = results.get(".meta").and_then(Value::as_array);
                collect(results, meta, &mut tables);
            }
            Analysis {
                id: a.get("id").and_then(Value::as_i64).unwrap_or(0),
                name: text(a.get("name")),
                title: text(a.get("title")),
                tables,
            }
        })
        .collect();
    Ok(JaspFile { analyses })
}

fn text(value: Option<&Value>) -> String {
    value.and_then(Value::as_str).unwrap_or("").to_string()
}

fn is_table(value: &Value) -> bool {
    value.get("schema").is_some() && value.get("data").is_some()
}

/// Walks one level of the results tree in `.meta` order; falls back to key order when there is no `.meta`.
fn collect(container: &Map<String, Value>, meta: Option<&Vec<Value>>, out: &mut Vec<Value>) {
    match meta {
        Some(entries) => {
            for entry in entries {
                let Some(name) = entry.get("name").and_then(Value::as_str) else { continue };
                let Some(child) = container.get(name) else { continue };
                match entry.get("type").and_then(Value::as_str) {
                    Some("table") if is_table(child) => out.push(child.clone()),
                    Some("collection") => {
                        if let Some(inner) = child.get("collection").and_then(Value::as_object) {
                            collect(inner, entry.get("meta").and_then(Value::as_array), out);
                        }
                    }
                    _ => {}
                }
            }
        }
        None => {
            for (name, child) in container {
                if name.starts_with('.') {
                    continue;
                }
                if is_table(child) {
                    out.push(child.clone());
                } else if let Some(inner) = child.get("collection").and_then(Value::as_object) {
                    collect(inner, child.get(".meta").and_then(Value::as_array), out);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::io::{Cursor, Write};

    fn table(title: &str) -> Value {
        json!({ "title": title, "schema": { "fields": [] }, "data": [], "status": "complete" })
    }

    fn zip_with(analyses: &Value) -> Cursor<Vec<u8>> {
        let mut buffer = Cursor::new(Vec::new());
        {
            let mut z = zip::ZipWriter::new(&mut buffer);
            let options = zip::write::SimpleFileOptions::default();
            z.start_file("manifest.json", options).unwrap();
            z.write_all(b"{}").unwrap();
            z.start_file("analyses.json", options).unwrap();
            z.write_all(analyses.to_string().as_bytes()).unwrap();
            z.finish().unwrap();
        }
        buffer.set_position(0);
        buffer
    }

    #[test]
    fn tables_follow_meta_order_through_collections() {
        let analyses = json!({ "analyses": [{
            "id": 2, "name": "RegressionLinear", "title": "Linear Regression",
            "results": {
                ".meta": [
                    { "name": "modelContainer", "type": "collection", "meta": [
                        { "name": "modelContainer_summaryTable", "type": "table" },
                        { "name": "modelContainer_anovaTable", "type": "table" }
                    ]},
                    { "name": "plot", "type": "image" },
                    { "name": "aTable", "type": "table" }
                ],
                "aTable": table("Last"),
                "modelContainer": { "collection": {
                    "modelContainer_anovaTable": table("ANOVA"),
                    "modelContainer_summaryTable": table("Model Summary")
                }},
                "plot": { "data": "x.png" }
            }
        }]});
        let file = read(zip_with(&analyses)).unwrap();
        let titles: Vec<_> = file.analyses[0].tables.iter().map(|t| t["title"].as_str().unwrap()).collect();
        assert_eq!(titles, ["Model Summary", "ANOVA", "Last"]);
        assert_eq!(file.analyses[0].title, "Linear Regression");
        assert_eq!(file.analyses[0].id, 2);
    }

    #[test]
    fn without_meta_every_table_is_found() {
        let analyses = json!({ "analyses": [{ "id": 1, "name": "X", "title": "X",
            "results": { "a": table("A"), "c": { "collection": { "b": table("B") } } } }] });
        let file = read(zip_with(&analyses)).unwrap();
        assert_eq!(file.analyses[0].tables.len(), 2);
    }

    #[test]
    fn analyses_without_results_have_no_tables() {
        let analyses = json!({ "analyses": [{ "id": 1, "name": "X", "title": "X" }] });
        assert!(read(zip_with(&analyses)).unwrap().analyses[0].tables.is_empty());
    }

    #[test]
    fn a_zip_without_results_is_refused() {
        let mut buffer = Cursor::new(Vec::new());
        {
            let mut z = zip::ZipWriter::new(&mut buffer);
            z.start_file("other.txt", zip::write::SimpleFileOptions::default()).unwrap();
            z.finish().unwrap();
        }
        buffer.set_position(0);
        assert!(matches!(read(buffer), Err(Error::NoResults)));
    }

    #[test]
    fn a_non_zip_is_refused() {
        assert!(matches!(read(Cursor::new(b"not a zip".to_vec())), Err(Error::Zip(_))));
    }

    /// Runs on JASP's own example files when they are around (they aren't part of this repo).
    #[test]
    fn example_files_if_present() {
        let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../jAPAsp/scratch/examples");
        let Ok(entries) = std::fs::read_dir(&dir) else { return };
        let mut tables = 0;
        for entry in entries.flatten() {
            if entry.path().extension().is_some_and(|e| e == "jasp") {
                let file = read_path(&entry.path()).unwrap();
                tables += file.analyses.iter().map(|a| a.tables.len()).sum::<usize>();
            }
        }
        assert!(tables > 0);
    }
}
