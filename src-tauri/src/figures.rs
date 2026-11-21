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
    #[error("JASP isn't installed on this computer in a way Coralline can use yet (on Linux it needs JASP's Flatpak)")]
    NoJasp,
    #[error("{0}")]
    Io(#[from] std::io::Error),
    #[error("JASP's R stopped: {0}")]
    R(String),
    #[error("{0}")]
    File(#[from] crate::jasp::Error),
    #[error("couldn't read what JASP's R wrote: {0}")]
    Json(#[from] serde_json::Error),
}

/// Where Coralline keeps its working files (the R scripts, a copy of jaspTools, the pictures)
pub fn work_dir() -> PathBuf {
    let base = std::env::var_os("XDG_CACHE_HOME")
        .filter(|d| !d.is_empty())
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("LOCALAPPDATA").map(PathBuf::from))
        .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".cache")))
        .unwrap_or_else(std::env::temp_dir);
    base.join("coralline").join("figures")
}

/// Whether this computer has a JASP that Coralline can redraw plots with
pub fn available() -> bool {
    runner().is_some()
}

/// How to start JASP's Rscript, or None when there's no JASP we can use
fn runner() -> Option<Vec<String>> {
    if cfg!(target_os = "linux") {
        let ok = Command::new("flatpak").args(["info", "org.jaspstats.JASP"]).output().map(|o| o.status.success()).unwrap_or(false);
        if ok {
            return Some(vec!["flatpak".into(), "run".into(), "--die-with-parent".into(), "--env=LC_ALL=C.UTF-8".into(), "--command=Rscript".into()]);
        }
    }
    None
}

/// Reruns the file's analyses and draws their plots. Returns figures.json with each picture as `src` (a data
/// URI), plus `rerun`: the rerun's results, one entry per analysis.
pub fn render(jasp: &Path) -> Result<serde_json::Value, Error> {
    crate::jasp::read_path(jasp)?; // the same check as opening a file: a .jasp with results, else a clear message
    let start = runner().ok_or(Error::NoJasp)?;
    let work = work_dir();
    clear_leftovers(&work);
    let scripts = work.join("r");
    // one output folder per run, so runs at the same time (two windows, two files) don't clear each other's pictures
    static RUNS: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
    let run = format!("{}-{}", std::process::id(), RUNS.fetch_add(1, std::sync::atomic::Ordering::Relaxed));
    let out = work.join(format!("out-{run}"));
    std::fs::create_dir_all(&scripts)?;
    for (name, text) in SCRIPTS {
        let path = scripts.join(name);
        if std::fs::read_to_string(&path).map(|old| old != text).unwrap_or(true) {
            std::fs::write(&path, text)?;
        }
    }
    // a copy of the file inside the work folder, so JASP's sandbox only needs access to that one folder
    let input = work.join(format!("input-{run}.jasp"));
    let log = work.join(format!("log-{run}.txt"));
    let result = run_r(&start, &work, &scripts, &input, &log, jasp, &out);
    let figures = result.and_then(|()| collect(jasp, &out));
    let _ = std::fs::remove_dir_all(&out);
    let _ = std::fs::remove_file(&input);
    let _ = std::fs::remove_file(&log);
    figures
}

/// Removes what runs that were stopped (the app closed, the computer slept) left behind: files of a run are named
/// out-*, input-* and log-*, and anything of those older than a day can't belong to a run still going.
fn clear_leftovers(work: &Path) {
    let Ok(entries) = std::fs::read_dir(work) else { return };
    let day = std::time::Duration::from_secs(24 * 60 * 60);
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        let ours = ["out-", "input-", "log-"].iter().any(|p| name.starts_with(p)) || name == "out" || name == "input.jasp";
        let old = entry.metadata().and_then(|m| m.modified()).ok().and_then(|t| t.elapsed().ok()).is_some_and(|age| age > day);
        if ours && (old || name == "out" || name == "input.jasp") {
            let path = entry.path();
            let _ = if path.is_dir() { std::fs::remove_dir_all(&path) } else { std::fs::remove_file(&path) };
        }
    }
}

/// Longest a whole file may take. figures.R stops each analysis after 3 minutes, but R can't stop code that is
/// busy inside a compiled library, so the app stops the whole run here instead of waiting for ever.
const RUN_LIMIT: std::time::Duration = std::time::Duration::from_secs(30 * 60);

