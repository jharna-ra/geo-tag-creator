import type { OverlayPosition } from "./geotag";

export type GeotagTiming = "beginning" | "end";

export interface VideoSettings {
  trimStart: number;
  trimEnd: number;
  percent: number;
  timing: GeotagTiming;
  position: OverlayPosition;
  /** overlay width as a fraction of the video width */
  scale: number;
  opacity: number;
}

export interface VideoItem {
  id: string;
  file: File;
  url: string;
  name: string;
  duration: number;
  width: number;
  height: number;
  settings: VideoSettings;
  status: "idle" | "processing" | "done" | "error";
  progress: number;
  error?: string;
  outputUrl?: string;
  outputName?: string;
  outputBlob?: Blob;
}

export const DEFAULT_SETTINGS = (duration: number): VideoSettings => ({
  trimStart: 0,
  trimEnd: duration,
  percent: 30,
  timing: "beginning",
  position: "bottom-center",
  scale: 0.9,
  opacity: 1,
});

export function fmtTime(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
