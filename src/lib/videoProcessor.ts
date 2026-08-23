import { fetchFile } from "@ffmpeg/util";

import { getFFmpeg } from "./ffmpeg";

import type { OverlayPosition } from "@/types/geotag";
import type { VideoItem } from "@/types/video";

export function overlayXY(
  position: OverlayPosition,
  margin: number,
): {
  x: string;
  y: string;
} {
  const m = String(Math.max(0, margin));

  switch (position) {
    case "top-left":
      return {
        x: m,
        y: m,
      };

    case "top-right":
      return {
        x: `main_w-overlay_w-${m}`,
        y: m,
      };

    case "bottom-left":
      return {
        x: m,
        y: `main_h-overlay_h-${m}`,
      };

    case "bottom-right":
      return {
        x: `main_w-overlay_w-${m}`,
        y: `main_h-overlay_h-${m}`,
      };

    case "bottom-center":
    default:
      return {
        x: "(main_w-overlay_w)/2",
        y: `main_h-overlay_h-${m}`,
      };
  }
}

export function computeTiming(item: VideoItem) {
  const duration = Number(item.duration);

  /*
   * A video with an invalid duration must not be processed.
   */
  if (!Number.isFinite(duration) || duration <= 0) {
    return {
      start: 0,
      end: 0,
      finalDuration: 0,
      geotagDuration: 0,
      overlayStart: 0,
      overlayEnd: 0,
    };
  }

  const trimStart = Number(item.settings.trimStart);
  const trimEnd = Number(item.settings.trimEnd);

  const start = Math.max(
    0,
    Math.min(
      Number.isFinite(trimStart) ? trimStart : 0,
      duration,
    ),
  );

  const end = Math.max(
    start + 0.1,
    Math.min(
      Number.isFinite(trimEnd) ? trimEnd : duration,
      duration,
    ),
  );

  const finalDuration = Math.max(
    0.1,
    end - start,
  );

  const percent = Math.max(
    1,
    Math.min(
      100,
      Number(item.settings.percent) || 1,
    ),
  );

  const geotagDuration =
    (finalDuration * percent) / 100;

  const overlayStart =
    item.settings.timing === "beginning"
      ? 0
      : Math.max(
          0,
          finalDuration - geotagDuration,
        );

  const overlayEnd =
    Math.min(
      finalDuration,
      overlayStart + geotagDuration,
    );

  return {
    start,
    end,
    finalDuration,
    geotagDuration,
    overlayStart,
    overlayEnd,
  };
}

export interface ProcessArgs {
  item: VideoItem;

  /*
   * This is now the user's uploaded
   * geotag image.
   */
  overlayPng: Blob;

  onProgress: (p: number) => void;
}

