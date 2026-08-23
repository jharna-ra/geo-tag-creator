import { createFileRoute } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

import {
  computeTiming,
  processVideo,
} from "@/lib/videoProcessor";

import {
  downloadBlob,
  probeVideo,
} from "@/lib/videoUtils";

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
          "Crop videos, add geotags, trim videos and export MP4 files directly in your browser.",
      },
    ],
  }),
});

const MAX_VIDEOS = 6;

function Index() {
  /* =========================================================
     GEOTAG
  ========================================================= */

  const [geotagFile, setGeotagFile] =
    useState<File | null>(null);

  const [geotagUrl, setGeotagUrl] =
    useState<string | null>(null);

  const geotagInputRef =
    useRef<HTMLInputElement>(null);

  const videoInputRef =
    useRef<HTMLInputElement>(null);

  /* =========================================================
     VIDEOS
  ========================================================= */

  const [videos, setVideos] =
    useState<VideoItem[]>([]);

  const [running, setRunning] =
    useState(false);

  const [queueLabel, setQueueLabel] =
    useState("");

  /* =========================================================
     GEOTAG PREVIEW URL
  ========================================================= */

  useEffect(() => {
    if (!geotagFile) {
      setGeotagUrl(null);
      return;
    }

    const url =
      URL.createObjectURL(geotagFile);

    setGeotagUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [geotagFile]);

  /* =========================================================
     GEOTAG FILE
  ========================================================= */

  const handleGeotagFile =
    useCallback((file: File | null) => {
      if (!file) {
        return;
      }

      const valid =
        file.type.startsWith("image/") ||
        /\.(png|jpe?g|webp)$/i.test(
          file.name,
        );

      if (!valid) {
        toast.error(
          "Please upload a PNG, JPG, JPEG or WebP image.",
        );
        return;
      }

      setGeotagFile(file);

      toast.success(
        `Geotag image loaded: ${file.name}`,
      );
    }, []);

  /* =========================================================
     VIDEO FILES
  ========================================================= */

  const handleFiles = async (
    files: FileList | null,
  ) => {
    if (!files?.length) {
      return;
    }

    const available =
      MAX_VIDEOS - videos.length;

    if (available <= 0) {
      toast.error(
        `Maximum ${MAX_VIDEOS} videos allowed.`,
      );
      return;
    }

    const selected =
      Array.from(files).slice(
        0,
        available,
      );

    for (const file of selected) {
      const url =
        URL.createObjectURL(file);

      try {
        const meta =
          await probeVideo(url);

        if (
          !meta.duration ||
          !meta.width ||
          !meta.height
        ) {
          throw new Error(
            "Could not read video information.",
          );
        }

        const id =
          `${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 9)}`;

        const video: VideoItem = {
          id,
          file,
          url,
          name: file.name,
          duration: meta.duration,
          width: meta.width,
          height: meta.height,

          settings:
            DEFAULT_SETTINGS(
              meta.duration,
            ),

          status: "idle",
          progress: 0,
        };

        setVideos((current) => [
          ...current,
          video,
        ]);
      } catch (error) {
        URL.revokeObjectURL(url);

        toast.error(
          error instanceof Error
            ? error.message
            : "Could not read this video.",
        );
      }
    }

    if (videoInputRef.current) {
      videoInputRef.current.value =
        "";
    }
  };

  /* =========================================================
     UPDATE SETTINGS
  ========================================================= */

  const updateSettings = (
    id: string,
    patch: Partial<VideoSettings>,
  ) => {
    setVideos((current) =>
      current.map((video) => {
        if (video.id !== id) {
          return video;
        }

        return {
          ...video,

          settings: {
            ...video.settings,
            ...patch,
          },
        };
      }),
    );
  };

  /* =========================================================
     APPLY SETTINGS TO ALL
  ========================================================= */

  const applyToAll = (id: string) => {
    const source =
      videos.find(
        (video) => video.id === id,
      );

    if (!source) {
      return;
    }

    setVideos((current) =>
      current.map((video) => {
        if (video.id === id) {
          return video;
        }

        const trimStart =
          Math.min(
            source.settings
              .trimStart,
            video.duration,
          );

        const trimEnd =
          Math.min(
            source.settings.trimEnd,
            video.duration,
          );

        return {
          ...video,

          settings: {
            ...source.settings,

            trimStart,

            trimEnd:
              trimEnd >
              trimStart
                ? trimEnd
                : Math.min(
                    video.duration,
                    trimStart + 0.1,
                  ),
          },
        };
      }),
    );

    toast.success(
      "Settings applied to all videos.",
    );
  };

  /* =========================================================
     REMOVE VIDEO
  ========================================================= */

  const removeVideo = (
    id: string,
  ) => {
    setVideos((current) => {
      const target =
        current.find(
          (video) =>
            video.id === id,
        );

      if (target) {
        URL.revokeObjectURL(
          target.url,
        );

        if (target.outputUrl) {
          URL.revokeObjectURL(
            target.outputUrl,
          );
        }
      }

      return current.filter(
        (video) =>
          video.id !== id,
      );
    });
  };

  /* =========================================================
     CLEAR ALL
  ========================================================= */

  const clearAll = () => {
    if (
      !videos.length &&
      !geotagFile
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Remove all uploaded videos, geotag image and generated files?",
      );

    if (!confirmed) {
      return;
    }

    videos.forEach((video) => {
      URL.revokeObjectURL(
        video.url,
      );

      if (video.outputUrl) {
        URL.revokeObjectURL(
          video.outputUrl,
        );
      }
    });

    setVideos([]);
    setGeotagFile(null);

    if (geotagInputRef.current) {
      geotagInputRef.current.value =
        "";
    }

    if (videoInputRef.current) {
      videoInputRef.current.value =
        "";
    }

    toast.success(
      "Workspace cleared.",
    );
  };

  /* =========================================================
     GENERATE
  ========================================================= */

  const generate = async () => {
    if (!geotagFile) {
      toast.error(
        "Please upload a geotag image first.",
      );
      return;
    }

    if (!videos.length) {
      toast.error(
        "Please upload at least one video.",
      );
      return;
    }

    setRunning(true);

    const queue = [...videos];

    for (
      let index = 0;
      index < queue.length;
      index++
    ) {
      const original =
        queue[index];

      if (!original) {
        continue;
      }

      setQueueLabel(
        `Processing ${index + 1} of ${queue.length} — ${original.name}`,
      );

      /* ---------------------------------------------
         PROCESSING STATE
      --------------------------------------------- */

      setVideos((current) =>
        current.map((video) =>
          video.id === original.id
            ? {
                ...video,
                status:
                  "processing",
                progress: 0,
                error:
                  undefined,
              }
            : video,
        ),
      );

      try {
        /*
         * IMPORTANT:
         *
         * Take the latest version of this video
         * from React state.
         *
         * This ensures the crop selected by the
         * user is actually sent to FFmpeg.
         */

        const latest =
          videos.find(
            (video) =>
              video.id ===
              original.id,
          ) ?? original;

        /*
         * User's original geotag image.
         */

        const result =
          await processVideo(
            latest,
            geotagFile,
            (progress) => {
              setVideos(
                (current) =>
                  current.map(
                    (video) =>
                      video.id ===
                      original.id
                        ? {
                            ...video,
                            progress,
                          }
                        : video,
                  ),
              );
            },
          );

        const outputUrl =
          URL.createObjectURL(
            result.blob,
          );

        /*
         * IMPORTANT:
         *
         * Keep EXACT SAME filename
         * as the uploaded video.
         *
         * Example:
         *
         * drone_video.mp4
         *
         * remains:
         *
         * drone_video.mp4
         */

        const finalName =
          original.name;

        setVideos((current) =>
          current.map((video) =>
            video.id ===
            original.id
              ? {
                  ...video,

                  status:
                    "done",

                  progress: 100,

                  outputBlob:
                    result.blob,

                  outputUrl,

                  outputName:
                    finalName,
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
            video.id ===
            original.id
              ? {
                  ...video,

                  status:
                    "error",

                  error:
                    message,
                }
              : video,
          ),
        );

        toast.error(
          `${original.name}: ${message}`,
        );
      }
    }

    setQueueLabel("");
    setRunning(false);

    toast.success(
      "Video processing finished.",
    );
  };

  /* =========================================================
     DOWNLOAD ALL
  ========================================================= */

  const downloadAll = async () => {
    const completed =
      videos.filter(
        (video) =>
          video.outputBlob,
      );

    if (!completed.length) {
      toast.error(
        "No generated videos available.",
      );
      return;
    }

    try {
      const zip =
        new JSZip();

      completed.forEach(
        (video) => {
          if (
            video.outputBlob &&
            video.outputName
          ) {
            zip.file(
              video.outputName,
              video.outputBlob,
            );
          }
        },
      );

      const blob =
        await zip.generateAsync({
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
          : "Could not create ZIP.",
      );
    }
  };

  /* =========================================================
     COUNTERS
  ========================================================= */

  const readyCount =
    useMemo(
      () =>
        videos.filter(
          (video) =>
            video.status ===
            "done",
        ).length,
      [videos],
    );

  const processingVideo =
    useMemo(
      () =>
        videos.find(
          (video) =>
            video.status ===
            "processing",
        ),
      [videos],
    );

  /* =========================================================
     UI
  ========================================================= */

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">

        {/* ===================================================
            HEADER
        =================================================== */}

        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            GeoTag Video Generator
          </h1>

          <p className="text-muted-foreground">
            Crop videos, trim them and add
            your geotag image directly in
            the browser.
          </p>

          <p className="text-sm text-muted-foreground">
            1. Upload Geotag →
            2. Upload Videos →
            3. Crop / Edit →
            4. Generate →
            5. Download
          </p>
        </header>

        {/* ===================================================
            GEOTAG
        =================================================== */}

        <Card>
          <CardHeader>
            <CardTitle>
              Upload Geotag Image
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">

            <input
              ref={
                geotagInputRef
              }
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) =>
                handleGeotagFile(
                  event.target.files?.[0] ??
                    null,
                )
              }
            />

            <div className="flex flex-wrap gap-2">

              <Button
                type="button"
                disabled={running}
                onClick={() =>
                  geotagInputRef.current?.click()
                }
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
                    setGeotagFile(
                      null,
                    );

                    if (
                      geotagInputRef.current
                    ) {
                      geotagInputRef.current.value =
                        "";
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
                  Upload your PNG, JPG or
                  WebP geotag image.
                </p>
              </div>
            )}

            {geotagFile &&
              geotagUrl && (
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
                      <strong>
                        File:
                      </strong>{" "}
                      {geotagFile.name}
                    </p>

                    <p>
                      <strong>
                        Type:
                      </strong>{" "}
                      {geotagFile.type ||
                        "Image"}
                    </p>

                    <p>
                      <strong>
                        Size:
                      </strong>{" "}
                      {(
                        geotagFile.size /
                        1024
                      ).toFixed(
                        1,
                      )}{" "}
                      KB
                    </p>
                  </div>

                </div>
              )}

          </CardContent>
        </Card>

        {/* ===================================================
            VIDEO UPLOAD
        =================================================== */}

        <Card>
          <CardHeader>
            <CardTitle>
              Upload Videos
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">

            <input
              ref={
                videoInputRef
              }
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/*"
              multiple
              className="hidden"
              onChange={(event) =>
                handleFiles(
                  event.target.files,
                )
              }
            />

            <div className="flex flex-wrap gap-2">

              <Button
                type="button"
                disabled={running}
                onClick={() =>
                  videoInputRef.current?.click()
                }
              >
                Choose Videos
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={
                  running ||
                  (!videos.length &&
                    !geotagFile)
                }
                onClick={clearAll}
              >
                Clear All
              </Button>

            </div>

            <p className="text-sm text-muted-foreground">
              Up to {MAX_VIDEOS} videos.
            </p>

            <p className="text-sm text-muted-foreground">
              Video processing happens
              locally in your browser.
            </p>

          </CardContent>
        </Card>

        {/* ===================================================
            VIDEO CARDS
        =================================================== */}

        {videos.map(
          (video, index) => (
            <VideoCard
              key={video.id}
              item={video}
              index={index}
              overlayUrl={
                geotagUrl
              }
              onUpdate={
                updateSettings
              }
              onRemove={
                removeVideo
              }
              onApplyToAll={
                applyToAll
              }
            />
          ),
        )}

        {/* ===================================================
            GENERATE
        =================================================== */}

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
                  Upload a geotag image
                  before generating.
                </div>
              )}

              <Button
                type="button"
                size="lg"
                disabled={
                  running ||
                  !videos.length ||
                  !geotagFile
                }
                onClick={generate}
              >
                {running
                  ? "Processing..."
                  : "Generate Geotagged Video"}
              </Button>

              {running && (
                <div className="space-y-2">

                  <p className="text-sm">
                    {queueLabel}
                  </p>

                  <Progress
                    value={
                      processingVideo?.progress ??
                      0
                    }
                  />

                  <p className="text-xs text-muted-foreground">
                    Large videos may take
                    several minutes.
                  </p>

                </div>
              )}

              {readyCount > 1 && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={running}
                  onClick={
                    downloadAll
                  }
                >
                  Download All (
                  {readyCount})
                </Button>
              )}

              {/* COMPLETED LIST */}

              {videos.some(
                (video) =>
                  video.status ===
                  "done",
              ) && (
                <div className="space-y-2">

                  {videos
                    .filter(
                      (video) =>
                        video.status ===
                        "done",
                    )
                    .map(
                      (video) => (
                        <div
                          key={
                            video.id
                          }
                          className="flex flex-col gap-3 rounded border p-3 sm:flex-row sm:items-center sm:justify-between"
                        >

                          <div>
                            <p className="text-sm font-medium">
                              ✓{" "}
                              {
                                video.outputName
                              }
                            </p>

                            <p className="text-xs text-muted-foreground">
                              Cropped:
                              {" "}
                              {(
                                video
                                  .settings
                                  .crop
                                  .width *
                                100
                              ).toFixed(
                                1,
                              )}
                              % ×{" "}
                              {(
                                video
                                  .settings
                                  .crop
                                  .height *
                                100
                              ).toFixed(
                                1,
                              )}
                              %
                            </p>
                          </div>

                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              if (
                                video.outputBlob &&
                                video.outputName
                              ) {
                                downloadBlob(
                                  video.outputBlob,
                                  video.outputName,
                                );
                              }
                            }}
                          >
                            Download
                          </Button>

                        </div>
                      ),
                    )}

                </div>
              )}

            </CardContent>
          </Card>
        )}

      </div>
    </main>
  );
}
