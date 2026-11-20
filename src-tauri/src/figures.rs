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
    Ok(figures)
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
    #[test]
    fn base64_matches_the_standard() {
        assert_eq!(super::base64(b""), "");
        assert_eq!(super::base64(b"f"), "Zg==");
        assert_eq!(super::base64(b"fo"), "Zm8=");
        assert_eq!(super::base64(b"foo"), "Zm9v");
        assert_eq!(super::base64(b"foobar"), "Zm9vYmFy");
    }
}
