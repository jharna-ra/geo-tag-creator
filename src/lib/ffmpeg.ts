import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

let ffmpeg: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;

const CORE_SOURCES = [
  "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd",
  "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd",
];

export async function getFFmpeg(onLog?: (msg: string) => void): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg;
  if (loading) return loading;

  loading = (async () => {
    const instance = new FFmpeg();
    instance.on("log", ({ message }) => onLog?.(message));

    let lastError: unknown;

    for (const CORE_URL of CORE_SOURCES) {
      try {
        await instance.load({
          coreURL: await toBlobURL(`${CORE_URL}/ffmpeg-core.js`, "text/javascript"),
          wasmURL: await toBlobURL(`${CORE_URL}/ffmpeg-core.wasm`, "application/wasm"),
        });
        ffmpeg = instance;
        return instance;
      } catch (err) {
        console.error(`FFmpeg core load failed from ${CORE_URL}:`, err);
        lastError = err;
      }
    }

    loading = null;
    const detail = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`Could not load the video engine (FFmpeg): ${detail}`);
  })();

  return loading;
}

export function isFFmpegLoaded() {
  return ffmpeg !== null;
}
