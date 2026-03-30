use serde::Serialize;
use crate::video_sources::{self, AvailableSource};

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
    let devices: Vec<String> = video_sources::parse_v4l2_devices(&stdout)
        .into_iter()
        .map(|(_, path)| path)
        .collect();

    Ok(devices)
}

#[tauri::command]
pub async fn detect_sources() -> Result<Vec<AvailableSource>, String> {
    let mut sources = Vec::new();

    // Demo video — always available
    sources.push(AvailableSource {
        id: "demo".to_string(),
        label: "Demo Video".to_string(),
        source_type: "demo".to_string(),
        device_path: None,
        available: true,
    });

    // Enumerate USB cameras via v4l2-ctl
    let v4l2_output = tokio::process::Command::new("v4l2-ctl")
        .arg("--list-devices")
        .output()
        .await;

    if let Ok(output) = v4l2_output {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for (label, path) in video_sources::parse_v4l2_devices(&stdout) {
            // Generate a slug id from the label
            let id = format!(
                "usb-{}",
                label
                    .to_lowercase()
                    .replace(|c: char| !c.is_alphanumeric(), "-")
                    .trim_matches('-')
                    .chars()
                    .take(40)
                    .collect::<String>()
            );
            sources.push(AvailableSource {
                id,
                label: format!("{} (USB)", label),
                source_type: "device".to_string(),
                device_path: Some(path),
                available: true,
            });
        }
    }

    // Check for Pi Camera via libcamera-hello
    let picam_output = tokio::process::Command::new("libcamera-hello")
        .arg("--list-cameras")
        .output()
        .await;

    let picam_available = if let Ok(output) = picam_output {
        let stdout = String::from_utf8_lossy(&output.stdout);
        stdout.contains("Available cameras") && !stdout.contains(": 0 cameras")
    } else {
        false
    };

    sources.push(AvailableSource {
        id: "picam-0".to_string(),
        label: "Pi Camera Module".to_string(),
        source_type: "device".to_string(),
        device_path: None,
        available: picam_available,
    });

    // Detect v4l2loopback virtual devices
    let loopback_device = detect_v4l2loopback().await;

    // Screen capture — always available
    let session_type = std::env::var("XDG_SESSION_TYPE").unwrap_or_default();
    let display_type = if session_type == "wayland" {
        "Wayland"
    } else {
        "X11"
    };
    let screen_note = if loopback_device.is_some() {
        format!(" ({})", display_type)
    } else {
        format!(" ({}, direct)", display_type)
    };

    sources.push(AvailableSource {
        id: "screen-full".to_string(),
        label: format!("Full Screen{}", screen_note),
        source_type: "screen".to_string(),
        device_path: loopback_device.clone(),
        available: true,
    });

    sources.push(AvailableSource {
        id: "screen-region".to_string(),
        label: "Screen Region".to_string(),
        source_type: "screen".to_string(),
        device_path: loopback_device,
        available: true,
    });

    // File input — always available (user picks later)
    sources.push(AvailableSource {
        id: "file".to_string(),
        label: "Video File".to_string(),
        source_type: "file".to_string(),
        device_path: None,
        available: true,
    });

    Ok(sources)
}

/// Detect the first v4l2loopback virtual device (e.g. /dev/video10).
/// Returns None if the v4l2loopback kernel module is not loaded.
async fn detect_v4l2loopback() -> Option<String> {
    // v4l2loopback devices show up as "Dummy video device" or similar platform devices
    let output = tokio::process::Command::new("v4l2-ctl")
        .arg("--list-devices")
        .output()
        .await
        .ok()?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut current_label = String::new();

    for line in stdout.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with('/') && !trimmed.is_empty() {
            current_label = trimmed.to_lowercase();
        } else if trimmed.starts_with("/dev/video") {
            // v4l2loopback typically shows as "Dummy video device" or contains "v4l2loopback"
            if current_label.contains("dummy") || current_label.contains("v4l2 loopback")
                || current_label.contains("v4l2loopback") || current_label.contains("screen capture")
            {
                return Some(trimmed.to_string());
            }
        }
    }
    None
}

#[derive(Serialize)]
pub struct V4l2LoopbackStatus {
    pub available: bool,
    pub device_path: Option<String>,
}

#[tauri::command]
pub async fn check_v4l2loopback() -> Result<V4l2LoopbackStatus, String> {
    let device = detect_v4l2loopback().await;
    Ok(V4l2LoopbackStatus {
        available: device.is_some(),
        device_path: device,
    })
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
