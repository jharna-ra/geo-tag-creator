import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

let ffmpeg: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;

const CORE_SOURCES = [
  "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm",
  "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm",
];

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

    instance.on("log", ({ message }) => {
      console.log("[FFmpeg]", message);
      onLog?.(message);
    });

    let lastError: unknown = null;

    for (const baseUrl of CORE_SOURCES) {
      try {
        console.log(
          `[FFmpeg] Loading engine from: ${baseUrl}`,
        );

        const coreURL = await toBlobURL(
          `${baseUrl}/ffmpeg-core.js`,
          "text/javascript",
        );

        const wasmURL = await toBlobURL(
          `${baseUrl}/ffmpeg-core.wasm`,
          "application/wasm",
        );

        await instance.load({
          coreURL,
          wasmURL,
        });

        console.log("[FFmpeg] Engine loaded successfully.");

        ffmpeg = instance;

        return instance;
      } catch (error) {
        console.error(
          `[FFmpeg] Failed to load from ${baseUrl}`,
          error,
        );

        lastError = error;
      }
    }

    loading = null;

    const message =
      lastError instanceof Error
        ? lastError.message
        : String(lastError);

    throw new Error(
      `Could not load FFmpeg. ${message}`,
    );
  })();

  try {
    return await loading;
  } catch (error) {
    loading = null;
    throw error;
  }
}

export function isFFmpegLoaded(): boolean {
  return ffmpeg !== null;
}