fn run_r(start: &[String], work: &Path, scripts: &Path, input: &Path, log: &Path, jasp: &Path, out: &Path) -> Result<(), Error> {
    std::fs::copy(jasp, input)?;
    let mut command = Command::new(&start[0]);
    command.args(&start[1..]);
    command.arg(format!("--filesystem={}", work.display()));
    command.arg("org.jaspstats.JASP");
    command.arg(scripts.join("figures.R")).arg(input).arg(out).arg(work);
    // R's messages go to a file: a pipe nobody reads while we wait could fill up and stall R
    command.stdout(std::process::Stdio::null()).stderr(std::fs::File::create(log)?);
    let mut child = command.spawn()?;
    let began = std::time::Instant::now();
    let status = loop {
        if let Some(status) = child.try_wait()? {
            break status;
        }
        if began.elapsed() > RUN_LIMIT {
            let _ = child.kill();
            let _ = child.wait();
            return Err(Error::R(format!("it took longer than {} minutes, so Coralline stopped it", RUN_LIMIT.as_secs() / 60)));
        }
        std::thread::sleep(std::time::Duration::from_millis(200));
    };
    if !status.success() {
        let text = std::fs::read_to_string(log).unwrap_or_default();
        let tail: Vec<&str> = text.lines().filter(|l| !l.contains("LC_")).rev().take(6).collect();
        return Err(Error::R(tail.into_iter().rev().collect::<Vec<_>>().join("\n")));
    }
    Ok(())
}

