import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface Detection {
  timestamp: number;
  track_id: number | null;
  label: string;
  confidence: number;
  pipeline: string;
}

export interface TimelineBucket {
  minute: number;
  count: number;
  labels: Record<string, number>;
}

export interface DetectionStats {
  total_detections: number;
  unique_track_ids: number;
  label_counts: Record<string, number>;
  first_detection: number | null;
  last_detection: number | null;
  avg_confidence: number;
  detections_per_minute: number;
  timeline: TimelineBucket[];
}

interface DetectionState {
  stats: DetectionStats | null;
  recentDetections: Detection[];
  isPolling: boolean;

  /** Parse a log line and add to detection log if it matches */
  parseLogLine: (line: string, pipeline: string) => Promise<Detection | null>;
  /** Refresh stats from backend */
  refreshStats: () => Promise<void>;
  /** Load recent detections (paginated) */
  loadRecent: (limit?: number, offset?: number) => Promise<void>;
  /** Export detection log to file */
  exportLog: (path: string, format: "csv" | "json") => Promise<string>;
  /** Clear all detection data */
  clearDetections: () => Promise<void>;
}

export const useDetectionStore = create<DetectionState>((set) => ({
  stats: null,
  recentDetections: [],
  isPolling: false,

  parseLogLine: async (line, pipeline) => {
    try {
      const det = await invoke<Detection | null>("parse_detection_line", {
        line,
        pipeline,
      });
      if (det) {
        // Update recent detections locally (prepend, cap at 100)
        set((state) => ({
          recentDetections: [det, ...state.recentDetections].slice(0, 100),
        }));
      }
      return det;
    } catch {
      return null;
    }
  },

  refreshStats: async () => {
    try {
      const stats = await invoke<DetectionStats>("get_detection_stats");
      set({ stats });
    } catch {
      // ignore — backend may not be available in dev mode
    }
  },

  loadRecent: async (limit = 50, offset = 0) => {
    try {
      const detections = await invoke<Detection[]>("get_detection_log", {
        limit,
        offset,
      });
      set({ recentDetections: detections });
    } catch {
      // ignore
    }
  },

  exportLog: async (path, format) => {
    return invoke<string>("export_detection_log", { path, format });
  },

  clearDetections: async () => {
    await invoke("clear_detection_log");
    set({ stats: null, recentDetections: [] });
  },
}));
