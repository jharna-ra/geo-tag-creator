// src/lib/videoProcessor.ts
import { fetchFile } from "@ffmpeg/util";
import { getFFmpeg } from "./ffmpeg";
import type { OverlayPosition } from "../types/geotag";

export interface WhiteTextRemoval {
  enabled: boolean;
  /** Selection box as fractions of video width/height, each 0-1. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GeotagTiming {
  mode: "beginning" | "end";
  durationSeconds: number;
}

export interface ProcessVideoOptions {
  file: File;
  trimStart: number;
  trimEnd: number;
  geotagPng: Blob;
  geotagPosition: OverlayPosition;
  /** Geotag width as a fraction of the video width, e.g. 0.9 for 90%. */
  geotagWidthFraction: number;
  timing: GeotagTiming;
  whiteTextRemoval?: WhiteTextRemoval;
  onProgress?: (ratio: number) => void;
}

function overlayPositionExpr(position: OverlayPosition): string {
  const m = "20";
  const map: Record<OverlayPosition, string> = {
    "top-left": `${m}:${m}`,
    "top-center": `(main_w-overlay_w)/2:${m}`,
    "top-right": `main_w-overlay_w-${m}:${m}`,
    "center-left": `${m}:(main_h-overlay_h)/2`,
    center: `(main_w-overlay_w)/2:(main_h-overlay_h)/2`,
    "center-right": `main_w-overlay_w-${m}:(main_h-overlay_h)/2`,
    "bottom-left": `${m}:main_h-overlay_h-${m}`,
    "bottom-center": `(main_w-overlay_w)/2:main_h-overlay_h-${m}`,
    "bottom-right": `main_w-overlay_w-${m}:main_h-overlay_h-${m}`,
  };
  return map[position];
}

/**
 * Trims the video, optionally removes a white-text/watermark region, and
 * burns in the geotag overlay for the configured duration — all in a single
 * FFmpeg pass. The white-text removal runs as a native FFmpeg filter
 * (crop + blur, laid back over itself) rather than manual per-frame pixel
 * work in JS, so it stays fast regardless of video length.
 */
export async function processVideo(opts: ProcessVideoOptions): Promise<Blob> {
  const ff = await getFFmpeg(opts.onProgress);

  const tag = Date.now();
  const inputName = `input_${tag}.mp4`;
  const overlayName = `overlay_${tag}.png`;
  const outputName = `output_${tag}.mp4`;

  await ff.writeFile(inputName, await fetchFile(opts.file));
  await ff.writeFile(overlayName, await fetchFile(opts.geotagPng));

  const trimDuration = Math.max(0.1, opts.trimEnd - opts.trimStart);
  const geotagDuration = Math.min(opts.timing.durationSeconds, trimDuration);
  const geotagStart = opts.timing.mode === "beginning" ? 0 : trimDuration - geotagDuration;
  const geotagEnd = geotagStart + geotagDuration;

  const filters: string[] = [];
  let videoLabel = "0:v";

  if (opts.whiteTextRemoval?.enabled) {
    const { x, y, w, h } = opts.whiteTextRemoval;
    // Crop just the selected region, blur it heavily, and overlay it back
    // at the same spot — hides the text without touching the rest of the
    // frame. (If your ffmpeg core build includes `delogo`, that filter can
    // give a cleaner true-inpaint result — swap these two lines for:
    // `[0:v]delogo=x=iw*${x}:y=ih*${y}:w=iw*${w}:h=ih*${h}[cleaned]`)
    filters.push(
      `[0:v]crop=w=iw*${w}:h=ih*${h}:x=iw*${x}:y=ih*${y},boxblur=24:3[patch]`,
      `[0:v][patch]overlay=x=iw*${x}:y=ih*${y}[cleaned]`
    );
    videoLabel = "cleaned";
  }

  filters.push(
    `[1:v]scale=iw*${opts.geotagWidthFraction}:-1[geo]`,
    `[${videoLabel}][geo]overlay=${overlayPositionExpr(
      opts.geotagPosition
    )}:enable='between(t,${geotagStart.toFixed(3)},${geotagEnd.toFixed(3)})'[outv]`
  );

  const args = [
    "-ss", String(opts.trimStart),
    "-to", String(opts.trimEnd),
    "-i", inputName,
    "-loop", "1",
    "-i", overlayName,
    "-filter_complex", filters.join(";"),
    "-map", "[outv]",
    "-map", "0:a?",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "20",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    "-shortest",
    outputName,
  ];

  try {
    await ff.exec(args);
  } catch (err) {
    throw new Error(
      "Unable to process this video in your browser. Try using an MP4 video or a shorter/smaller video."
    );
  }

  const data = await ff.readFile(outputName);

  await Promise.allSettled([
    ff.deleteFile(inputName),
    ff.deleteFile(overlayName),
    ff.deleteFile(outputName),
  ]);

  return new Blob([data as Uint8Array], { type: "video/mp4" });
}
