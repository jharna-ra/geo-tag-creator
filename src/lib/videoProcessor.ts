import { fetchFile } from "@ffmpeg/util";

import { getFFmpeg } from "./ffmpeg";

import type { OverlayPosition } from "@/types/geotag";
import type { VideoItem } from "@/types/video";

/* ============================================================
   OVERLAY POSITION
============================================================ */

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

/* ============================================================
   TIMING
============================================================ */

export function computeTiming(item: VideoItem) {
  const duration = Math.max(
    0.1,
    Number(item.duration) || 0.1,
  );

  const requestedStart = Number(
    item.settings.trimStart,
  );

  const requestedEnd = Number(
    item.settings.trimEnd,
  );

  const start = Math.max(
    0,
    Math.min(
      Number.isFinite(requestedStart)
        ? requestedStart
        : 0,
      duration - 0.1,
    ),
  );

  const end = Math.max(
    start + 0.1,
    Math.min(
      Number.isFinite(requestedEnd)
        ? requestedEnd
        : duration,
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

  const overlayEnd = Math.min(
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

/* ============================================================
   PROCESS ARGUMENTS
============================================================ */

export interface ProcessArgs {
  item: VideoItem;

  /*
   * This is the image uploaded by the user.
   *
   * We do NOT generate a geotag.
   */
  overlayPng: Blob;

  onProgress: (progress: number) => void;
}

/* ============================================================
   HELPER
============================================================ */

function even(value: number): number {
  const rounded = Math.max(
    2,
    Math.round(value),
  );

  return rounded % 2 === 0
    ? rounded
    : rounded - 1;
}

/* ============================================================
   PROCESS VIDEO
============================================================ */

export async function processVideo({
  item,
  overlayPng,
  onProgress,
}: ProcessArgs): Promise<Blob> {
  const ffmpeg = await getFFmpeg();

  const {
    start,
    finalDuration,
    overlayStart,
    overlayEnd,
  } = computeTiming(item);

  if (!item.file) {
    throw new Error(
      "No video file was supplied.",
    );
  }

  if (!overlayPng) {
    throw new Error(
      "No geotag image was supplied.",
    );
  }

  if (
    !item.width ||
    !item.height ||
    item.width <= 0 ||
    item.height <= 0
  ) {
    throw new Error(
      "Could not determine the video dimensions.",
    );
  }

  /* ==========================================================
     FILE NAMES
  ========================================================== */

  const extension =
    item.file.name
      .split(".")
      .pop()
      ?.toLowerCase() || "mp4";

  const safeExtension =
    /^[a-z0-9]+$/i.test(extension)
      ? extension
      : "mp4";

  const inName =
    `input_${item.id}.${safeExtension}`;

  const pngName =
    `geotag_${item.id}.png`;

  const outFile =
    `output_${item.id}.mp4`;

  /* ==========================================================
     PROGRESS HANDLER
  ========================================================== */

  const handler = ({
    progress,
  }: {
    progress: number;
  }) => {
    const value = Number(progress);

    const percentage = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          value * 100,
        ),
      ),
    );

    onProgress(percentage);
  };

  ffmpeg.on(
    "progress",
    handler,
  );

  try {
    /* ========================================================
       WRITE VIDEO
    ======================================================== */

    await ffmpeg.writeFile(
      inName,
      await fetchFile(item.file),
    );

    /* ========================================================
       WRITE USER'S GEOTAG IMAGE

       IMPORTANT:
       The uploaded image is used exactly as supplied.
       No geotag is generated here.
    ======================================================== */

    await ffmpeg.writeFile(
      pngName,
      await fetchFile(overlayPng),
    );

    /* ========================================================
       VIDEO DIMENSIONS
    ======================================================== */

    const videoWidth = Math.max(
      2,
      Number(item.width),
    );

    const videoHeight = Math.max(
      2,
      Number(item.height),
    );

    /* ========================================================
       USER WIDTH

       scale = 0.5
       => 50% video width

       scale = 1
       => 100% video width
    ======================================================== */

    const widthScale = Math.max(
      0.01,
      Math.min(
        1,
        Number(item.settings.scale) || 0.9,
      ),
    );

    /* ========================================================
       USER HEIGHT

       heightScale = 0.2
       => 20% video height

       heightScale = 0.5
       => 50%

       heightScale = 1
       => 100%
    ======================================================== */

    const heightScale = Math.max(
      0.01,
      Math.min(
        1,
        Number(
          item.settings.heightScale,
        ) || 0.2,
      ),
    );

    /* ========================================================
       IMPORTANT FIX

       DO NOT USE:

       main_w
       main_h

       inside scale.

       Instead calculate the actual pixel dimensions
       in JavaScript.

       Example:

       Video = 1920 × 1080

       Width = 90%
       => 1728

       Height = 20%
       => 216
    ======================================================== */

    const overlayWidth = even(
      videoWidth * widthScale,
    );

    const overlayHeight = even(
      videoHeight * heightScale,
    );

    /* ========================================================
       POSITION
    ======================================================== */

    const {
      x,
      y,
    } = overlayXY(
      item.settings.position,
      0,
    );

    /* ========================================================
       OPACITY
    ======================================================== */

    const opacity = Math.max(
      0,
      Math.min(
        1,
        Number(item.settings.opacity) || 1,
      ),
    );

    /* ========================================================
       FILTER

       Input 0 = video

       Input 1 = uploaded geotag image

       The geotag image is resized to the exact dimensions
       selected by the user.

       Then it is overlaid on the video.
    ======================================================== */

    const filter =
      `[1:v]` +
      `scale=${overlayWidth}:${overlayHeight}:force_original_aspect_ratio=disable,` +
      `format=rgba,` +
      `colorchannelmixer=aa=${opacity}` +
      `[geotag];` +

      `[0:v][geotag]` +
      `overlay=${x}:${y}` +
      `:enable='between(t,${overlayStart.toFixed(
        3,
      )},${overlayEnd.toFixed(
        3,
      )})'` +
      `:eof_action=repeat` +
      `:format=auto` +
      `[video]`;

    console.log(
      "FFmpeg filter:",
      filter,
    );

    /* ========================================================
       FFMPEG ARGUMENTS
    ======================================================== */

    const args = [
      /*
       * Trim start
       */
      "-ss",
      start.toFixed(3),

      /*
       * Video
       */
      "-i",
      inName,

      /*
       * Loop uploaded geotag image
       */
      "-loop",
      "1",

      /*
       * Uploaded geotag
       */
      "-i",
      pngName,

      /*
       * Video + geotag filter
       */
      "-filter_complex",
      filter,

      /*
       * Video output
       */
      "-map",
      "[video]",

      /*
       * Keep original audio if available
       */
      "-map",
      "0:a?",

      /*
       * Final duration
       */
      "-t",
      finalDuration.toFixed(3),

      /*
       * Video encoder
       */
      "-c:v",
      "libx264",

      /*
       * Fast browser encoding
       */
      "-preset",
      "ultrafast",

      /*
       * Quality
       */
      "-crf",
      "26",

      /*
       * Browser-compatible pixel format
       */
      "-pix_fmt",
      "yuv420p",

      /*
       * Audio
       */
      "-c:a",
      "aac",

      "-b:a",
      "128k",

      /*
       * Better MP4 compatibility
       */
      "-movflags",
      "+faststart",

      /*
       * Output
       */
      outFile,
    ];

    console.log(
      "FFmpeg arguments:",
      args,
    );

    /* ========================================================
       EXECUTE
    ======================================================== */

    const code =
      await ffmpeg.exec(args);

    if (code !== 0) {
      console.error(
        "FFmpeg exited with code:",
        code,
      );

      throw new Error(
        `FFmpeg exited with code ${code}. Check the browser console for the FFmpeg log.`,
      );
    }

    /* ========================================================
       READ OUTPUT
    ======================================================== */

    const output =
      await ffmpeg.readFile(
        outFile,
      );

    /*
     * FFmpeg may return Uint8Array or string.
     */

    if (
      typeof output === "string"
    ) {
      throw new Error(
        "FFmpeg returned invalid video data.",
      );
    }

    const copy =
      new Uint8Array(output);

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
     * Preserve the useful FFmpeg error.
     */

    if (
      error instanceof Error &&
      error.message.startsWith(
        "FFmpeg exited with code",
      )
    ) {
      throw error;
    }

    throw new Error(
      error instanceof Error
        ? error.message
        : "Unable to process this video in your browser. Please upload an MP4 video and try again.",
    );
  } finally {
    /* ========================================================
       REMOVE PROGRESS LISTENER
    ======================================================== */

    ffmpeg.off(
      "progress",
      handler,
    );

    /* ========================================================
       CLEAN FFMPEG FILES
    ======================================================== */

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
        /*
         * Ignore cleanup errors.
         */
      }
    }
  }
}
