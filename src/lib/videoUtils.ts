/**
 * Video utility functions
 */

/**
 * Download a Blob using the browser.
 */
export function downloadBlob(
  blob: Blob,
  filename: string,
): void {
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;

  document.body.appendChild(anchor);
  anchor.click();

  anchor.remove();

  // Give the browser time to start the download
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Keep the EXACT original video filename.
 *
 * Examples:
 *
 * video.mp4        → video.mp4
 * VID_001.MP4      → VID_001.MP4
 * my-video.mov     → my-video.mov
 * recording.webm   → recording.webm
 */
export function outputName(
  originalName: string,
): string {
  return originalName;
}

/**
 * Read basic metadata from a video.
 */
export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
}

/**
 * Probe a video using the browser's HTMLVideoElement.
 */
export function probeVideo(
  url: string,
): Promise<VideoMetadata> {
  return new Promise(
    (resolve, reject) => {
      const video =
        document.createElement("video");

      let settled = false;

      const cleanup = () => {
        video.removeAttribute("src");
        video.load();
      };

      const fail = (
        message: string,
      ) => {
        if (settled) return;

        settled = true;

        cleanup();

        reject(
          new Error(message),
        );
      };

      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;

      video.onloadedmetadata = () => {
        if (settled) return;

        const duration =
          Number(video.duration);

        const width =
          Number(video.videoWidth);

        const height =
          Number(video.videoHeight);

        if (
          !Number.isFinite(duration) ||
          duration <= 0
        ) {
          fail(
            "Could not read this video's duration.",
          );
          return;
        }

        if (
          !width ||
          !height
        ) {
          fail(
            "Could not read this video's dimensions.",
          );
          return;
        }

        settled = true;

        cleanup();

        resolve({
          duration,
          width,
          height,
        });
      };

      video.onerror = () => {
        fail(
          "Unable to read this video in your browser. Please upload an MP4 video and try again.",
        );
      };

      video.src = url;
    },
  );
}
