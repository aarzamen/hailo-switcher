use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "value")]
pub enum VideoSource {
    Device(String),
    File(String),
    Screen(ScreenRegion),
    Demo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenRegion {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
    pub full_screen: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AvailableSource {
    pub id: String,
    pub label: String,
    pub source_type: String,
    pub device_path: Option<String>,
    pub available: bool,
}

/// Validate a device path (must start with /dev/).
fn validate_device_path(path: &str) -> Result<&str, String> {
    if !path.starts_with("/dev/") {
        return Err(format!("Invalid device path: {}", path));
    }
    if path.contains("..") || path.contains('\0') {
        return Err(format!("Device path contains invalid characters: {}", path));
    }
    Ok(path)
}

/// Validate a file path (must be absolute, no null bytes).
fn validate_file_path(path: &str) -> Result<&str, String> {
    if path.contains('\0') {
        return Err("File path contains null bytes".to_string());
    }
    if !Path::new(path).is_absolute() {
        return Err(format!("File path must be absolute: {}", path));
    }
    Ok(path)
}

impl VideoSource {
    /// Validate the source paths. Returns Err if paths are invalid.
    pub fn validate(&self) -> Result<(), String> {
        match self {
            VideoSource::Device(path) => { validate_device_path(path)?; Ok(()) }
            VideoSource::File(path) => { validate_file_path(path)?; Ok(()) }
            VideoSource::Screen(_) | VideoSource::Demo => Ok(()),
        }
    }

    /// Convert to the `--input` argument for hailo-rpi5-examples Python pipelines.
    /// Returns None for Demo (pipeline uses its built-in default).
    pub fn to_input_arg(&self) -> Option<String> {
        match self {
            VideoSource::Device(path) => Some(path.clone()),
            VideoSource::File(path) => Some(path.clone()),
            VideoSource::Screen(region) => {
                // For screen capture, we'd need to pipe through a virtual device.
                // For now, use ximagesrc or pipewiresrc GStreamer element as input.
                if region.full_screen {
                    Some(detect_screen_source(None))
                } else {
                    Some(detect_screen_source(Some(region)))
                }
            }
            VideoSource::Demo => None,
        }
    }

    /// Convert to a GStreamer source description string.
    pub fn to_gst_source(&self) -> String {
        match self {
            VideoSource::Device(path) => format!("v4l2src device={}", path),
            VideoSource::File(path) => format!("filesrc location={} ! decodebin", path),
            VideoSource::Screen(region) => {
                if is_wayland() {
                    if region.full_screen {
                        "pipewiresrc".to_string()
                    } else {
                        // Wayland region capture via pipewire — crop handled downstream
                        "pipewiresrc".to_string()
                    }
                } else {
                    // X11
                    if region.full_screen {
                        "ximagesrc".to_string()
                    } else {
                        format!(
                            "ximagesrc startx={} starty={} endx={} endy={}",
                            region.x,
                            region.y,
                            region.x + region.width,
                            region.y + region.height
                        )
                    }
                }
            }
            VideoSource::Demo => "videotestsrc".to_string(),
        }
    }
}

fn is_wayland() -> bool {
    std::env::var("XDG_SESSION_TYPE")
        .map(|v| v == "wayland")
        .unwrap_or(false)
}

fn detect_screen_source(region: Option<&ScreenRegion>) -> String {
    if is_wayland() {
        // Wayland: use pipewiresrc (region cropping handled by compositor or downstream)
        "pipewiresrc".to_string()
    } else {
        // X11: use ximagesrc with optional region
        match region {
            Some(r) => format!(
                "ximagesrc startx={} starty={} endx={} endy={}",
                r.x,
                r.y,
                r.x + r.width,
                r.y + r.height
            ),
            None => "ximagesrc".to_string(),
        }
    }
}

/// Parse `v4l2-ctl --list-devices` output into AvailableSource entries.
/// Returns (device_label, device_path) pairs for USB cameras.
pub fn parse_v4l2_devices(stdout: &str) -> Vec<(String, String)> {
    let mut devices = Vec::new();
    let mut current_label = String::new();
    let mut in_usb_section = false;

    for line in stdout.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with('/') && !trimmed.is_empty() {
            // Section header — e.g. "Logitech C270 (usb-xhci-hcd.1-1):"
            current_label = trimmed.trim_end_matches(':').to_string();
            in_usb_section = !trimmed.contains("pispbe")
                && !trimmed.contains("rpi-hevc")
                && !trimmed.contains("platform:");
        } else if in_usb_section && trimmed.starts_with("/dev/video") {
            // Only take the first /dev/video entry per device (avoid metadata nodes)
            if !devices.iter().any(|(l, _): &(String, String)| *l == current_label) {
                devices.push((current_label.clone(), trimmed.to_string()));
            }
        }
    }

    devices
}
