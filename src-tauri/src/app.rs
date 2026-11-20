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

pub fn run(file: Option<PathBuf>) {
    // Some Linux graphics drivers (NVIDIA on Wayland) show WebKit windows blank without this
    #[cfg(target_os = "linux")]
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
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
