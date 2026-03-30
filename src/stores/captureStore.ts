import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

type CaptureMode = "still" | "video";

interface CaptureState {
  captureMode: CaptureMode;
  isRecording: boolean;
  lastSavePath: string | null;
  saveDirectory: string;
  errorMessage: string | null;

  toggleCaptureMode: () => void;
  takeScreenshot: () => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  setSaveDirectory: (dir: string) => void;
  clearError: () => void;
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export const useCaptureStore = create<CaptureState>((set, get) => ({
  captureMode: "still",
  isRecording: false,
  lastSavePath: null,
  saveDirectory: "/home/ama/Desktop",
  errorMessage: null,

  toggleCaptureMode: () =>
    set((s) => ({
      captureMode: s.captureMode === "still" ? "video" : "still",
    })),

  takeScreenshot: async () => {
    const { saveDirectory } = get();
    const path = `${saveDirectory}/hailo-capture-${timestamp()}.png`;
    try {
      set({ errorMessage: null });
      const result = await invoke<string>("take_screenshot", { savePath: path });
      set({ lastSavePath: result });
    } catch (e) {
      set({ errorMessage: `Screenshot failed: ${e}` });
    }
  },

  startRecording: async () => {
    const { saveDirectory } = get();
    const path = `${saveDirectory}/hailo-capture-${timestamp()}.mp4`;
    try {
      set({ errorMessage: null });
      await invoke("start_recording", { savePath: path });
      set({ isRecording: true, lastSavePath: path });
    } catch (e) {
      set({ errorMessage: `Recording failed: ${e}` });
    }
  },

  stopRecording: async () => {
    try {
      set({ errorMessage: null });
      const path = await invoke<string>("stop_recording");
      set({ isRecording: false, lastSavePath: path });
    } catch (e) {
      set({ isRecording: false, errorMessage: `Stop recording failed: ${e}` });
    }
  },

  setSaveDirectory: (dir) => set({ saveDirectory: dir }),

  clearError: () => set({ errorMessage: null }),
}));
