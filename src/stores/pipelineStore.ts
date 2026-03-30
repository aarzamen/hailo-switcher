import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  PipelineDefinition,
  PipelineStatus,
  LogEntry,
  VideoSource,
  AvailableSource,
  ScreenRegion,
} from "@/types/pipeline";

const MAX_LOG_LINES = 2000;
const FPS_REGEX = /FPS:\s*([\d.]+)/;

interface PipelineState {
  activePipeline: PipelineDefinition | null;
  pipelineStatus: PipelineStatus;
  selectedSourceId: string | null;
  selectedFilePath: string;
  screenRegion: ScreenRegion;
  logs: LogEntry[];
  availableSources: AvailableSource[];
  errorMessage: string | null;
  currentFps: string | null;
  listenersInitialized: boolean;

  selectPipeline: (pipeline: PipelineDefinition | null) => void;
  selectSource: (sourceId: string) => void;
  setFilePath: (path: string) => void;
  setScreenRegion: (region: ScreenRegion) => void;
  startPipeline: () => Promise<void>;
  stopPipeline: () => Promise<void>;
  appendLog: (entry: LogEntry) => void;
  clearLogs: () => void;
  refreshSources: () => Promise<void>;
  initListeners: () => Promise<void>;
}

/** Build the VideoSource object to send to the Rust backend */
function buildVideoSource(
  sourceId: string,
  sources: AvailableSource[],
  filePath: string,
  screenRegion: ScreenRegion,
): VideoSource | null {
  const src = sources.find((s) => s.id === sourceId);
  if (!src) return null;

  if (src.id === "demo") {
    return { type: "Demo" };
  }
  if (src.id === "file") {
    return filePath ? { type: "File", value: filePath } : null;
  }
  if (src.id === "screen-full") {
    return {
      type: "Screen",
      value: { x: 0, y: 0, width: 1920, height: 1080, full_screen: true },
    };
  }
  if (src.id === "screen-region") {
    return { type: "Screen", value: screenRegion };
  }
  // Device — use device_path if available, else Pi Camera
  if (src.device_path) {
    return { type: "Device", value: src.device_path };
  }
  if (src.id === "picam-0") {
    return { type: "Device", value: "/dev/video0" };
  }
  return null;
}

export const usePipelineStore = create<PipelineState>((set, get) => ({
  activePipeline: null,
  pipelineStatus: "idle",
  selectedSourceId: "demo",
  selectedFilePath: "",
  screenRegion: { x: 0, y: 0, width: 640, height: 480, full_screen: false },
  logs: [],
  availableSources: [],
  errorMessage: null,
  currentFps: null,
  listenersInitialized: false,

  selectPipeline: (pipeline) => set({ activePipeline: pipeline }),

  selectSource: (sourceId) => set({ selectedSourceId: sourceId }),

  setFilePath: (path) => set({ selectedFilePath: path }),

  setScreenRegion: (region) => set({ screenRegion: region }),

  startPipeline: async () => {
    const { activePipeline, selectedSourceId, availableSources, selectedFilePath, screenRegion } =
      get();
    if (!activePipeline) return;

    set({ pipelineStatus: "starting", errorMessage: null, logs: [], currentFps: null });

    const source = selectedSourceId
      ? buildVideoSource(selectedSourceId, availableSources, selectedFilePath, screenRegion)
      : null;

    try {
      await invoke("start_pipeline", {
        pipelineType: activePipeline.type,
        script: activePipeline.script ?? null,
        jsonConfig: activePipeline.jsonConfig ?? null,
        source,
      });
    } catch (e) {
      set({
        pipelineStatus: "error",
        errorMessage: String(e),
      });
    }
  },

  stopPipeline: async () => {
    set({ pipelineStatus: "stopping" });
    try {
      await invoke("stop_pipeline");
    } catch (e) {
      set({ errorMessage: String(e) });
    }
  },

  appendLog: (entry) =>
    set((state) => {
      let fps = state.currentFps;
      if (entry.stream === "stdout") {
        const match = entry.line.match(FPS_REGEX);
        if (match) {
          fps = match[1];
        }
      }

      const logs = [...state.logs, entry];
      if (logs.length > MAX_LOG_LINES) {
        return { logs: logs.slice(logs.length - MAX_LOG_LINES), currentFps: fps };
      }
      return { logs, currentFps: fps };
    }),

  clearLogs: () => set({ logs: [], currentFps: null }),

  refreshSources: async () => {
    try {
      const sources = await invoke<AvailableSource[]>("detect_sources");
      set({ availableSources: sources });
    } catch {
      // Fallback: provide core sources when Tauri backend is unavailable (e.g. dev mode)
      set({
        availableSources: [
          { id: "demo", label: "Demo Video", source_type: "demo", device_path: null, available: true },
          { id: "file", label: "Video File", source_type: "file", device_path: null, available: true },
          { id: "screen-full", label: "Full Screen", source_type: "screen", device_path: null, available: true },
          { id: "screen-region", label: "Screen Region", source_type: "screen", device_path: null, available: true },
        ],
      });
    }
  },

  initListeners: async () => {
    if (get().listenersInitialized) return;
    set({ listenersInitialized: true });

    listen<{ line: string; stream: "stdout" | "stderr" }>(
      "pipeline-log",
      (event) => {
        get().appendLog({
          line: event.payload.line,
          stream: event.payload.stream,
          timestamp: Date.now(),
        });
      },
    );

    listen<{ status: PipelineStatus; error?: string }>(
      "pipeline-status",
      (event) => {
        const updates: Partial<PipelineState> = {
          pipelineStatus: event.payload.status,
          errorMessage: event.payload.error ?? null,
        };
        if (event.payload.status === "idle" || event.payload.status === "error") {
          updates.currentFps = null;
        }
        set(updates);
      },
    );
  },
}));
