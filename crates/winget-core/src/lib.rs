//! Parsers for `winget` command-line output.
//!
//! winget has no JSON output for search/list/upgrade/show, so this crate turns its
//! human-readable tables and `Key: value` blocks into typed data. It has no
//! dependency on Tauri so it can be unit-tested anywhere.

pub mod model;
pub mod parse;
pub mod progress;

pub use model::*;
pub use parse::*;
pub use progress::*;
