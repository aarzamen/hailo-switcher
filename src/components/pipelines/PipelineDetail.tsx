import React from "react";
import { usePipelineStore } from "@/stores/pipelineStore";

export const PipelineDetail: React.FC = () => {
  const activePipeline = usePipelineStore((s) => s.activePipeline);
  const pipelineStatus = usePipelineStore((s) => s.pipelineStatus);
  const selectedSourceId = usePipelineStore((s) => s.selectedSourceId);
  const availableSources = usePipelineStore((s) => s.availableSources);
  const errorMessage = usePipelineStore((s) => s.errorMessage);
  const logs = usePipelineStore((s) => s.logs);

  if (!activePipeline) return null;

  const selectedSource = availableSources.find((s) => s.id === selectedSourceId);
  const sourceLabel = selectedSource?.label ?? selectedSourceId ?? "None";

  return (
    <div className="settings-card bg-background-card border border-surface-border rounded-lg p-4 space-y-3">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold">{activePipeline.name}</h2>
        <p className="text-xs text-mid-gray">{activePipeline.description}</p>
        <p className="text-xs text-mid-gray mt-1">
          Model: <span className="text-logo-primary font-medium">{activePipeline.model}</span>
          {" | "}Source: <span className="font-medium">{sourceLabel}</span>
        </p>
      </div>

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
              key={`${entry.timestamp}-${i}`}
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
