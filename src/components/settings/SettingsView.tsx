import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SettingsGroup } from "@/components/ui/SettingsGroup";
import { ThemeSelector } from "./ThemeSelector";

interface HailoStatus {
  detected: boolean;
  device: string;
  firmware: string;
}

export const SettingsView: React.FC = () => {
  const [hailo, setHailo] = useState<HailoStatus | null>(null);

  useEffect(() => {
    invoke<HailoStatus>("check_hailo_status")
      .then(setHailo)
      .catch(() => setHailo({ detected: false, device: "Error", firmware: "N/A" }));
  }, []);

  return (
    <div className="space-y-4">
      <SettingsGroup title="Hardware">
        <div className="px-4 p-3 space-y-2">
          {hailo === null ? (
            <p className="text-xs text-mid-gray">Detecting Hailo hardware...</p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    hailo.detected ? "bg-green-400" : "bg-red-400"
                  }`}
                />
                <span className="text-sm font-medium">
                  {hailo.detected ? hailo.device : "Not detected"}
                </span>
              </div>
              {hailo.detected && (
                <p className="text-xs text-mid-gray">
                  Firmware: {hailo.firmware}
                </p>
              )}
            </>
          )}
        </div>
      </SettingsGroup>

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
