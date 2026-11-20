//! Plots as APA figures: reruns a file's analyses in JASP's own R (`r/figures.R`) and reads back what it drew:
//! one PNG per plot (returned as a data URI), its size and facts, and the rerun's results so the caller can check
//! them against the file before trusting the pictures. Only JASP's Flatpak on Linux is supported so far.
use std::path::{Path, PathBuf};
use std::process::Command;

const SCRIPTS: [(&str, &str); 4] = [
    ("figures.R", include_str!("../r/figures.R")),
    ("engine.R", include_str!("../r/engine.R")),
    ("readjasp.R", include_str!("../r/readjasp.R")),
    ("apastyle.R", include_str!("../r/apastyle.R")),
];

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("JASP isn't installed on this computer in a way jAPAsp can use yet (on Linux it needs JASP's Flatpak)")]
    NoJasp,
    #[error("{0}")]
    Io(#[from] std::io::Error),
    #[error("JASP's R stopped: {0}")]
    R(String),
    #[error("couldn't read what JASP's R wrote: {0}")]
    Json(#[from] serde_json::Error),
}

/// Where jAPAsp keeps its working files (the R scripts, a copy of jaspTools, the pictures)
pub fn work_dir() -> PathBuf {
    let base = std::env::var_os("XDG_CACHE_HOME")
        .filter(|d| !d.is_empty())
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("LOCALAPPDATA").map(PathBuf::from))
        .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".cache")))
        .unwrap_or_else(std::env::temp_dir);
    base.join("japasp").join("figures")
}

/// How to start JASP's Rscript, or None when there's no JASP we can use
fn runner() -> Option<Vec<String>> {
    if cfg!(target_os = "linux") {
        let ok = Command::new("flatpak").args(["info", "org.jaspstats.JASP"]).output().map(|o| o.status.success()).unwrap_or(false);
        if ok {
            return Some(vec!["flatpak".into(), "run".into(), "--env=LC_ALL=C.UTF-8".into(), "--command=Rscript".into()]);
        }
    }
    None
}

/// Reruns the file's analyses and draws their plots. Returns figures.json with each picture as `src` (a data
/// URI), plus `rerun`: the rerun's results, one entry per analysis.
pub fn render(jasp: &Path) -> Result<serde_json::Value, Error> {
    let start = runner().ok_or(Error::NoJasp)?;
    let work = work_dir();
    let scripts = work.join("r");
    let out = work.join("out");
    std::fs::create_dir_all(&scripts)?;
    for (name, text) in SCRIPTS {
        let path = scripts.join(name);
        if std::fs::read_to_string(&path).map(|old| old != text).unwrap_or(true) {
            std::fs::write(&path, text)?;
        }
    }
    if out.exists() {
        std::fs::remove_dir_all(&out)?;
    }
    // A copy inside the work folder, so JASP's sandbox only needs access to that one folder
    let input = work.join("input.jasp");
    std::fs::copy(jasp, &input)?;
    let mut command = Command::new(&start[0]);
    command.args(&start[1..]);
    command.arg(format!("--filesystem={}", work.display()));
    command.arg("org.jaspstats.JASP");
    command.arg(scripts.join("figures.R")).arg(&input).arg(&out).arg(&work);
    let result = command.output()?;
    if !result.status.success() {
        let text = String::from_utf8_lossy(&result.stderr);
        let tail: Vec<&str> = text.lines().filter(|l| !l.contains("LC_")).rev().take(6).collect();
        return Err(Error::R(tail.into_iter().rev().collect::<Vec<_>>().join("\n")));
    }
    let mut figures: serde_json::Value = serde_json::from_str(&std::fs::read_to_string(out.join("figures.json"))?)?;
    if let Some(list) = figures.get_mut("figures").and_then(|f| f.as_array_mut()) {
        for figure in list {
            if let Some(png) = figure.get("png").and_then(|p| p.as_str()).map(String::from) {
                let bytes = std::fs::read(out.join(&png))?;
                figure["src"] = serde_json::Value::String(format!("data:image/png;base64,{}", base64(&bytes)));
            }
        }
    }
    figures["rerun"] = serde_json::from_str(&std::fs::read_to_string(out.join("rerun.json"))?)?;
    add_originals(jasp, &mut figures);
    add_trust(jasp, &mut figures);
    Ok(figures)
}

