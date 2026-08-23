import type { OverlayPosition } from "./geotag";

export type GeotagTiming = "beginning" | "end";

export interface VideoSettings {
  trimStart: number;
  trimEnd: number;

  // Percentage of video duration where geotag is visible
  percent: number;

  timing: GeotagTiming;

  position: OverlayPosition;

  // Geotag width as a fraction of video width
  // 0.5 = 50%, 1 = 100%
  scale: number;

  // Geotag height as a fraction of video height
  // 0.2 = 20%, 0.5 = 50%, 1 = 100%
  heightScale: number;

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

  status:
    | "idle"
    | "processing"
    | "done"
    | "error";

  progress: number;

  error?: string;

  outputUrl?: string;
  outputName?: string;
  outputBlob?: Blob;
}

export const DEFAULT_SETTINGS = (
  duration: number,
): VideoSettings => ({
  trimStart: 0,
  trimEnd: duration,

  // Geotag duration
  percent: 30,

  timing: "beginning",

  position: "bottom-center",

  // Geotag width = 90%
  scale: 0.9,

  // Geotag height = 20%
  heightScale: 0.2,

  opacity: 1,
});

export function fmtTime(
  s: number,
): string {
  if (!isFinite(s) || s < 0) {
    s = 0;
  }

  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);

  return `${String(m).padStart(
    2,
    "0",
  )}:${String(sec).padStart(2, "0")}`;
}
