// src/lib/ffmpeg.ts
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

let instance: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;

/** Loads (once) and returns the shared FFmpeg instance. Safe to call repeatedly. */
export async function getFFmpeg(onProgress?: (ratio: number) => void): Promise<FFmpeg> {
  if (instance) return instance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const ff = new FFmpeg();
    if (onProgress) {
      ff.on("progress", ({ progress }) => onProgress(Math.min(1, Math.max(0, progress))));
    }
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
    try {
      await ff.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      });
    } catch (err) {
      loadingPromise = null;
      throw new Error(
        "Could not load the video processing engine. Check your connection and try again."
      );
    }
    instance = ff;
    return ff;
  })();

  return loadingPromise;
}
