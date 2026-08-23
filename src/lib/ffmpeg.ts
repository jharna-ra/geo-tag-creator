import { FFmpeg } from "@ffmpeg/ffmpeg";
// Vite bundles these as static assets and gives you a same-origin URL
import coreURL from "@ffmpeg/core/dist/esm/ffmpeg-core.js?url";
import wasmURL from "@ffmpeg/core/dist/esm/ffmpeg-core.wasm?url";

let ffmpeg: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;

export async function getFFmpeg(onLog?: (msg: string) => void): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg;
  if (loading) return loading;

  loading = (async () => {
    const instance = new FFmpeg();
    instance.on("log", ({ message }) => onLog?.(message));

    try {
      await instance.load({
        coreURL,
        wasmURL,
      });
      ffmpeg = instance;
      return instance;
    } catch (err) {
      loading = null;
      console.error("FFmpeg core load failed:", err);
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(`Could not load the video engine (FFmpeg): ${detail}`);
    }
  })();

  return loading;
}

export function isFFmpegLoaded() {
  return ffmpeg !== null;
}
