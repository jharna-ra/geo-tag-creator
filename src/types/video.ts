import type { OverlayPosition } from "./geotag";
import {
  DEFAULT_CROP,
  type CropRect,
} from "@/lib/crop";

export type GeotagTiming =
  | "beginning"
  | "end";

export interface VideoSettings {
  trimStart: number;

  trimEnd: number;

  /**
   * Percentage of the final video
   * during which the geotag is visible.
   */
  percent: number;

  timing: GeotagTiming;

  position: OverlayPosition;

  /**
   * Geotag width as fraction of
   * video width.
   *
   * 0.5 = 50%
   * 1   = 100%
   */
  scale: number;

  /**
   * Geotag height as fraction of
   * video height.
   *
   * 0.2 = 20%
   * 0.5 = 50%
   * 1   = 100%
   */
  heightScale: number;

  /**
   * Geotag opacity.
   *
   * 0 = invisible
   * 1 = fully visible
   */
  opacity: number;

  /**
   * Video crop rectangle.
   *
   * All values are normalized 0–1.
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

  crop: {
    ...DEFAULT_CROP,
  },
});

export function fmtTime(
  s: number,
): string {
  if (
    !Number.isFinite(s) ||
    s < 0
  ) {
    s = 0;
  }

  const minutes = Math.floor(
    s / 60,
  );

  const seconds = Math.floor(
    s % 60,
  );

  return `${String(minutes).padStart(
    2,
    "0",
  )}:${String(seconds).padStart(
    2,
    "0",
  )}`;
}
