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
  computeTiming,
} from "./videoProcessor";

/*
 * -------------------------------------------------------
 * FFmpeg singleton
 * -------------------------------------------------------
 */

let ffmpeg: FFmpeg | null = null;

let ffmpegLoading:
  Promise<FFmpeg> | null = null;

/*
 * -------------------------------------------------------
 * LOAD FFmpeg
 * -------------------------------------------------------
 */

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
        console.log(
          "[FFmpeg]",
          message,
        );
      },
    );

    instance.on(
      "progress",
      ({ progress }) => {
        console.log(
          "[FFmpeg] progress:",
          Math.round(progress * 100),
          "%",
        );
      },
    );

    console.log(
      "[FFmpeg] Loading engine from:",
      "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm",
    );

    await instance.load({
      coreURL:
        "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js",
      wasmURL:
        "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm",
    });

    console.log(
      "[FFmpeg] Engine loaded successfully.",
    );

    ffmpeg = instance;

    return instance;
  })();

  try {
    return await ffmpegLoading;
  } finally {
    ffmpegLoading = null;
  }
}

/*
 * -------------------------------------------------------
 * SAFE FILE NAME
 * -------------------------------------------------------
 */

function safeFileName(
  name: string,
): string {
  return name.replace(
    /[^a-zA-Z0-9._-]/g,
    "_",
  );
}

/*
 * -------------------------------------------------------
 * OUTPUT NAME
 *
 * Example:
 *
 * video.mp4
 *       ↓
 * video_geotagged.mp4
 *
 * This preserves the original video name.
 * -------------------------------------------------------
 */

function createOutputName(
  originalName: string,
): string {
  const lastDot =
    originalName.lastIndexOf(".");

  if (lastDot === -1) {
    return `${originalName}_geotagged.mp4`;
  }

  const base =
    originalName.substring(
      0,
      lastDot,
    );

  return `${base}_geotagged.mp4`;
}

/*
 * -------------------------------------------------------
 * EVEN NUMBER
 *
 * H.264 crop dimensions work more reliably
 * when width/height are even.
 * -------------------------------------------------------
 */

function even(
  value: number,
): number {
  const rounded =
    Math.floor(value);

  return rounded % 2 === 0
    ? rounded
    : rounded - 1;
}

/*
 * -------------------------------------------------------
 * CLAMP
 * -------------------------------------------------------
 */

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

/*
 * -------------------------------------------------------
 * CROP PIXELS
 *
 * CropSelector gives normalized values:
 *
 * x = 0.2
 * y = 0.1
 * width = 0.6
 * height = 0.7
 *
 * We convert them to actual pixels.
 * -------------------------------------------------------
 */

function getCropPixels(
  video: VideoItem,
) {
  const {
    crop,
  } = video.settings;

  const sourceWidth =
    video.width;

  const sourceHeight =
    video.height;

  let x = Math.round(
    crop.x * sourceWidth,
  );

  let y = Math.round(
    crop.y * sourceHeight,
  );

  let width = Math.round(
    crop.width * sourceWidth,
  );

  let height = Math.round(
    crop.height * sourceHeight,
  );

  /*
   * Keep crop inside the video.
   */

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

  width = clamp(
    width,
    2,
    sourceWidth - x,
  );

  height = clamp(
    height,
    2,
    sourceHeight - y,
  );

  /*
   * H.264 prefers even dimensions.
   */

  width = even(width);

  height = even(height);

  /*
   * Make sure we don't accidentally
   * create zero dimensions.
   */

  width = Math.max(
    2,
    width,
  );

  height = Math.max(
    2,
    height,
  );

  return {
    x,
    y,
    width,
    height,
  };
}

/*
 * -------------------------------------------------------
 * ESCAPE FFmpeg FILTER EXPRESSIONS
 * -------------------------------------------------------
 */

