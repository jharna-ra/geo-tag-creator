import type { OverlayPosition } from "./geotag";

export type GeotagTiming = "beginning" | "end";

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Rectangle used by the white-text remover.
 *
 * Coordinates are normalized to the original video:
 * 0 = left/top
 * 1 = right/bottom
 *
 * Example:
 * x: 0.1
 * y: 0.8
 * width: 0.8
 * height: 0.15
 */
export interface WhiteTextRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * White-text removal settings.
 *
 * The selected area is applied to every frame during export.
 */
export interface WhiteTextRemovalSettings {
  /**
   * Whether white-text removal is enabled.
   */
  enabled: boolean;

  /**
   * Selected rectangle in normalized video coordinates.
   */
  rect: WhiteTextRect | null;

  /**
   * Brightness threshold used to identify white pixels.
   *
   * Higher = only brighter pixels are removed.
   */
  threshold: number;

  /**
   * Color tolerance.
   *
   * Lower = pixels must be closer to pure white.
   */
  tolerance: number;

  /**
   * Removal strength from 0 to 1.
   */
  strength: number;

  /**
   * Number of lightweight cleanup passes.
   *
   * Keep this low for video performance.
   */
  passes: number;
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
   *
   * Values are normalized:
   * 0..1
   */
  crop: CropRect;

  /**
   * White-text removal settings.
   */
  whiteTextRemoval: WhiteTextRemovalSettings;

  /**
   * Starting clock time for the video.
   *
   * Example:
   * "10:25:00"
   */
  startClockTime: string;

  /**
   * If true, the timestamp advances automatically
   * with the video's elapsed time.
   */
  movingTime: boolean;
}

export interface VideoItem {
  id: string;

  file: File;

  url: string;

  /**
   * Original uploaded filename.
   *
   * This should never be replaced with a generated name.
   */
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

  /**
   * Object URL for the rendered output.
   */
  outputUrl?: string;

  /**
   * Final downloaded filename.
   */
  outputName?: string;

  /**
   * Rendered video blob.
   */
  outputBlob?: Blob;
}

/**
 * Full-video crop by default.
 */
export const DEFAULT_CROP: CropRect = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
};

/**
 * No white-text-removal selection by default.
 */
export const DEFAULT_WHITE_TEXT_REMOVAL: WhiteTextRemovalSettings = {
  enabled: false,
  rect: null,

  /**
   * Bright white pixels only.
   */
  threshold: 180,

  /**
   * Small color difference from white.
   */
  tolerance: 55,

  /**
   * Full replacement strength.
   */
  strength: 1,

  /**
   * Keep this low because this is video processing.
   */
  passes: 1,
};

export const DEFAULT_SETTINGS = (
  duration: number,
): VideoSettings => ({
  trimStart: 0,

  trimEnd: Number.isFinite(duration)
    ? Math.max(0, duration)
    : 0,

  percent: 30,

  timing: "beginning",

  position: "bottom-center",

  scale: 0.9,

  heightScale: 0.2,

  opacity: 1,

  crop: {
    ...DEFAULT_CROP,
  },

  whiteTextRemoval: {
    ...DEFAULT_WHITE_TEXT_REMOVAL,
  },

  /*
   * Default starting time.
   *
   * This is changed by the user from the UI.
   */
  startClockTime: "10:25:00",

  /*
   * The clock moves with the video.
   */
  movingTime: true,
});

/**
 * Convert seconds to MM:SS.
 *
 * Examples:
 * 0    -> 00:00
 * 10   -> 00:10
 * 20   -> 00:20
 * 65   -> 01:05
 */
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

/**
 * Clamp a number between two values.
 */
export function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.min(
    max,
    Math.max(min, value),
  );
}

/**
 * Validate a normalized rectangle.
 */
export function isValidRect(
  rect: CropRect | WhiteTextRect | null | undefined,
): rect is CropRect | WhiteTextRect {
  if (!rect) {
    return false;
  }

  return (
    Number.isFinite(rect.x) &&
    Number.isFinite(rect.y) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height) &&
    rect.width > 0 &&
    rect.height > 0
  );
}

/**
 * Clamp a rectangle to normalized video coordinates.
 */
export function normalizeRect(
  rect: CropRect,
): CropRect {
  const x = clamp(rect.x, 0, 1);
  const y = clamp(rect.y, 0, 1);

  const maxWidth = 1 - x;
  const maxHeight = 1 - y;

  return {
    x,
    y,
    width: clamp(
      rect.width,
      0,
      maxWidth,
    ),
    height: clamp(
      rect.height,
      0,
      maxHeight,
    ),
  };
}

/**
 * Create a safe copy of video settings.
 *
 * Useful when updating React state so nested crop/removal
 * objects aren't accidentally shared.
 */
export function cloneVideoSettings(
  settings: VideoSettings,
): VideoSettings {
  return {
    ...settings,

    crop: {
      ...settings.crop,
    },

    whiteTextRemoval: {
      ...settings.whiteTextRemoval,

      rect:
        settings.whiteTextRemoval.rect
          ? {
              ...settings.whiteTextRemoval.rect,
            }
          : null,
    },
  };
}

/**
 * Calculate the actual trimmed duration.
 */
export function getTrimmedDuration(
  settings: VideoSettings,
  sourceDuration: number,
): number {
  const start = clamp(
    Number(settings.trimStart) || 0,
    0,
    sourceDuration,
  );

  const end = clamp(
    Number(settings.trimEnd) || sourceDuration,
    start,
    sourceDuration,
  );

  return Math.max(
    0,
    end - start,
  );
}

/**
 * Convert a normalized rectangle into
 * pixel coordinates.
 */
export function rectToPixels(
  rect: CropRect | WhiteTextRect,
  videoWidth: number,
  videoHeight: number,
) {
  return {
    x: Math.round(
      rect.x * videoWidth,
    ),

    y: Math.round(
      rect.y * videoHeight,
    ),

    width: Math.round(
      rect.width * videoWidth,
    ),

    height: Math.round(
      rect.height * videoHeight,
    ),
  };
}
