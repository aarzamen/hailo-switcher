import React from "react";
import { Play, Square, Loader2 } from "lucide-react";
import { usePipelineStore } from "@/stores/pipelineStore";

export const Footer: React.FC = () => {
  const activePipeline = usePipelineStore((s) => s.activePipeline);
  const pipelineStatus = usePipelineStore((s) => s.pipelineStatus);
  const currentFps = usePipelineStore((s) => s.currentFps);
  const startPipeline = usePipelineStore((s) => s.startPipeline);
  const stopPipeline = usePipelineStore((s) => s.stopPipeline);

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
      </div>

      {/* Action button */}
      {activePipeline && (
        <button
          onClick={() => (isRunning || isBusy) ? stopPipeline() : startPipeline()}
          disabled={isBusy}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-xs transition-all ${
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

      {/* Version */}
      <span className="text-[10px] text-mid-gray/50">v0.1.0</span>
    </div>
  );
};
