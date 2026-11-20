pub mod data;
pub mod jasp;

#[cfg(feature = "app")]
mod app;
#[cfg(feature = "app")]
pub use app::{install_desktop_entry, run};
