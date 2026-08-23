import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

import type { VideoItem } from "@/types/video";

/* =========================================================
   TYPES
========================================================= */

interface CropPixels {
  x: number;
  y: number;
  width: number;
  height: number;
}

/* =========================================================
   FFMPEG SINGLETON
========================================================= */

let ffmpeg: FFmpeg | null = null;
let ffmpegLoading: Promise<FFmpeg> | null = null;

/* =========================================================
   TIMING
========================================================= */

export function computeTiming(item: VideoItem) {
  const settings = item.settings;

  const start = Math.max(
    0,
    Math.min(
      settings.trimStart,
      Math.max(0, item.duration - 0.1),
    ),
  );

  const end = Math.max(
    start + 0.1,
    Math.min(
      settings.trimEnd,
      item.duration,
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
      Number(settings.percent) || 1,
    ),
  );

  const geotagDuration =
    finalDuration * (percent / 100);

  let overlayStart = 0;
  let overlayEnd = geotagDuration;

  if (settings.timing === "end") {
    overlayStart =
      finalDuration - geotagDuration;

    overlayEnd = finalDuration;
  }

  return {
    start,
    end,
    finalDuration,
    geotagDuration,
    overlayStart: Math.max(
      0,
      overlayStart,
    ),
    overlayEnd: Math.min(
      finalDuration,
      overlayEnd,
    ),
  };
}

/* =========================================================
   LOAD FFMPEG
========================================================= */

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
          Math.round(
            progress * 100,
          ),
          "%",
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

/* =========================================================
   SAFE FILE NAME
========================================================= */

function safeFileName(
  name: string,
): string {
  return String(name || "video")
    .replace(
      /[^a-zA-Z0-9._-]/g,
      "_",
    );
}

/* =========================================================
   OUTPUT NAME

   example:

   video.mp4

   becomes:

   video_geotagged.mp4
========================================================= */

function createOutputName(
  originalName: string,
): string {
  const name =
    String(
      originalName ||
        "video.mp4",
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
   GET CROP IN PIXELS

   CropSelector stores normalized values:

   x      0 → 1
   y      0 → 1
   width  0 → 1
   height 0 → 1

   FFmpeg needs pixels.
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

  const normalizedX =
    Number.isFinite(crop.x)
      ? crop.x
      : 0;

  const normalizedY =
    Number.isFinite(crop.y)
      ? crop.y
      : 0;

  const normalizedWidth =
    Number.isFinite(
      crop.width,
    )
      ? crop.width
      : 1;

  const normalizedHeight =
    Number.isFinite(
      crop.height,
    )
      ? crop.height
      : 1;

  let x = Math.round(
    clamp(
      normalizedX,
      0,
      1,
    ) * sourceWidth,
  );

  let y = Math.round(
    clamp(
      normalizedY,
      0,
      1,
    ) * sourceHeight,
  );

  let width = Math.round(
    clamp(
      normalizedWidth,
      0.01,
      1,
    ) * sourceWidth,
  );

  let height = Math.round(
    clamp(
      normalizedHeight,
      0.01,
      1,
    ) * sourceHeight,
  );

  /*
   * Minimum dimensions.
   */

  width = Math.max(
    2,
    width,
  );

  height = Math.max(
    2,
    height,
  );

  /*
   * Keep crop inside video.
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

  width = Math.min(
    width,
    sourceWidth - x,
  );

  height = Math.min(
    height,
    sourceHeight - y,
  );

  /*
   * H.264 works more reliably
   * with even dimensions.
   */

  width = even(width);
  height = even(height);

  /*
   * Re-check boundaries after
   * making dimensions even.
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

  width = Math.max(
    2,
    width,
  );

  height = Math.max(
    2,
    height,
  );

  /*
   * Make sure x + width and
   * y + height are valid.
   */

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

  /* =======================================================
     WRITE INPUT VIDEO
  ======================================================= */

  await engine.writeFile(
    inputName,
    await fetchFile(
      item.file,
    ),
  );

  /* =======================================================
     WRITE GEOTAG IMAGE
  ======================================================= */

  await engine.writeFile(
    overlayName,
    await fetchFile(
      overlayBlob,
    ),
  );

  /* =======================================================
     TIMING
  ======================================================= */

  const timing =
    computeTiming(item);

  /* =======================================================
     CROP
  ======================================================= */

  const crop =
    getCropPixels(item);

  console.log(
    "[FFmpeg] ORIGINAL:",
    item.width,
    "x",
    item.height,
  );

  console.log(
    "[FFmpeg] CROP:",
    crop,
  );

  /* =======================================================
     GEOTAG SIZE

     IMPORTANT:
     Geotag is sized according to
     the CROPPED video.
  ======================================================= */

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
    Math.max(
      2,
      even(
        geotagWidth,
      ),
    );

  geotagHeight =
    Math.max(
      2,
      even(
        geotagHeight,
      ),
    );

  /* =======================================================
     GEOTAG POSITION
  ======================================================= */

  let overlayX =
    "(main_w-overlay_w)/2";

  let overlayY =
    "main_h-overlay_h";

  switch (
    item.settings.position
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
    default:
      overlayX =
        "(main_w-overlay_w)/2";
      overlayY =
        "main_h-overlay_h";
      break;
  }

  /* =======================================================
     OVERLAY ENABLE TIME
  ======================================================= */

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

  /* =======================================================
     FILTER

     VERY IMPORTANT:

     [0:v]
        ↓
     CROP
        ↓
     [cropped]
        ↓
     GEOTAG
        ↓
     [video]

     This physically changes the
     output video dimensions.
  ======================================================= */

  const filterComplex =
    `[0:v]` +
    `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}` +
    `[cropped];` +

    `[1:v]` +
    `scale=${geotagWidth}:${geotagHeight}:force_original_aspect_ratio=disable` +
    `,format=rgba` +
    `,colorchannelmixer=aa=${clamp(
      item.settings.opacity,
      0,
      1,
    )}` +
    `[geotag];` +

    `[cropped][geotag]` +
    `overlay=${overlayX}:${overlayY}` +
    `:enable='between(t,${overlayStart.toFixed(
      3,
    )},${overlayEnd.toFixed(
      3,
    )})'` +
    `:eof_action=repeat` +
    `:format=auto` +
    `[video]`;

  console.log(
    "[FFmpeg] FILTER:",
    filterComplex,
  );

  /* =======================================================
     FFMPEG ARGUMENTS
  ======================================================= */

  const args: string[] = [
    "-ss",
    timing.start.toFixed(
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
    "[FFmpeg] ARGUMENTS:",
    args,
  );

  /* =======================================================
     PROGRESS
  ======================================================= */

  const progressHandler =
    ({
      progress,
    }: {
      progress: number;
    }) => {
      onProgress?.(
        Math.round(
          clamp(
            progress * 100,
            0,
            100,
          ),
        ),
      );
    };

  engine.on(
    "progress",
    progressHandler,
  );

  try {
    /* =====================================================
       EXECUTE
    ===================================================== */

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

    /* =====================================================
       READ OUTPUT
    ===================================================== */

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
        ? output
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

    console.log(
      "[FFmpeg] OUTPUT:",
      outputName,
    );

    console.log(
      "[FFmpeg] OUTPUT CROP SIZE:",
      crop.width,
      "x",
      crop.height,
    );

    return {
      blob,
      name: outputName,
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
