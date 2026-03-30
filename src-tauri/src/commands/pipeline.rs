use crate::config::Config;
use crate::process_manager::{self, StatusPayload};
use crate::video_sources::VideoSource;
use crate::SharedProcessManager;
use tauri::{AppHandle, Emitter, State};

#[tauri::command]
pub async fn start_pipeline(
    app: AppHandle,
    pipeline_type: String,
    script: Option<String>,
    json_config: Option<String>,
    source: Option<VideoSource>,
    state: State<'_, SharedProcessManager>,
    cfg: State<'_, Config>,
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
        let _ = app.emit(
            "pipeline-status",
            StatusPayload {
                status: "cooldown".to_string(),
                error: None,
            },
        );
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
            if let Some(ref src) = source {
                if let Some(input_arg) = src.to_input_arg() {
                    args.push("--input".to_string());
                    args.push(input_arg);
                }
            }

            let env_vars = vec![
                ("PYTHONPATH".to_string(), cfg.hailo_examples_dir.clone()),
                ("HAILO_ENV_FILE".to_string(), cfg.env_file.clone()),
                ("GST_PLUGIN_PATH".to_string(), cfg.gst_plugin_path.clone()),
                ("LD_LIBRARY_PATH".to_string(), cfg.ld_library_path.clone()),
            ];

            process_manager::spawn_pipeline(
                app,
                &cfg.python_bin,
                &args,
                env_vars,
                Some(&cfg.hailo_examples_dir),
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
                format!("{}/{}", cfg.rpicam_assets_dir, json_config),
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