/// Marks each figure `trusted` when its analysis's rerun reproduced every table the file saved (all values equal,
/// up to rounding in the last digits). Otherwise `trusted` is false and `why` says what differed: the caller then
/// shows JASP's own picture. An analysis without tables can't be checked, so its figures aren't trusted either.
fn add_trust(jasp: &Path, figures: &mut serde_json::Value) {
    let saved: serde_json::Value = std::fs::File::open(jasp)
        .ok()
        .and_then(|f| zip::ZipArchive::new(f).ok())
        .and_then(|mut a| a.by_name("analyses.json").ok().and_then(|e| serde_json::from_reader(e).ok()))
        .unwrap_or_default();
    let rerun = figures.get("rerun").cloned().unwrap_or_default();
    let analyses = figures.get("analyses").cloned().unwrap_or_default();
    let Some(list) = figures.get_mut("figures").and_then(|f| f.as_array_mut()) else { return };
    for figure in list {
        let index = figure.get("analysis").and_then(|a| a.as_u64()).unwrap_or(0) as usize;
        let before = saved.get("analyses").and_then(|a| a.get(index.wrapping_sub(1))).and_then(|a| a.get("results"));
        let after = rerun.get(index.wrapping_sub(1)).filter(|r| !r.is_null());
        let status = analyses.get(index.wrapping_sub(1)).and_then(|a| a.get("status")).and_then(|s| s.as_str()).unwrap_or("");
        let saved_analysis = saved.get("analyses").and_then(|a| a.get(index.wrapping_sub(1)));
        let plot = figure.get("name").and_then(|n| n.as_str()).unwrap_or("");
        let verdict = if status != "complete" {
            Err(format!("the rerun ended with {}", if status.is_empty() { "no status" } else { status }))
        } else if let Some(why) = saved_analysis.and_then(|a| random_parts(a, plot)) {
            Err(why)
        } else {
            match (before, after) {
                (Some(b), Some(a)) => same_tables(b, a),
                _ => Err("the analysis didn't rerun".to_string()),
            }
        };
        figure["trusted"] = serde_json::Value::Bool(verdict.is_ok());
        if let Err(why) = verdict {
            figure["why"] = serde_json::Value::String(why);
        }
    }
}

/// Plots that a rerun can't reproduce exactly even when the tables match: random draws (machine learning,
/// clustering, forecasts, MCMC, bootstrap, networks) and Bayes factor robustness curves. Their pictures stay JASP's.
fn random_parts(analysis: &serde_json::Value, plot: &str) -> Option<String> {
    let name = analysis.get("name").and_then(|n| n.as_str()).unwrap_or("");
    let random_kind = name.starts_with("ml")
        || ["Prophet", "Bsts", "JAGS", "Network", "BayesianProcess", "Bain", "LearnBayes", "LS", "audit"].iter().any(|k| name.contains(k));
    let options = analysis.get("options").and_then(|o| o.as_object());
    let bootstrap = options.is_some_and(|o| {
        o.iter().any(|(k, v)| {
            let k = k.to_lowercase();
            (k.contains("bootstrap") && v.as_bool() == Some(true)) || (k.contains("cimethod") && v.as_str().is_some_and(|s| s.contains("bootstrap")))
        })
    });
    if random_kind || bootstrap {
        Some("the analysis has random parts, so a rerun draws a slightly different picture".into())
    } else if plot.to_lowercase().contains("robustness") {
        Some("robustness curves can differ a little between runs".into())
    } else {
        None
    }
}

/// Every table (an object with `data` rows and a `schema`) by its key path
fn tables<'a>(value: &'a serde_json::Value, path: String, out: &mut Vec<(String, &'a serde_json::Value)>) {
    match value {
        serde_json::Value::Object(map) => {
            if map.get("data").is_some_and(|d| d.is_array()) && map.contains_key("schema") {
                out.push((path, value));
                return;
            }
            for (key, v) in map {
                tables(v, format!("{path}/{key}"), out);
            }
        }
        serde_json::Value::Array(items) => {
            for (i, v) in items.iter().enumerate() {
                tables(v, format!("{path}/{i}"), out);
            }
        }
        _ => {}
    }
}

