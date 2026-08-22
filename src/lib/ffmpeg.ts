import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

let ffmpeg: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;

const CORE_URL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";

export async function getFFmpeg(onLog?: (msg: string) => void): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg;
  if (loading) return loading;

  loading = (async () => {
    const instance = new FFmpeg();
    instance.on("log", ({ message }) => onLog?.(message));
    try {
      await instance.load({
        coreURL: await toBlobURL(`${CORE_URL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${CORE_URL}/ffmpeg-core.wasm`, "application/wasm"),
      });
    } catch {
      loading = null;
      throw new Error(
        "Could not load the video engine (FFmpeg). Check your internet connection and refresh the page.",
      );
    }
    ffmpeg = instance;
    return instance;
  })();

  return loading;
}

export function isFFmpegLoaded() {
  return ffmpeg !== null;
}
