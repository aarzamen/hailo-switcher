import React, { useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import { usePipelineStore } from "@/stores/pipelineStore";

export const LogViewer: React.FC = () => {
  const logs = usePipelineStore((s) => s.logs);
  const clearLogs = usePipelineStore((s) => s.clearLogs);
  const pipelineStatus = usePipelineStore((s) => s.pipelineStatus);
  const activePipeline = usePipelineStore((s) => s.activePipeline);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Pipeline Output</span>
          {activePipeline && (
            <span className="text-xs text-mid-gray">
              — {activePipeline.name}
            </span>
          )}
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              pipelineStatus === "running"
                ? "bg-green-400 animate-pulse"
                : pipelineStatus === "error"
                  ? "bg-red-400"
                  : "bg-mid-gray"
            }`}
          />
        </div>
        <button
          onClick={clearLogs}
          className="flex items-center gap-1 text-xs text-mid-gray hover:text-red-400 transition-colors"
        >
          <Trash2 size={12} /> Clear
        </button>
      </div>

      {/* Log output */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed bg-background"
      >
        {logs.length === 0 ? (
          <p className="text-mid-gray text-center mt-8">
            No output yet. Select and run a pipeline.
          </p>
        ) : (
          logs.map((entry, i) => (
            <div
              key={i}
              className={
                entry.stream === "stderr"
                  ? "text-red-400"
                  : "text-text opacity-80"
              }
            >
              {entry.line}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
