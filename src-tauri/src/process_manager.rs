use serde::Serialize;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

#[derive(Debug, Clone, Serialize)]
pub struct LogPayload {
    pub line: String,
    pub stream: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct StatusPayload {
    pub status: String,
    pub error: Option<String>,
}

pub struct ProcessManager {
    child_pid: Option<u32>,
    status: String,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            child_pid: None,
            status: "idle".to_string(),
        }
    }

    pub fn status(&self) -> &str {
        &self.status
    }

    pub fn is_running(&self) -> bool {
        self.child_pid.is_some()
    }

    pub fn set_status(&mut self, status: &str) {
        self.status = status.to_string();
    }

    pub fn set_pid(&mut self, pid: Option<u32>) {
        self.child_pid = pid;
    }

    pub fn stop(&mut self) -> Result<(), String> {
        if let Some(pid) = self.child_pid.take() {
            self.status = "stopping".to_string();
            let neg_pid = nix::unistd::Pid::from_raw(-(pid as i32));
            let pos_pid = nix::unistd::Pid::from_raw(pid as i32);

            // Send SIGTERM to process group first
            let _ = nix::sys::signal::kill(neg_pid, nix::sys::signal::Signal::SIGTERM);
            let _ = nix::sys::signal::kill(pos_pid, nix::sys::signal::Signal::SIGTERM);

            // SIGKILL the process group after 1 second (GStreamer pipelines need forceful kill)
            tokio::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                let neg = nix::unistd::Pid::from_raw(-(pid as i32));
                let pos = nix::unistd::Pid::from_raw(pid as i32);
                let _ = nix::sys::signal::kill(neg, nix::sys::signal::Signal::SIGKILL);
                let _ = nix::sys::signal::kill(pos, nix::sys::signal::Signal::SIGKILL);
            });

            Ok(())
        } else {
            self.status = "idle".to_string();
            Ok(())
        }
    }
}

pub fn spawn_pipeline(
    app: AppHandle,
    program: &str,
    args: &[String],
    env_vars: Vec<(String, String)>,
    working_dir: Option<&str>,
    manager: Arc<Mutex<ProcessManager>>,
) -> Result<(), String> {
    let mut cmd = Command::new(program);
    cmd.args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .process_group(0);

    for (key, val) in &env_vars {
        cmd.env(key, val);
    }

    if let Some(dir) = working_dir {
        cmd.current_dir(dir);
    }

    // Log the exact command being spawned
    eprintln!(
        "[hailo-switcher] Spawning: {} {} (cwd: {:?})",
        program,
        args.join(" "),
        working_dir.unwrap_or("(inherit)")
    );

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn: {}", e))?;

    let pid = child.id().ok_or("Failed to get child process ID")?;

    {
        let mut mgr = manager.lock().map_err(|e| e.to_string())?;
        mgr.set_pid(Some(pid));
        mgr.set_status("running");
    }

    let _ = app.emit(
        "pipeline-status",
        StatusPayload {
            status: "running".to_string(),
            error: None,
        },
    );

    // Stream stdout
    if let Some(stdout) = child.stdout.take() {
        let app_out = app.clone();
        tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app_out.emit(
                    "pipeline-log",
                    LogPayload {
                        line,
                        stream: "stdout".to_string(),
                    },
                );
            }
        });
    }

    // Stream stderr
    if let Some(stderr) = child.stderr.take() {
        let app_err = app.clone();
        tokio::spawn(async move {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app_err.emit(
                    "pipeline-log",
                    LogPayload {
                        line,
                        stream: "stderr".to_string(),
                    },
                );
            }
        });
    }

    // Wait for process exit
    let app_wait = app.clone();
    let manager_wait = manager.clone();
    tokio::spawn(async move {
        let exit_status = child.wait().await;
        let (status, error) = match exit_status {
            Ok(s) if s.success() => ("idle".to_string(), None),
            Ok(s) => (
                "error".to_string(),
                Some(format!(
                    "Process exited with code: {}",
                    s.code().unwrap_or(-1)
                )),
            ),
            Err(e) => ("error".to_string(), Some(format!("Process error: {}", e))),
        };

        if let Ok(mut mgr) = manager_wait.lock() {
            mgr.set_pid(None);
            mgr.set_status(&status);
        }

        let _ = app_wait.emit("pipeline-status", StatusPayload { status, error });
    });

    Ok(())
}
