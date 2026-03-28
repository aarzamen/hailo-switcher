use crate::process_manager::{self, StatusPayload};
use crate::SharedProcessManager;
use tauri::{AppHandle, Emitter, State};

const HAILO_EXAMPLES_DIR: &str = "/home/ama/hailo/hailo-rpi5-examples";
const PYTHON_BIN: &str =
    "/home/ama/hailo/hailo-rpi5-examples/venv_hailo_rpi_examples/bin/python";
const ENV_FILE: &str = "/home/ama/hailo/hailo-rpi5-examples/.env";

#[tauri::command]
pub async fn start_pipeline(
    app: AppHandle,
    pipeline_type: String,
    script: Option<String>,
    json_config: Option<String>,
    input_source: Option<String>,
    state: State<'_, SharedProcessManager>,
) -> Result<(), String> {
    // Stop any existing pipeline first
    let was_running = {
        let mut mgr = state.lock().map_err(|e| e.to_string())?;
        if mgr.is_running() {
            mgr.stop()?;
            true
        } else {
            false
        }
    };
    if was_running {
        // Wait for SIGKILL to take effect and Hailo device to be released
        tokio::time::sleep(std::time::Duration::from_millis(2000)).await;
    }

    let _ = app.emit(
        "pipeline-status",
        StatusPayload {
            status: "starting".to_string(),
            error: None,
        },
    );

    let manager = state.inner().clone();

    match pipeline_type.as_str() {
        "python" => {
            let script = script.ok_or("Missing script for python pipeline")?;
            let mut args = vec![
                format!("basic_pipelines/{}", script),
                "--show-fps".to_string(),
            ];
            if let Some(ref input) = input_source {
                args.push("--input".to_string());
                args.push(input.clone());
            }

            let env_vars = vec![
                ("PYTHONPATH".to_string(), HAILO_EXAMPLES_DIR.to_string()),
                ("HAILO_ENV_FILE".to_string(), ENV_FILE.to_string()),
                ("GST_PLUGIN_PATH".to_string(), "/usr/lib/aarch64-linux-gnu/gstreamer-1.0".to_string()),
                ("LD_LIBRARY_PATH".to_string(), "/usr/lib/aarch64-linux-gnu/hailo/tappas/post_processes:/usr/local/hailo/resources/so".to_string()),
            ];

            process_manager::spawn_pipeline(
                app,
                PYTHON_BIN,
                &args,
                env_vars,
                Some(HAILO_EXAMPLES_DIR),
                manager,
            )?;
        }
        "rpicam" => {
            let json_config =
                json_config.ok_or("Missing json_config for rpicam pipeline")?;
            let args = vec![
                "-t".to_string(),
                "0".to_string(),
                "--post-process-file".to_string(),
                format!("/usr/share/rpi-camera-assets/{}", json_config),
            ];

            process_manager::spawn_pipeline(
                app,
                "rpicam-hello",
                &args,
                vec![],
                None,
                manager,
            )?;
        }
        _ => return Err(format!("Unknown pipeline type: {}", pipeline_type)),
    }

    Ok(())
}

#[tauri::command]
pub async fn stop_pipeline(
    app: AppHandle,
    state: State<'_, SharedProcessManager>,
) -> Result<(), String> {
    let mut mgr = state.lock().map_err(|e| e.to_string())?;
    mgr.stop()?;

    let _ = app.emit(
        "pipeline-status",
        StatusPayload {
            status: "stopping".to_string(),
            error: None,
        },
    );

    Ok(())
}

#[tauri::command]
pub async fn get_pipeline_status(
    state: State<'_, SharedProcessManager>,
) -> Result<String, String> {
    let mgr = state.lock().map_err(|e| e.to_string())?;
    Ok(mgr.status().to_string())
}
