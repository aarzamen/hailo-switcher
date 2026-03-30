mod commands;
pub mod config;
mod process_manager;
pub mod video_sources;

use std::sync::{Arc, Mutex};
use process_manager::ProcessManager;

/// Uses std::sync::Mutex (not tokio::Mutex) because all critical sections are
/// short and non-async — the lock is never held across an `.await` point.
/// This avoids the Send bound issues that tokio::Mutex would introduce with
/// Tauri's State extractor while remaining safe for the async command handlers.
pub type SharedProcessManager = Arc<Mutex<ProcessManager>>;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let manager: SharedProcessManager = Arc::new(Mutex::new(ProcessManager::new()));
    let cfg = config::Config::load();
    let recording_state: commands::capture::SharedRecordingState =
        Mutex::new(commands::capture::RecordingState::new());
    let detection_log: commands::detection_log::SharedDetectionLog =
        Mutex::new(commands::detection_log::DetectionLog::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .manage(manager)
        .manage(cfg)
        .manage(recording_state)
        .manage(detection_log)
        .invoke_handler(tauri::generate_handler![
            commands::pipeline::start_pipeline,
            commands::pipeline::stop_pipeline,
            commands::pipeline::get_pipeline_status,
            commands::system::list_video_devices,
            commands::system::detect_sources,
            commands::system::check_hailo_status,
            commands::capture::take_screenshot,
            commands::capture::start_recording,
            commands::capture::stop_recording,
            commands::detection_log::parse_detection_line,
            commands::detection_log::get_detection_stats,
            commands::detection_log::get_detection_log,
            commands::detection_log::export_detection_log,
            commands::detection_log::clear_detection_log,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
