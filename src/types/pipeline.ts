export type PipelineType = "python" | "rpicam";
export type PipelineStatus = "idle" | "cooldown" | "starting" | "running" | "stopping" | "error";
export type InputSourceType = "default" | "usb" | "file" | "rpi";

export interface PipelineDefinition {
  id: string;
  name: string;
  description: string;
  type: PipelineType;
  model: string;
  script?: string;
  jsonConfig?: string;
  supportedInputs: InputSourceType[];
  category: "detection" | "segmentation" | "pose" | "depth" | "classification" | "face";
}

export interface LogEntry {
  line: string;
  stream: "stdout" | "stderr";
  timestamp: number;
}
