import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  PipelineDefinition,
  PipelineStatus,
  InputSourceType,
  LogEntry,
} from "@/types/pipeline";

const MAX_LOG_LINES = 2000;
const FPS_REGEX = /FPS:\s*([\d.]+)/;

interface PipelineState {
  activePipeline: PipelineDefinition | null;
  pipelineStatus: PipelineStatus;
  inputSource: InputSourceType;
  inputFilePath: string;
  logs: LogEntry[];
  availableDevices: string[];
  errorMessage: string | null;
  currentFps: string | null;
  listenersInitialized: boolean;

  selectPipeline: (pipeline: PipelineDefinition | null) => void;
  setInputSource: (source: InputSourceType) => void;
  setInputFilePath: (path: string) => void;
  startPipeline: () => Promise<void>;
  stopPipeline: () => Promise<void>;
  appendLog: (entry: LogEntry) => void;
  clearLogs: () => void;
  refreshDevices: () => Promise<void>;
  initListeners: () => Promise<void>;
}

export const usePipelineStore = create<PipelineState>((set, get) => ({
  activePipeline: null,
  pipelineStatus: "idle",
  inputSource: "default",
  inputFilePath: "",
  logs: [],
  availableDevices: [],
  errorMessage: null,
  currentFps: null,
  listenersInitialized: false,

  selectPipeline: (pipeline) => set({ activePipeline: pipeline }),

  setInputSource: (source) => set({ inputSource: source }),

  setInputFilePath: (path) => set({ inputFilePath: path }),

  startPipeline: async () => {
    const { activePipeline, inputSource, inputFilePath } = get();
    if (!activePipeline) return;

    set({ pipelineStatus: "starting", errorMessage: null, logs: [], currentFps: null });

    let inputArg: string | null = null;
    if (inputSource === "usb") inputArg = "usb";
    else if (inputSource === "rpi") inputArg = "rpi";
    else if (inputSource === "file" && inputFilePath) inputArg = inputFilePath;

    try {
      await invoke("start_pipeline", {
        pipelineType: activePipeline.type,
        script: activePipeline.script ?? null,
        jsonConfig: activePipeline.jsonConfig ?? null,
        inputSource: inputArg,
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
      // Parse FPS from stdout lines
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

  refreshDevices: async () => {
    try {
      const devices = await invoke<string[]>("list_video_devices");
      set({ availableDevices: devices });
    } catch {
      set({ availableDevices: [] });
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
      }
    );

    listen<{ status: PipelineStatus; error?: string }>(
      "pipeline-status",
      (event) => {
        const updates: Partial<PipelineState> = {
          pipelineStatus: event.payload.status,
          errorMessage: event.payload.error ?? null,
        };
        // Clear FPS when pipeline stops
        if (event.payload.status === "idle" || event.payload.status === "error") {
          updates.currentFps = null;
        }
        set(updates);
      }
    );
  },
}));
