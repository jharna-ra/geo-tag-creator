import {
  FFmpeg,
} from "@ffmpeg/ffmpeg";

import {
  fetchFile,
} from "@ffmpeg/util";

import type {
  CropRect,
  VideoItem,
} from "@/types/video";

/* =========================================================
   FFmpeg singleton
========================================================= */

let ffmpeg: FFmpeg | null = null;

let ffmpegLoading:
  Promise<FFmpeg> | null = null;

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
   SAFE STRING
========================================================= */

function safeString(
  value: unknown,
  fallback: string,
): string {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return fallback;
  }

  return value;
}

/* =========================================================
   SAFE FILE NAME
========================================================= */

function safeFileName(
  name: unknown,
): string {
  const value =
    safeString(
      name,
      "video.mp4",
    );

  return value.replace(
    /[^a-zA-Z0-9._-]/g,
    "_",
  );
}

/* =========================================================
   OUTPUT NAME
========================================================= */

function createOutputName(
  originalName: unknown,
): string {
  const safeName =
    safeString(
      originalName,
      "video.mp4",
    );

  const dot =
    safeName.lastIndexOf(".");

  if (dot <= 0) {
    return `${safeName}_geotagged.mp4`;
  }

  const base =
    safeName.substring(
      0,
      dot,
    );

  return `${base}_geotagged.mp4`;
}

/* =========================================================
   EVEN NUMBER
========================================================= */