fn number(value: &serde_json::Value) -> Option<f64> {
    match value {
        serde_json::Value::Number(n) => n.as_f64(),
        serde_json::Value::String(s) => s.trim().parse().ok(),
        _ => None,
    }
}

fn same_value(a: &serde_json::Value, b: &serde_json::Value) -> bool {
    match (number(a), number(b)) {
        (Some(x), Some(y)) if x.is_nan() || y.is_nan() => x.is_nan() && y.is_nan(),
        (Some(x), Some(y)) => x == y || (x - y).abs() <= 1e-9_f64.max(1e-6 * x.abs().max(y.abs())),
        _ => match (a, b) {
            // cells like { format, type, value }: field by field, so 360.0 and 360 are the same number
            (serde_json::Value::Object(x), serde_json::Value::Object(y)) => {
                x.len() == y.len() && x.iter().all(|(k, v)| y.get(k).is_some_and(|w| same_value(v, w)))
            }
            (serde_json::Value::Array(x), serde_json::Value::Array(y)) => x.len() == y.len() && x.iter().zip(y).all(|(v, w)| same_value(v, w)),
            _ => a == b,
        },
    }
}

fn same_tables(saved: &serde_json::Value, rerun: &serde_json::Value) -> Result<(), String> {
    let (mut before, mut after) = (Vec::new(), Vec::new());
    tables(saved, String::new(), &mut before);
    tables(rerun, String::new(), &mut after);
    if before.is_empty() {
        return Err("the analysis has no tables to check the rerun against".into());
    }
    let missing = serde_json::Value::String("<missing>".into());
    for (path, table) in &before {
        let Some((_, other)) = after.iter().find(|(p, _)| p == path) else {
            return Err(format!("the rerun has no table {path}"));
        };
        let rows = table["data"].as_array().map(Vec::as_slice).unwrap_or_default();
        let others = other["data"].as_array().map(Vec::as_slice).unwrap_or_default();
        if rows.len() != others.len() {
            return Err(format!("{path}: {} rows saved, {} in the rerun", rows.len(), others.len()));
        }
        for (i, (row, again)) in rows.iter().zip(others).enumerate() {
            let (Some(row), Some(again)) = (row.as_object(), again.as_object()) else { continue };
            for key in row.keys().chain(again.keys()).filter(|k| !k.starts_with('.')) {
                let (a, b) = (row.get(key).unwrap_or(&missing), again.get(key).unwrap_or(&missing));
                if !same_value(a, b) {
                    return Err(format!("{path}: row {} {key}: {a} saved, {b} in the rerun", i + 1));
                }
            }
        }
    }
    Ok(())
}

/// JASP's own picture of each plot, from the file (`original`, a data URI, with `originalWidthIn`/`HeightIn` at
/// the same scale as the redrawn ones): used when the rerun can't be trusted. Missing pictures are left out.
fn add_originals(jasp: &Path, figures: &mut serde_json::Value) {
    let Ok(file) = std::fs::File::open(jasp) else { return };
    let Ok(mut archive) = zip::ZipArchive::new(file) else { return };
    let analyses: serde_json::Value = match archive.by_name("analyses.json") {
        Ok(entry) => serde_json::from_reader(entry).unwrap_or_default(),
        Err(_) => return,
    };
    let Some(list) = figures.get_mut("figures").and_then(|f| f.as_array_mut()) else { return };
    for figure in list {
        let index = figure.get("analysis").and_then(|a| a.as_u64()).unwrap_or(0) as usize;
        let Some(name) = figure.get("name").and_then(|n| n.as_str()).map(String::from) else { continue };
        let Some(results) = analyses.get("analyses").and_then(|a| a.get(index.wrapping_sub(1))).and_then(|a| a.get("results")) else { continue };
        let Some(image) = find_image(results, &name) else { continue };
        let Some(path) = image.get("data").and_then(|d| d.as_str()) else { continue };
        let mut bytes = Vec::new();
        if let Ok(mut entry) = archive.by_name(path) {
            if std::io::Read::read_to_end(&mut entry, &mut bytes).is_err() {
                continue;
            }
        } else {
            continue;
        }
        figure["original"] = serde_json::Value::String(format!("data:image/png;base64,{}", base64(&bytes)));
        // JASP's size in CSS pixels (72 per inch), on the same scale as figures.R: a 530 px plot becomes 5 in
        let scale = 5.0 / (530.0 / 72.0);
        for (key, out) in [("width", "originalWidthIn"), ("height", "originalHeightIn")] {
            if let Some(px) = image.get(key).and_then(|v| v.as_f64()) {
                figure[out] = serde_json::json!(px / 72.0 * scale);
            }
        }
    }
}

