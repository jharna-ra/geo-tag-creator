import { fetchFile } from "@ffmpeg/util";
import { getFFmpeg } from "./ffmpeg";
import type { OverlayPosition } from "@/types/geotag";
import type { VideoItem } from "@/types/video";

export function overlayXY(position: OverlayPosition, margin: number): { x: string; y: string } {
  const m = String(margin);
  switch (position) {
    case "top-left":
      return { x: m, y: m };
    case "top-right":
      return { x: `main_w-overlay_w-${m}`, y: m };
    case "bottom-left":
      return { x: m, y: `main_h-overlay_h-${m}` };
    case "bottom-right":
      return { x: `main_w-overlay_w-${m}`, y: `main_h-overlay_h-${m}` };
    case "bottom-center":
    default:
      return { x: "(main_w-overlay_w)/2", y: `main_h-overlay_h-${m}` };
  }
}

export function computeTiming(item: VideoItem) {
  const start = Math.max(0, Math.min(item.settings.trimStart, item.duration));
  const end = Math.max(start + 0.1, Math.min(item.settings.trimEnd, item.duration || item.settings.trimEnd));
  const finalDuration = end - start;
  const geotagDuration = (finalDuration * item.settings.percent) / 100;
  const overlayStart = item.settings.timing === "beginning" ? 0 : Math.max(0, finalDuration - geotagDuration);
  const overlayEnd = overlayStart + geotagDuration;
  return { start, end, finalDuration, geotagDuration, overlayStart, overlayEnd };
}

export interface ProcessArgs {
  item: VideoItem;
  overlayPng: Blob;
  onProgress: (p: number) => void;
}

export async function processVideo({ item, overlayPng, onProgress }: ProcessArgs): Promise<Blob> {
  const ffmpeg = await getFFmpeg();
  const { start, finalDuration, overlayStart, overlayEnd } = computeTiming(item);

  const inName = `in_${item.id}.${(item.file.name.split(".").pop() || "mp4").toLowerCase()}`;
  const pngName = `ov_${item.id}.png`;
  const outFile = `out_${item.id}.mp4`;

  const handler = ({ progress }: { progress: number }) => {
    const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
    onProgress(pct);
  };
  ffmpeg.on("progress", handler);

  try {
    await ffmpeg.writeFile(inName, await fetchFile(item.file));
    await ffmpeg.writeFile(pngName, await fetchFile(overlayPng));

    const overlayW = Math.round((item.width || 1280) * item.settings.scale);
    const { x, y } = overlayXY(item.settings.position, Math.round((item.height || 720) * 0.035));
    const alpha = item.settings.opacity;

    const filter =
      `[1:v]scale=${overlayW}:-1,format=rgba,colorchannelmixer=aa=${alpha}[ov];` +
      `[0:v][ov]overlay=${x}:${y}:enable='between(t,${overlayStart.toFixed(3)},${overlayEnd.toFixed(
        3,
      )})':format=auto[v]`;

    const args = [
      "-ss",
      start.toFixed(3),
      "-t",
      finalDuration.toFixed(3),
      "-i",
      inName,
      "-i",
      pngName,
      "-filter_complex",
      filter,
      "-map",
      "[v]",
      "-map",
      "0:a?",
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
      outFile,
    ];

    const code = await ffmpeg.exec(args);
    if (code !== 0) throw new Error("encode-failed");

    const data = (await ffmpeg.readFile(outFile)) as Uint8Array;
    const copy = new Uint8Array(data);
    return new Blob([copy], { type: "video/mp4" });
  } catch (e) {
    throw new Error(
      "Unable to process this video in your browser. Try using an MP4 video or a shorter/smaller video.",
    );
  } finally {
    ffmpeg.off("progress", handler);
    for (const f of [inName, pngName, outFile]) {
      try {
        await ffmpeg.deleteFile(f);
      } catch {
        /* ignore */
      }
    }
  }
}
