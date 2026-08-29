import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

let ffmpeg: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;

/*
 * Local files are preferred because they avoid downloading
 * the FFmpeg core from a CDN every time.
 *
 * Put these three files in:
 *
 * public/ffmpeg/
 *
 * ffmpeg-core.js
 * ffmpeg-core.wasm
 * ffmpeg-core.worker.js
 *
 * The CDN entries remain as a fallback.
 */

const LOCAL_CORE = "/ffmpeg";

const CDN_SOURCES = [
  "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm",
  "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm",
];

/* =========================================================
   LOAD FFMPEG
========================================================= */

export async function getFFmpeg(
  onLog?: (message: string) => void,
): Promise<FFmpeg> {
  if (ffmpeg) {
    return ffmpeg;
  }

  if (loading) {
    return loading;
  }

  loading = (async () => {
    const instance = new FFmpeg();

    instance.on(
      "log",
      ({ message }) => {
        console.log(
          "[FFmpeg]",
          message,
        );

        onLog?.(message);
      },
    );

    /*
     * -------------------------------------------------------
     * FIRST: try local FFmpeg files
     * -------------------------------------------------------
     *
     * This is the fastest and most reliable option once
     * the files are placed in public/ffmpeg/.
     */

    try {
      console.log(
        "[FFmpeg] Trying local engine...",
      );

      await instance.load({
        coreURL:
          `${LOCAL_CORE}/ffmpeg-core.js`,

        wasmURL:
          `${LOCAL_CORE}/ffmpeg-core.wasm`,

        workerURL:
          `${LOCAL_CORE}/ffmpeg-core.worker.js`,
      });

      console.log(
        "[FFmpeg] Local engine loaded.",
      );

      ffmpeg = instance;

      return instance;
    } catch (localError) {
      console.warn(
        "[FFmpeg] Local engine unavailable. Trying CDN...",
        localError,
      );
    }

    /*
     * -------------------------------------------------------
     * FALLBACK: CDN
     * -------------------------------------------------------
     */

    let lastError: unknown = null;

    for (
      const baseURL of CDN_SOURCES
    ) {
      try {
        console.log(
          `[FFmpeg] Loading engine from ${baseURL}`,
        );

        const coreURL =
          await toBlobURL(
            `${baseURL}/ffmpeg-core.js`,
            "text/javascript",
          );

        const wasmURL =
          await toBlobURL(
            `${baseURL}/ffmpeg-core.wasm`,
            "application/wasm",
          );

        /*
         * Worker is important for FFmpeg.wasm.
         *
         * Some CDN builds expose it alongside the
         * core files.
         */
        let workerURL:
          | string
          | undefined;

        try {
          workerURL =
            await toBlobURL(
              `${baseURL}/ffmpeg-core.worker.js`,
              "text/javascript",
            );
        } catch {
          workerURL =
            undefined;
        }

        const config: {
          coreURL: string;
          wasmURL: string;
          workerURL?: string;
        } = {
          coreURL,
          wasmURL,
        };

        if (workerURL) {
          config.workerURL =
            workerURL;
        }

        await instance.load(
          config,
        );

        console.log(
          "[FFmpeg] CDN engine loaded.",
        );

        ffmpeg =
          instance;

        return instance;
      } catch (error) {
        console.error(
          `[FFmpeg] Failed to load from ${baseURL}`,
          error,
        );

        lastError =
          error;
      }
    }

    /*
     * Nothing worked.
     */
    const message =
      lastError instanceof Error
        ? lastError.message
        : String(
            lastError ??
              "Unknown FFmpeg loading error",
          );

    throw new Error(
      `Could not load FFmpeg. ${message}`,
    );
  })();

  try {
    return await loading;
  } catch (error) {
    /*
     * Allow another attempt after a failed load.
     */
    loading = null;

    throw error;
  }
}

/* =========================================================
   STATUS
========================================================= */

export function isFFmpegLoaded(): boolean {
  return ffmpeg !== null;
}

/* =========================================================
   RESET
========================================================= */

export async function resetFFmpeg(): Promise<void> {
  if (!ffmpeg) {
    return;
  }

  try {
    await ffmpeg.terminate();
  } catch (error) {
    console.warn(
      "[FFmpeg] Failed to terminate engine.",
      error,
    );
  }

  ffmpeg = null;
  loading = null;
}

/* =========================================================
   PRELOAD
========================================================= */

/**
 * Start loading FFmpeg before the user presses Export.
 *
 * Calling this while the user is editing means the
 * 20–30 MB FFmpeg core can load in the background instead
 * of making Export appear stuck.
 */
export function preloadFFmpeg(
  onLog?: (message: string) => void,
): Promise<FFmpeg> {
  return getFFmpeg(
    onLog,
  );
}
