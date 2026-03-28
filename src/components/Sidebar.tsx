import React from "react";
import {
  Cpu,
  Video,
  Terminal,
  Settings,
} from "lucide-react";
import { PipelineGrid } from "./pipelines/PipelineGrid";
import { InputSourceSelector } from "./input/InputSourceSelector";
import { LogViewer } from "./logs/LogViewer";
import { SettingsView } from "./settings/SettingsView";

export type SidebarSection = keyof typeof SECTIONS_CONFIG;

interface IconProps {
  width?: number | string;
  height?: number | string;
  size?: number | string;
  className?: string;
  [key: string]: unknown;
}

interface SectionConfig {
  label: string;
  icon: React.ComponentType<IconProps>;
  component: React.ComponentType;
}

export const SECTIONS_CONFIG = {
  pipelines: {
    label: "Pipelines",
    icon: Cpu,
    component: PipelineGrid,
  },
  input: {
    label: "Input",
    icon: Video,
    component: InputSourceSelector,
  },
  logs: {
    label: "Logs",
    icon: Terminal,
    component: LogViewer,
  },
  settings: {
    label: "Settings",
    icon: Settings,
    component: SettingsView,
  },
} as const satisfies Record<string, SectionConfig>;

interface SidebarProps {
  activeSection: SidebarSection;
  onSectionChange: (section: SidebarSection) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSectionChange,
}) => {
  return (
    <div className="sidebar-region flex flex-col w-44 h-full border-e border-mid-gray/20 items-center px-2 bg-sidebar-bg">
      {/* Logo */}
      <div className="flex items-center gap-2 m-4">
        <Cpu size={24} className="text-logo-primary" />
        <span className="text-sm font-bold text-logo-primary tracking-wider">
          HAILO NPU
        </span>
      </div>

      {/* Nav */}
      <div className="flex flex-col w-full items-center gap-1 pt-2 border-t border-mid-gray/20">
        {Object.entries(SECTIONS_CONFIG).map(([id, config]) => {
          const Icon = config.icon;
          const isActive = activeSection === id;

          return (
            <div
              key={id}
              className={`flex gap-2 items-center p-2 w-full rounded-lg cursor-pointer transition-colors ${
                isActive
                  ? "bg-logo-primary/80"
                  : "hover:bg-mid-gray/20 hover:opacity-100 opacity-85"
              }`}
              onClick={() => onSectionChange(id as SidebarSection)}
            >
              <Icon width={20} height={20} className="shrink-0" />
              <p className="text-sm font-medium truncate">{config.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
