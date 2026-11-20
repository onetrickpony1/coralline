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

/// The app icon in each colour: blue (light theme), dark grey (dark theme), pink (pink theme)
fn icon_png(variant: &str) -> &'static [u8] {
    match variant {
        "dark" => include_bytes!("../icons/variants/dark.png"),
        "pink" => include_bytes!("../icons/variants/pink.png"),
        _ => include_bytes!("../icons/variants/blue.png"),
    }
}

/// Shows the icon in the chosen colour: on the window (taskbars on Windows and X11) and, on Linux, in the
/// app's desktop entry, which is where Wayland taskbars look.
#[tauri::command]
fn set_app_icon(variant: String, window: tauri::Window) -> Result<(), String> {
    let png = icon_png(&variant);
    let image = tauri::image::Image::from_bytes(png).map_err(|e| e.to_string())?;
    window.set_icon(image).map_err(|e| e.to_string())?;
    #[cfg(target_os = "linux")]
    {
        desktop_entries(&variant).map_err(|e| format!("couldn't update the desktop entry: {e}"))?;
        // Wayland taskbars look the icon up once per app id, so the window switches to the id of the
        // entry with this colour's icon
        let id = format!("japasp-{}", variant_name(&variant));
        let target = window.clone();
        window
            .run_on_main_thread(move || {
                if let Ok(gtk_window) = target.gtk_window() {
                    set_wayland_app_id(&gtk_window, &id);
                }
            })
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn variant_name(variant: &str) -> &'static str {
    match variant {
        "dark" => "dark",
        "pink" => "pink",
        _ => "blue",
    }
}

#[cfg(target_os = "linux")]
fn set_wayland_app_id(window: &gtk::ApplicationWindow, id: &str) {
    use gtk::glib::translate::ToGlibPtr;
    use gtk::prelude::*;
    extern "C" {
        fn gdk_wayland_window_set_application_id(window: *mut gtk::gdk::ffi::GdkWindow, id: *const std::os::raw::c_char);
    }
    let Some(gdk_window) = window.window() else { return };
    // Only Wayland windows have an app id; on X11 the window icon is enough
    if gdk_window.type_().name() != "GdkWaylandToplevel" && gdk_window.type_().name() != "GdkWaylandWindow" {
        return;
    }
    let Ok(id) = std::ffi::CString::new(id) else { return };
    unsafe { gdk_wayland_window_set_application_id(gdk_window.to_glib_none().0, id.as_ptr()) };
}

/// Desktop entries, which is where Wayland taskbars find an app's icon: one per colour (japasp-blue,
/// -dark, -pink, hidden from menus, matched by the window's app id), and the launcher entry japasp with
/// the current colour. Files are only rewritten when they change.
#[cfg(target_os = "linux")]
fn desktop_entries(variant: &str) -> std::io::Result<()> {
    let data = match std::env::var_os("XDG_DATA_HOME") {
        Some(dir) if !dir.is_empty() => PathBuf::from(dir),
        _ => PathBuf::from(std::env::var_os("HOME").ok_or_else(|| std::io::Error::other("no home folder"))?).join(".local/share"),
    };
    let icons = data.join("japasp");
    let apps = data.join("applications");
    std::fs::create_dir_all(&icons)?;
    std::fs::create_dir_all(&apps)?;
    let exe = std::env::current_exe()?;
    let entry = |id: &str, icon: &Path, hidden: bool| {
        format!(
            "[Desktop Entry]\nType=Application\nName=jAPAsp\nComment=Copy JASP tables as APA 7 tables\nExec=\"{}\" %f\nIcon={}\nTerminal=false\nCategories=Education;Science;\nStartupWMClass={id}\n{}",
            exe.display(),
            icon.display(),
            if hidden { "NoDisplay=true\n" } else { "" }
        )
    };
    // Icon files are named after their content, so a redesigned icon gets a new path: KDE caches icons by path
    let file_of = |name: &str| {
        use std::hash::{Hash, Hasher};
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        icon_png(name).hash(&mut hasher);
        icons.join(format!("icon-{name}-{:08x}.png", hasher.finish() as u32))
    };
    let current_files: Vec<PathBuf> = ["blue", "dark", "pink"].iter().map(|n| file_of(n)).collect();
    if let Ok(entries) = std::fs::read_dir(&icons) {
        for old in entries.flatten().map(|e| e.path()) {
            if old.extension().is_some_and(|x| x == "png") && !current_files.contains(&old) {
                let _ = std::fs::remove_file(old);
            }
        }
    }
    for name in ["blue", "dark", "pink"] {
        let icon = file_of(name);
        write_if_changed(&icon, icon_png(name))?;
        let id = format!("japasp-{name}");
        write_if_changed(&apps.join(format!("{id}.desktop")), entry(&id, &icon, true).as_bytes())?;
    }
    let current = file_of(variant_name(variant));
    if write_if_changed(&apps.join("japasp.desktop"), entry("japasp", &current, false).as_bytes())? {
        refresh_app_menu();
    }
    Ok(())
}

/// KDE's app search and menu read a cache of the desktop entries (sycoca) that it only rebuilds now and then, so
/// a new launcher icon would show up late. Asks KDE to rebuild it now, in the background; elsewhere nothing to do.
#[cfg(target_os = "linux")]
fn refresh_app_menu() {
    for tool in ["kbuildsycoca6", "kbuildsycoca5"] {
        let started = std::process::Command::new(tool)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn();
        if let Ok(mut child) = started {
            std::thread::spawn(move || child.wait());  // reap it, so it doesn't linger as a zombie
            return;
        }
    }
}

/// For the installer: the launcher entry and icons, before the app has been opened (Linux only; elsewhere a no-op)
pub fn install_desktop_entry() -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        move_old_name();
        desktop_entries("blue").map_err(|e| format!("couldn't write the desktop entry: {e}"))?;
    }
    Ok(())
}

