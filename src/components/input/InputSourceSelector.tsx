import React from "react";
import { Video, MonitorPlay, FileVideo, Camera, RefreshCw } from "lucide-react";
import { usePipelineStore } from "@/stores/pipelineStore";
import { SettingsGroup } from "@/components/ui/SettingsGroup";
import type { InputSourceType } from "@/types/pipeline";

const INPUT_OPTIONS: {
  type: InputSourceType;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
}[] = [
  {
    type: "default",
    label: "Default Video",
    description: "Built-in example.mp4 demo video",
    icon: FileVideo,
  },
  {
    type: "usb",
    label: "USB Webcam",
    description: "Auto-detect connected USB camera",
    icon: Video,
  },
  {
    type: "file",
    label: "Video File",
    description: "Choose a custom video file",
    icon: MonitorPlay,
  },
  {
    type: "rpi",
    label: "Pi Camera",
    description: "Raspberry Pi Camera Module (CSI)",
    icon: Camera,
  },
];

export const InputSourceSelector: React.FC = () => {
  const inputSource = usePipelineStore((s) => s.inputSource);
  const inputFilePath = usePipelineStore((s) => s.inputFilePath);
  const availableDevices = usePipelineStore((s) => s.availableDevices);
  const setInputSource = usePipelineStore((s) => s.setInputSource);
  const setInputFilePath = usePipelineStore((s) => s.setInputFilePath);
  const refreshDevices = usePipelineStore((s) => s.refreshDevices);

  const handleFileSelect = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        filters: [{ name: "Video", extensions: ["mp4", "avi", "mkv", "mov", "webm"] }],
      });
      if (selected) {
        setInputFilePath(selected as string);
      }
    } catch {
      // Dialog cancelled or unavailable
    }
  };

  return (
    <div className="space-y-4">
      <SettingsGroup title="Input Source">
        <div className="p-2 space-y-1">
          {INPUT_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isActive = inputSource === opt.type;

            return (
              <div
                key={opt.type}
                onClick={() => setInputSource(opt.type)}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border ${
                  isActive
                    ? "border-logo-primary bg-accent-glow"
                    : "border-transparent hover:bg-mid-gray/10"
                }`}
              >
                <Icon
                  size={22}
                  className={isActive ? "text-logo-primary" : "text-mid-gray"}
                />
                <div>
                  <h3 className="text-sm font-medium">{opt.label}</h3>
                  <p className="text-xs text-mid-gray">{opt.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </SettingsGroup>

      {/* File path input */}
      {inputSource === "file" && (
        <SettingsGroup title="Video File">
          <div className="p-3 flex items-center gap-2">
            <input
              type="text"
              value={inputFilePath}
              onChange={(e) => setInputFilePath(e.target.value)}
              placeholder="/path/to/video.mp4"
              className="flex-1 bg-mid-gray/10 border border-mid-gray/30 rounded px-2 py-1.5 text-sm text-text placeholder:text-mid-gray/50 focus:border-logo-primary focus:outline-none"
            />
            <button
              onClick={handleFileSelect}
              className="px-3 py-1.5 bg-logo-primary/20 hover:bg-logo-primary/30 border border-logo-primary/40 rounded text-sm text-logo-primary transition-colors"
            >
              Browse
            </button>
          </div>
        </SettingsGroup>
      )}

      {/* USB devices */}
      {inputSource === "usb" && (
        <SettingsGroup title="Detected Cameras">
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-mid-gray">
                {availableDevices.length} device(s) found
              </span>
              <button
                onClick={refreshDevices}
                className="flex items-center gap-1 text-xs text-logo-primary hover:text-logo-primary/80 transition-colors"
              >
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
            {availableDevices.length > 0 ? (
              <div className="space-y-1">
                {availableDevices.map((dev) => (
                  <div
                    key={dev}
                    className="text-xs font-mono bg-mid-gray/10 rounded px-2 py-1"
                  >
                    {dev}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-mid-gray">
                No USB cameras detected. Plug one in and click Refresh.
              </p>
            )}
          </div>
        </SettingsGroup>
      )}
    </div>
  );
};
