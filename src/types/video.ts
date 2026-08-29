import type { OverlayPosition } from "./geotag";

export type GeotagTiming = "beginning" | "end";

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VideoSettings {
  trimStart: number;
  trimEnd: number;

  /**
   * Percentage of the final trimmed video
   * during which the geotag is visible.
   */
  percent: number;

  timing: GeotagTiming;

  position: OverlayPosition;

  /**
   * Geotag width relative to cropped video width.
   *
   * 0.9 = 90%
   */
  scale: number;

  /**
   * Geotag height relative to cropped video height.
   *
   * 0.2 = 20%
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
   * Crop rectangle.
   */
  crop: CropRect;

  /**
   * Starting clock time for the video.
   *
   * Example:
   * "10:25:00"
   *
   * The exported video advances this clock
   * with the video's elapsed time:
   *
   * 10:25:00
   * 10:25:01
   * 10:25:02
   * ...
   */
  startClockTime: string;

  /**
   * If true, the timestamp advances automatically
   * while the video plays.
   */
  movingTime: boolean;
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

export const DEFAULT_CROP: CropRect = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
};

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

  /*
   * Default starting time.
   *
   * Change this from the UI.
   */
  startClockTime: "10:25:00",

  /*
   * The clock moves with the video.
   */
  movingTime: true,
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