#[cfg(target_os = "linux")]
/// Returns whether the file was written
fn write_if_changed(path: &Path, bytes: &[u8]) -> std::io::Result<bool> {
    if std::fs::read(path).map(|old| old == bytes).unwrap_or(false) {
        return Ok(false);
    }
    std::fs::write(path, bytes)?;
    Ok(true)
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

/// Up to 0.1.0 the app was called japasp-tool. Its settings (theme, recent files) live in WebKit's storage, in a
/// folder named after the app identifier, so that folder is moved to the new name once. On Linux the launcher
/// entries and icons it wrote under the old name are removed (the app writes new ones under the new name).
fn move_old_name() {
    const OLD: &str = "io.github.onetrickpony1.japasp-tool";
    const NEW: &str = "io.github.onetrickpony1.japasp";
    let home = std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE")).map(PathBuf::from);
    let mut bases: Vec<PathBuf> = Vec::new();
    match std::env::var_os("XDG_DATA_HOME") {
        Some(dir) if !dir.is_empty() => bases.push(PathBuf::from(dir)),
        _ => bases.extend(home.iter().map(|h| h.join(".local/share"))),
    }
    bases.extend(std::env::var_os("LOCALAPPDATA").map(PathBuf::from));
    bases.extend(std::env::var_os("APPDATA").map(PathBuf::from));
    bases.extend(home.iter().flat_map(|h| [h.join("Library/Application Support"), h.join("Library/WebKit"), h.join("Library/Caches")]));
    for base in &bases {
        let (old, new) = (base.join(OLD), base.join(NEW));
        if old.is_dir() && !new.exists() {
            let _ = std::fs::rename(&old, &new);
        }
    }
    #[cfg(target_os = "linux")]
    if let Some(data) = bases.first() {
        for name in ["japasp-tool", "japasp-tool-blue", "japasp-tool-dark", "japasp-tool-pink"] {
            let entry = data.join("applications").join(format!("{name}.desktop"));
            if std::fs::read_to_string(&entry).is_ok_and(|text| text.contains("Name=jAPAsp")) {
                let _ = std::fs::remove_file(entry);
            }
        }
        let icons = data.join("japasp-tool");
        if let Ok(entries) = std::fs::read_dir(&icons) {
            for icon in entries.flatten().map(|e| e.path()) {
                if icon.file_name().and_then(|n| n.to_str()).is_some_and(|n| n.starts_with("icon-") && n.ends_with(".png")) {
                    let _ = std::fs::remove_file(icon);
                }
            }
            let _ = std::fs::remove_dir(icons);  // only if nothing else is in it
        }
    }
}

pub fn run(file: Option<PathBuf>) {
    move_old_name();
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
        .invoke_handler(tauri::generate_handler![open_jasp, initial_file, copy_apa, copy_text, file_stamp, set_app_icon])
        .run(tauri::generate_context!())
        .expect("the app window couldn't start");
}
