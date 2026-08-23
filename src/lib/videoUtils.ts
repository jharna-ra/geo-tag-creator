export interface VideoMeta {
  duration: number;
  width: number;
  height: number;
}

/* ============================================================
   PROBE VIDEO
============================================================ */

export function probeVideo(
  url: string,
): Promise<VideoMeta> {
  return new Promise(
    (resolve, reject) => {
      const video =
        document.createElement(
          "video",
        );

      video.preload =
        "metadata";

      video.muted = true;

      let finished = false;

      const cleanup = () => {
        video.onloadedmetadata =
          null;

        video.onerror =
          null;

        video.onabort =
          null;

        video.removeAttribute(
          "src",
        );

        video.load();
      };

      const fail = (
        message: string,
      ) => {
        if (finished) return;

        finished = true;

        cleanup();

        reject(
          new Error(message),
        );
      };

      video.onloadedmetadata =
        () => {
          if (finished) {
            return;
          }

          const duration =
            Number.isFinite(
              video.duration,
            )
              ? video.duration
              : 0;

          const width =
            video.videoWidth || 0;

          const height =
            video.videoHeight || 0;

          /*
           * Make sure the browser actually
           * understood the video.
           */

          if (
            duration <= 0
          ) {
            fail(
              "The video duration could not be read. Please upload a valid MP4 video.",
            );

            return;
          }

          if (
            width <= 0 ||
            height <= 0
          ) {
            fail(
              "The video dimensions could not be read. Please upload a valid MP4 video.",
            );

            return;
          }

          finished = true;

          cleanup();

          resolve({
            duration,
            width,
            height,
          });
        };

      video.onerror =
        () => {
          fail(
            "This video format cannot be read by your browser. Please use an MP4 video.",
          );
        };

      video.onabort =
        () => {
          fail(
            "Video loading was aborted. Please try the video again.",
          );
        };

      /*
       * Start loading.
       */

      video.src = url;

      video.load();
    },
  );
}

/* ============================================================
   OUTPUT NAME
============================================================ */

export function outputName(
  name: string,
): string {
  const dot =
    name.lastIndexOf(
      ".",
    );

  const base =
    dot > 0
      ? name.slice(0, dot)
      : name;

  return `${base}_geotagged.mp4`;
}

/* ============================================================
   DOWNLOAD
============================================================ */

export function downloadBlob(
  blob: Blob,
  filename: string,
) {
  if (!blob) {
    return;
  }

  const url =
    URL.createObjectURL(
      blob,
    );

  const anchor =
    document.createElement(
      "a",
    );

  anchor.href = url;

  anchor.download =
    filename;

  document.body.appendChild(
    anchor,
  );

  anchor.click();

  anchor.remove();

  setTimeout(() => {
    URL.revokeObjectURL(
      url,
    );
  }, 4000);
}
