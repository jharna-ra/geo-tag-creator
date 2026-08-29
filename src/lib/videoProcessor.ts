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

/* =========================================================
   FFMPEG
========================================================= */

let ffmpeg:
  FFmpeg | null = null;

let ffmpegLoading:
  Promise<FFmpeg> | null = null;

/* =========================================================
   TIMING
========================================================= */

export function computeTiming(
  item: VideoItem,
) {

  const settings =
    item.settings;

  const start =
    Math.max(
      0,
      Math.min(
        settings.trimStart,
        Math.max(
          0,
          item.duration - 0.1,
        ),
      ),
    );

  const end =
    Math.max(
      start + 0.1,
      Math.min(
        settings.trimEnd,
        item.duration,
      ),
    );

  const finalDuration =
    Math.max(
      0.1,
      end - start,
    );

  const percent =
    Math.max(
      1,
      Math.min(
        100,
        Number(
          settings.percent,
        ) || 1,
      ),
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
   LOAD FFMPEG
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
        ({
          message,
        }) => {

          console.log(
            "[FFmpeg]",
            message,
          );

        },
      );

      await instance.load({
        coreURL:
          "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js",

        wasmURL:
          "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm",
      });

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
   HELPERS
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

function even(
  value: number,
): number {

  const n =
    Math.floor(
      value,
    );

  if (n <= 2) {
    return 2;
  }

  return n % 2 === 0
    ? n
    : n - 1;
}

/* =========================================================
   SAFE NAME
========================================================= */

function safeFileName(
  name: string,
): string {

  return String(
    name ||
    "video",
  ).replace(
    /[^a-zA-Z0-9._-]/g,
    "_",
  );
}

function createOutputName(
  originalName: string,
): string {

  const name =
    String(
      originalName ||
      "video.mp4",
    );

  const lastDot =
    name.lastIndexOf(
      ".",
    );

  if (
    lastDot <= 0
  ) {

    return (
      `${name}_geotagged.mp4`
    );

  }

  const base =
    name.substring(
      0,
      lastDot,
    );

  return (
    `${base}_geotagged.mp4`
  );
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
        Number.isFinite(
          crop.x,
        )
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
        Number.isFinite(
          crop.y,
        )
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
        Number.isFinite(
          crop.width,
        )
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
        Number.isFinite(
          crop.height,
        )
          ? crop.height
          : 1,
        0.01,
        1,
      ) *
      sourceHeight,
    );

  width =
    Math.max(
      2,
      width,
    );

  height =
    Math.max(
      2,
      height,
    );

  x =
    clamp(
      x,
      0,
      sourceWidth - 2,
    );

  y =
    clamp(
      y,
      0,
      sourceHeight - 2,
    );

  width =
    Math.min(
      width,
      sourceWidth - x,
    );

  height =
    Math.min(
      height,
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
        sourceWidth -
        x,
      );

  }

  if (
    y + height >
    sourceHeight
  ) {

    height =
      even(
        sourceHeight -
        y,
      );

  }

  width =
    Math.max(
      2,
      width,
    );

  height =
    Math.max(
      2,
      height,
    );

  x =
    Math.min(
      x,
      sourceWidth -
        width,
    );

  y =
    Math.min(
      y,
      sourceHeight -
        height,
    );

  return {
    x,
    y,
    width,
    height,
  };
}

/* =========================================================
   CLOCK HELPERS
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
    Number.isFinite(
      parts[0],
    )
      ? parts[0]
      : 0;

  let minutes =
    Number.isFinite(
      parts[1],
    )
      ? parts[1]
      : 0;

  let seconds =
    Number.isFinite(
      parts[2],
    )
      ? parts[2]
      : 0;

  hours =
    clamp(
      Math.floor(hours),
      0,
      23,
    );

  minutes =
    clamp(
      Math.floor(minutes),
      0,
      59,
    );

  seconds =
    clamp(
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

function getClockAtSecond(
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
   GENERATE MOVING GEOTAG FRAMES
========================================================= */

