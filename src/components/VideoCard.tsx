import {
  useEffect,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";

import { CropSelector } from "@/components/CropSelector";

import {
  computeTiming,
} from "@/lib/videoProcessor";

import {
  downloadBlob,
} from "@/lib/videoUtils";

import type {
  OverlayPosition,
} from "@/types/geotag";

import {
  fmtTime,
  type CropRect,
  type VideoItem,
  type VideoSettings,
} from "@/types/video";

/* =========================================================
   PROPS
========================================================= */

interface Props {
  item: VideoItem;

  overlayUrl:
    | string
    | null;

  index: number;

  onUpdate: (
    id: string,
    patch: Partial<VideoSettings>,
  ) => void;

  onRemove: (
    id: string,
  ) => void;

  onApplyToAll: (
    id: string,
  ) => void;
}

/* =========================================================
   POSITIONS
========================================================= */

const POSITIONS: {
  key: OverlayPosition;
  label: string;
}[] = [
  {
    key: "top-left",
    label: "Top Left",
  },
  {
    key: "top-right",
    label: "Top Right",
  },
  {
    key: "bottom-left",
    label: "Bottom Left",
  },
  {
    key: "bottom-right",
    label: "Bottom Right",
  },
  {
    key: "bottom-center",
    label: "Bottom Center",
  },
];

/* =========================================================
   POSITION CLASSES
========================================================= */

const POS_CLASS: Record<
  OverlayPosition,
  string
> = {
  "top-left":
    "left-0 top-0",

  "top-right":
    "right-0 top-0",

  "bottom-left":
    "left-0 bottom-0",

  "bottom-right":
    "right-0 bottom-0",

  "bottom-center":
    "left-1/2 -translate-x-1/2 bottom-0",
};

/* =========================================================
   FULL CROP
========================================================= */

const FULL_CROP: CropRect = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
};

/* =========================================================
   HELPERS
========================================================= */

function isFullCrop(
  crop: CropRect,
) {
  return (
    Math.abs(crop.x) < 0.0001 &&
    Math.abs(crop.y) < 0.0001 &&
    Math.abs(
      crop.width - 1,
    ) < 0.0001 &&
    Math.abs(
      crop.height - 1,
    ) < 0.0001
  );
}

/* =========================================================
   VIDEO CARD
========================================================= */

