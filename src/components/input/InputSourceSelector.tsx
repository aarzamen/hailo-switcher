import React, { useState } from "react";
import {
  Video,
  Camera,
  Monitor,
  Crop,
  Film,
  FileVideo,
  RefreshCw,
  Loader2,
  Radio,
} from "lucide-react";
import { usePipelineStore } from "@/stores/pipelineStore";
import { SettingsGroup } from "@/components/ui/SettingsGroup";
import { ScreenRegionSelector } from "./ScreenRegionSelector";
import type { AvailableSource } from "@/types/pipeline";

const SOURCE_ICONS: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
  "demo": Film,
  "file": FileVideo,
  "screen-full": Monitor,
  "screen-region": Crop,
  "picam-0": Camera,
  "stream": Radio,
};

function getIcon(source: AvailableSource) {
  if (SOURCE_ICONS[source.id]) return SOURCE_ICONS[source.id];
  if (source.source_type === "device") return Video;
  if (source.source_type === "screen") return Monitor;
  return Film;
}

export const InputSourceSelector: React.FC = () => {
  const selectedSourceId = usePipelineStore((s) => s.selectedSourceId);
  const selectedFilePath = usePipelineStore((s) => s.selectedFilePath);
  const streamUrl = usePipelineStore((s) => s.streamUrl);
  const availableSources = usePipelineStore((s) => s.availableSources);
  const selectSource = usePipelineStore((s) => s.selectSource);
  const setFilePath = usePipelineStore((s) => s.setFilePath);
  const setStreamUrl = usePipelineStore((s) => s.setStreamUrl);
  const refreshSources = usePipelineStore((s) => s.refreshSources);
  const screenRegion = usePipelineStore((s) => s.screenRegion);
  const setScreenRegion = usePipelineStore((s) => s.setScreenRegion);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshSources();
    setIsRefreshing(false);
  };

  const handleFileSelect = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        filters: [{ name: "Video", extensions: ["mp4", "avi", "mkv", "mov", "webm"] }],
      });
      if (selected) {
        setFilePath(selected as string);
      }
    } catch {
      // Dialog cancelled or unavailable
    }
  };

  return (
    <div className="space-y-4">
      <SettingsGroup
        title="Video Source"
        description="Select an input source for the pipeline"
      >
        <div className="p-2 space-y-1">
          {availableSources.map((source) => {
            const Icon = getIcon(source);
            const isActive = selectedSourceId === source.id;
            const isAvailable = source.available;

            return (
              <button
                key={source.id}
                onClick={() => isAvailable && selectSource(source.id)}
                disabled={!isAvailable}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all border text-left cursor-pointer ${
                  !isAvailable
                    ? "opacity-40 cursor-not-allowed border-transparent"
                    : isActive
                      ? "border-logo-primary bg-accent-glow"
                      : "border-transparent hover:bg-mid-gray/10"
                }`}
              >
                <Icon
                  size={22}
                  className={isActive && isAvailable ? "text-logo-primary" : "text-mid-gray"}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium truncate">
                    {source.label}
                    {!isAvailable && (
                      <span className="text-[10px] text-mid-gray ml-2">(not detected)</span>
                    )}
                  </h3>
                  <p className="text-xs text-mid-gray">{source.source_type}</p>
                </div>
                {/* Availability dot */}
                <span
                  className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                    isAvailable ? "bg-green-400" : "bg-mid-gray/40"
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Refresh button */}
        <div className="px-3 pb-3 flex justify-end">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 min-h-[32px] min-w-[44px] rounded border border-logo-primary/40 bg-logo-primary/10 text-xs text-logo-primary hover:bg-logo-primary/20 active:bg-logo-primary/30 transition-colors cursor-pointer pointer-events-auto"
          >
            {isRefreshing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Refresh
          </button>
        </div>
      </SettingsGroup>

      {/* File path input — shown when "file" source is selected */}
      {selectedSourceId === "file" && (
        <SettingsGroup title="Video File">
          <div className="p-3 flex items-center gap-2">
            <input
              type="text"
              value={selectedFilePath}
              onChange={(e) => setFilePath(e.target.value)}
              placeholder="/path/to/video.mp4"
              className="flex-1 bg-mid-gray/10 border border-mid-gray/30 rounded px-2 py-1.5 text-sm text-text placeholder:text-mid-gray/50 focus:border-logo-primary focus:outline-none"
            />
            <button
              onClick={handleFileSelect}
              className="px-3 py-1.5 min-h-[32px] bg-logo-primary/20 hover:bg-logo-primary/30 active:bg-logo-primary/40 border border-logo-primary/40 rounded text-sm text-logo-primary transition-colors cursor-pointer"
            >
              Browse
            </button>
          </div>
        </SettingsGroup>
      )}

      {/* Stream URL input — shown when "stream" source is selected */}
      {selectedSourceId === "stream" && (
        <SettingsGroup title="Stream URL" description="YouTube URL or RTSP address">
          <div className="p-3">
            <input
              type="text"
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=... or rtsp://..."
              className="w-full bg-mid-gray/10 border border-mid-gray/30 rounded px-2 py-1.5 text-sm text-text placeholder:text-mid-gray/50 focus:border-logo-primary focus:outline-none"
            />
            <p className="text-[10px] text-mid-gray mt-1.5">
              YouTube requires yt-dlp installed. RTSP streams connect directly.
            </p>
          </div>
        </SettingsGroup>
      )}

      {/* Screen region selector — shown when "screen-region" is selected */}
      {selectedSourceId === "screen-region" && (
        <ScreenRegionSelector region={screenRegion} onChange={setScreenRegion} />
      )}
    </div>
  );
};