fn collect(jasp: &Path, out: &Path) -> Result<serde_json::Value, Error> {
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
        let verdict = if figure.get("src").is_none() {
            Err(figure.get("error").and_then(|e| e.as_str()).unwrap_or("the plot wasn't redrawn").to_string())
        } else if status != "complete" {
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
    let switched_on = |part: &str| options.is_some_and(|o| o.iter().any(|(k, v)| k.to_lowercase().contains(part) && v.as_bool() == Some(true)));
    let bootstrap = switched_on("bootstrap")
        || options.is_some_and(|o| o.iter().any(|(k, v)| k.to_lowercase().contains("cimethod") && v.as_str().is_some_and(|s| s.contains("bootstrap"))));
    let plot = plot.to_lowercase();
    let module = analysis.get("dynamicModule").and_then(|m| m.get("moduleName")).and_then(|m| m.as_str()).unwrap_or("");
    if random_kind || bootstrap {
        Some("the analysis has random parts, so a rerun draws a slightly different picture".into())
    } else if plot.contains("scree") && switched_on("parallel") {
        // parallel analysis simulates data, and no saved table holds the simulated points
        Some("the scree plot's parallel analysis is a simulation, so a rerun draws different points".into())
    } else if plot.contains("robustness") {
        Some("robustness curves can differ a little between runs".into())
    } else if plot.contains("forest") {
        Some("redrawn forest plots don't keep JASP's study order yet".into())
    } else if module == "jaspQualityControl" {
        Some("quality control charts get crowded when redrawn with APA text sizes".into())
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
            // "error": the estimated error of a Bayes factor's numerical integration, which varies a little
            // between runs and isn't plotted (the Bayes factors themselves are still compared)
            for key in row.keys().chain(again.keys()).filter(|k| !k.starts_with('.') && *k != "error") {
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
/// the same scale as the redrawn ones): used when the rerun can't be trusted. A plot the file has but the rerun
/// didn't draw (the analysis failed, or drew a different set) is added with only JASP's picture, so no plot is lost.
fn add_originals(jasp: &Path, figures: &mut serde_json::Value) {
    let Ok(file) = std::fs::File::open(jasp) else { return };
    let Ok(mut archive) = zip::ZipArchive::new(file) else { return };
    let analyses: serde_json::Value = match archive.by_name("analyses.json") {
        Ok(entry) => serde_json::from_reader(entry).unwrap_or_default(),
        Err(_) => return,
    };
    let Some(list) = figures.get_mut("figures").and_then(|f| f.as_array_mut()) else { return };
    let saved = analyses.get("analyses").and_then(|a| a.as_array()).map(Vec::as_slice).unwrap_or_default();
    let of = |f: &serde_json::Value| f.get("analysis").and_then(|a| a.as_u64()).unwrap_or(0) as usize;
    let mut all = Vec::new();
    for (i, analysis) in saved.iter().enumerate() {
        let mut found = Vec::new();
        if let Some(results) = analysis.get("results") {
            images(results, "", &[], &mut found);
        }
        let mut used = vec![false; found.len()];
        let mut drawn: Vec<serde_json::Value> = list.iter().filter(|f| of(f) == i + 1).cloned().collect();
        for figure in drawn.iter_mut() {
            let name = figure.get("name").and_then(|n| n.as_str()).unwrap_or("").to_string();
            // the same name, else the same name with its parts in another order (JASP versions sort pairs differently)
            let hit = (0..found.len())
                .find(|&k| !used[k] && found[k].0 == name)
                .or_else(|| (0..found.len()).find(|&k| !used[k] && same_letters(&found[k].0, &name)));
            if let Some(k) = hit {
                used[k] = true;
                attach(&mut archive, figure, found[k].1);
                figure["containerTitles"] = serde_json::json!(found[k].2);
                // JASP's own title as shown (the rerun's can lack a level name the container adds)
                if let Some(t) = found[k].1.get("title").filter(|t| t.as_str().is_some_and(|t| !t.is_empty())) {
                    figure["title"] = t.clone();
                }
            }
        }
        for (k, (key, image, titles)) in found.iter().enumerate() {
            if used[k] {
                continue;
            }
            let mut figure = serde_json::json!({
                "analysis": i + 1, "name": key, "title": image.get("title").cloned().unwrap_or_default(),
                "containerTitles": titles, "error": "the rerun didn't draw this plot", "facts": null,
            });
            attach(&mut archive, &mut figure, image);
            if figure.get("original").is_some() {
                drawn.push(figure);
            }
        }
        all.extend(drawn);
    }
    all.extend(list.iter().filter(|f| of(f) == 0 || of(f) > saved.len()).cloned());
    *list = all;
    // each analysis's options, for the figure notes (what error bars show, and the like)
    figures["options"] = serde_json::Value::Array(saved.iter().map(|a| a.get("options").cloned().unwrap_or_default()).collect());
}

/// The two names hold the same characters (pair names like "a-b" and "b-a")
fn same_letters(a: &str, b: &str) -> bool {
    let sorted = |s: &str| {
        let mut c: Vec<char> = s.chars().collect();
        c.sort_unstable();
        c
    };
    a.len() == b.len() && sorted(a) == sorted(b)
}

fn attach<R: std::io::Read + std::io::Seek>(archive: &mut zip::ZipArchive<R>, figure: &mut serde_json::Value, image: &serde_json::Value) {
    let Some(path) = image.get("data").and_then(|d| d.as_str()) else { return };
    let Ok(mut entry) = archive.by_name(path) else { return };
    let mut bytes = Vec::new();
    if std::io::Read::read_to_end(&mut entry, &mut bytes).is_err() || bytes.is_empty() {
        return;
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

type Found<'a> = (String, &'a serde_json::Value, Vec<String>);

/// Every saved plot picture in an analysis's results: (its key, the image object, the titles of the containers
/// around it, outermost first), in the results' order
fn images<'a>(value: &'a serde_json::Value, key: &str, titles: &[String], out: &mut Vec<Found<'a>>) {
    match value {
        serde_json::Value::Object(map) => {
            if map.get("data").and_then(|d| d.as_str()).is_some_and(|d| d.ends_with(".png")) {
                out.push((key.to_string(), value, titles.to_vec()));
                return;
            }
            let mut inner = titles.to_vec();
            if let Some(title) = map.get("title").and_then(|t| t.as_str()).filter(|t| !t.trim().is_empty()) {
                if map.contains_key("collection") {
                    inner.push(title.to_string());
                }
            }
            for (k, v) in map {
                images(v, k, &inner, out);
            }
        }
        serde_json::Value::Array(items) => items.iter().for_each(|v| images(v, key, titles, out)),
        _ => {}
    }
}

/// The bytes of a base64 data URI ("data:image/png;base64,..."), or None when it isn't one
pub fn data_uri_bytes(uri: &str) -> Option<Vec<u8>> {
    let text = uri.strip_prefix("data:")?.split_once(";base64,")?.1;
    let value = |c: u8| -> Option<u32> {
        Some(match c {
            b'A'..=b'Z' => c - b'A',
            b'a'..=b'z' => c - b'a' + 26,
            b'0'..=b'9' => c - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            _ => return None,
        } as u32)
    };
    let clean: Vec<u8> = text.bytes().filter(|c| !c.is_ascii_whitespace() && *c != b'=').collect();
    let mut out = Vec::with_capacity(clean.len() * 3 / 4);
    for chunk in clean.chunks(4) {
        let mut n = 0u32;
        for (i, c) in chunk.iter().enumerate() {
            n |= value(*c)? << (18 - 6 * i);
        }
        out.extend(&n.to_be_bytes()[1..chunk.len()]);
    }
    Some(out)
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
        let bf = table(json!([{ "BF": 6.33, "error": 0.0016 }]));
        assert!(super::same_tables(&bf, &table(json!([{ "BF": 6.33, "error": 0.0019 }]))).is_ok(), "a Bayes factor's error estimate");
        assert!(super::same_tables(&bf, &table(json!([{ "BF": 6.4, "error": 0.0016 }]))).is_err(), "the Bayes factor itself");
        assert!(super::same_tables(&json!({}), &saved).is_err(), "nothing to check against");
        let cell = table(json!([{ "m": { "format": "dp:3", "value": 360.0 } }]));
        assert!(super::same_tables(&cell, &table(json!([{ "m": { "format": "dp:3", "value": 360 } }]))).is_ok(), "cells with a format, 360.0 = 360");
    }

    #[test]
    fn only_old_run_files_are_cleared() {
        let dir = std::env::temp_dir().join(format!("coralline-leftovers-{}", std::process::id()));
        std::fs::create_dir_all(dir.join("out-1-0")).unwrap();
        std::fs::create_dir_all(dir.join("out")).unwrap();
        std::fs::create_dir_all(dir.join("rlib")).unwrap();
        std::fs::write(dir.join("log-1-0.txt"), "").unwrap();
        let old = std::time::SystemTime::now() - std::time::Duration::from_secs(2 * 24 * 60 * 60);
        std::fs::File::options().write(true).open(dir.join("log-1-0.txt")).unwrap().set_modified(old).unwrap();
        super::clear_leftovers(&dir);
        assert!(dir.join("out-1-0").exists(), "a run from today may still be going");
        assert!(!dir.join("log-1-0.txt").exists(), "two days old");
        assert!(!dir.join("out").exists(), "the old fixed folder");
        assert!(dir.join("rlib").exists(), "not a run's file");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn pair_names_match_in_either_order() {
        assert!(super::same_letters("pairs_Box Office-Freshness_scatterPlot", "pairs_Freshness-Box Office_scatterPlot"));
        assert!(!super::same_letters("pairs_a-b_scatterPlot", "pairs_a-c_scatterPlot"));
    }

    #[test]
    fn random_analyses_keep_jasps_picture() {
        assert!(super::random_parts(&json!({ "name": "mlClassificationDecisionTree", "options": {} }), "tree").is_some());
        assert!(super::random_parts(&json!({ "name": "ClassicProcess", "options": { "ciMethod": "bootstrap" } }), "path").is_some());
        assert!(super::random_parts(&json!({ "name": "TTestBayesianIndependentSamples", "options": {} }), "drp_robustnessPlot").is_some());
        assert!(super::random_parts(&json!({ "name": "TTestBayesianIndependentSamples", "options": {} }), "drp_priorAndPosteriorPlot").is_none());
        assert!(super::random_parts(&json!({ "name": "Anova", "options": { "bootstrapEstimates": false } }), "descriptivesPlot").is_none());
        let efa = json!({ "name": "exploratoryFactorAnalysis", "options": { "screePlotParallelAnalysisResults": true } });
        assert!(super::random_parts(&efa, "modelContainer_screePlot").is_some(), "parallel analysis is simulated");
        assert!(super::random_parts(&efa, "pathPlot").is_none());
        assert!(super::random_parts(&json!({ "name": "ClassicMetaAnalysis", "options": {} }), "forestPlot").is_some());
        assert!(super::random_parts(&json!({ "name": "attributesCharts", "options": {}, "dynamicModule": { "moduleName": "jaspQualityControl" } }), "pChart").is_some());
    }

    #[test]
    fn base64_matches_the_standard() {
        assert_eq!(super::base64(b""), "");
        assert_eq!(super::base64(b"f"), "Zg==");
        assert_eq!(super::base64(b"fo"), "Zm8=");
        assert_eq!(super::base64(b"foo"), "Zm9v");
        assert_eq!(super::base64(b"foobar"), "Zm9vYmFy");
    }

    #[test]
    fn data_uris_decode_back() {
        for text in [&b""[..], b"f", b"fo", b"foo", b"foobar", &[0, 255, 128, 7, 9]] {
            let uri = format!("data:image/png;base64,{}", super::base64(text));
            assert_eq!(super::data_uri_bytes(&uri).as_deref(), Some(text));
        }
        assert_eq!(super::data_uri_bytes("not a uri"), None);
        assert_eq!(super::data_uri_bytes("data:image/png;base64,***"), None);
    }
}
