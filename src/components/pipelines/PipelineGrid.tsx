import React from "react";
import { PIPELINES, CATEGORIES } from "@/data/pipelines";
import { PipelineCard } from "./PipelineCard";
import { PipelineDetail } from "./PipelineDetail";
import { usePipelineStore } from "@/stores/pipelineStore";
import { SettingsGroup } from "@/components/ui/SettingsGroup";
import type { PipelineDefinition } from "@/types/pipeline";

export const PipelineGrid: React.FC = () => {
  const activePipeline = usePipelineStore((s) => s.activePipeline);
  const pipelineStatus = usePipelineStore((s) => s.pipelineStatus);
  const selectPipeline = usePipelineStore((s) => s.selectPipeline);

  // Group pipelines by category
  const grouped = React.useMemo(() => {
    const groups: Record<string, PipelineDefinition[]> = {};
    for (const p of PIPELINES) {
      if (!groups[p.category]) groups[p.category] = [];
      groups[p.category].push(p);
    }
    return Object.entries(groups).sort(
      ([a], [b]) =>
        (CATEGORIES[a as keyof typeof CATEGORIES]?.order ?? 99) -
        (CATEGORIES[b as keyof typeof CATEGORIES]?.order ?? 99)
    );
  }, []);

  return (
    <div className="space-y-4">
      {/* Detail panel when a pipeline is selected */}
      {activePipeline && <PipelineDetail />}

      {/* Pipeline grid by category */}
      {grouped.map(([category, pipelines]) => (
        <SettingsGroup
          key={category}
          title={CATEGORIES[category as keyof typeof CATEGORIES]?.label ?? category}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2">
            {pipelines.map((p) => (
              <PipelineCard
                key={p.id}
                pipeline={p}
                isActive={activePipeline?.id === p.id}
                isRunning={activePipeline?.id === p.id && pipelineStatus === "running"}
                onClick={() =>
                  selectPipeline(activePipeline?.id === p.id ? null : p)
                }
              />
            ))}
          </div>
        </SettingsGroup>
      ))}
    </div>
  );
};
