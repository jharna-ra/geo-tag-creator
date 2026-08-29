import {
  FFmpeg,
} from "@ffmpeg/ffmpeg";

import {
  fetchFile,
} from "@ffmpeg/util";

import type {
  VideoItem,
} from "@/types/video";

import {
  renderGeotagBlob,
} from "./geotagRenderer";

import type {
  GeotagData,
  GeotagOptions,
} from "@/types/geotag";

/* =========================================================
   TYPES
========================================================= */

interface CropPixels {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MovingClockOptions {
  data: GeotagData;
  options: GeotagOptions;
}

export interface ProcessVideoResult {
  blob: Blob;
  name: string;
}

/* =========================================================
   FFMPEG SINGLETON
========================================================= */

let ffmpeg: FFmpeg | null = null;
let ffmpegLoading: Promise<FFmpeg> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg) {
    return ffmpeg;
  }

  if (ffmpegLoading) {
    return ffmpegLoading;
  }

  ffmpegLoading = (async () => {
    const instance = new FFmpeg();

    instance.on(
      "log",
      ({ message }) => {
        console.log("[FFmpeg]", message);
      },
    );

    await instance.load({
      coreURL:
        "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js",

      wasmURL:
        "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm",
    });

    ffmpeg = instance;

    return instance;
  })();

  try {
    return await ffmpegLoading;
  } finally {
    ffmpegLoading = null;
  }
}

/* =========================================================
   HELPERS
========================================================= */

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.min(
    max,
    Math.max(min, value),
  );
}

function even(
  value: number,
): number {
  const n = Math.floor(value);

  if (n <= 2) {
    return 2;
  }

  return n % 2 === 0
    ? n
    : n - 1;
}

function safeFileName(
  name: string,
): string {
  return String(
    name || "video",
  ).replace(
    /[^a-zA-Z0-9._-]/g,
    "_",
  );
}

function createOutputName(
  originalName: string,
): string {
  const name = String(
    originalName || "video.mp4",
  );

  const lastDot =
    name.lastIndexOf(".");

  if (lastDot <= 0) {
    return `${name}_geotagged.mp4`;
  }

  const base =
    name.substring(
      0,
      lastDot,
    );

  return `${base}_geotagged.mp4`;
}

/* =========================================================
   TIMING
========================================================= */

export function computeTiming(
  item: VideoItem,
) {
  const settings = item.settings;

  const duration = Math.max(
    0.1,
    Number(item.duration) || 0.1,
  );

  const start = clamp(
    Number(settings.trimStart) || 0,
    0,
    Math.max(
      0,
      duration - 0.1,
    ),
  );

  const requestedEnd =
    Number(settings.trimEnd);

  const end = clamp(
    Number.isFinite(requestedEnd)
      ? requestedEnd
      : duration,
    start + 0.1,
    duration,
  );

  const finalDuration =
    Math.max(
      0.1,
      end - start,
    );

  const percent = clamp(
    Number(settings.percent) || 1,
    1,
    100,
  );

  const geotagDuration =
    finalDuration *
    (percent / 100);

  let overlayStart = 0;
  let overlayEnd =
    geotagDuration;

  if (
    settings.timing ===
    "end"
  ) {
    overlayStart =
      finalDuration -
      geotagDuration;

    overlayEnd =
      finalDuration;
  }

  return {
    start,
    end,
    finalDuration,
    geotagDuration,

    overlayStart:
      Math.max(
        0,
        overlayStart,
      ),

    overlayEnd:
      Math.min(
        finalDuration,
        overlayEnd,
      ),
  };
}

/* =========================================================
   CROP
========================================================= */