export async function processVideo({
  item,
  overlayPng,
  onProgress,
}: ProcessArgs): Promise<Blob> {
  /*
   * ------------------------------------------------------------
   * VALIDATE VIDEO
   * ------------------------------------------------------------
   */

  if (!item) {
    throw new Error("No video was supplied.");
  }

  if (!(item.file instanceof File)) {
    throw new Error(
      "The selected video file is invalid. Please upload the video again.",
    );
  }

  if (item.file.size <= 0) {
    throw new Error(
      "The selected video file is empty.",
    );
  }

  /*
   * ------------------------------------------------------------
   * VALIDATE GEOTAG IMAGE
   * ------------------------------------------------------------
   */

  if (!(overlayPng instanceof Blob)) {
    throw new Error(
      "The geotag image is invalid. Please upload the geotag image again.",
    );
  }

  if (overlayPng.size <= 0) {
    throw new Error(
      "The geotag image is empty.",
    );
  }

  /*
   * ------------------------------------------------------------
   * TIMING
   * ------------------------------------------------------------
   */

  const timing = computeTiming(item);

  if (timing.finalDuration <= 0) {
    throw new Error(
      "Could not determine the video duration. Please remove the video and upload it again.",
    );
  }

  const {
    start,
    finalDuration,
    overlayStart,
    overlayEnd,
  } = timing;

  /*
   * ------------------------------------------------------------
   * FFMPEG
   * ------------------------------------------------------------
   */

  const ffmpeg = await getFFmpeg();

  /*
   * ------------------------------------------------------------
   * FILE NAMES
   * ------------------------------------------------------------
   */

  const extension =
    item.file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") ||
    "mp4";

  const inName = `input_${item.id}.${extension}`;

  const pngName = `geotag_${item.id}.png`;

  const outFile = `output_${item.id}.mp4`;

  /*
   * ------------------------------------------------------------
   * PROGRESS
   * ------------------------------------------------------------
   */

  const handler = ({
    progress,
  }: {
    progress: number;
  }) => {
    const pct = Math.max(
      0,
      Math.min(
        100,
        Math.round(progress * 100),
      ),
    );

    onProgress(pct);
  };

  ffmpeg.on("progress", handler);

  try {
    /*
     * ----------------------------------------------------------
     * WRITE VIDEO
     * ----------------------------------------------------------
     */

    const videoData = await fetchFile(
      item.file,
    );

    if (!videoData) {
      throw new Error(
        "Could not read the uploaded video.",
      );
    }

    await ffmpeg.writeFile(
      inName,
      videoData,
    );

    /*
     * ----------------------------------------------------------
     * WRITE GEOTAG IMAGE
     *
     * IMPORTANT:
     *
     * This is the exact image uploaded by the user.
     *
     * We do NOT generate it.
     * We do NOT redraw it.
     * We do NOT modify its design.
     * ----------------------------------------------------------
     */

    const imageData = await fetchFile(
      overlayPng,
    );

    if (!imageData) {
      throw new Error(
        "Could not read the uploaded geotag image.",
      );
    }

    await ffmpeg.writeFile(
      pngName,
      imageData,
    );

    /*
     * ----------------------------------------------------------
     * GEOTAG SIZE
     * ----------------------------------------------------------
     */

    const widthScale = Math.max(
      0.01,
      Math.min(
        1,
        Number(item.settings.scale) || 0.9,
      ),
    );

    const heightScale = Math.max(
      0.01,
      Math.min(
        1,
        Number(item.settings.heightScale) || 0.2,
      ),
    );

    /*
     * Scale according to the VIDEO dimensions.
     *
     * The original geotag image keeps its content.
     * FFmpeg only scales the overlay.
     */

    const overlayW =
      `main_w*${widthScale}`;

    const overlayH =
      `main_h*${heightScale}`;

    /*
     * ----------------------------------------------------------
     * POSITION
     * ----------------------------------------------------------
     */

    const { x, y } = overlayXY(
      item.settings.position,
      0,
    );

    /*
     * ----------------------------------------------------------
     * OPACITY
     * ----------------------------------------------------------
     */

    const alpha = Math.max(
      0,
      Math.min(
        1,
        Number(item.settings.opacity) || 1,
      ),
    );

    /*
     * ----------------------------------------------------------
     * FILTER
     * ----------------------------------------------------------
     */

    const filter =
      `[1:v]` +
      `scale=${overlayW}:${overlayH},` +
      `format=rgba,` +
      `colorchannelmixer=aa=${alpha}` +
      `[geotag];` +

      `[0:v][geotag]` +
      `overlay=${x}:${y}` +
      `:enable='between(t,${overlayStart.toFixed(
        3,
      )},${overlayEnd.toFixed(
        3,
      )})'` +
      `:format=auto` +
      `[v]`;

    /*
     * ----------------------------------------------------------
     * FFMPEG COMMAND
     * ----------------------------------------------------------
     */

    const args = [
      "-ss",
      start.toFixed(3),

      "-i",
      inName,

      /*
       * Keep image available for entire video.
       */
      "-loop",
      "1",

      "-i",
      pngName,

      "-filter_complex",
      filter,

      "-map",
      "[v]",

      /*
       * Copy original audio stream.
       */
      "-map",
      "0:a?",

      "-t",
      finalDuration.toFixed(3),

      "-c:v",
      "libx264",

      "-preset",
      "ultrafast",

      "-crf",
      "26",

      "-pix_fmt",
      "yuv420p",

      "-c:a",
      "aac",

      "-b:a",
      "128k",

      "-movflags",
      "+faststart",

      outFile,
    ];

    console.log(
      "FFmpeg input:",
      item.file.name,
    );

    console.log(
      "FFmpeg geotag:",
      overlayPng.type,
      overlayPng.size,
    );

    console.log(
      "FFmpeg timing:",
      timing,
    );

    console.log(
      "FFmpeg args:",
      args,
    );

    /*
     * ----------------------------------------------------------
     * EXECUTE
     * ----------------------------------------------------------
     */

    const code =
      await ffmpeg.exec(args);

    if (code !== 0) {
      throw new Error(
        `FFmpeg failed with exit code ${code}.`,
      );
    }

    /*
     * ----------------------------------------------------------
     * READ OUTPUT
     * ----------------------------------------------------------
     */

    const output =
      await ffmpeg.readFile(
        outFile,
      );

    if (!output) {
      throw new Error(
        "FFmpeg did not produce an output video.",
      );
    }

    /*
     * Convert to a clean Uint8Array.
     */

    const copy =
      new Uint8Array(
        output as Uint8Array,
      );

    return new Blob(
      [copy],
      {
        type: "video/mp4",
      },
    );
  } catch (error) {
    console.error(
      "Video processing error:",
      error,
    );

    /*
     * Preserve useful validation messages.
     */
    if (
      error instanceof Error &&
      (
        error.message.includes(
          "Please",
        ) ||
        error.message.includes(
          "invalid",
        ) ||
        error.message.includes(
          "empty",
        )
      )
    ) {
      throw error;
    }

    throw new Error(
      "Unable to process this video in your browser. Please upload an MP4 video and try again.",
    );
  } finally {
    ffmpeg.off(
      "progress",
      handler,
    );

    /*
     * Cleanup FFmpeg files.
     */

    for (const file of [
      inName,
      pngName,
      outFile,
    ]) {
      try {
        await ffmpeg.deleteFile(
          file,
        );
      } catch {
        // Cleanup failure can be ignored.
      }
    }
  }
}
