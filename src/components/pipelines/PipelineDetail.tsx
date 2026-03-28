import React from "react";
import { Play, Square, Loader2 } from "lucide-react";
import { usePipelineStore } from "@/stores/pipelineStore";

export const PipelineDetail: React.FC = () => {
  const activePipeline = usePipelineStore((s) => s.activePipeline);
  const pipelineStatus = usePipelineStore((s) => s.pipelineStatus);
  const inputSource = usePipelineStore((s) => s.inputSource);
  const errorMessage = usePipelineStore((s) => s.errorMessage);
  const logs = usePipelineStore((s) => s.logs);
  const startPipeline = usePipelineStore((s) => s.startPipeline);
  const stopPipeline = usePipelineStore((s) => s.stopPipeline);

  if (!activePipeline) return null;

  const isRunning = pipelineStatus === "running" || pipelineStatus === "starting";
  const isStopping = pipelineStatus === "stopping";

  // Check if the selected input is compatible
  const inputCompatible = activePipeline.supportedInputs.includes(inputSource);

  const handleAction = () => {
    if (isRunning || isStopping) {
      stopPipeline();
    } else {
      startPipeline();
    }
  };

  return (
    <div className="settings-card bg-background-card border border-surface-border rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">{activePipeline.name}</h2>
          <p className="text-xs text-mid-gray">{activePipeline.description}</p>
          <p className="text-xs text-mid-gray mt-1">
            Model: <span className="text-logo-primary font-medium">{activePipeline.model}</span>
            {" | "}Input: <span className="font-medium">{inputSource}</span>
          </p>
        </div>

        {/* Run / Stop button */}
        <button
          onClick={handleAction}
          disabled={isStopping || (!inputCompatible && !isRunning)}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all ${
            isRunning
              ? "bg-red-500/90 hover:bg-red-500 text-white"
              : isStopping
                ? "bg-mid-gray/30 text-mid-gray cursor-wait"
                : !inputCompatible
                  ? "bg-mid-gray/20 text-mid-gray cursor-not-allowed"
                  : "bg-logo-primary/90 hover:bg-logo-primary text-background"
          }`}
        >
          {isStopping ? (
            <Loader2 size={18} className="animate-spin" />
          ) : isRunning ? (
            <Square size={18} />
          ) : (
            <Play size={18} />
          )}
          {isStopping ? "Stopping..." : isRunning ? "Stop" : "Run"}
        </button>
      </div>

      {/* Input warning */}
      {!inputCompatible && !isRunning && (
        <p className="text-xs text-red-400">
          This pipeline requires{" "}
          <span className="font-medium">
            {activePipeline.supportedInputs.join(", ")}
          </span>{" "}
          input. Switch input source in the Input tab.
        </p>
      )}

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
        {errorMessage && (
          <span className="text-red-400 ml-2 truncate">{errorMessage}</span>
        )}
      </div>

      {/* Inline log tail */}
      {logs.length > 0 && (
        <div className="bg-background rounded border border-surface-border p-2 max-h-32 overflow-y-auto font-mono text-[11px] leading-tight">
          {logs.slice(-30).map((entry, i) => (
            <div
              key={i}
              className={
                entry.stream === "stderr" ? "text-red-400" : "text-mid-gray"
              }
            >
              {entry.line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