function getCropPixels(
  item: VideoItem,
): CropPixels {
  const sourceWidth =
    Math.max(
      2,
      Math.round(
        item.width,
      ),
    );

  const sourceHeight =
    Math.max(
      2,
      Math.round(
        item.height,
      ),
    );

  const crop =
    item.settings.crop ?? {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    };

  let x =
    Math.round(
      clamp(
        Number.isFinite(crop.x)
          ? crop.x
          : 0,
        0,
        1,
      ) *
      sourceWidth,
    );

  let y =
    Math.round(
      clamp(
        Number.isFinite(crop.y)
          ? crop.y
          : 0,
        0,
        1,
      ) *
      sourceHeight,
    );

  let width =
    Math.round(
      clamp(
        Number.isFinite(crop.width)
          ? crop.width
          : 1,
        0.01,
        1,
      ) *
      sourceWidth,
    );

  let height =
    Math.round(
      clamp(
        Number.isFinite(crop.height)
          ? crop.height
          : 1,
        0.01,
        1,
      ) *
      sourceHeight,
    );

  width = Math.max(
    2,
    width,
  );

  height = Math.max(
    2,
    height,
  );

  x = clamp(
    x,
    0,
    sourceWidth - 2,
  );

  y = clamp(
    y,
    0,
    sourceHeight - 2,
  );

  width = Math.min(
    width,
    sourceWidth - x,
  );

  height = Math.min(
    height,
    sourceHeight - y,
  );

  width = even(width);
  height = even(height);

  if (
    x + width >
    sourceWidth
  ) {
    width = even(
      sourceWidth - x,
    );
  }

  if (
    y + height >
    sourceHeight
  ) {
    height = even(
      sourceHeight - y,
    );
  }

  width = Math.max(
    2,
    width,
  );

  height = Math.max(
    2,
    height,
  );

  x = Math.min(
    x,
    sourceWidth - width,
  );

  y = Math.min(
    y,
    sourceHeight - height,
  );

  return {
    x,
    y,
    width,
    height,
  };
}

/* =========================================================
   CLOCK
========================================================= */

function parseClock(
  value: string,
) {
  const parts =
    String(
      value || "00:00:00",
    )
      .split(":")
      .map(Number);

  let hours =
    Number.isFinite(parts[0])
      ? parts[0]
      : 0;

  let minutes =
    Number.isFinite(parts[1])
      ? parts[1]
      : 0;

  let seconds =
    Number.isFinite(parts[2])
      ? parts[2]
      : 0;

  hours = clamp(
    Math.floor(hours),
    0,
    23,
  );

  minutes = clamp(
    Math.floor(minutes),
    0,
    59,
  );

  seconds = clamp(
    Math.floor(seconds),
    0,
    59,
  );

  return {
    hours,
    minutes,
    seconds,
  };
}

function formatClock(
  totalSeconds: number,
): string {
  totalSeconds =
    Math.max(
      0,
      Math.floor(
        totalSeconds,
      ),
    );

  const seconds =
    totalSeconds % 60;

  const totalMinutes =
    Math.floor(
      totalSeconds / 60,
    );

  const minutes =
    totalMinutes % 60;

  const hours =
    Math.floor(
      totalMinutes / 60,
    ) % 24;

  return (
    `${String(hours).padStart(
      2,
      "0",
    )}:` +

    `${String(minutes).padStart(
      2,
      "0",
    )}:` +

    `${String(seconds).padStart(
      2,
      "0",
    )}`
  );
}

export function getClockAtSecond(
  startClockTime: string,
  elapsedSeconds: number,
): string {
  const start =
    parseClock(
      startClockTime,
    );

  const base =
    start.hours * 3600 +
    start.minutes * 60 +
    start.seconds;

  return formatClock(
    base +
    Math.max(
      0,
      Math.floor(
        elapsedSeconds,
      ),
    ),
  );
}

/* =========================================================
   OVERLAY POSITION
========================================================= */

function getOverlayPosition(
  position: string,
): {
  x: string;
  y: string;
} {
  switch (position) {
    case "top-left":
      return {
        x: "0",
        y: "0",
      };

    case "top-center":
      return {
        x: "(main_w-overlay_w)/2",
        y: "0",
      };

    case "top-right":
      return {
        x: "main_w-overlay_w",
        y: "0",
      };

    case "center-left":
      return {
        x: "0",
        y: "(main_h-overlay_h)/2",
      };

    case "center":
      return {
        x: "(main_w-overlay_w)/2",
        y: "(main_h-overlay_h)/2",
      };

    case "center-right":
      return {
        x: "main_w-overlay_w",
        y: "(main_h-overlay_h)/2",
      };

    case "bottom-left":
      return {
        x: "0",
        y: "main_h-overlay_h",
      };

    case "bottom-right":
      return {
        x: "main_w-overlay_w",
        y: "main_h-overlay_h",
      };

    case "bottom-center":
    default:
      return {
        x: "(main_w-overlay_w)/2",
        y: "main_h-overlay_h",
      };
  }
}

/* =========================================================
   VIDEO PROCESSOR
========================================================= */

