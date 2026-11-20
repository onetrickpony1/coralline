//! The app window: opens .jasp files and puts APA tables on the clipboard.

use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::State;

use crate::jasp;

/// The clipboard is kept for the app's lifetime: on Linux the copied table lives only as long as its owner.
struct Clipboard(Mutex<Option<arboard::Clipboard>>);

/// A file given on the command line, opened once the window is ready
struct InitialFile(Mutex<Option<PathBuf>>);

#[tauri::command]
fn open_jasp(path: String) -> Result<jasp::JaspFile, String> {
    jasp::read_path(Path::new(&path)).map_err(|e| e.to_string())
}

#[tauri::command]
fn initial_file(state: State<InitialFile>) -> Option<String> {
    state.0.lock().ok()?.take().map(|p| p.to_string_lossy().into_owned())
}

/// When the file was last saved (milliseconds), so the window can reload it after JASP saves again.
/// None when the file is gone or unreadable.
#[tauri::command]
fn file_stamp(path: String) -> Option<u64> {
    let modified = std::fs::metadata(path).ok()?.modified().ok()?;
    Some(modified.duration_since(std::time::UNIX_EPOCH).ok()?.as_millis() as u64)
}

fn with_clipboard(state: &State<Clipboard>, f: impl FnOnce(&mut arboard::Clipboard) -> Result<(), arboard::Error>) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|_| "the clipboard is busy".to_string())?;
    if guard.is_none() {
        *guard = Some(arboard::Clipboard::new().map_err(|e| e.to_string())?);
    }
    f(guard.as_mut().expect("set above")).map_err(|e| e.to_string())
}

#[tauri::command]
fn copy_apa(html: String, text: String, state: State<Clipboard>) -> Result<(), String> {
    with_clipboard(&state, |c| c.set_html(html, Some(text)))
}

/// Plain text only (tab-separated), for spreadsheets and plain editors
#[tauri::command]
fn copy_text(text: String, state: State<Clipboard>) -> Result<(), String> {
    with_clipboard(&state, |c| c.set_text(text))
}

/// True on Wayland with an NVIDIA driver older than 545 (the versions with the blank-window bug)
#[cfg(target_os = "linux")]
fn needs_dmabuf_workaround() -> bool {
    if std::env::var_os("WAYLAND_DISPLAY").is_none() {
        return false;
    }
    match std::fs::read_to_string("/proc/driver/nvidia/version") {
        Ok(text) => nvidia_major(&text).is_none_or(|major| major < 545),
        Err(_) => false,
    }
}

/// The driver's major version from /proc/driver/nvidia/version ("... Kernel Module ... 620.70.06 ...")
fn nvidia_major(text: &str) -> Option<u32> {
    let first = text.lines().next()?;
    first
        .split_whitespace()
        .find(|w| w.contains('.') && w.split('.').all(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_digit())))?
        .split('.')
        .next()?
        .parse()
        .ok()
}

#[cfg(test)]
mod tests {
    #[test]
    fn reads_the_nvidia_driver_version() {
        let open = "NVRM version: NVIDIA UNIX Open Kernel Module for x86_64  620.70.06  Release Build  (root@)  Tue";
        assert_eq!(super::nvidia_major(open), Some(620));
        let old = "NVRM version: NVIDIA UNIX x86_64 Kernel Module  535.183.01  Sun May 12 19:39:15 UTC 2024";
        assert_eq!(super::nvidia_major(old), Some(535));
        assert_eq!(super::nvidia_major("garbage"), None);
    }
}

pub fn run(file: Option<PathBuf>) {
    // Older NVIDIA drivers on Wayland show WebKit windows blank unless WebKit's DMA-BUF renderer is off. Turning it
    // off makes WebKit copy every frame through memory, which makes scrolling slow, so it is only done there.
    // Setting WEBKIT_DISABLE_DMABUF_RENDERER yourself (0 or 1) always wins.
    #[cfg(target_os = "linux")]
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() && needs_dmabuf_workaround() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Clipboard(Mutex::new(None)))
        .manage(InitialFile(Mutex::new(file)))
        .invoke_handler(tauri::generate_handler![open_jasp, initial_file, copy_apa, copy_text, file_stamp])
        .run(tauri::generate_context!())
        .expect("the app window couldn't start");
}
