import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";

import { computeTiming } from "@/lib/videoProcessor";
import { downloadBlob } from "@/lib/videoUtils";

import type { OverlayPosition } from "@/types/geotag";
import {
  fmtTime,
  type VideoItem,
  type VideoSettings,
} from "@/types/video";

interface Props {
  item: VideoItem;
  overlayUrl: string | null;
  index: number;

  onUpdate: (
    id: string,
    patch: Partial<VideoSettings>,
  ) => void;

  onRemove: (id: string) => void;

  onApplyToAll: (id: string) => void;
}

/*
 * Available position buttons.
 */
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

/*
 * Position classes for the preview.
 */
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

export function VideoCard({
  item,
  overlayUrl,
  index,
  onUpdate,
  onRemove,
  onApplyToAll,
}: Props) {
  /*
   * First video is open by default.
   */
  const [open, setOpen] =
    useState(index === 0);

  /*
   * Controls whether the preview geotag
   * is currently visible.
   */
  const [showOverlay, setShowOverlay] =
    useState(true);

  /*
   * Video reference.
   */
  const videoRef =
    useRef<HTMLVideoElement>(null);

  /*
   * Calculate timing information.
   *
   * percent controls duration only.
   */
  const timing =
    computeTiming(item);

  /*
   * Percentage values used in UI.
   */
  const widthPercent = Math.round(
    item.settings.scale * 100,
  );

  const heightPercent = Math.round(
    item.settings.heightScale * 100,
  );

  /*
   * Keep preview geotag synchronized
   * with the video playback.
   */
  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const handleTimeUpdate =
      () => {
        const current =
          video.currentTime;

        /*
         * Stop playback at the selected
         * trim end.
         */
        if (
          current >=
          timing.end
        ) {
          video.pause();

          video.currentTime =
            timing.start;
        }

        /*
         * Current time relative to
         * trimmed video.
         */
        const relativeTime =
          current -
          timing.start;

        /*
         * Show geotag only during the
         * selected duration percentage.
         */
        const visible =
          relativeTime >=
            timing.overlayStart &&
          relativeTime <=
            timing.overlayEnd;

        setShowOverlay(visible);
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

  /*
   * Update width safely.
   */
  const updateWidth = (
    value: number,
  ) => {
    const clamped =
      Math.min(
        100,
        Math.max(10, value),
      );

    onUpdate(item.id, {
      scale: clamped / 100,
    });
  };

  /*
   * Update height safely.
   */
  const updateHeight = (
    value: number,
  ) => {
    const clamped =
      Math.min(
        100,
        Math.max(5, value),
      );

    onUpdate(item.id, {
      heightScale:
        clamped / 100,
    });
  };

  /*
   * Update duration percentage safely.
   */
  const updateDurationPercent = (
    value: number,
  ) => {
    const clamped =
      Math.min(
        100,
        Math.max(1, value),
      );

    onUpdate(item.id, {
      percent: clamped,
    });
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 pt-6">

        {/* ================================================== */}
        {/* HEADER */}
        {/* ================================================== */}

        <div className="flex flex-wrap items-center justify-between gap-3">

          <div className="min-w-0">
            <p className="truncate font-medium">
              {item.name}
            </p>

            <p className="text-sm text-muted-foreground">
              {fmtTime(item.duration)}
              {" · "}
              {item.width} ×{" "}
              {item.height}
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
                onRemove(item.id)
              }
            >
              Remove
            </Button>

          </div>
        </div>

        {/* ================================================== */}
        {/* PROCESSING */}
        {/* ================================================== */}

        {item.status ===
          "processing" && (
          <div className="space-y-2">

            <Progress
              value={
                item.progress
              }
            />

            <p className="text-xs text-muted-foreground">
              Processing…{" "}
              {item.progress}%
            </p>

          </div>
        )}

        {/* ================================================== */}
        {/* ERROR */}
        {/* ================================================== */}

        {item.status === "error" && (
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

        {/* ================================================== */}
        {/* COMPLETED VIDEO */}
        {/* ================================================== */}

        {item.status === "done" &&
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
                        "geotagged-video.mp4",
                    );
                  }
                }}
              >
                Download
              </Button>

            </div>
          )}

        {/* ================================================== */}
        {/* EDITOR */}
        {/* ================================================== */}

        {open && (
          <div className="space-y-6 border-t pt-5">

            {/* ================================================== */}
            {/* VIDEO PREVIEW */}
            {/* ================================================== */}

            <div className="relative overflow-hidden rounded-lg bg-black">

              <video
                ref={videoRef}
                src={item.url}
                controls
                preload="metadata"
                className="block w-full"
              />

              {/* GEOTAG PREVIEW */}

              {overlayUrl &&
                showOverlay && (
                  <img
                    src={
                      overlayUrl
                    }
                    alt="Geotag overlay preview"
                    className={`pointer-events-none absolute ${POS_CLASS[item.settings.position]}`}
                    style={{
                      /*
                       * WIDTH is controlled
                       * independently.
                       */
                      width: `${widthPercent}%`,

                      /*
                       * HEIGHT is controlled
                       * independently.
                       */
                      height: `${heightPercent}%`,

                      /*
                       * Do NOT automatically
                       * preserve aspect ratio.
                       *
                       * User controls both.
                       */
                      objectFit:
                        "fill",

                      opacity:
                        item.settings
                          .opacity,
                    }}
                  />
                )}

            </div>

            {/* ================================================== */}
            {/* TRIM SETTINGS */}
            {/* ================================================== */}

            <div className="space-y-3">

              <div>
                <Label className="text-base">
                  Video Trim
                </Label>

                <p className="text-xs text-muted-foreground">
                  Select the portion of
                  the video to export.
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
                    onChange={(
                      event,
                    ) => {
                      const value =
                        Number(
                          event.target
                            .value,
                        );

                      const end =
                        item.settings
                          .trimEnd;

                      onUpdate(
                        item.id,
                        {
                          trimStart:
                            Math.max(
                              0,
                              Math.min(
                                value,
                                end -
                                  0.1,
                              ),
                            ),
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
                    onChange={(
                      event,
                    ) => {
                      const value =
                        Number(
                          event.target
                            .value,
                        );

                      const start =
                        item.settings
                          .trimStart;

                      onUpdate(
                        item.id,
                        {
                          trimEnd:
                            Math.min(
                              item.duration,
                              Math.max(
                                value,
                                start +
                                  0.1,
                              ),
                            ),
                        },
                      );
                    }}
                  />
                </div>

              </div>

              <p className="text-sm text-muted-foreground">
                Final video duration:{" "}
                <strong>
                  {fmtTime(
                    timing.finalDuration,
                  )}
                </strong>
              </p>

            </div>

            {/* ================================================== */}
            {/* GEOTAG DURATION */}
            {/* ================================================== */}

            <div className="space-y-4 rounded-lg border p-4">

              <div>
                <div className="flex items-center justify-between gap-3">

                  <Label className="text-base">
                    Geotag Duration
                  </Label>

                  <span className="rounded-md bg-muted px-2 py-1 text-sm font-medium">
                    {
                      item.settings
                        .percent
                    }%
                  </span>

                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  Percentage of the final
                  video duration during which
                  the geotag is visible.
                </p>
              </div>

              {/* QUICK BUTTONS */}

              <div className="flex flex-wrap gap-2">

                {[
                  10,
                  20,
                  30,
                  40,
                  50,
                  75,
                  100,
                ].map(
                  (value) => (
                    <Button
                      key={value}
                      size="sm"
                      variant={
                        item.settings
                          .percent ===
                        value
                          ? "default"
                          : "outline"
                      }
                      onClick={() =>
                        updateDurationPercent(
                          value,
                        )
                      }
                    >
                      {value}%
                    </Button>
                  ),
                )}

              </div>

              {/* SLIDER */}

              <Slider
                value={[
                  item.settings
                    .percent,
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
                    updateDurationPercent(
                      value,
                    );
                  }
                }}
              />

              <p className="text-sm">
                Geotag visible for{" "}
                <strong>
                  {timing.geotagDuration.toFixed(
                    1,
                  )}{" "}
                  seconds
                </strong>
              </p>

            </div>

            {/* ================================================== */}
            {/* TIMING */}
            {/* ================================================== */}

            <div className="space-y-3">

              <div>
                <Label className="text-base">
                  Geotag Timing
                </Label>

                <p className="text-xs text-muted-foreground">
                  Choose when the geotag
                  appears.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">

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

            {/* ================================================== */}
            {/* GEOTAG SIZE */}
            {/* ================================================== */}

            <div className="space-y-6 rounded-lg border p-4">

              <div>
                <Label className="text-base">
                  Geotag Size
                </Label>

                <p className="mt-1 text-xs text-muted-foreground">
                  Width and height are
                  controlled independently.
                </p>
              </div>

              {/* ================================================== */}
              {/* WIDTH */}
              {/* ================================================== */}

              <div className="space-y-3">

                <div className="flex items-center justify-between">

                  <Label>
                    Geotag Width
                  </Label>

                  <span className="rounded-md bg-muted px-2 py-1 text-sm font-medium">
                    {widthPercent}%
                  </span>

                </div>

                <Slider
                  value={[
                    widthPercent,
                  ]}
                  min={10}
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
                      updateWidth(
                        value,
                      );
                    }
                  }}
                />

                {/* QUICK WIDTH */}

                <div className="flex flex-wrap gap-2">

                  {[
                    25,
                    50,
                    75,
                    90,
                    100,
                  ].map(
                    (value) => (
                      <Button
                        key={value}
                        size="sm"
                        variant={
                          widthPercent ===
                          value
                            ? "default"
                            : "outline"
                        }
                        onClick={() =>
                          updateWidth(
                            value,
                          )
                        }
                      >
                        {value}%
                      </Button>
                    ),
                  )}

                </div>

              </div>

              {/* ================================================== */}
              {/* HEIGHT */}
              {/* ================================================== */}

              <div className="space-y-3">

                <div className="flex items-center justify-between">

                  <Label>
                    Geotag Height
                  </Label>

                  <span className="rounded-md bg-muted px-2 py-1 text-sm font-medium">
                    {heightPercent}%
                  </span>

                </div>

                <Slider
                  value={[
                    heightPercent,
                  ]}
                  min={5}
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
                      updateHeight(
                        value,
                      );
                    }
                  }}
                />

                {/* QUICK HEIGHT */}

                <div className="flex flex-wrap gap-2">

                  {[
                    10,
                    15,
                    20,
                    25,
                    30,
                    40,
                    50,
                    75,
                    100,
                  ].map(
                    (value) => (
                      <Button
                        key={value}
                        size="sm"
                        variant={
                          heightPercent ===
                          value
                            ? "default"
                            : "outline"
                        }
                        onClick={() =>
                          updateHeight(
                            value,
                          )
                        }
                      >
                        {value}%
                      </Button>
                    ),
                  )}

                </div>

              </div>

              {/* ================================================== */}
              {/* SIZE SUMMARY */}
              {/* ================================================== */}

              <div className="rounded-md bg-muted p-3">

                <p className="text-sm font-medium">
                  Current Geotag Size
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Width:{" "}
                  <strong>
                    {widthPercent}%
                  </strong>
                  {" · "}
                  Height:{" "}
                  <strong>
                    {heightPercent}%
                  </strong>
                </p>

                <p className="mt-2 text-xs text-muted-foreground">
                  The exported geotag will
                  use exactly these width and
                  height percentages relative
                  to the video.
                </p>

              </div>

            </div>

            {/* ================================================== */}
            {/* POSITION */}
            {/* ================================================== */}

            <div className="space-y-3">

              <div>
                <Label className="text-base">
                  Geotag Position
                </Label>

                <p className="text-xs text-muted-foreground">
                  Choose where the geotag is
                  placed on the video.
                </p>
              </div>

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

            {/* ================================================== */}
            {/* OPACITY */}
            {/* ================================================== */}

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
                min={10}
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

            {/* ================================================== */}
            {/* SETTINGS SUMMARY */}
            {/* ================================================== */}

            <div className="rounded-lg border bg-muted/30 p-4">

              <p className="mb-3 text-sm font-semibold">
                Geotag Settings
              </p>

              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">

                <div>
                  <p className="text-xs text-muted-foreground">
                    Duration
                  </p>

                  <p className="font-medium">
                    {
                      item.settings
                        .percent
                    }%
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    Width
                  </p>

                  <p className="font-medium">
                    {widthPercent}%
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    Height
                  </p>

                  <p className="font-medium">
                    {heightPercent}%
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">
                    Position
                  </p>

                  <p className="font-medium">
                    {
                      POSITIONS.find(
                        (p) =>
                          p.key ===
                          item
                            .settings
                            .position,
                      )?.label ??
                      item.settings
                        .position
                    }
                  </p>
                </div>

              </div>

            </div>

            {/* ================================================== */}
            {/* APPLY TO ALL */}
            {/* ================================================== */}

            <Button
              className="w-full sm:w-auto"
              variant="secondary"
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