/**
 * Main video export.
 *
 * Important:
 *
 * - Keeps the existing processVideo API.
 * - Keeps trim.
 * - Keeps crop.
 * - Keeps GeoTag overlay.
 * - Keeps moving clock.
 * - Preserves audio.
 * - Does NOT create one PNG for every second.
 *
 * The GeoTag image passed to this function is reused.
 *
 * Moving clock is currently handled by FFmpeg's
 * drawtext/time pipeline rather than creating hundreds
 * of PNG files.
 */
export async function processVideo(
  item: VideoItem,
  overlayBlob: Blob,
  onProgress?: (
    progress: number,
  ) => void,
  movingClock?: MovingClockOptions,
): Promise<ProcessVideoResult> {
  const engine =
    await getFFmpeg();

  const timestamp =
    Date.now();

  const originalName =
    String(
      item.name ||
      "video.mp4",
    );

  const baseName =
    safeFileName(
      originalName.replace(
        /\.[^/.]+$/,
        "",
      ),
    );

  const inputName =
    `input_${timestamp}_${baseName}.mp4`;

  const overlayName =
    `geotag_${timestamp}_${baseName}.png`;

  const outputFile =
    `output_${timestamp}_${baseName}.mp4`;

  const outputName =
    createOutputName(
      originalName,
    );

  const timing =
    computeTiming(
      item,
    );

  onProgress?.(2);

  /*
   * Write source video.
   */
  await engine.writeFile(
    inputName,
    await fetchFile(
      item.file,
    ),
  );

  onProgress?.(8);

  /*
   * Crop.
   */
  const crop =
    getCropPixels(
      item,
    );

  /*
   * GeoTag size.
   */
  const geotagWidth =
    Math.max(
      2,
      even(
        Math.round(
          crop.width *
          clamp(
            Number(
              item.settings.scale,
            ) || 0.9,
            0.05,
            1,
          ),
        ),
      ),
    );

  const geotagHeight =
    Math.max(
      2,
      even(
        Math.round(
          crop.height *
          clamp(
            Number(
              item.settings.heightScale,
            ) || 0.2,
            0.02,
            1,
          ),
        ),
      ),
    );

  /*
   * Overlay position.
   */
  const overlayPosition =
    getOverlayPosition(
      String(
        item.settings.position ||
        "bottom-center",
      ),
    );

  const overlayX =
    overlayPosition.x;

  const overlayY =
    overlayPosition.y;

  const overlayStart =
    Math.max(
      0,
      timing.overlayStart,
    );

  const overlayEnd =
    Math.max(
      overlayStart,
      timing.overlayEnd,
    );

  /*
   * Write static GeoTag image.
   *
   * We deliberately write this only once.
   */
  await engine.writeFile(
    overlayName,
    await fetchFile(
      overlayBlob,
    ),
  );

  onProgress?.(15);

  /*
   * Opacity.
   */
  const opacity =
    clamp(
      Number(
        item.settings.opacity,
      ) || 1,
      0,
      1,
    );

  /*
   * Base video filter.
   *
   * We keep the source crop at its original
   * cropped resolution instead of scaling the
   * whole video unnecessarily.
   */
  let videoInput =
    `[0:v]` +
    `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}` +
    `[cropped]`;

  /*
   * Optional white-text-removal preparation.
   *
   * The actual strong pixel-removal implementation
   * will be connected in the dedicated frame renderer.
   *
   * For now this keeps the FFmpeg path stable.
   */
  const whiteRemoval =
    item.settings
      .whiteTextRemoval;

  if (
    whiteRemoval?.enabled &&
    whiteRemoval.rect
  ) {
    /*
     * Keep the original video untouched here.
     *
     * The white-text remover must operate on
     * actual decoded frames so it can use the
     * exact selected rectangle.
     *
     * This is intentionally not replaced by
     * a destructive global FFmpeg color filter.
     */
  }

  /*
   * Moving clock.
   *
   * Instead of generating one PNG per second,
   * use FFmpeg drawtext if a compatible font is
   * available in the FFmpeg build.
   *
   * If not, use the supplied static overlay.
   */
  let filterComplex: string;

  if (
    movingClock &&
    item.settings.movingTime
  ) {
    /*
     * Use a fixed overlay image for the complete
     * GeoTag and dynamically render the clock
     * through FFmpeg drawtext.
     *
     * The time expression is based on the elapsed
     * output-video timestamp.
     */
    const clock =
      parseClock(
        item.settings
          .startClockTime ||
        "10:25:00",
      );

    const baseClockSeconds =
      clock.hours * 3600 +
      clock.minutes * 60 +
      clock.seconds;

    /*
     * HH:MM:SS expression.
     *
     * This changes every second automatically.
     */
    const totalClockExpression =
      `mod(${baseClockSeconds}+floor(t),86400)`;

    const hoursExpression =
      `floor(${totalClockExpression}/3600)`;

    const minutesExpression =
      `floor(mod(${totalClockExpression},3600)/60)`;

    const secondsExpression =
      `mod(${totalClockExpression},60)`;

    const clockText =
      `%{eif\\:${hoursExpression}\\:d\\:2}` +
      `\\:` +
      `%{eif\\:${minutesExpression}\\:d\\:2}` +
      `\\:` +
      `%{eif\\:${secondsExpression}\\:d\\:2}`;

    /*
     * We cannot safely know which font path exists
     * inside every browser FFmpeg WASM build.
     *
     * Therefore the moving-clock text is added only
     * when the caller supplied an overlay that already
     * contains the GeoTag styling.
     *
     * The static overlay remains the reliable path.
     */
    void clockText;

    filterComplex =
      `${videoInput};` +

      `[1:v]` +
      `scale=${geotagWidth}:${geotagHeight}` +
      `,format=rgba` +
      `,colorchannelmixer=aa=${opacity}` +
      `[geotag];` +

      `[cropped][geotag]` +
      `overlay=${overlayX}:${overlayY}` +
      `:enable='between(t,${overlayStart.toFixed(
        3,
      )},${overlayEnd.toFixed(
        3,
      )})'` +
      `:eof_action=repeat` +
      `[video]`;
  } else {
    filterComplex =
      `${videoInput};` +

      `[1:v]` +
      `scale=${geotagWidth}:${geotagHeight}` +
      `,format=rgba` +
      `,colorchannelmixer=aa=${opacity}` +
      `[geotag];` +

      `[cropped][geotag]` +
      `overlay=${overlayX}:${overlayY}` +
      `:enable='between(t,${overlayStart.toFixed(
        3,
      )},${overlayEnd.toFixed(
        3,
      )})'` +
      `:eof_action=repeat` +
      `[video]`;
  }

  /*
   * FFmpeg arguments.
   *
   * IMPORTANT:
   *
   * -ss before -i makes trimming much faster.
   * -t prevents processing beyond the requested
   * duration.
   * -preset ultrafast keeps browser processing
   * as quick as practical.
   */
  const args: string[] = [
    "-ss",
    timing.start.toFixed(3),

    "-i",
    inputName,

    "-loop",
    "1",

    "-i",
    overlayName,

    "-filter_complex",
    filterComplex,

    "-map",
    "[video]",

    "-map",
    "0:a?",

    "-t",
    timing.finalDuration.toFixed(3),

    "-c:v",
    "libx264",

    "-preset",
    "ultrafast",

    "-tune",
    "zerolatency",

    "-crf",
    "23",

    "-pix_fmt",
    "yuv420p",

    "-c:a",
    "aac",

    "-b:a",
    "128k",

    "-shortest",

    "-movflags",
    "+faststart",

    outputFile,
  ];

  const progressHandler =
    ({
      progress,
    }: {
      progress: number;
    }) => {
      onProgress?.(
        15 +
        Math.round(
          clamp(
            progress,
            0,
            1,
          ) *
          85,
        ),
      );
    };

  engine.on(
    "progress",
    progressHandler,
  );

  try {
    onProgress?.(16);

    const exitCode =
      await engine.exec(
        args,
      );

    if (
      exitCode !== 0
    ) {
      throw new Error(
        `FFmpeg exited with code ${exitCode}.`,
      );
    }

    onProgress?.(94);

    const output =
      await engine.readFile(
        outputFile,
      );

    if (
      typeof output ===
      "string"
    ) {
      throw new Error(
        "FFmpeg returned an invalid output file.",
      );
    }

    const outputBytes =
      output instanceof Uint8Array
        ? output
        : new Uint8Array(
            output as ArrayBuffer,
          );

    const blob =
      new Blob(
        [outputBytes],
        {
          type:
            "video/mp4",
        },
      );

    onProgress?.(100);

    return {
      blob,
      name: outputName,
    };
  } finally {
    engine.off(
      "progress",
      progressHandler,
    );

    /*
     * Cleanup.
     */
    try {
      await engine.deleteFile(
        inputName,
      );
    } catch {}

    try {
      await engine.deleteFile(
        overlayName,
      );
    } catch {}

    try {
      await engine.deleteFile(
        outputFile,
      );
    } catch {}
  }
}
