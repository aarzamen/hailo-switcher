use std::sync::Mutex;
use tauri::State;
use tokio::process::Command;

pub struct RecordingState {
    pid: Option<u32>,
    save_path: Option<String>,
}

impl RecordingState {
    pub fn new() -> Self {
        Self {
            pid: None,
            save_path: None,
        }
    }
}

pub type SharedRecordingState = Mutex<RecordingState>;

#[tauri::command]
pub async fn take_screenshot(save_path: String) -> Result<String, String> {
    // Try grim (Wayland) first, fall back to scrot (X11)
    let output = Command::new("grim")
        .arg(&save_path)
        .output()
        .await
        .map_err(|e| format!("Failed to run grim: {}", e))?;

    if output.status.success() {
        return Ok(save_path);
    }

    // Fallback to scrot
    let output = Command::new("scrot")
        .arg(&save_path)
        .output()
        .await
        .map_err(|e| format!("Failed to run scrot: {}", e))?;

    if output.status.success() {
        Ok(save_path)
    } else {
        Err(format!(
            "Screenshot failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ))
    }
}

#[tauri::command]
pub async fn start_recording(
    save_path: String,
    state: State<'_, SharedRecordingState>,
) -> Result<(), String> {
    let mut rec = state.lock().map_err(|e| e.to_string())?;

    if rec.pid.is_some() {
        return Err("Already recording".to_string());
    }

    let child = tokio::process::Command::new("wf-recorder")
        .arg("-f")
        .arg(&save_path)
        .spawn()
        .map_err(|e| format!("Failed to start wf-recorder: {}", e))?;

    let pid = child.id().unwrap_or(0);
    rec.pid = Some(pid);
    rec.save_path = Some(save_path);

    Ok(())
}

#[tauri::command]
pub async fn stop_recording(
    state: State<'_, SharedRecordingState>,
) -> Result<String, String> {
    let mut rec = state.lock().map_err(|e| e.to_string())?;

    let pid = rec.pid.take().ok_or("Not recording")?;
    let path = rec.save_path.take().unwrap_or_default();

    // wf-recorder stops cleanly on SIGINT
    let pid_nix = nix::unistd::Pid::from_raw(pid as i32);
    nix::sys::signal::kill(pid_nix, nix::sys::signal::Signal::SIGINT)
        .map_err(|e| format!("Failed to stop recording: {}", e))?;

    Ok(path)
}
