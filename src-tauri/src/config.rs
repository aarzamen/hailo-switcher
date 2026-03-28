use std::env;
use std::path::PathBuf;

/// Application configuration loaded from environment variables with sane defaults.
///
/// All paths default to the standard Pi 5 Hailo setup under `/home/ama/hailo/`.
/// Override any value by setting the corresponding env var before launch.
pub struct Config {
    pub hailo_examples_dir: String,
    pub python_bin: String,
    pub env_file: String,
    pub gst_plugin_path: String,
    pub ld_library_path: String,
    pub rpicam_assets_dir: String,
}

impl Config {
    pub fn load() -> Self {
        let hailo_examples_dir = env::var("HAILO_EXAMPLES_DIR")
            .unwrap_or_else(|_| "/home/ama/hailo/hailo-rpi5-examples".to_string());

        let python_bin = env::var("HAILO_PYTHON_BIN").unwrap_or_else(|_| {
            let mut path = PathBuf::from(&hailo_examples_dir);
            path.push("venv_hailo_rpi_examples/bin/python");
            path.to_string_lossy().to_string()
        });

        let env_file = env::var("HAILO_ENV_FILE").unwrap_or_else(|_| {
            let mut path = PathBuf::from(&hailo_examples_dir);
            path.push(".env");
            path.to_string_lossy().to_string()
        });

        let gst_plugin_path = env::var("GST_PLUGIN_PATH")
            .unwrap_or_else(|_| "/usr/lib/aarch64-linux-gnu/gstreamer-1.0".to_string());

        let ld_library_path = env::var("HAILO_LD_LIBRARY_PATH").unwrap_or_else(|_| {
            "/usr/lib/aarch64-linux-gnu/hailo/tappas/post_processes:/usr/local/hailo/resources/so"
                .to_string()
        });

        let rpicam_assets_dir = env::var("RPICAM_ASSETS_DIR")
            .unwrap_or_else(|_| "/usr/share/rpi-camera-assets".to_string());

        Self {
            hailo_examples_dir,
            python_bin,
            env_file,
            gst_plugin_path,
            ld_library_path,
            rpicam_assets_dir,
        }
    }
}
