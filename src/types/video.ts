import type { OverlayPosition } from "./geotag";

export type GeotagTiming = "beginning" | "end";

export interface CropRect {
  /**
   * All values are normalized 0–1.
   *
   * x      = left position
   * y      = top position
   * width  = crop width
   * height = crop height
   */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VideoSettings {
  trimStart: number;
  trimEnd: number;

  /**
   * Percentage of the FINAL video duration
   * during which the geotag is visible.
   */
  percent: number;

  timing: GeotagTiming;

  position: OverlayPosition;

  /**
   * Geotag width as a fraction of video width.
   *
   * 0.5 = 50%
   * 1   = 100%
   */
  scale: number;

  /**
   * Geotag height as a fraction of video height.
   *
   * 0.2 = 20%
   * 0.5 = 50%
   * 1   = 100%
   */
  heightScale: number;

  /**
   * Geotag opacity.
   *
   * 0 = transparent
   * 1 = completely visible
   */
  opacity: number;

  /**
   * Video crop rectangle.
   *
   * Default:
   * x = 0
   * y = 0
   * width = 1
   * height = 1
   *
   * means the entire video.
   */
  crop: CropRect;
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

  percent: 30,

  timing: "beginning",

  position: "bottom-center",

  scale: 0.9,

  heightScale: 0.2,

  opacity: 1,

  /**
   * Initially keep the entire video.
   */
  crop: {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
  },
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
