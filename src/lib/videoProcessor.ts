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
  const m = String(margin);

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
  const start = Math.max(
    0,
    Math.min(item.settings.trimStart, item.duration),
  );

  const end = Math.max(
    start + 0.1,
    Math.min(
      item.settings.trimEnd,
      item.duration || item.settings.trimEnd,
    ),
  );

  const finalDuration = end - start;

  const geotagDuration =
    (finalDuration * item.settings.percent) / 100;

  const overlayStart =
    item.settings.timing === "beginning"
      ? 0
      : Math.max(
          0,
          finalDuration - geotagDuration,
        );

  const overlayEnd =
    overlayStart + geotagDuration;

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

  /**
   * This is now the USER-UPLOADED
   * geotag image.
   *
   * It can be PNG or JPG.
   */
  geotagImage: Blob;

  onProgress: (p: number) => void;
}

export async function processVideo({
  item,
  geotagImage,
  onProgress,
}: ProcessArgs): Promise<Blob> {
  const ffmpeg = await getFFmpeg();

  const {
    start,
    finalDuration,
    overlayStart,
    overlayEnd,
  } = computeTiming(item);

  /*
   * ----------------------------------------------------
   * INPUT VIDEO
   * ----------------------------------------------------
   */

  const videoExtension =
    item.file.name.split(".").pop() || "mp4";

  const inName =
    `in_${item.id}.${videoExtension}`.toLowerCase();

  /*
   * ----------------------------------------------------
   * USER GEOTAG IMAGE
   * ----------------------------------------------------
   *
   * Do NOT create or render a geotag here.
   *
   * The image comes directly from the user.
   */

  const imageType =
    geotagImage.type.toLowerCase();

  let imageExtension = "png";

  if (imageType.includes("jpeg") || imageType.includes("jpg")) {
    imageExtension = "jpg";
  }

  const imageName =
    `geotag_${item.id}.${imageExtension}`;

  /*
   * ----------------------------------------------------
   * OUTPUT
   * ----------------------------------------------------
   */

  const outFile =
    `out_${item.id}.mp4`;

  /*
   * ----------------------------------------------------
   * PROGRESS
   * ----------------------------------------------------
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
     * --------------------------------------------------
     * WRITE VIDEO TO FFMPEG
     * --------------------------------------------------
     */

    await ffmpeg.writeFile(
      inName,
      await fetchFile(item.file),
    );

    /*
     * --------------------------------------------------
     * WRITE USER GEOTAG IMAGE TO FFMPEG
     * --------------------------------------------------
     */

    await ffmpeg.writeFile(
      imageName,
      await fetchFile(geotagImage),
    );

    /*
     * --------------------------------------------------
     * OVERLAY SIZE
     * --------------------------------------------------
     *
     * scale:
     *   1.0 = 100% video width
     *   0.75 = 75%
     *   0.50 = 50%
     *
     * heightScale:
     *   0.20 = 20% video height
     *   0.50 = 50%
     */

    const widthScale = Math.max(
      0.01,
      Math.min(
        1,
        item.settings.scale,
      ),
    );

    const heightScale = Math.max(
      0.01,
      Math.min(
        1,
        item.settings.heightScale,
      ),
    );

    const overlayW =
      `main_w*${widthScale}`;

    const overlayH =
      `main_h*${heightScale}`;

    /*
     * --------------------------------------------------
     * POSITION
     * --------------------------------------------------
     */

    const {
      x,
      y,
    } = overlayXY(
      item.settings.position,
      0,
    );

    /*
     * --------------------------------------------------
     * OPACITY
     * --------------------------------------------------
     */

    const alpha = Math.max(
      0,
      Math.min(
        1,
        item.settings.opacity,
      ),
    );

    /*
     * --------------------------------------------------
     * FFMPEG FILTER
     * --------------------------------------------------
     *
     * [0:v] = video
     *
     * [1:v] = USER'S GEOTAG IMAGE
     *
     * We resize the uploaded image and
     * place it over the video.
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
     * --------------------------------------------------
     * FFMPEG COMMAND
     * --------------------------------------------------
     */

    const args = [
      /*
       * Start position
       */
      "-ss",
      start.toFixed(3),

      /*
       * Video
       */
      "-i",
      inName,

      /*
       * Geotag image
       *
       * Loop it so it remains available
       * for the entire video.
       */
      "-loop",
      "1",

      "-i",
      imageName,

      /*
       * Filter
       */
      "-filter_complex",
      filter,

      /*
       * Video output
       */
      "-map",
      "[v]",

      /*
       * Keep original audio if present
       */
      "-map",
      "0:a?",

      /*
       * Final duration
       */
      "-t",
      finalDuration.toFixed(3),

      /*
       * Video codec
       */
      "-c:v",
      "libx264",

      /*
       * Fast browser processing
       */
      "-preset",
      "ultrafast",

      /*
       * Quality
       */
      "-crf",
      "26",

      /*
       * Compatibility
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
       * Better playback after download
       */
      "-movflags",
      "+faststart",

      /*
       * Output
       */
      outFile,
    ];

    /*
     * --------------------------------------------------
     * RUN FFMPEG
     * --------------------------------------------------
     */

    const code =
      await ffmpeg.exec(args);

    if (code !== 0) {
      throw new Error(
        "FFmpeg encoding failed.",
      );
    }

    /*
     * --------------------------------------------------
     * READ OUTPUT
     * --------------------------------------------------
     */

    const data =
      (await ffmpeg.readFile(
        outFile,
      )) as Uint8Array;

    /*
     * Make a separate copy because
     * FFmpeg's memory can be reused.
     */

    const copy =
      new Uint8Array(data);

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

    throw new Error(
      "Unable to process this video in your browser. Try using an MP4 video or a shorter/smaller video.",
    );
  } finally {
    /*
     * --------------------------------------------------
     * REMOVE PROGRESS LISTENER
     * --------------------------------------------------
     */

    ffmpeg.off(
      "progress",
      handler,
    );

    /*
     * --------------------------------------------------
     * CLEAN FFMPEG MEMORY
     * --------------------------------------------------
     */

    for (const file of [
      inName,
      imageName,
      outFile,
    ]) {
      try {
        await ffmpeg.deleteFile(
          file,
        );
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
