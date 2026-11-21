// Hides the console window on Windows release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;

const USAGE: &str = "Usage:\n  coralline [FILE.jasp]       open the app (with a file)\n  coralline --json FILE.jasp  print the file's tables as JSON\n  coralline --figures FILE.jasp  rerun the analyses in JASP's R and print the APA figures as JSON\n  coralline --version         print the version";

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match args.first().map(String::as_str) {
        Some("--help") | Some("-h") => println!("{USAGE}"),
        Some("--version") | Some("-V") => println!("coralline {}", env!("CARGO_PKG_VERSION")),
        Some("--desktop-entry") => desktop_entry(),
        Some("--json") => {
            let Some(path) = args.get(1) else {
                eprintln!("{USAGE}");
                std::process::exit(2);
            };
            match coralline_lib::jasp::read_path(&PathBuf::from(path)) {
                Ok(file) => println!("{}", serde_json::to_string(&file).expect("tables are valid JSON")),
                Err(e) => {
                    eprintln!("{path}: {e}");
                    std::process::exit(1);
                }
            }
        }
        Some("--figures") => {
            let Some(path) = args.get(1) else {
                eprintln!("{USAGE}");
                std::process::exit(2);
            };
            match coralline_lib::figures::render(&PathBuf::from(path)) {
                Ok(figures) => println!("{figures}"),
                Err(e) => {
                    eprintln!("{path}: {e}");
                    std::process::exit(1);
                }
            }
        }
        first => open_app(first.map(PathBuf::from)),
    }
}

#[cfg(feature = "app")]
fn open_app(file: Option<PathBuf>) {
    coralline_lib::run(file);
}

#[cfg(not(feature = "app"))]
fn open_app(_file: Option<PathBuf>) {
    eprintln!("This build has no app window (built without the \"app\" feature).\n{USAGE}");
    std::process::exit(2);
}

/// Used by install.sh: adds Coralline to the Linux app menu
#[cfg(feature = "app")]
fn desktop_entry() {
    if let Err(e) = coralline_lib::install_desktop_entry() {
        eprintln!("{e}");
        std::process::exit(1);
    }
}

#[cfg(not(feature = "app"))]
fn desktop_entry() {}
