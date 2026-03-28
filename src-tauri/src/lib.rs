mod commands;
mod process_manager;

use std::sync::{Arc, Mutex};
use process_manager::ProcessManager;

pub type SharedProcessManager = Arc<Mutex<ProcessManager>>;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let manager: SharedProcessManager = Arc::new(Mutex::new(ProcessManager::new()));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .manage(manager)
        .invoke_handler(tauri::generate_handler![
            commands::pipeline::start_pipeline,
            commands::pipeline::stop_pipeline,
            commands::pipeline::get_pipeline_status,
            commands::system::list_video_devices,
            commands::system::check_hailo_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
