import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { VideoCard } from "@/components/VideoCard";

import { computeTiming, processVideo } from "@/lib/videoProcessor";
import { downloadBlob, outputName, probeVideo } from "@/lib/videoUtils";

import {
  DEFAULT_SETTINGS,
  type VideoItem,
  type VideoSettings,
} from "@/types/video";

export const Route = createFileRoute("/")({
  component: Index,

  head: () => ({
    meta: [
      {
        title: "GeoTag Video Generator",
      },
      {
        name: "description",
        content:
          "Upload your own geotag image, place it over videos, trim videos, control geotag duration and download the finished MP4.",
      },
      {
        property: "og:title",
        content: "GeoTag Video Generator",
      },
      {
        property: "og:description",
        content:
          "Upload a geotag image and burn it directly into your videos in the browser.",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
    ],
  }),
});

const MAX_VIDEOS = 6;

function Index() {
  /*
   * ============================================================
   * GEOTAG IMAGE
   * ============================================================
   *
   * The user supplies the complete geotag image.
   *
   * We DO NOT generate the geotag anymore.
   *
   * The old geotag generation files can remain in the project.
   * They simply aren't used by this page.
   */

  const [geotagFile, setGeotagFile] = useState<File | null>(null);
  const [geotagUrl, setGeotagUrl] = useState<string | null>(null);

  const geotagInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  /*
   * ============================================================
   * VIDEO STATE
   * ============================================================
   */

  const [videos, setVideos] = useState<VideoItem[]>([]);

  const [running, setRunning] = useState(false);
  const [queueLabel, setQueueLabel] = useState("");

  /*
   * ============================================================
   * GEOTAG IMAGE PREVIEW
   * ============================================================
   */

  useEffect(() => {
    if (!geotagFile) {
      setGeotagUrl(null);
      return;
    }

    const url = URL.createObjectURL(geotagFile);

    setGeotagUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [geotagFile]);

  /*
   * ============================================================
   * HANDLE GEOTAG IMAGE
   * ============================================================
   */

  const handleGeotagFile = useCallback((file: File | null) => {
    if (!file) return;

    const isImage =
      file.type.startsWith("image/") ||
      /\.(png|jpe?g|webp)$/i.test(file.name);

    if (!isImage) {
      toast.error("Please upload a PNG, JPG, JPEG or WebP geotag image.");
      return;
    }

    /*
     * Keep the original file.
     *
     * IMPORTANT:
     * We don't redraw it.
     * We don't modify its design.
     * We don't generate another geotag.
     *
     * The uploaded image itself becomes the video overlay.
     */
    setGeotagFile(file);

    toast.success(`Geotag image loaded: ${file.name}`);
  }, []);

  /*
   * ============================================================
   * HANDLE VIDEOS
   * ============================================================
   */

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;

    const room = MAX_VIDEOS - videos.length;

    if (room <= 0) {
      toast.error(
        `You can work with up to ${MAX_VIDEOS} videos at a time.`,
      );
      return;
    }

    const picked = Array.from(files).slice(0, room);

    for (const file of picked) {
      const url = URL.createObjectURL(file);

      try {
        const meta = await probeVideo(url);

        if (!meta.duration) {
          throw new Error(
            "Could not read this video's duration.",
          );
        }

        const id = `${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}`;

        setVideos((current) => [
          ...current,
          {
            id,
            file,
            url,
            name: file.name,
            duration: meta.duration,
            width: meta.width,
            height: meta.height,
            settings: DEFAULT_SETTINGS(meta.duration),
            status: "idle",
            progress: 0,
          },
        ]);
      } catch (error) {
        URL.revokeObjectURL(url);

        toast.error(
          error instanceof Error
            ? error.message
            : "This video format is not supported by your browser.",
        );
      }
    }

    if (videoInputRef.current) {
      videoInputRef.current.value = "";
    }
  };

  /*
   * ============================================================
   * VIDEO SETTINGS
   * ============================================================
   */

  const updateSettings = (
    id: string,
    patch: Partial<VideoSettings>,
  ) => {
    setVideos((current) =>
      current.map((video) =>
        video.id === id
          ? {
              ...video,
              settings: {
                ...video.settings,
                ...patch,
              },
            }
          : video,
      ),
    );
  };

  /*
   * ============================================================
   * APPLY SETTINGS TO ALL
   * ============================================================
   */

  const applyToAll = (id: string) => {
    const source = videos.find((video) => video.id === id);

    if (!source) return;

    setVideos((current) =>
      current.map((video) => {
        if (video.id === id) {
          return video;
        }

        return {
          ...video,

          settings: {
            ...source.settings,

            trimStart: Math.min(
              source.settings.trimStart,
              video.duration,
            ),

            trimEnd: Math.min(
              source.settings.trimEnd,
              video.duration,
            ),
          },
        };
      }),
    );

    toast.success("Settings applied to all videos.");
  };

  /*
   * ============================================================
   * REMOVE VIDEO
   * ============================================================
   */

  const removeVideo = (id: string) => {
    setVideos((current) => {
      const target = current.find((video) => video.id === id);

      if (target) {
        URL.revokeObjectURL(target.url);

        if (target.outputUrl) {
          URL.revokeObjectURL(target.outputUrl);
        }
      }

      return current.filter((video) => video.id !== id);
    });
  };

  /*
   * ============================================================
   * CLEAR EVERYTHING
   * ============================================================
   */

  const clearAll = () => {
    if (!videos.length && !geotagFile) {
      return;
    }

    if (
      !window.confirm(
        "Remove the uploaded geotag, videos and generated files from this session?",
      )
    ) {
      return;
    }

    videos.forEach((video) => {
      URL.revokeObjectURL(video.url);

      if (video.outputUrl) {
        URL.revokeObjectURL(video.outputUrl);
      }
    });

    setVideos([]);
    setGeotagFile(null);

    if (geotagInputRef.current) {
      geotagInputRef.current.value = "";
    }

    toast.success("Workspace cleared.");
  };

  /*
   * ============================================================
   * GENERATE VIDEOS
   * ============================================================
   */

  const generate = async () => {
    /*
     * FIRST:
     * Make sure a geotag image has been supplied.
     */

    if (!geotagFile) {
      toast.error(
        "Please upload your geotag image first.",
      );
      return;
    }

    /*
     * SECOND:
     * Make sure videos exist.
     */

    if (!videos.length) {
      toast.error(
        "Upload at least one video first.",
      );
      return;
    }

    setRunning(true);

    const list = [...videos];

    for (let index = 0; index < list.length; index++) {
      const item = list[index];

      setQueueLabel(
        `Processing ${index + 1} of ${list.length} — ${item.name}`,
      );

      /*
       * Set current video to processing.
       */

      setVideos((current) =>
        current.map((video) =>
          video.id === item.id
            ? {
                ...video,
                status: "processing",
                progress: 0,
                error: undefined,
              }
            : video,
        ),
      );

      try {
        /*
         * ======================================================
         * IMPORTANT CHANGE
         * ======================================================
         *
         * BEFORE:
         *
         * const png = await renderGeotagBlob(...)
         *
         * That created a new geotag.
         *
         * NOW:
         *
         * We directly use the image uploaded by the user.
         */

        const overlayPng = geotagFile;

        /*
         * Process the video exactly as before.
         *
         * All existing trimming,
         * percentage,
         * position,
         * duration,
         * FFmpeg,
         * progress
         * and output functionality
         * stays inside videoProcessor.ts.
         */

        const blob = await processVideo({
          item,

          /*
           * This is now the USER'S IMAGE.
           */
          overlayPng,

          onProgress: (progress) => {
            setVideos((current) =>
              current.map((video) =>
                video.id === item.id
                  ? {
                      ...video,
                      progress,
                    }
                  : video,
              ),
            );
          },
        });

        /*
         * Create temporary URL for output.
         */

        const outputUrl = URL.createObjectURL(blob);

        /*
         * Save generated result.
         */

        setVideos((current) =>
          current.map((video) =>
            video.id === item.id
              ? {
                  ...video,
                  status: "done",
                  progress: 100,
                  outputBlob: blob,
                  outputUrl,
                  outputName: outputName(video.name),
                }
              : video,
          ),
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Processing failed.";

        setVideos((current) =>
          current.map((video) =>
            video.id === item.id
              ? {
                  ...video,
                  status: "error",
                  error: message,
                }
              : video,
          ),
        );

        toast.error(
          `${item.name}: ${message}`,
        );
      }
    }

    setQueueLabel("");
    setRunning(false);

    toast.success(
      "Video processing finished.",
    );
  };

  /*
   * ============================================================
   * DOWNLOAD ALL
   * ============================================================
   */

  const downloadAll = async () => {
    const completed = videos.filter(
      (video) => video.outputBlob,
    );

    if (!completed.length) {
      toast.error(
        "There are no generated videos to download.",
      );
      return;
    }

    try {
      const zip = new JSZip();

      completed.forEach((video) => {
        zip.file(
          video.outputName!,
          video.outputBlob!,
        );
      });

      const blob = await zip.generateAsync({
        type: "blob",
      });

      downloadBlob(
        blob,
        "geotagged_videos.zip",
      );

      toast.success(
        "ZIP downloaded successfully.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not create ZIP file.",
      );
    }
  };

  /*
   * ============================================================
   * COUNTERS
   * ============================================================
   */

  const readyCount = useMemo(
    () =>
      videos.filter(
        (video) => video.status === "done",
      ).length,
    [videos],
  );

  const processingVideo = useMemo(
    () =>
      videos.find(
        (video) => video.status === "processing",
      ),
    [videos],
  );

  /*
   * ============================================================
   * UI
   * ============================================================
   */

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">

        {/* ======================================================
            HEADER
        ====================================================== */}

        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            GeoTag Video Generator
          </h1>

          <p className="text-muted-foreground">
            Upload your geotag image and burn it directly
            into your videos.
          </p>

          <p className="text-sm text-muted-foreground">
            1. Upload Geotag → 2. Upload Videos → 3. Edit →
            4. Generate → 5. Download
          </p>
        </header>

        {/* ======================================================
            GEOTAG IMAGE UPLOAD
        ====================================================== */}

        <Card>
          <CardHeader>
            <CardTitle>
              Upload Geotag Image
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">

            <input
              ref={geotagInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => {
                handleGeotagFile(
                  event.target.files?.[0] ?? null,
                );
              }}
            />

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() =>
                  geotagInputRef.current?.click()
                }
                disabled={running}
              >
                {geotagFile
                  ? "Change Geotag Image"
                  : "Choose Geotag Image"}
              </Button>

              {geotagFile && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={running}
                  onClick={() => {
                    setGeotagFile(null);

                    if (geotagInputRef.current) {
                      geotagInputRef.current.value = "";
                    }
                  }}
                >
                  Remove Geotag
                </Button>
              )}
            </div>

            {!geotagFile && (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="font-medium">
                  No geotag image selected
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Upload the complete PNG/JPG geotag that
                  you want to appear on the video.
                </p>
              </div>
            )}

            {geotagFile && geotagUrl && (
              <div className="space-y-3">
                <div className="rounded-lg border bg-background p-3">
                  <img
                    src={geotagUrl}
                    alt="Uploaded geotag"
                    className="mx-auto max-h-72 max-w-full rounded-md object-contain"
                  />
                </div>

                <div className="rounded-md bg-muted p-3 text-sm">
                  <p>
                    <strong>File:</strong>{" "}
                    {geotagFile.name}
                  </p>

                  <p>
                    <strong>Type:</strong>{" "}
                    {geotagFile.type || "Image"}
                  </p>

                  <p>
                    <strong>Size:</strong>{" "}
                    {(geotagFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>

                <p className="text-sm text-muted-foreground">
                  This exact uploaded image will be used
                  as the geotag overlay. The application
                  will not create or redraw another geotag.
                </p>
              </div>
            )}

          </CardContent>
        </Card>

        {/* ======================================================
            VIDEO UPLOAD
        ====================================================== */}

        <Card>
          <CardHeader>
            <CardTitle>
              Upload Videos
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">

            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/*"
              multiple
              className="hidden"
              onChange={(event) =>
                handleFiles(event.target.files)
              }
            />

            <div className="flex flex-wrap gap-2">

              <Button
                type="button"
                onClick={() =>
                  videoInputRef.current?.click()
                }
                disabled={running}
              >
                Choose Videos
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={clearAll}
                disabled={
                  running ||
                  (!videos.length && !geotagFile)
                }
              >
                Clear All
              </Button>

            </div>

            <p className="text-sm text-muted-foreground">
              Up to {MAX_VIDEOS} videos.
              Supported formats include MP4, MOV and WebM
              where your browser/FFmpeg supports them.
            </p>

            <p className="text-sm text-muted-foreground">
              Videos are processed locally in your browser
              and are not permanently stored.
            </p>

          </CardContent>
        </Card>

        {/* ======================================================
            VIDEO CARDS
        ====================================================== */}

        {videos.map((video, index) => (
          <VideoCard
            key={video.id}
            item={video}
            index={index}

            /*
             * IMPORTANT:
             *
             * VideoCard receives the uploaded image.
             * It can therefore show the same geotag over
             * the video preview.
             */
            overlayUrl={geotagUrl}

            onUpdate={updateSettings}
            onRemove={removeVideo}
            onApplyToAll={applyToAll}
          />
        ))}

        {/* ======================================================
            GENERATE
        ====================================================== */}

        {videos.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>
                Generate
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">

              {!geotagFile && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                  Upload a geotag image before generating
                  the videos.
                </div>
              )}

              <Button
                type="button"
                size="lg"
                onClick={generate}
                disabled={
                  running ||
                  !videos.length ||
                  !geotagFile
                }
              >
                {running
                  ? "Processing…"
                  : "Generate Geotagged Video"}
              </Button>

              {/* ==================================================
                  PROCESSING PROGRESS
              ================================================== */}

              {running && (
                <div className="space-y-2">

                  <p className="text-sm">
                    {queueLabel}
                  </p>

                  <Progress
                    value={
                      processingVideo?.progress ?? 0
                    }
                  />

                  <p className="text-xs text-muted-foreground">
                    The video engine loads on first use.
                    Large videos can take several minutes.
                  </p>

                </div>
              )}

              {/* ==================================================
                  DOWNLOAD ALL
              ================================================== */}

              {readyCount > 1 && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={downloadAll}
                  disabled={running}
                >
                  Download All ({readyCount})
                </Button>
              )}

              {/* ==================================================
                  COMPLETED VIDEOS
              ================================================== */}

              {videos.some(
                (video) =>
                  video.status === "done",
              ) && (
                <ul className="space-y-2">

                  {videos
                    .filter(
                      (video) =>
                        video.status === "done",
                    )
                    .map((video) => (
                      <li
                        key={video.id}
                        className="flex flex-col gap-3 rounded border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >

                        <span className="text-sm">
                          {video.outputName}

                          {" · "}

                          final{" "}
                          {computeTiming(
                            video,
                          ).finalDuration.toFixed(0)}
                          s

                          {" · geotag "}

                          {video.settings.percent}%
                        </span>

                        <Button
                          type="button"
                          size="sm"
                          onClick={() =>
                            downloadBlob(
                              video.outputBlob!,
                              video.outputName!,
                            )
                          }
                        >
                          Download
                        </Button>

                      </li>
                    ))}

                </ul>
              )}

            </CardContent>
          </Card>
        )}

      </div>
    </main>
  );
}
