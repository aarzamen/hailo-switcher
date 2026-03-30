import React from "react";
import { SettingsGroup } from "@/components/ui/SettingsGroup";
import type { ScreenRegion } from "@/types/pipeline";

interface ScreenRegionSelectorProps {
  region: ScreenRegion;
  onChange: (region: ScreenRegion) => void;
}

const PRESETS: { label: string; region: ScreenRegion }[] = [
  { label: "Full Screen", region: { x: 0, y: 0, width: 1920, height: 1080, full_screen: true } },
  { label: "Left Half", region: { x: 0, y: 0, width: 960, height: 1080, full_screen: false } },
  { label: "Right Half", region: { x: 960, y: 0, width: 960, height: 1080, full_screen: false } },
  { label: "Top Half", region: { x: 0, y: 0, width: 1920, height: 540, full_screen: false } },
  { label: "Bottom Half", region: { x: 0, y: 540, width: 1920, height: 540, full_screen: false } },
];

export const ScreenRegionSelector: React.FC<ScreenRegionSelectorProps> = ({ region, onChange }) => {
  const updateField = (field: keyof ScreenRegion, value: number | boolean) => {
    onChange({ ...region, [field]: value, full_screen: false });
  };

  return (
    <SettingsGroup title="Screen Region" description="Select capture area">
      {/* Presets */}
      <div className="px-3 pt-3 flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => {
          const isActive =
            region.full_screen === preset.region.full_screen &&
            region.x === preset.region.x &&
            region.y === preset.region.y &&
            region.width === preset.region.width &&
            region.height === preset.region.height;

          return (
            <button
              key={preset.label}
              onClick={() => onChange(preset.region)}
              className={`px-2.5 py-1.5 min-h-[32px] rounded text-xs font-medium transition-all cursor-pointer ${
                isActive
                  ? "bg-logo-primary/30 border border-logo-primary text-logo-primary"
                  : "bg-mid-gray/10 border border-mid-gray/30 text-mid-gray hover:bg-mid-gray/20"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Manual coordinate input */}
      {!region.full_screen && (
        <div className="p-3 grid grid-cols-2 gap-2">
          {(["x", "y", "width", "height"] as const).map((field) => (
            <div key={field}>
              <label className="text-[10px] text-mid-gray uppercase tracking-wider">{field}</label>
              <input
                type="number"
                value={region[field] as number}
                onChange={(e) => updateField(field, Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-mid-gray/10 border border-mid-gray/30 rounded px-2 py-1.5 text-sm text-text font-mono focus:border-logo-primary focus:outline-none"
              />
            </div>
          ))}
        </div>
      )}
    </SettingsGroup>
  );
};
