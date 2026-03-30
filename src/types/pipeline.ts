export type PipelineType = "python" | "rpicam";
export type PipelineStatus = "idle" | "cooldown" | "starting" | "running" | "stopping" | "error";

export interface PipelineDefinition {
  id: string;
  name: string;
  description: string;
  type: PipelineType;
  model: string;
  script?: string;
  jsonConfig?: string;
  category: "detection" | "segmentation" | "pose" | "depth" | "classification" | "face";
}

export interface LogEntry {
  line: string;
  stream: "stdout" | "stderr";
  timestamp: number;
}

// Unified video source types — matches Rust VideoSource enum
export interface ScreenRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  full_screen: boolean;
}

export type VideoSource =
  | { type: "Device"; value: string }
  | { type: "File"; value: string }
  | { type: "Screen"; value: ScreenRegion }
  | { type: "Stream"; value: string }
  | { type: "Demo" };

export interface AvailableSource {
  id: string;
  label: string;
  source_type: "device" | "screen" | "demo" | "file" | "stream";
  device_path: string | null;
  available: boolean;
}
