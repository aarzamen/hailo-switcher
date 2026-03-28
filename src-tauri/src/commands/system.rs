use serde::Serialize;

#[derive(Serialize)]
pub struct HailoStatus {
    pub detected: bool,
    pub device: String,
    pub firmware: String,
}

#[tauri::command]
pub async fn list_video_devices() -> Result<Vec<String>, String> {
    let output = tokio::process::Command::new("v4l2-ctl")
        .arg("--list-devices")
        .output()
        .await
        .map_err(|e| format!("Failed to run v4l2-ctl: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut devices = Vec::new();

    // Parse v4l2-ctl output for /dev/video* lines that are USB cameras
    // USB cameras typically appear as their own section (not "pispbe" or "rpi-hevc")
    let mut in_usb_section = false;
    for line in stdout.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with('/') && !trimmed.is_empty() {
            // Section header
            in_usb_section = !trimmed.contains("pispbe")
                && !trimmed.contains("rpi-hevc")
                && !trimmed.contains("platform:");
        } else if in_usb_section && trimmed.starts_with("/dev/video") {
            devices.push(trimmed.to_string());
        }
    }

    Ok(devices)
}

#[tauri::command]
pub async fn check_hailo_status() -> Result<HailoStatus, String> {
    let output = tokio::process::Command::new("hailortcli")
        .args(["fw-control", "identify"])
        .output()
        .await
        .map_err(|e| format!("Failed to run hailortcli: {}", e))?;

    if !output.status.success() {
        return Ok(HailoStatus {
            detected: false,
            device: "Not found".to_string(),
            firmware: "N/A".to_string(),
        });
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut device = String::new();
    let mut firmware = String::new();

    for line in stdout.lines() {
        if line.contains("Board Name:") {
            device = line.split(':').nth(1).unwrap_or("").trim().to_string();
        } else if line.contains("Firmware Version:") {
            firmware = line.split(':').nth(1).unwrap_or("").trim().to_string();
        }
    }

    Ok(HailoStatus {
        detected: true,
        device,
        firmware,
    })
}
