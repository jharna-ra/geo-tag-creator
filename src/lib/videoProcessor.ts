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
  clampCrop,
  DEFAULT_CROP,
} from "@/lib/crop";

/* =========================================================
   FFmpeg
========================================================= */

let ffmpeg:
  FFmpeg | null = null;

let ffmpegLoading:
  Promise<FFmpeg> | null = null;

/* =========================================================
   GET FFMPEG
========================================================= */

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg) {
    return ffmpeg;
  }

  if (ffmpegLoading) {
    return ffmpegLoading;
  }

  ffmpegLoading =
    (async () => {
      const instance =
        new FFmpeg();

      instance.on(
        "log",
        ({ message }) => {
          console.log(
            "[FFmpeg]",
            message,
          );
        },
      );

      console.log(
        "[FFmpeg] Loading engine...",
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

      ffmpeg =
        instance;

      return instance;
    })();

  try {
    return await ffmpegLoading;
  } finally {
    ffmpegLoading =
      null;
  }
}

/* =========================================================
   CLAMP
========================================================= */

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.min(
    max,
    Math.max(
      min,
      value,
    ),
  );
}

/* =========================================================
   EVEN NUMBER
========================================================= */

function even(
  value: number,
): number {
  const n =
    Math.floor(value);

  if (n < 2) {
    return 2;
  }

  return n % 2 === 0
    ? n
    : n - 1;
}

/* =========================================================
   SAFE FILE NAME
========================================================= */

function safeFileName(
  name: string,
): string {
  return name.replace(
    /[^a-zA-Z0-9._-]/g,
    "_",
  );
}

/* =========================================================
   OUTPUT NAME

   IMPORTANT:
   Keep the ORIGINAL uploaded filename.
   
   example:
   
   myvideo.mp4
       ↓
   myvideo.mp4
========================================================= */

function createOutputName(
  originalName: string,
): string {
  const cleaned =
    safeFileName(
      originalName,
    );

  if (
    cleaned.toLowerCase()
      .endsWith(".mp4")
  ) {
    return cleaned;
  }

  return `${cleaned}.mp4`;
}

/* =========================================================
   COMPUTE TIMING

   This function was missing from the current processor.

   It calculates:
   - trim duration
   - geotag duration
   - overlay start
   - overlay end
========================================================= */

export function computeTiming(
  item: VideoItem,
) {
  const settings =
    item.settings;

  const start =
    clamp(
      Number(
        settings.trimStart,
      ) || 0,
      0,
      item.duration,
    );

  const end =
    clamp(
      Number(
        settings.trimEnd,
      ) || item.duration,
      start + 0.01,
      item.duration,
    );

  const finalDuration =
    Math.max(
      0.01,
      end - start,
    );

  const percent =
    clamp(
      Number(
        settings.percent,
      ) || 1,
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
      Math.max(
        0,
        finalDuration -
          geotagDuration,
      );

    overlayEnd =
      finalDuration;
  }

  return {
    start,

    end,

    finalDuration,

    percent,

    geotagDuration,

    overlayStart,

    overlayEnd,
  };
}

/* =========================================================
   GET CROP PIXELS
========================================================= */

