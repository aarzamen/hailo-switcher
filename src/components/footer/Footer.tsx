import React from "react";
import { Play, Square, Loader2 } from "lucide-react";
import { usePipelineStore } from "@/stores/pipelineStore";

export const Footer: React.FC = () => {
  const activePipeline = usePipelineStore((s) => s.activePipeline);
  const pipelineStatus = usePipelineStore((s) => s.pipelineStatus);
  const startPipeline = usePipelineStore((s) => s.startPipeline);
  const stopPipeline = usePipelineStore((s) => s.stopPipeline);

  const isRunning = pipelineStatus === "running" || pipelineStatus === "starting";
  const isStopping = pipelineStatus === "stopping";

  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-surface-border bg-sidebar-bg">
      {/* Status */}
      <div className="flex items-center gap-2 text-xs">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            pipelineStatus === "running"
              ? "bg-green-400 animate-pulse"
              : pipelineStatus === "starting"
                ? "bg-yellow-400 animate-pulse"
                : pipelineStatus === "error"
                  ? "bg-red-400"
                  : "bg-mid-gray"
          }`}
        />
        <span className="text-mid-gray capitalize">{pipelineStatus}</span>
        {activePipeline && (
          <span className="text-text/60 ml-1">— {activePipeline.name}</span>
        )}
      </div>

      {/* Action button */}
      {activePipeline && (
        <button
          onClick={() => (isRunning || isStopping) ? stopPipeline() : startPipeline()}
          disabled={isStopping}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-xs transition-all ${
            isRunning
              ? "bg-red-500/90 hover:bg-red-500 text-white"
              : isStopping
                ? "bg-mid-gray/30 text-mid-gray cursor-wait"
                : "bg-logo-primary/90 hover:bg-logo-primary text-background"
          }`}
        >
          {isStopping ? (
            <Loader2 size={14} className="animate-spin" />
          ) : isRunning ? (
            <Square size={14} />
          ) : (
            <Play size={14} />
          )}
          {isStopping ? "Stopping" : isRunning ? "Stop" : "Run"}
        </button>
      )}

      {/* Version */}
      <span className="text-[10px] text-mid-gray/50">v0.1.0</span>
    </div>
  );
};