function buildFilter(
  video: VideoItem,
  overlayWidth: number,
  overlayHeight: number,
  overlayInputIndex: number,
) {
  const timing =
    computeTiming(video);

  const crop =
    getCropPixels(video);

  /*
   * Geotag visibility.
   *
   * computeTiming returns values relative
   * to the trimmed video.
   */

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
   * Crop first.
   *
   * Then overlay geotag on the cropped video.
   */

  const cropFilter =
    `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}`;

  /*
   * Geotag dimensions.
   */

  const scaleFilter =
    `[${overlayInputIndex}:v]` +
    `scale=${overlayWidth}:${overlayHeight}:force_original_aspect_ratio=disable,` +
    `format=rgba,` +
    `colorchannelmixer=aa=${clamp(
      video.settings.opacity,
      0,
      1,
    )}` +
    `[geotag]`;

  /*
   * Position.
   */

  let overlayX =
    "(main_w-overlay_w)/2";

  let overlayY =
    "main_h-overlay_h";

  switch (
    video.settings.position
  ) {
    case "top-left":
      overlayX = "0";
      overlayY = "0";
      break;

    case "top-right":
      overlayX =
        "main_w-overlay_w";
      overlayY = "0";
      break;

    case "bottom-left":
      overlayX = "0";
      overlayY =
        "main_h-overlay_h";
      break;

    case "bottom-right":
      overlayX =
        "main_w-overlay_w";
      overlayY =
        "main_h-overlay_h";
      break;

    case "bottom-center":
      overlayX =
        "(main_w-overlay_w)/2";
      overlayY =
        "main_h-overlay_h";
      break;
  }

  /*
   * Final overlay filter.
   */

  const overlayFilter =
    `[0:v][geotag]` +
    `overlay=${overlayX}:${overlayY}` +
    `:enable='between(t,${overlayStart.toFixed(
      3,
    )},${overlayEnd.toFixed(3)})'` +
    `:eof_action=repeat` +
    `:format=auto` +
    `[video]`;

  return {
    cropFilter,
    scaleFilter,
    overlayFilter,
    filterComplex:
      `[0:v]${cropFilter}[cropped];` +
      scaleFilter.replace(
        `[${overlayInputIndex}:v]`,
        `[${overlayInputIndex}:v]`,
      ) +
      ";" +
      `[cropped][geotag]` +
      `overlay=${overlayX}:${overlayY}` +
      `:enable='between(t,${overlayStart.toFixed(
        3,
      )},${overlayEnd.toFixed(3)})'` +
      `:eof_action=repeat` +
      `:format=auto` +
      `[video]`,
  };
}

/*
 * -------------------------------------------------------
 * MAIN VIDEO PROCESSOR
 * -------------------------------------------------------
 */

export async function processVideo(
  item: VideoItem,
  overlayBlob: Blob,
  onProgress?: (
    progress: number,
  ) => void,
): Promise<{
  blob: Blob;
  name: string;
}> {
  const engine =
    await getFFmpeg();

  /*
   * Unique filenames.
   */

  const timestamp =
    Date.now();

  const baseName =
    safeFileName(
      item.name.replace(
        /\.[^/.]+$/,
        "",
      ),
    );

  const inputName =
    `input_${timestamp}_${baseName}.mp4`;

  const overlayName =
    `geotag_${timestamp}_${baseName}.png`;

  const outputName =
    createOutputName(
      item.name,
    );

  const outputFile =
    `output_${timestamp}_${baseName}.mp4`;

  /*
   * Write files into FFmpeg.
   */

  await engine.writeFile(
    inputName,
    await fetchFile(item.file),
  );

  await engine.writeFile(
    overlayName,
    await fetchFile(
      overlayBlob,
    ),
  );

  /*
   * Calculate crop.
   */

  const crop =
    getCropPixels(item);

  /*
   * Calculate final video size.
   *
   * IMPORTANT:
   * Geotag width/height are based on
   * the CROPPED video.
   */

  const outputWidth =
    crop.width;

  const outputHeight =
    crop.height;

  let geotagWidth =
    Math.round(
      outputWidth *
        item.settings.scale,
    );

  let geotagHeight =
    Math.round(
      outputHeight *
        item.settings.heightScale,
    );

  /*
   * Keep dimensions valid.
   */

  geotagWidth =
    Math.max(
      2,
      even(geotagWidth),
    );

  geotagHeight =
    Math.max(
      2,
      even(geotagHeight),
    );

  /*
   * Build filters.
   */

  const {
    filterComplex,
  } = buildFilter(
    item,
    geotagWidth,
    geotagHeight,
    1,
  );

  console.log(
    "[FFmpeg] Crop:",
    crop,
  );

  console.log(
    "[FFmpeg] Filter:",
    filterComplex,
  );

  /*
   * ---------------------------------------------------
   * ARGUMENTS
   * ---------------------------------------------------
   */

  const args: string[] = [
    "-ss",
    item.settings.trimStart.toFixed(
      3,
    ),

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
    computeTiming(
      item,
    ).finalDuration.toFixed(
      3,
    ),

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

    outputFile,
  ];

  console.log(
    "[FFmpeg] Arguments:",
    args,
  );

  /*
   * Progress.
   */

  const progressHandler =
    ({
      progress,
    }: {
      progress: number;
    }) => {
      onProgress?.(
        Math.min(
          100,
          Math.max(
            0,
            Math.round(
              progress * 100,
            ),
          ),
        ),
      );
    };

  engine.on(
    "progress",
    progressHandler,
  );

  try {
    /*
     * Execute FFmpeg.
     */

    const exitCode =
      await engine.exec(
        args,
      );

    if (exitCode !== 0) {
      throw new Error(
        `FFmpeg exited with code ${exitCode}. Check the browser console for the FFmpeg log.`,
      );
    }

    /*
     * Read result.
     */

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
        ? new Uint8Array(
            output,
          )
        : new Uint8Array(
            output as ArrayBuffer,
          );

    const blob =
      new Blob(
        [outputBytes],
        {
          type: "video/mp4",
        },
      );

    onProgress?.(100);

    return {
      blob,
      name: outputName,
    };
  } finally {
    /*
     * Remove temporary files.
     */

    engine.off(
      "progress",
      progressHandler,
    );

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
