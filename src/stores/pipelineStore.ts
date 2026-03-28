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

interface PipelineState {
  activePipeline: PipelineDefinition | null;
  pipelineStatus: PipelineStatus;
  inputSource: InputSourceType;
  inputFilePath: string;
  logs: LogEntry[];
  availableDevices: string[];
  errorMessage: string | null;
  listenersInitialized: boolean;

  // Actions
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
  listenersInitialized: false,

  selectPipeline: (pipeline) => set({ activePipeline: pipeline }),

  setInputSource: (source) => set({ inputSource: source }),

  setInputFilePath: (path) => set({ inputFilePath: path }),

  startPipeline: async () => {
    const { activePipeline, inputSource, inputFilePath } = get();
    if (!activePipeline) return;

    set({ pipelineStatus: "starting", errorMessage: null, logs: [] });

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
      const logs = [...state.logs, entry];
      if (logs.length > MAX_LOG_LINES) {
        return { logs: logs.slice(logs.length - MAX_LOG_LINES) };
      }
      return { logs };
    }),

  clearLogs: () => set({ logs: [] }),

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
        set({
          pipelineStatus: event.payload.status,
          errorMessage: event.payload.error ?? null,
        });
      }
    );
  },
}));
