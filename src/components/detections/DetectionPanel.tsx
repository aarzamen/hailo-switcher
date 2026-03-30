import React, { useEffect } from "react";
import { useDetectionStore } from "@/stores/detectionStore";
import { usePipelineStore } from "@/stores/pipelineStore";

export const DetectionPanel: React.FC = () => {
  const stats = useDetectionStore((s) => s.stats);
  const recentDetections = useDetectionStore((s) => s.recentDetections);
  const refreshStats = useDetectionStore((s) => s.refreshStats);
  const clearDetections = useDetectionStore((s) => s.clearDetections);
  const exportLog = useDetectionStore((s) => s.exportLog);
  const pipelineStatus = usePipelineStore((s) => s.pipelineStatus);

  // Poll stats while pipeline is running
  useEffect(() => {
    refreshStats();
    if (pipelineStatus !== "running") return;

    const interval = setInterval(refreshStats, 2000);
    return () => clearInterval(interval);
  }, [pipelineStatus, refreshStats]);

  const topLabels = stats
    ? Object.entries(stats.label_counts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
    : [];

  const handleExport = async (format: "csv" | "json") => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const path = `/tmp/detections-${timestamp}.${format}`;
      await exportLog(path, format);
      alert(`Exported to ${path}`);
    } catch (e) {
      alert(`Export failed: ${e}`);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-heading">Detections</h2>
        <div className="flex gap-2">
          <button
            className="px-3 py-1 min-h-[32px] text-xs rounded bg-accent/20 text-accent hover:bg-accent/30 cursor-pointer"
            onClick={() => handleExport("csv")}
          >
            Export CSV
          </button>
          <button
            className="px-3 py-1 min-h-[32px] text-xs rounded bg-accent/20 text-accent hover:bg-accent/30 cursor-pointer"
            onClick={() => handleExport("json")}
          >
            Export JSON
          </button>
          <button
            className="px-3 py-1 min-h-[32px] text-xs rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 cursor-pointer"
            onClick={clearDetections}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Stats summary */}
      {stats && stats.total_detections > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total" value={stats.total_detections.toLocaleString()} />
          <StatCard label="Unique IDs" value={stats.unique_track_ids.toLocaleString()} />
          <StatCard label="Avg Confidence" value={`${(stats.avg_confidence * 100).toFixed(1)}%`} />
          <StatCard
            label="Det/min"
            value={stats.detections_per_minute.toFixed(1)}
          />
        </div>
      ) : (
        <div className="text-sm text-muted opacity-60 py-8 text-center">
          No detections yet. Start a detection pipeline to see results.
        </div>
      )}

      {/* Top labels */}
      {topLabels.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-heading mb-2">Top Labels</h3>
          <div className="flex flex-wrap gap-2">
            {topLabels.map(([label, count]) => (
              <span
                key={label}
                className="px-2 py-1 text-xs rounded-full bg-accent/15 text-accent"
              >
                {label}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent detections table */}
      {recentDetections.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-heading mb-2">
            Recent Detections
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted border-b border-mid-gray/20">
                  <th className="text-left py-1 pr-3">Time</th>
                  <th className="text-left py-1 pr-3">ID</th>
                  <th className="text-left py-1 pr-3">Label</th>
                  <th className="text-left py-1 pr-3">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {recentDetections.slice(0, 50).map((det, i) => (
                  <tr
                    key={`${det.timestamp}-${i}`}
                    className="border-b border-mid-gray/10"
                  >
                    <td className="py-1 pr-3 text-muted">
                      {new Date(det.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-1 pr-3">
                      {det.track_id ?? "-"}
                    </td>
                    <td className="py-1 pr-3 text-accent">{det.label}</td>
                    <td className="py-1 pr-3">
                      {(det.confidence * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div className="rounded-lg bg-card-bg p-3 border border-mid-gray/20">
    <div className="text-xs text-muted">{label}</div>
    <div className="text-lg font-bold text-heading">{value}</div>
  </div>
);
