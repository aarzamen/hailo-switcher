use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

// ── Data structures ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct Detection {
    pub timestamp: u64,
    pub track_id: Option<u32>,
    pub label: String,
    pub confidence: f32,
    pub pipeline: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TimelineBucket {
    pub minute: u64,
    pub count: u64,
    pub labels: HashMap<String, u64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DetectionStats {
    pub total_detections: u64,
    pub unique_track_ids: u64,
    pub label_counts: HashMap<String, u64>,
    pub first_detection: Option<u64>,
    pub last_detection: Option<u64>,
    pub avg_confidence: f32,
    pub detections_per_minute: f32,
    pub timeline: Vec<TimelineBucket>,
}

// ── In-memory log ─────────────────────────────────────────────────

pub struct DetectionLog {
    detections: Vec<Detection>,
    track_ids: std::collections::HashSet<u32>,
    label_counts: HashMap<String, u64>,
    confidence_sum: f64,
    timeline: HashMap<u64, HashMap<String, u64>>,
}

impl DetectionLog {
    pub fn new() -> Self {
        Self {
            detections: Vec::new(),
            track_ids: std::collections::HashSet::new(),
            label_counts: HashMap::new(),
            confidence_sum: 0.0,
            timeline: HashMap::new(),
        }
    }

    pub fn push(&mut self, det: Detection) {
        if let Some(tid) = det.track_id {
            self.track_ids.insert(tid);
        }
        *self.label_counts.entry(det.label.clone()).or_insert(0) += 1;
        self.confidence_sum += det.confidence as f64;

        // Timeline bucket: detections grouped by Unix minute
        let minute = det.timestamp / 60_000;
        let bucket = self.timeline.entry(minute).or_default();
        *bucket.entry(det.label.clone()).or_insert(0) += 1;

        self.detections.push(det);
    }

    pub fn stats(&self) -> DetectionStats {
        let total = self.detections.len() as u64;
        let first = self.detections.first().map(|d| d.timestamp);
        let last = self.detections.last().map(|d| d.timestamp);

        let duration_minutes = match (first, last) {
            (Some(f), Some(l)) if l > f => (l - f) as f32 / 60_000.0,
            _ => 0.0,
        };

        let dpm = if duration_minutes > 0.0 {
            total as f32 / duration_minutes
        } else {
            0.0
        };

        let avg_conf = if total > 0 {
            (self.confidence_sum / total as f64) as f32
        } else {
            0.0
        };

        // Build sorted timeline buckets
        let mut timeline: Vec<TimelineBucket> = self
            .timeline
            .iter()
            .map(|(minute, labels)| TimelineBucket {
                minute: *minute,
                count: labels.values().sum(),
                labels: labels.clone(),
            })
            .collect();
        timeline.sort_by_key(|b| b.minute);

        DetectionStats {
            total_detections: total,
            unique_track_ids: self.track_ids.len() as u64,
            label_counts: self.label_counts.clone(),
            first_detection: first,
            last_detection: last,
            avg_confidence: avg_conf,
            detections_per_minute: dpm,
            timeline,
        }
    }

    pub fn get_page(&self, limit: u32, offset: u32) -> Vec<Detection> {
        self.detections
            .iter()
            .rev() // newest first
            .skip(offset as usize)
            .take(limit as usize)
            .cloned()
            .collect()
    }

    pub fn clear(&mut self) {
        self.detections.clear();
        self.track_ids.clear();
        self.label_counts.clear();
        self.confidence_sum = 0.0;
        self.timeline.clear();
    }

    pub fn export_csv(&self) -> String {
        let mut out = String::from("timestamp,track_id,label,confidence,pipeline\n");
        for d in &self.detections {
            out.push_str(&format!(
                "{},{},{},{:.3},{}\n",
                d.timestamp,
                d.track_id.map_or("".to_string(), |id| id.to_string()),
                d.label,
                d.confidence,
                d.pipeline,
            ));
        }
        out
    }

    pub fn export_json(&self) -> Result<String, String> {
        serde_json::to_string_pretty(&self.detections).map_err(|e| e.to_string())
    }
}

pub type SharedDetectionLog = Mutex<DetectionLog>;

// ── Detection line parser ─────────────────────────────────────────
//
// hailo-rpi5-examples YOLO detection pipelines output lines like:
//   Detection: ID: 3 Label: car Confidence: 0.87

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn parse_detection(line: &str, pipeline: &str) -> Option<Detection> {
    if !line.contains("Detection:") {
        return None;
    }

    let track_id = line
        .find("ID:")
        .and_then(|i| {
            let after = &line[i + 3..];
            let trimmed = after.trim_start();
            trimmed
                .split_whitespace()
                .next()
                .and_then(|s| s.parse::<u32>().ok())
        });

    let label = line.find("Label:").and_then(|i| {
        let after = &line[i + 6..];
        let trimmed = after.trim_start();
        trimmed.split_whitespace().next().map(|s| s.to_string())
    })?;

    let confidence = line.find("Confidence:").and_then(|i| {
        let after = &line[i + 11..];
        let trimmed = after.trim_start();
        trimmed
            .split_whitespace()
            .next()
            .and_then(|s| s.parse::<f32>().ok())
    })?;

    Some(Detection {
        timestamp: now_ms(),
        track_id,
        label,
        confidence,
        pipeline: pipeline.to_string(),
    })
}

// ── Tauri commands ────────────────────────────────────────────────

#[tauri::command]
pub fn parse_detection_line(
    line: String,
    pipeline: String,
    state: State<'_, SharedDetectionLog>,
) -> Option<Detection> {
    let det = parse_detection(&line, &pipeline)?;
    let mut log = state.lock().ok()?;
    log.push(det.clone());
    Some(det)
}

#[tauri::command]
pub fn get_detection_stats(state: State<'_, SharedDetectionLog>) -> Result<DetectionStats, String> {
    let log = state.lock().map_err(|e| e.to_string())?;
    Ok(log.stats())
}

#[tauri::command]
pub fn get_detection_log(
    limit: u32,
    offset: u32,
    state: State<'_, SharedDetectionLog>,
) -> Result<Vec<Detection>, String> {
    let log = state.lock().map_err(|e| e.to_string())?;
    Ok(log.get_page(limit, offset))
}

#[tauri::command]
pub fn export_detection_log(
    path: String,
    format: String,
    state: State<'_, SharedDetectionLog>,
) -> Result<String, String> {
    let log = state.lock().map_err(|e| e.to_string())?;
    let content = match format.as_str() {
        "csv" => log.export_csv(),
        "json" => log.export_json()?,
        _ => return Err(format!("Unknown format: {}", format)),
    };
    std::fs::write(&path, &content).map_err(|e| format!("Failed to write {}: {}", path, e))?;
    Ok(path)
}

#[tauri::command]
pub fn clear_detection_log(state: State<'_, SharedDetectionLog>) -> Result<(), String> {
    let mut log = state.lock().map_err(|e| e.to_string())?;
    log.clear();
    Ok(())
}
