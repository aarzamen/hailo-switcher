import React from "react";
import { SettingsGroup } from "@/components/ui/SettingsGroup";
import { ThemeSelector } from "./ThemeSelector";

export const SettingsView: React.FC = () => {
  return (
    <div className="space-y-4">
      <SettingsGroup title="Appearance">
        <ThemeSelector />
      </SettingsGroup>

      <SettingsGroup title="About">
        <div className="px-4 p-3 space-y-1">
          <p className="text-sm font-medium">Hailo Demo Switcher</p>
          <p className="text-xs text-mid-gray">
            Visual launcher for Hailo NPU AI pipelines on Raspberry Pi 5.
          </p>
          <p className="text-xs text-mid-gray mt-2">
            Hailo-8 (26 TOPS) &bull; Tauri 2.x &bull; React
          </p>
        </div>
      </SettingsGroup>
    </div>
  );
};