/// The image object stored under this name anywhere in an analysis's results
fn find_image<'a>(value: &'a serde_json::Value, name: &str) -> Option<&'a serde_json::Value> {
    match value {
        serde_json::Value::Object(map) => {
            if let Some(found) = map.get(name).filter(|v| v.get("data").and_then(|d| d.as_str()).is_some_and(|d| d.ends_with(".png"))) {
                return Some(found);
            }
            map.values().find_map(|v| find_image(v, name))
        }
        serde_json::Value::Array(items) => items.iter().find_map(|v| find_image(v, name)),
        _ => None,
    }
}

fn base64(bytes: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let n = (chunk[0] as u32) << 16 | (*chunk.get(1).unwrap_or(&0) as u32) << 8 | *chunk.get(2).unwrap_or(&0) as u32;
        for i in 0..4 {
            out.push(if i <= chunk.len() { TABLE[(n >> (18 - 6 * i) & 63) as usize] as char } else { '=' });
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    fn table(rows: serde_json::Value) -> serde_json::Value {
        json!({ "main": { "schema": {}, "data": rows, "title": "T" } })
    }

    #[test]
    fn a_rerun_is_trusted_only_when_its_tables_match() {
        let saved = table(json!([{ "v": "a", "x": 0.30000000000000004, ".isNewGroup": true }]));
        assert!(super::same_tables(&saved, &table(json!([{ "v": "a", "x": 0.3 }]))).is_ok(), "rounding in the last digits");
        assert!(super::same_tables(&saved, &table(json!([{ "v": "a", "x": "0.3" }]))).is_ok(), "numbers written as text");
        assert!(super::same_tables(&saved, &table(json!([{ "v": "a", "x": 0.31 }]))).is_err(), "a different value");
        assert!(super::same_tables(&saved, &table(json!([{ "v": "b", "x": 0.3 }]))).is_err(), "a different label");
        assert!(super::same_tables(&saved, &table(json!([]))).is_err(), "missing rows");
        assert!(super::same_tables(&saved, &json!({})).is_err(), "a missing table");
        assert!(super::same_tables(&json!({}), &saved).is_err(), "nothing to check against");
        let cell = table(json!([{ "m": { "format": "dp:3", "value": 360.0 } }]));
        assert!(super::same_tables(&cell, &table(json!([{ "m": { "format": "dp:3", "value": 360 } }]))).is_ok(), "cells with a format, 360.0 = 360");
    }

    #[test]
    fn random_analyses_keep_jasps_picture() {
        assert!(super::random_parts(&json!({ "name": "mlClassificationDecisionTree", "options": {} }), "tree").is_some());
        assert!(super::random_parts(&json!({ "name": "ClassicProcess", "options": { "ciMethod": "bootstrap" } }), "path").is_some());
        assert!(super::random_parts(&json!({ "name": "TTestBayesianIndependentSamples", "options": {} }), "drp_robustnessPlot").is_some());
        assert!(super::random_parts(&json!({ "name": "TTestBayesianIndependentSamples", "options": {} }), "drp_priorAndPosteriorPlot").is_none());
        assert!(super::random_parts(&json!({ "name": "Anova", "options": { "bootstrapEstimates": false } }), "descriptivesPlot").is_none());
    }

    #[test]
    fn base64_matches_the_standard() {
        assert_eq!(super::base64(b""), "");
        assert_eq!(super::base64(b"f"), "Zg==");
        assert_eq!(super::base64(b"fo"), "Zm8=");
        assert_eq!(super::base64(b"foo"), "Zm9v");
        assert_eq!(super::base64(b"foobar"), "Zm9vYmFy");
    }
}