function getCropPixels(
  item: VideoItem,
) {
  const crop =
    clampCrop(
      item.settings.crop ??
        DEFAULT_CROP,
    );

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

  let x =
    Math.round(
      crop.x *
        sourceWidth,
    );

  let y =
    Math.round(
      crop.y *
        sourceHeight,
    );

  let width =
    Math.round(
      crop.width *
        sourceWidth,
    );

  let height =
    Math.round(
      crop.height *
        sourceHeight,
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

  width =
    even(width);

  height =
    even(height);

  /*
   * Re-check bounds after making
   * dimensions even.
   */

  if (
    x + width >
    sourceWidth
  ) {
    width =
      even(
        sourceWidth - x,
      );
  }

  if (
    y + height >
    sourceHeight
  ) {
    height =
      even(
        sourceHeight - y,
      );
  }

  return {
    x,

    y,

    width:
      Math.max(
        2,
        width,
      ),

    height:
      Math.max(
        2,
        height,
      ),
  };
}

/* =========================================================
   POSITION
========================================================= */

function getOverlayPosition(
  position: VideoItem["settings"]["position"],
) {
  switch (
    position
  ) {
    case "top-left":
      return {
        x: "0",
        y: "0",
      };

    case "top-right":
      return {
        x:
          "main_w-overlay_w",
        y: "0",
      };

    case "bottom-left":
      return {
        x: "0",
        y:
          "main_h-overlay_h",
      };

    case "bottom-right":
      return {
        x:
          "main_w-overlay_w",
        y:
          "main_h-overlay_h",
      };

    case "bottom-center":
    default:
      return {
        x:
          "(main_w-overlay_w)/2",
        y:
          "main_h-overlay_h",
      };
  }
}

/* =========================================================
   BUILD FILTER
========================================================= */

function buildFilter(
  item: VideoItem,
  crop: ReturnType<
    typeof getCropPixels
  >,
  overlayWidth: number,
  overlayHeight: number,
) {
  const timing =
    computeTiming(item);

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
   * Crop the original video.
   */

  const cropPart =
    `[0:v]crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}[cropped]`;

  /*
   * Prepare geotag.
   */

  const geotagPart =
    `[1:v]` +
    `scale=${overlayWidth}:${overlayHeight}:force_original_aspect_ratio=disable,` +
    `format=rgba,` +
    `colorchannelmixer=aa=${clamp(
      item.settings.opacity,
      0,
      1,
    )}` +
    `[geotag]`;

  const position =
    getOverlayPosition(
      item.settings.position,
    );

  /*
   * Overlay geotag on cropped video.
   */

  const overlayPart =
    `[cropped][geotag]` +
    `overlay=${position.x}:${position.y}` +
    `:enable='between(t,${overlayStart.toFixed(
      3,
    )},${overlayEnd.toFixed(3)})'` +
    `:eof_action=repeat` +
    `:format=auto` +
    `[video]`;

  return (
    cropPart +
    ";" +
    geotagPart +
    ";" +
    overlayPart
  );
}

/* =========================================================
   PROCESS VIDEO
========================================================= */

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

  const timestamp =
    Date.now();

  const baseName =
    safeFileName(
      item.name.replace(
        /\.[^/.]+$/,
        "",
      ),
    );

  /*
   * Temporary FFmpeg files.
   */

  const inputName =
    `input_${timestamp}_${baseName}.mp4`;

  const overlayName =
    `geotag_${timestamp}_${baseName}.png`;

  /*
   * Final file.
   *
   * Same name as original.
   */

  const outputName =
    createOutputName(
      item.name,
    );

  const outputFile =
    `output_${timestamp}_${baseName}.mp4`;

  /*
   * Write input video.
   */

  await engine.writeFile(
    inputName,
    await fetchFile(
      item.file,
    ),
  );

  /*
   * Write geotag.
   */

  await engine.writeFile(
    overlayName,
    await fetchFile(
      overlayBlob,
    ),
  );

  /*
   * Crop.
   */

  const crop =
    getCropPixels(item);

  /*
   * Geotag dimensions are based
   * on CROPPED video dimensions.
   */

  let geotagWidth =
    Math.round(
      crop.width *
        item.settings.scale,
    );

  let geotagHeight =
    Math.round(
      crop.height *
        item.settings.heightScale,
    );

  geotagWidth =
    even(
      Math.max(
        2,
        geotagWidth,
      ),
    );

  geotagHeight =
    even(
      Math.max(
        2,
        geotagHeight,
      ),
    );

  /*
   * Build filter.
   */

  const filterComplex =
    buildFilter(
      item,
      crop,
      geotagWidth,
      geotagHeight,
    );

  console.log(
    "[FFmpeg] Crop:",
    crop,
  );

  console.log(
    "[FFmpeg] Filter:",
    filterComplex,
  );

  const timing =
    computeTiming(item);

  /*
   * FFmpeg arguments.
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
    timing.finalDuration.toFixed(
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

  const progressHandler =
    ({
      progress,
    }: {
      progress: number;
    }) => {
      const value =
        Math.round(
          progress * 100,
        );

      onProgress?.(
        Math.min(
          100,
          Math.max(
            0,
            value,
          ),
        ),
      );
    };

  engine.on(
    "progress",
    progressHandler,
  );

  try {
    const exitCode =
      await engine.exec(
        args,
      );

    if (
      exitCode !== 0
    ) {
      throw new Error(
        `FFmpeg exited with code ${exitCode}. Check the browser console for the FFmpeg log.`,
      );
    }

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
      output instanceof
      Uint8Array
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

    onProgress?.(
      100,
    );

    return {
      blob,

      /*
       * SAME ORIGINAL NAME
       */
      name:
        outputName,
    };
  } finally {
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
