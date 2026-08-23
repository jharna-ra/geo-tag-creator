import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Button,
} from "@/components/ui/button";

import {
  Card,
  CardContent,
} from "@/components/ui/card";

import {
  Input,
} from "@/components/ui/input";

import {
  Label,
} from "@/components/ui/label";

import {
  Progress,
} from "@/components/ui/progress";

import {
  Slider,
} from "@/components/ui/slider";

import {
  CropSelector,
} from "@/components/CropSelector";

import {
  computeTiming,
} from "@/lib/videoProcessor";

import {
  DEFAULT_CROP,
} from "@/lib/crop";

import {
  downloadBlob,
} from "@/lib/videoUtils";

import type {
  OverlayPosition,
} from "@/types/geotag";

import {
  fmtTime,
  type VideoItem,
  type VideoSettings,
} from "@/types/video";

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
  const [
    open,
    setOpen,
  ] = useState(
    index === 0,
  );

  const videoRef =
    useRef<HTMLVideoElement>(
      null,
    );

  const [
    showOverlay,
    setShowOverlay,
  ] = useState(true);

  const [
    cropEnabled,
    setCropEnabled,
  ] = useState(false);

  /* =======================================================
     TIMING
  ======================================================= */

  const timing =
    computeTiming(item);

  /* =======================================================
     CROP
  ======================================================= */

  const crop =
    item.settings.crop ??
    DEFAULT_CROP;

  /* =======================================================
     PERCENTAGES
  ======================================================= */

  const widthPercent =
    item.settings.scale *
    100;

  const heightPercent =
    item.settings.heightScale *
    100;

  const durationPercent =
    item.settings.percent;

  /* =======================================================
     VIDEO PLAYBACK
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

          return;
        }

        /*
         * Time relative to trimmed
         * video.
         */

        const relative =
          current -
          timing.start;

        /*
         * Show geotag only during
         * selected timing.
         */

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
        percent:
          safe,
      },
    );
  };

  /* =======================================================
     CROP
  ======================================================= */

  const updateCrop = (
    newCrop: typeof crop,
  ) => {
    onUpdate(
      item.id,
      {
        crop: newCrop,
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
          ...DEFAULT_CROP,
        },
      },
    );
  };

  /* =======================================================
     RETURN
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
            </p>

          </div>

          <div className="flex gap-2">

            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setOpen(
                  value =>
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
                  item.outputBlob
                ) {
                  downloadBlob(
                    item.outputBlob,
                    item.outputName ??
                      item.name,
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

              <div className="relative overflow-hidden rounded-lg bg-black">

                <video
                  ref={videoRef}
                  src={item.url}
                  controls
                  preload="metadata"
                  className="block w-full"
                />

                {/* CROP */}
                {cropEnabled && (
                  <CropSelector
                    videoWidth={
                      item.width
                    }
                    videoHeight={
                      item.height
                    }
                    crop={crop}
                    onChange={
                      updateCrop
                    }
                  />
                )}

                {/* GEOTAG */}
                {!cropEnabled &&
                  overlayUrl &&
                  showOverlay && (
                  <img
                    src={
                      overlayUrl
                    }
                    alt="Geotag overlay"
                    className={`pointer-events-none absolute ${POS_CLASS[item.settings.position]}`}
                    style={{
                      width:
                        `${widthPercent}%`,

                      height:
                        `${heightPercent}%`,

                      objectFit:
                        "fill",

                      opacity:
                        item.settings
                          .opacity,
                    }}
                  />
                )}

              </div>
            </div>

            {/* =============================================
                CROP
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
                    selected area will
                    remain in the final
                    video.
                  </p>

                </div>

                <div className="flex gap-2">

                  <Button
                    size="sm"
                    variant={
                      cropEnabled
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      setCropEnabled(
                        value =>
                          !value,
                      )
                    }
                  >
                    {cropEnabled
                      ? "Finish Crop"
                      : "Crop Video"}
                  </Button>

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

              {/* CROP INFO */}

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
                  Drag inside the rectangle
                  to move it. Drag any
                  white handle to resize it.
                </p>
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

                {/* START */}

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
                    onChange={event => {

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

                {/* END */}

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
                    onChange={event => {

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
                    Percentage of the final
                    video during which the
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
                  onChange={event => {

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
                onValueChange={
                  values => {
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
                  }
                }
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
                  onChange={event => {

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
                onValueChange={
                  values => {

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
                  }
                }
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
                  onChange={event => {

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
                onValueChange={
                  values => {

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
                  }
                }
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
                  position => (
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
                onValueChange={
                  values => {

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
                  }
                }
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
                    {Math.round(
                      crop.width *
                        100,
                    )}
                    %
                  </p>
                </div>

              </div>

            </div>

            {/* =============================================
                APPLY TO ALL
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