export function VideoCard({
  item,
  overlayUrl,
  index,
  onUpdate,
  onRemove,
  onApplyToAll,
}: Props) {
  /* =======================================================
     OPEN
  ======================================================= */

  const [open, setOpen] =
    useState(index === 0);

  /* =======================================================
     VIDEO REF
  ======================================================= */

  const videoRef =
    useRef<HTMLVideoElement>(
      null,
    );

  /* =======================================================
     CROP MODE
  ======================================================= */

  const [cropEnabled, setCropEnabled] =
    useState(false);

  /* =======================================================
     OVERLAY VISIBILITY
  ======================================================= */

  const [showOverlay, setShowOverlay] =
    useState(true);

  /* =======================================================
     TIMING
  ======================================================= */

  const timing =
    computeTiming(item);

  /* =======================================================
     CROP
  ======================================================= */

  const crop: CropRect =
    item.settings.crop ??
    FULL_CROP;

  /* =======================================================
     PERCENTAGES
  ======================================================= */

  const widthPercent =
    item.settings.scale * 100;

  const heightPercent =
    item.settings.heightScale *
    100;

  const durationPercent =
    item.settings.percent;

  /* =======================================================
     PLAYBACK / GEOTAG TIMING
  ======================================================= */

  useEffect(() => {
    const video =
      videoRef.current;

    if (!video) {
      return;
    }

    const handleTimeUpdate =
      () => {
        const current =
          video.currentTime;

        /*
         * Stop at trim end.
         */

        if (
          current >=
          timing.end
        ) {
          video.pause();

          video.currentTime =
            timing.start;

          setShowOverlay(
            timing.timing ===
              "beginning",
          );

          return;
        }

        const relative =
          current -
          timing.start;

        const visible =
          relative >=
            timing.overlayStart &&
          relative <=
            timing.overlayEnd;

        setShowOverlay(
          visible,
        );
      };

    video.addEventListener(
      "timeupdate",
      handleTimeUpdate,
    );

    return () => {
      video.removeEventListener(
        "timeupdate",
        handleTimeUpdate,
      );
    };
  }, [
    timing.start,
    timing.end,
    timing.overlayStart,
    timing.overlayEnd,
  ]);

  /* =======================================================
     WIDTH
  ======================================================= */

  const updateWidth = (
    value: number,
  ) => {
    if (
      !Number.isFinite(value)
    ) {
      return;
    }

    const safe =
      Math.min(
        100,
        Math.max(
          0.1,
          value,
        ),
      );

    onUpdate(
      item.id,
      {
        scale:
          safe / 100,
      },
    );
  };

  /* =======================================================
     HEIGHT
  ======================================================= */

  const updateHeight = (
    value: number,
  ) => {
    if (
      !Number.isFinite(value)
    ) {
      return;
    }

    const safe =
      Math.min(
        100,
        Math.max(
          0.1,
          value,
        ),
      );

    onUpdate(
      item.id,
      {
        heightScale:
          safe / 100,
      },
    );
  };

  /* =======================================================
     DURATION
  ======================================================= */

  const updateDuration = (
    value: number,
  ) => {
    if (
      !Number.isFinite(value)
    ) {
      return;
    }

    const safe =
      Math.min(
        100,
        Math.max(
          1,
          value,
        ),
      );

    onUpdate(
      item.id,
      {
        percent: safe,
      },
    );
  };

  /* =======================================================
     CROP UPDATE
  ======================================================= */

  const updateCrop = (
    newCrop: CropRect,
  ) => {
    /*
     * Extra safety.
     */

    const safe: CropRect = {
      x: Math.max(
        0,
        Math.min(
          1,
          newCrop.x,
        ),
      ),

      y: Math.max(
        0,
        Math.min(
          1,
          newCrop.y,
        ),
      ),

      width: Math.max(
        0.01,
        Math.min(
          1,
          newCrop.width,
        ),
      ),

      height: Math.max(
        0.01,
        Math.min(
          1,
          newCrop.height,
        ),
      ),
    };

    /*
     * Make sure crop does not
     * go outside video.
     */

    safe.x = Math.min(
      safe.x,
      1 - safe.width,
    );

    safe.y = Math.min(
      safe.y,
      1 - safe.height,
    );

    onUpdate(
      item.id,
      {
        crop: safe,
      },
    );
  };

  /* =======================================================
     RESET CROP
  ======================================================= */

  const resetCrop = () => {
    onUpdate(
      item.id,
      {
        crop: {
          ...FULL_CROP,
        },
      },
    );

    setCropEnabled(
      false,
    );
  };

  /* =======================================================
     FINISH CROP
  ======================================================= */

  const finishCrop = () => {
    setCropEnabled(
      false,
    );

    /*
     * Force video back to
     * beginning so the new
     * crop preview is visible.
     */

    if (videoRef.current) {
      videoRef.current.pause();

      videoRef.current.currentTime =
        Math.max(
          0,
          item.settings
            .trimStart,
        );
    }
  };

  /* =======================================================
     CROP PREVIEW
  ======================================================= */

  /*
   * The important part:
   *
   * Instead of showing the complete
   * video after Finish Crop, we
   * create a viewport exactly the
   * size of the selected crop.
   *
   * The original video is enlarged
   * inside that viewport.
   */

  const cropPreviewStyle =
    !isFullCrop(crop)
      ? {
          aspectRatio:
            `${crop.width} / ${crop.height}`,
        }
      : undefined;

  const croppedVideoStyle =
    !isFullCrop(crop)
      ? {
          position:
            "absolute" as const,

          left:
            `${-crop.x * (100 / crop.width)}%`,

          top:
            `${-crop.y * (100 / crop.height)}%`,

          width:
            `${100 / crop.width}%`,

          height:
            `${100 / crop.height}%`,

          maxWidth: "none",

          objectFit:
            "fill" as const,
        }
      : undefined;

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <Card className="overflow-hidden">

      <CardContent className="space-y-4 pt-6">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="flex flex-wrap items-center justify-between gap-3">

          <div className="min-w-0">

            <p className="truncate font-medium">
              {item.name}
            </p>

            <p className="text-sm text-muted-foreground">
              {fmtTime(
                item.duration,
              )}

              {" · "}

              {item.width}
              {" × "}
              {item.height}

              {!isFullCrop(
                crop,
              ) && (
                <>
                  {" · Cropped "}
                  {(
                    crop.width *
                    100
                  ).toFixed(
                    1,
                  )}
                  %
                  {" × "}
                  {(
                    crop.height *
                    100
                  ).toFixed(
                    1,
                  )}
                  %
                </>
              )}
            </p>

          </div>

          <div className="flex gap-2">

            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setOpen(
                  (value) =>
                    !value,
                )
              }
            >
              {open
                ? "Close"
                : "Edit"}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                onRemove(
                  item.id,
                )
              }
            >
              Remove
            </Button>

          </div>

        </div>

        {/* =================================================
            PROCESSING
        ================================================= */}

        {item.status ===
          "processing" && (
          <div className="space-y-2">

            <Progress
              value={
                item.progress
              }
            />

            <p className="text-xs text-muted-foreground">
              Processing...
              {" "}
              {item.progress}%
            </p>

          </div>
        )}

        {/* =================================================
            ERROR
        ================================================= */}

        {item.status ===
          "error" && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">

            <p className="text-sm font-medium text-destructive">
              Processing failed
            </p>

            {item.error && (
              <p className="mt-1 text-xs text-destructive/80">
                {item.error}
              </p>
            )}

          </div>
        )}

        {/* =================================================
            COMPLETED
        ================================================= */}

        {item.status ===
          "done" &&
          item.outputUrl && (
            <div className="space-y-3 rounded-md border p-3">

              <div>

                <p className="text-sm font-medium">
                  ✓{" "}
                  {item.outputName}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Original{" "}
                  {fmtTime(
                    item.duration,
                  )}

                  {" · "}

                  Final{" "}
                  {fmtTime(
                    timing.finalDuration,
                  )}

                  {" · "}

                  Geotag{" "}
                  {durationPercent}%
                </p>

              </div>

              <video
                src={
                  item.outputUrl
                }
                controls
                className="w-full rounded-md bg-black"
              />

              <Button
                size="sm"
                onClick={() => {
                  if (
                    item.outputBlob &&
                    item.outputName
                  ) {
                    downloadBlob(
                      item.outputBlob,
                      item.outputName,
                    );
                  }
                }}
              >
                Download
              </Button>

            </div>
          )}

        {/* =================================================
            EDITOR
        ================================================= */}

        {open && (
          <div className="space-y-6 border-t pt-5">

            {/* =============================================
                VIDEO PREVIEW
            ============================================= */}

            <div>

              <Label className="mb-2 block text-base">
                Video Preview
              </Label>

              {/*
               * FULL VIDEO
               *
               * During crop editing:
               * show normal video.
               */}

              {cropEnabled ? (
                <div className="relative overflow-hidden rounded-lg bg-black">

                  <video
                    ref={
                      videoRef
                    }
                    src={
                      item.url
                    }
                    controls
                    preload="metadata"
                    className="block w-full"
                  />

                  {/* CROP SELECTOR */}

                  <CropSelector
                    videoWidth={
                      item.width
                    }
                    videoHeight={
                      item.height
                    }
                    crop={
                      crop
                    }
                    onChange={
                      updateCrop
                    }
                  />

                </div>
              ) : (
                /*
                 * FINISHED CROP PREVIEW
                 */

                <div
                  className="relative mx-auto overflow-hidden rounded-lg bg-black"
                  style={
                    cropPreviewStyle
                  }
                >

                  <video
                    ref={
                      videoRef
                    }
                    src={
                      item.url
                    }
                    controls
                    preload="metadata"
                    className={
                      isFullCrop(
                        crop,
                      )
                        ? "block w-full"
                        : "block"
                    }
                    style={
                      croppedVideoStyle
                    }
                  />

                  {/* =====================================
                      GEOTAG ON CROPPED PREVIEW
                  ===================================== */}

                  {overlayUrl &&
                    showOverlay && (
                      <img
                        src={
                          overlayUrl
                        }
                        alt="Geotag overlay"
                        className={`pointer-events-none absolute ${POS_CLASS[item.settings.position]}`}
                        style={{
                          width: `${widthPercent}%`,
                          height: `${heightPercent}%`,
                          objectFit:
                            "fill",
                          opacity:
                            item.settings
                              .opacity,
                        }}
                      />
                    )}

                </div>
              )}

              {!isFullCrop(
                crop,
              ) && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Preview shows only the
                  selected crop area.
                  The same crop will be
                  permanently applied to
                  the exported video.
                </p>
              )}

            </div>

            {/* =============================================
                CROP CONTROLS
            ============================================= */}

            <div className="space-y-4 rounded-lg border p-4">

              <div className="flex flex-wrap items-center justify-between gap-3">

                <div>

                  <Label className="text-base">
                    Video Crop
                  </Label>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Draw a rectangle over
                    the video. Only the
                    selected area will remain.
                  </p>

                </div>

                <div className="flex gap-2">

                  {!cropEnabled ? (
                    <Button
                      size="sm"
                      onClick={() =>
                        setCropEnabled(
                          true,
                        )
                      }
                    >
                      Crop Video
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={
                        finishCrop
                      }
                    >
                      Finish Crop
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={
                      resetCrop
                    }
                  >
                    Reset
                  </Button>

                </div>

              </div>

              {/* CROP VALUES */}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

                <div className="rounded-md bg-muted p-3">
                  <p className="text-xs text-muted-foreground">
                    X
                  </p>

                  <p className="font-medium">
                    {(
                      crop.x *
                      100
                    ).toFixed(
                      1,
                    )}
                    %
                  </p>
                </div>

                <div className="rounded-md bg-muted p-3">
                  <p className="text-xs text-muted-foreground">
                    Y
                  </p>

                  <p className="font-medium">
                    {(
                      crop.y *
                      100
                    ).toFixed(
                      1,
                    )}
                    %
                  </p>
                </div>

                <div className="rounded-md bg-muted p-3">
                  <p className="text-xs text-muted-foreground">
                    Width
                  </p>

                  <p className="font-medium">
                    {(
                      crop.width *
                      100
                    ).toFixed(
                      1,
                    )}
                    %
                  </p>
                </div>

                <div className="rounded-md bg-muted p-3">
                  <p className="text-xs text-muted-foreground">
                    Height
                  </p>

                  <p className="font-medium">
                    {(
                      crop.height *
                      100
                    ).toFixed(
                      1,
                    )}
                    %
                  </p>
                </div>

              </div>

              {cropEnabled && (
                <p className="text-xs text-muted-foreground">
                  Drag the white rectangle
                  to move it. Drag the
                  bottom-right handle to
                  resize it.
                </p>
              )}

              {!cropEnabled &&
                !isFullCrop(
                  crop,
                ) && (
                  <div className="rounded-md bg-muted p-3 text-sm">
                    <strong>
                      Crop active
                    </strong>

                    <p className="mt-1 text-xs text-muted-foreground">
                      The exported video
                      will contain only
                      this selected region.
                    </p>
                  </div>
                )}

            </div>

            {/* =============================================
                TRIM
            ============================================= */}

            <div className="space-y-4">

              <div>

                <Label className="text-base">
                  Video Trim
                </Label>

                <p className="text-xs text-muted-foreground">
                  Select the part of the
                  video you want to export.
                </p>

              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                <div className="space-y-2">

                  <Label>
                    Start (seconds)
                  </Label>

                  <Input
                    type="number"
                    min={0}
                    max={
                      item.duration
                    }
                    step={0.1}
                    value={
                      item.settings
                        .trimStart
                    }
                    onChange={(
                      event,
                    ) => {
                      const value =
                        Number(
                          event.target
                            .value,
                        );

                      if (
                        !Number.isFinite(
                          value,
                        )
                      ) {
                        return;
                      }

                      const safe =
                        Math.max(
                          0,
                          Math.min(
                            value,
                            item.settings
                              .trimEnd -
                              0.1,
                          ),
                        );

                      onUpdate(
                        item.id,
                        {
                          trimStart:
                            safe,
                        },
                      );
                    }}
                  />

                </div>

                <div className="space-y-2">

                  <Label>
                    End (seconds)
                  </Label>

                  <Input
                    type="number"
                    min={0}
                    max={
                      item.duration
                    }
                    step={0.1}
                    value={
                      item.settings
                        .trimEnd
                    }
                    onChange={(
                      event,
                    ) => {
                      const value =
                        Number(
                          event.target
                            .value,
                        );

                      if (
                        !Number.isFinite(
                          value,
                        )
                      ) {
                        return;
                      }

                      const safe =
                        Math.min(
                          item.duration,
                          Math.max(
                            value,
                            item.settings
                              .trimStart +
                              0.1,
                          ),
                        );

                      onUpdate(
                        item.id,
                        {
                          trimEnd:
                            safe,
                        },
                      );
                    }}
                  />

                </div>

              </div>

              <p className="text-sm text-muted-foreground">
                Final duration:{" "}
                <strong>
                  {fmtTime(
                    timing.finalDuration,
                  )}
                </strong>
              </p>

            </div>

            {/* =============================================
                GEOTAG DURATION
            ============================================= */}

            <div className="space-y-4 rounded-lg border p-4">

              <div className="flex items-center justify-between">

                <div>

                  <Label className="text-base">
                    Geotag Duration
                  </Label>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Percentage of final
                    video during which
                    geotag is displayed.
                  </p>

                </div>

                <span className="rounded-md bg-muted px-2 py-1 text-sm font-medium">
                  {durationPercent}%
                </span>

              </div>

              <div className="flex items-center gap-2">

                <Input
                  type="number"
                  min={1}
                  max={100}
                  step={0.1}
                  value={
                    durationPercent
                  }
                  onChange={(
                    event,
                  ) => {
                    const value =
                      Number(
                        event.target
                          .value,
                      );

                    if (
                      Number.isFinite(
                        value,
                      )
                    ) {
                      updateDuration(
                        value,
                      );
                    }
                  }}
                  className="w-32"
                />

                <span className="text-sm text-muted-foreground">
                  % of duration
                </span>

              </div>

              <Slider
                value={[
                  durationPercent,
                ]}
                min={1}
                max={100}
                step={0.1}
                onValueChange={(
                  values,
                ) => {
                  const value =
                    values[0];

                  if (
                    value !==
                    undefined
                  ) {
                    updateDuration(
                      value,
                    );
                  }
                }}
              />

              <p className="text-sm">
                Geotag visible for{" "}
                <strong>
                  {timing.geotagDuration.toFixed(
                    2,
                  )}{" "}
                  seconds
                </strong>
              </p>

            </div>

            {/* =============================================
                TIMING
            ============================================= */}

            <div className="space-y-3">

              <Label className="text-base">
                Geotag Timing
              </Label>

              <div className="flex gap-2">

                <Button
                  size="sm"
                  variant={
                    item.settings
                      .timing ===
                    "beginning"
                      ? "default"
                      : "outline"
                  }
                  onClick={() =>
                    onUpdate(
                      item.id,
                      {
                        timing:
                          "beginning",
                      },
                    )
                  }
                >
                  Beginning
                </Button>

                <Button
                  size="sm"
                  variant={
                    item.settings
                      .timing ===
                    "end"
                      ? "default"
                      : "outline"
                  }
                  onClick={() =>
                    onUpdate(
                      item.id,
                      {
                        timing:
                          "end",
                      },
                    )
                  }
                >
                  End
                </Button>

              </div>

            </div>

            {/* =============================================
                WIDTH
            ============================================= */}

            <div className="space-y-4 rounded-lg border p-4">

              <div className="flex items-center justify-between">

                <div>

                  <Label className="text-base">
                    Geotag Width
                  </Label>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Percentage of video
                    width.
                  </p>

                </div>

                <span className="rounded-md bg-muted px-2 py-1 text-sm font-medium">
                  {widthPercent.toFixed(
                    1,
                  )}
                  %
                </span>

              </div>

              <div className="flex items-center gap-2">

                <Input
                  type="number"
                  min={0.1}
                  max={100}
                  step={0.1}
                  value={
                    widthPercent
                  }
                  onChange={(
                    event,
                  ) => {
                    const value =
                      Number(
                        event.target
                          .value,
                      );

                    if (
                      Number.isFinite(
                        value,
                      )
                    ) {
                      updateWidth(
                        value,
                      );
                    }
                  }}
                  className="w-32"
                />

                <span className="text-sm text-muted-foreground">
                  % of video width
                </span>

              </div>

              <Slider
                value={[
                  widthPercent,
                ]}
                min={0.1}
                max={100}
                step={0.1}
                onValueChange={(
                  values,
                ) => {
                  const value =
                    values[0];

                  if (
                    value !==
                    undefined
                  ) {
                    updateWidth(
                      value,
                    );
                  }
                }}
              />

            </div>

            {/* =============================================
                HEIGHT
            ============================================= */}

            <div className="space-y-4 rounded-lg border p-4">

              <div className="flex items-center justify-between">

                <div>

                  <Label className="text-base">
                    Geotag Height
                  </Label>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Percentage of video
                    height.
                  </p>

                </div>

                <span className="rounded-md bg-muted px-2 py-1 text-sm font-medium">
                  {heightPercent.toFixed(
                    1,
                  )}
                  %
                </span>

              </div>

              <div className="flex items-center gap-2">

                <Input
                  type="number"
                  min={0.1}
                  max={100}
                  step={0.1}
                  value={
                    heightPercent
                  }
                  onChange={(
                    event,
                  ) => {
                    const value =
                      Number(
                        event.target
                          .value,
                      );

                    if (
                      Number.isFinite(
                        value,
                      )
                    ) {
                      updateHeight(
                        value,
                      );
                    }
                  }}
                  className="w-32"
                />

                <span className="text-sm text-muted-foreground">
                  % of video height
                </span>

              </div>

              <Slider
                value={[
                  heightPercent,
                ]}
                min={0.1}
                max={100}
                step={0.1}
                onValueChange={(
                  values,
                ) => {
                  const value =
                    values[0];

                  if (
                    value !==
                    undefined
                  ) {
                    updateHeight(
                      value,
                    );
                  }
                }}
              />

            </div>

            {/* =============================================
                POSITION
            ============================================= */}

            <div className="space-y-3">

              <Label className="text-base">
                Geotag Position
              </Label>

              <div className="flex flex-wrap gap-2">

                {POSITIONS.map(
                  (position) => (
                    <Button
                      key={
                        position.key
                      }
                      size="sm"
                      variant={
                        item.settings
                          .position ===
                        position.key
                          ? "default"
                          : "outline"
                      }
                      onClick={() =>
                        onUpdate(
                          item.id,
                          {
                            position:
                              position.key,
                          },
                        )
                      }
                    >
                      {
                        position.label
                      }
                    </Button>
                  ),
                )}

              </div>

            </div>

            {/* =============================================
                OPACITY
            ============================================= */}

            <div className="space-y-3">

              <div className="flex items-center justify-between">

                <Label>
                  Geotag Opacity
                </Label>

                <span className="text-sm font-medium">
                  {Math.round(
                    item.settings
                      .opacity *
                      100,
                  )}
                  %
                </span>

              </div>

              <Slider
                value={[
                  item.settings
                    .opacity *
                    100,
                ]}
                min={1}
                max={100}
                step={1}
                onValueChange={(
                  values,
                ) => {
                  const value =
                    values[0];

                  if (
                    value !==
                    undefined
                  ) {
                    onUpdate(
                      item.id,
                      {
                        opacity:
                          value /
                          100,
                      },
                    );
                  }
                }}
              />

            </div>

            {/* =============================================
                CURRENT SETTINGS
            ============================================= */}

            <div className="rounded-lg border bg-muted/30 p-4">

              <p className="mb-3 text-sm font-semibold">
                Current Settings
              </p>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">

                <div>
                  <p className="text-xs text-muted-foreground">
                    Duration
                  </p>

                  <p className="font-medium">
                    {durationPercent.toFixed(
                      1,
                    )}
                    %
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    Width
                  </p>

                  <p className="font-medium">
                    {widthPercent.toFixed(
                      1,
                    )}
                    %
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    Height
                  </p>

                  <p className="font-medium">
                    {heightPercent.toFixed(
                      1,
                    )}
                    %
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    Opacity
                  </p>

                  <p className="font-medium">
                    {Math.round(
                      item.settings
                        .opacity *
                        100,
                    )}
                    %
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    Crop
                  </p>

                  <p className="font-medium">
                    {isFullCrop(
                      crop,
                    )
                      ? "Full"
                      : `${(
                          crop.width *
                          100
                        ).toFixed(
                          0,
                        )}%`}
                  </p>
                </div>

              </div>

            </div>

            {/* =============================================
                APPLY ALL
            ============================================= */}

            <Button
              variant="secondary"
              className="w-full"
              onClick={() =>
                onApplyToAll(
                  item.id,
                )
              }
            >
              Apply Current Settings
              to All Videos
            </Button>

          </div>
        )}

      </CardContent>
    </Card>
  );
}