function even(
  value: number,
): number {
  const result =
    Math.floor(value);

  if (result <= 2) {
    return 2;
  }

  return result % 2 === 0
    ? result
    : result - 1;
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
   NORMALIZE CROP
========================================================= */

function normalizeCrop(
  crop: CropRect | undefined,
): CropRect {
  const value =
    crop ?? {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    };

  const x =
    clamp(
      Number.isFinite(value.x)
        ? value.x
        : 0,
      0,
      1,
    );

  const y =
    clamp(
      Number.isFinite(value.y)
        ? value.y
        : 0,
      0,
      1,
    );

  const width =
    clamp(
      Number.isFinite(
        value.width,
      )
        ? value.width
        : 1,
      0.05,
      1 - x,
    );

  const height =
    clamp(
      Number.isFinite(
        value.height,
      )
        ? value.height
        : 1,
      0.05,
      1 - y,
    );

  return {
    x,
    y,
    width,
    height,
  };
}

/* =========================================================
   CROP → PIXELS
========================================================= */

function getCropPixels(
  video: VideoItem,
) {
  const sourceWidth =
    Math.max(
      2,
      Math.floor(
        video.width,
      ),
    );

  const sourceHeight =
    Math.max(
      2,
      Math.floor(
        video.height,
      ),
    );

  const crop =
    normalizeCrop(
      video.settings?.crop,
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
    width: Math.max(
      2,
      width,
    ),
    height: Math.max(
      2,
      height,
    ),
  };
}

/* =========================================================
   TIMING
========================================================= */

export interface VideoTiming {
  start: number;
  end: number;
  finalDuration: number;
  geotagDuration: number;
  overlayStart: number;
  overlayEnd: number;
}

export function computeTiming(
  item: VideoItem,
): VideoTiming {
  const duration =
    Math.max(
      0,
      Number(item.duration) ||
        0,
    );

  const start =
    clamp(
      Number(
        item.settings
          ?.trimStart,
      ) || 0,
      0,
      Math.max(
        0,
        duration - 0.01,
      ),
    );

  const requestedEnd =
    Number(
      item.settings
        ?.trimEnd,
    );

  const end =
    clamp(
      Number.isFinite(
        requestedEnd,
      )
        ? requestedEnd
        : duration,
      start + 0.01,
      duration,
    );

  const finalDuration =
    Math.max(
      0.01,
      end - start,
    );

  const percent =
    clamp(
      Number(
        item.settings
          ?.percent,
      ) || 30,
      1,
      100,
    );

  const geotagDuration =
    finalDuration *
    (percent / 100);

  const timing =
    item.settings
      ?.timing ??
    "beginning";

  const overlayStart =
    timing === "end"
      ? finalDuration -
        geotagDuration
      : 0;

  const overlayEnd =
    timing === "end"
      ? finalDuration
      : geotagDuration;

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
   POSITION
========================================================= */

function getOverlayPosition(
  position: string,
) {
  switch (position) {
    case "top-left":
      return {
        x: "0",
        y: "0",
      };

    case "top-right":
      return {
        x: "main_w-overlay_w",
        y: "0",
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
   MAIN PROCESSOR
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
  if (!item) {
    throw new Error(
      "Video information is missing.",
    );
  }

  if (!(item.file instanceof File)) {
    throw new Error(
      "The uploaded video file is missing.",
    );
  }

  if (!(overlayBlob instanceof Blob)) {
    throw new Error(
      "The geotag image is missing.",
    );
  }

  const engine =
    await getFFmpeg();

  const originalName =
    safeString(
      item.name,
      item.file.name ||
        "video.mp4",
    );

  const safeBase =
    safeFileName(
      originalName.replace(
        /\.[^/.]+$/,
        "",
      ),
    );

  const timestamp =
    Date.now();

  const inputName =
    `input_${timestamp}_${safeBase}.mp4`;

  const overlayName =
    `geotag_${timestamp}_${safeBase}.png`;

  const outputName =
    createOutputName(
      originalName,
    );

  const outputFile =
    `output_${timestamp}_${safeBase}.mp4`;

  try {
    /* -------------------------------------------------------
       WRITE INPUT VIDEO
    ------------------------------------------------------- */

    await engine.writeFile(
      inputName,
      await fetchFile(
        item.file,
      ),
    );

    /* -------------------------------------------------------
       WRITE GEOTAG
    ------------------------------------------------------- */

    await engine.writeFile(
      overlayName,
      await fetchFile(
        overlayBlob,
      ),
    );

    /* -------------------------------------------------------
       CROP
    ------------------------------------------------------- */

    const crop =
      getCropPixels(item);

    console.log(
      "[FFmpeg] Crop:",
      crop,
    );

    /* -------------------------------------------------------
       OUTPUT VIDEO DIMENSIONS
    ------------------------------------------------------- */

    const outputWidth =
      crop.width;

    const outputHeight =
      crop.height;

    /* -------------------------------------------------------
       GEOTAG SIZE
    ------------------------------------------------------- */

    const scale =
      clamp(
        Number(
          item.settings
            ?.scale,
        ) || 0.9,
        0.001,
        1,
      );

    const heightScale =
      clamp(
        Number(
          item.settings
            ?.heightScale,
        ) || 0.2,
        0.001,
        1,
      );

    const opacity =
      clamp(
        Number(
          item.settings
            ?.opacity,
        ) || 1,
        0,
        1,
      );

    const geotagWidth =
      Math.max(
        2,
        even(
          outputWidth *
            scale,
        ),
      );

    const geotagHeight =
      Math.max(
        2,
        even(
          outputHeight *
            heightScale,
        ),
      );

    /* -------------------------------------------------------
       TIMING
    ------------------------------------------------------- */

    const timing =
      computeTiming(item);

    /* -------------------------------------------------------
       POSITION
    ------------------------------------------------------- */

    const position =
      getOverlayPosition(
        item.settings
          ?.position,
      );

    /* -------------------------------------------------------
       FILTER
    ------------------------------------------------------- */

    const filterComplex =
      `[0:v]` +
      `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}` +
      `[cropped];` +

      `[1:v]` +
      `scale=${geotagWidth}:${geotagHeight}:force_original_aspect_ratio=disable` +
      `,format=rgba` +
      `,colorchannelmixer=aa=${opacity}` +
      `[geotag];` +

      `[cropped][geotag]` +
      `overlay=${position.x}:${position.y}` +
      `:enable='between(t,${timing.overlayStart.toFixed(
        3,
      )},${timing.overlayEnd.toFixed(
        3,
      )})'` +
      `:eof_action=repeat` +
      `:format=auto` +
      `[video]`;

    console.log(
      "[FFmpeg] Filter:",
      filterComplex,
    );

    /* -------------------------------------------------------
       ARGUMENTS
    ------------------------------------------------------- */

    const args = [
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

    /* -------------------------------------------------------
       PROGRESS
    ------------------------------------------------------- */

    const progressHandler =
      ({
        progress,
      }: {
        progress: number;
      }) => {
        const value =
          Math.round(
            clamp(
              progress,
              0,
              1,
            ) * 100,
          );

        onProgress?.(
          value,
        );
      };

    engine.on(
      "progress",
      progressHandler,
    );

    try {
      /* -----------------------------------------------------
         EXECUTE
      ----------------------------------------------------- */

      const exitCode =
        await engine.exec(
          args,
        );

      if (exitCode !== 0) {
        throw new Error(
          `FFmpeg exited with code ${exitCode}. Check the browser console for the FFmpeg log.`,
        );
      }

      /* -----------------------------------------------------
         READ OUTPUT
      ----------------------------------------------------- */

      const output =
        await engine.readFile(
          outputFile,
        );

      if (
        typeof output ===
        "string"
      ) {
        throw new Error(
          "FFmpeg returned invalid output data.",
        );
      }

      const bytes =
        output instanceof
        Uint8Array
          ? output
          : new Uint8Array(
              output as ArrayBuffer,
            );

      const blob =
        new Blob(
          [bytes],
          {
            type: "video/mp4",
          },
        );

      if (blob.size === 0) {
        throw new Error(
          "FFmpeg created an empty video.",
        );
      }

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
    }
  } finally {
    /* -------------------------------------------------------
       CLEANUP
    ------------------------------------------------------- */

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
