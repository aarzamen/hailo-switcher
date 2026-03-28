import React from "react";
import {
  ScanSearch,
  PersonStanding,
  Layers,
  Mountain,
  Tag,
  Smile,
} from "lucide-react";
import type { PipelineDefinition } from "@/types/pipeline";

const CATEGORY_ICONS: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
  detection: ScanSearch,
  pose: PersonStanding,
  segmentation: Layers,
  depth: Mountain,
  classification: Tag,
  face: Smile,
};

interface PipelineCardProps {
  pipeline: PipelineDefinition;
  isActive: boolean;
  onClick: () => void;
}

export const PipelineCard: React.FC<PipelineCardProps> = ({
  pipeline,
  isActive,
  onClick,
}) => {
  const Icon = CATEGORY_ICONS[pipeline.category] ?? ScanSearch;

  return (
    <div
      onClick={onClick}
      className={`settings-group-hover flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all border ${
        isActive
          ? "border-logo-primary bg-accent-glow shadow-[0_0_12px_var(--color-accent-glow)]"
          : "border-transparent hover:border-surface-border hover:bg-mid-gray/5"
      }`}
    >
      <Icon
        size={28}
        className={`shrink-0 mt-0.5 ${isActive ? "text-logo-primary" : "text-mid-gray"}`}
      />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold truncate">{pipeline.name}</h3>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
              pipeline.type === "python"
                ? "bg-blue-500/20 text-blue-300"
                : "bg-green-500/20 text-green-300"
            }`}
          >
            {pipeline.type === "python" ? "Python" : "rpicam"}
          </span>
        </div>
        <p className="text-xs text-mid-gray mt-0.5 truncate">
          {pipeline.model}
        </p>
      </div>
    </div>
  );
};
