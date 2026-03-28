import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

type CaptureMode = "still" | "video";

interface CaptureState {
  captureMode: CaptureMode;
  isRecording: boolean;
  lastSavePath: string | null;
  saveDirectory: string;

  toggleCaptureMode: () => void;
  takeScreenshot: () => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  setSaveDirectory: (dir: string) => void;
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

  toggleCaptureMode: () =>
    set((s) => ({
      captureMode: s.captureMode === "still" ? "video" : "still",
    })),

  takeScreenshot: async () => {
    const { saveDirectory } = get();
    const path = `${saveDirectory}/hailo-capture-${timestamp()}.png`;
    try {
      const result = await invoke<string>("take_screenshot", { savePath: path });
      set({ lastSavePath: result });
    } catch (e) {
      console.error("Screenshot failed:", e);
    }
  },

  startRecording: async () => {
    const { saveDirectory } = get();
    const path = `${saveDirectory}/hailo-capture-${timestamp()}.mp4`;
    try {
      await invoke("start_recording", { savePath: path });
      set({ isRecording: true, lastSavePath: path });
    } catch (e) {
      console.error("Recording failed:", e);
    }
  },

  stopRecording: async () => {
    try {
      const path = await invoke<string>("stop_recording");
      set({ isRecording: false, lastSavePath: path });
    } catch (e) {
      console.error("Stop recording failed:", e);
      set({ isRecording: false });
    }
  },

  setSaveDirectory: (dir) => set({ saveDirectory: dir }),
}));