async function createMovingClockFrames(
  item: VideoItem,
  timing: ReturnType<
    typeof computeTiming
  >,
  overlayWidth: number,
  clock: MovingClockOptions,
  engine: FFmpeg,
  prefix: string,
  onProgress?: (
    progress: number,
  ) => void,
): Promise<{
  firstFrame: string;
  frameCount: number;
}> {

  const duration =
    Math.max(
      0.1,
      timing.geotagDuration,
    );

  const frameCount =
    Math.max(
      1,
      Math.ceil(
        duration,
      ),
    );

  let firstFrame =
    "";

  for (
    let i = 0;
    i < frameCount;
    i++
  ) {

    const elapsed =
      i;

    const clockText =
      getClockAtSecond(
        item.settings
          .startClockTime ||
          "10:25:00",
        elapsed,
      );

    const blob =
      await renderGeotagBlob(
        clock.data,
        {
          ...clock.options,
          showTime: true,
        },
        overlayWidth,
        item.settings.movingTime
          ? clockText
          : undefined,
      );

    const frameName =
      `${prefix}_${String(
        i,
      ).padStart(
        5,
        "0",
      )}.png`;

    await engine.writeFile(
      frameName,
      await fetchFile(
        blob,
      ),
    );

    if (
      !firstFrame
    ) {

      firstFrame =
        frameName;

    }

    onProgress?.(
      Math.round(
        (i + 1) /
          frameCount *
          15,
      ),
    );
  }

  return {
    firstFrame,
    frameCount,
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
  movingClock?: MovingClockOptions,
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

  /*
   * Timing.
   */

  const timing =
    computeTiming(
      item,
    );

  /*
   * Input.
   */

  await engine.writeFile(
    inputName,
    await fetchFile(
      item.file,
    ),
  );

  /*
   * Crop.
   */

  const crop =
    getCropPixels(
      item,
    );

  /*
   * Geotag dimensions.
   */

  const geotagWidth =
    Math.max(
      2,
      even(
        Math.round(
          crop.width *
          item.settings.scale,
        ),
      ),
    );

  const geotagHeight =
    Math.max(
      2,
      even(
        Math.round(
          crop.height *
          item.settings.heightScale,
        ),
      ),
    );

  /*
   * Position.
   */

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

    case "top-center":
      overlayX =
        "(main_w-overlay_w)/2";
      overlayY = "0";
      break;

    case "top-right":
      overlayX =
        "main_w-overlay_w";
      overlayY = "0";
      break;

    case "center-left":
      overlayX = "0";
      overlayY =
        "(main_h-overlay_h)/2";
      break;

    case "center":
      overlayX =
        "(main_w-overlay_w)/2";
      overlayY =
        "(main_h-overlay_h)/2";
      break;

    case "center-right":
      overlayX =
        "main_w-overlay_w";
      overlayY =
        "(main_h-overlay_h)/2";
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
   * =======================================================
   * MOVING CLOCK
   * =======================================================
   *
   * If movingClock data exists and movingTime
   * is enabled, generate one geotag PNG per
   * second.
   *
   * Example:
   *
   * 10:25:00
   * 10:25:01
   * 10:25:02
   * 10:25:03
   *
   * The PNG sequence is then used as a 1 FPS
   * overlay stream.
   */

  let useMovingFrames =
    Boolean(
      movingClock &&
      item.settings.movingTime,
    );

  let framePrefix =
    `clock_${timestamp}_${baseName}`;

  let frameCount = 0;

  try {

    if (
      useMovingFrames &&
      movingClock
    ) {

      const frames =
        await createMovingClockFrames(
          item,
          timing,
          geotagWidth,
          movingClock,
          engine,
          framePrefix,
          onProgress,
        );

      frameCount =
        frames.frameCount;

    } else {

      await engine.writeFile(
        overlayName,
        await fetchFile(
          overlayBlob,
        ),
      );

    }

    /*
     * =====================================================
     * FILTER
     * =====================================================
     */

    let filterComplex: string;

    if (
      useMovingFrames
    ) {

      /*
       * Image sequence runs at 1 frame
       * per second.
       *
       * FFmpeg repeats each generated
       * geotag for the corresponding
       * second of the video.
       */

      filterComplex =
        `[0:v]` +
        `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}` +
        `[cropped];` +

        `[1:v]` +
        `scale=${geotagWidth}:${geotagHeight}` +
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
        `[video]`;

    } else {

      filterComplex =
        `[0:v]` +
        `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}` +
        `[cropped];` +

        `[1:v]` +
        `scale=${geotagWidth}:${geotagHeight}` +
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
        `[video]`;

    }

    /*
     * =====================================================
     * INPUT ARGUMENTS
     * =====================================================
     */

    const args: string[] = [

      "-ss",

      timing.start.toFixed(
        3,
      ),

      "-i",

      inputName,

    ];

    if (
      useMovingFrames
    ) {

      /*
       * One generated image per second.
       */

      args.push(
        "-framerate",
        "1",
        "-start_number",
        "0",
        "-i",
        `${framePrefix}_%05d.png`,
      );

    } else {

      args.push(
        "-loop",
        "1",
        "-i",
        overlayName,
      );

    }

    args.push(

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
            type:
              "video/mp4",
          },
        );

      onProgress?.(
        100,
      );

      return {
        blob,
        name:
          outputName,
      };

    } finally {

      engine.off(
        "progress",
        progressHandler,
      );

    }

  } finally {

    /*
     * Clean FFmpeg files.
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

    /*
     * Delete generated clock frames.
     *
     * We know the number of frames,
     * so remove each one.
     */

    if (
      useMovingFrames
    ) {

      for (
        let i = 0;
        i < frameCount;
        i++
      ) {

        const frameName =
          `${framePrefix}_${String(
            i,
          ).padStart(
            5,
            "0",
          )}.png`;

        try {

          await engine.deleteFile(
            frameName,
          );

        } catch {}

      }

    }

  }
}
