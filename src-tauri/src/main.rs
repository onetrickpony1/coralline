// Hides the console window on Windows release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;

const USAGE: &str = "Usage:\n  japasp-tool [FILE.jasp]        open the app (with a file)\n  japasp-tool --json FILE.jasp   print the file's tables as JSON";

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match args.first().map(String::as_str) {
        Some("--help") | Some("-h") => println!("{USAGE}"),
        Some("--json") => {
            let Some(path) = args.get(1) else {
                eprintln!("{USAGE}");
                std::process::exit(2);
            };
            match japasp_tool::jasp::read_path(&PathBuf::from(path)) {
                Ok(file) => println!("{}", serde_json::to_string(&file).expect("tables are valid JSON")),
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
    japasp_tool::run(file);
}

#[cfg(not(feature = "app"))]
fn open_app(_file: Option<PathBuf>) {
    eprintln!("This build has no app window (built without the \"app\" feature).\n{USAGE}");
    std::process::exit(2);
}
