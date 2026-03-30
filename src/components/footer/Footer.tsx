import React, { useState, useCallback } from "react";
import { Play, Square, Loader2, Camera, Video, Circle } from "lucide-react";
import { usePipelineStore } from "@/stores/pipelineStore";
import { useCaptureStore } from "@/stores/captureStore";
import { open } from "@tauri-apps/plugin-dialog";

export const Footer: React.FC = () => {
  const activePipeline = usePipelineStore((s) => s.activePipeline);
  const pipelineStatus = usePipelineStore((s) => s.pipelineStatus);
  const currentFps = usePipelineStore((s) => s.currentFps);
  const startPipeline = usePipelineStore((s) => s.startPipeline);
  const stopPipeline = usePipelineStore((s) => s.stopPipeline);

  const captureMode = useCaptureStore((s) => s.captureMode);
  const isRecording = useCaptureStore((s) => s.isRecording);
  const toggleCaptureMode = useCaptureStore((s) => s.toggleCaptureMode);
  const takeScreenshot = useCaptureStore((s) => s.takeScreenshot);
  const startRecording = useCaptureStore((s) => s.startRecording);
  const stopRecording = useCaptureStore((s) => s.stopRecording);
  const setSaveDirectory = useCaptureStore((s) => s.setSaveDirectory);
  const captureError = useCaptureStore((s) => s.errorMessage);
  const clearCaptureError = useCaptureStore((s) => s.clearError);
  const pipelineError = usePipelineStore((s) => s.errorMessage);

  const [flashCapture, setFlashCapture] = useState(false);
  const [hasPickedDir, setHasPickedDir] = useState(false);

  const isRunning = pipelineStatus === "running" || pipelineStatus === "starting";
  const isBusy = pipelineStatus === "stopping" || pipelineStatus === "cooldown";

  const statusDotClass =
    pipelineStatus === "running"
      ? "bg-green-400 animate-pulse"
      : pipelineStatus === "cooldown"
        ? "bg-logo-primary animate-pulse"
        : pipelineStatus === "starting"
          ? "bg-yellow-400 animate-pulse"
          : pipelineStatus === "error"
            ? "bg-red-400"
            : "bg-mid-gray";

  const statusLabel =
    pipelineStatus === "cooldown" ? "NPU Cooldown" : pipelineStatus;

  const promptDirectory = useCallback(async (): Promise<boolean> => {
    if (hasPickedDir) return true;
    try {
      const selected = await open({ directory: true, title: "Save captures to..." });
      if (selected) {
        setSaveDirectory(selected as string);
      }
      // Even if cancelled, mark as picked so we don't re-prompt (uses default)
      setHasPickedDir(true);
      return true;
    } catch {
      setHasPickedDir(true);
      return true;
    }
  }, [hasPickedDir, setSaveDirectory]);

  const handleCapture = useCallback(async () => {
    await promptDirectory();

    if (captureMode === "still") {
      await takeScreenshot();
      setFlashCapture(true);
      setTimeout(() => setFlashCapture(false), 500);
    } else {
      if (isRecording) {
        await stopRecording();
        setFlashCapture(true);
        setTimeout(() => setFlashCapture(false), 500);
      } else {
        await startRecording();
      }
    }
  }, [captureMode, isRecording, takeScreenshot, startRecording, stopRecording, promptDirectory]);

  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-surface-border bg-sidebar-bg">
      {/* Status */}
      <div className="flex items-center gap-2 text-xs">
        <span className={`inline-block w-2 h-2 rounded-full ${statusDotClass}`} />
        <span className="text-mid-gray capitalize">{statusLabel}</span>
        {activePipeline && (
          <span className="text-text/60 ml-1">— {activePipeline.name}</span>
        )}
        {currentFps && pipelineStatus === "running" && (
          <span className="text-logo-primary font-mono ml-2">{currentFps} FPS</span>
        )}
        {(captureError || pipelineError) && (
          <button
            onClick={captureError ? clearCaptureError : undefined}
            className="ml-2 text-red-400 text-[10px] truncate max-w-[300px] cursor-pointer hover:text-red-300"
            title={captureError || pipelineError || ""}
          >
            {captureError || pipelineError}
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        {/* Capture controls */}
        <div className="flex items-center gap-1 mr-2">
          {/* Mode toggle */}
          <button
            onClick={toggleCaptureMode}
            className="p-2 min-w-[32px] min-h-[32px] flex items-center justify-center rounded border border-mid-gray/30 text-mid-gray hover:text-text hover:border-mid-gray/60 transition-all cursor-pointer"
            title={captureMode === "still" ? "Switch to video" : "Switch to still"}
          >
            {captureMode === "still" ? <Camera size={14} /> : <Video size={14} />}
          </button>

          {/* Capture/Record button */}
          <button
            onClick={handleCapture}
            className={`flex items-center gap-1 px-2.5 py-1.5 min-h-[32px] rounded text-[11px] font-medium transition-all cursor-pointer ${
              flashCapture
                ? "bg-green-500/80 text-white"
                : isRecording
                  ? "bg-red-500/90 hover:bg-red-500 text-white"
                  : "border border-mid-gray/30 text-mid-gray hover:text-text hover:border-mid-gray/60"
            }`}
          >
            {captureMode === "still" ? (
              <>
                <Camera size={11} />
                Snap
              </>
            ) : isRecording ? (
              <>
                <Circle size={9} className="fill-current animate-pulse" />
                STOP
              </>
            ) : (
              <>
                <Circle size={9} className="fill-current" />
                REC
              </>
            )}
          </button>
        </div>

        {/* Pipeline action button */}
        {activePipeline && (
          <button
            onClick={() => (isRunning || isBusy) ? stopPipeline() : startPipeline()}
            disabled={isBusy}
            className={`flex items-center gap-1.5 px-4 py-2 min-h-[36px] min-w-[72px] rounded-md font-medium text-xs transition-all cursor-pointer ${
              isRunning
                ? "bg-red-500/90 hover:bg-red-500 text-white"
                : isBusy
                  ? "bg-mid-gray/30 text-mid-gray cursor-wait"
                  : "bg-logo-primary/90 hover:bg-logo-primary text-background"
            }`}
          >
            {isBusy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : isRunning ? (
              <Square size={14} />
            ) : (
              <Play size={14} />
            )}
            {isBusy ? (pipelineStatus === "cooldown" ? "Cooldown" : "Stopping") : isRunning ? "Stop" : "Run"}
          </button>
        )}
      </div>

      {/* Version */}
      <span className="text-[10px] text-mid-gray/50">v0.2.1</span>
    </div>
  );
};
