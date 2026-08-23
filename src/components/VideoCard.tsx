import { useRef, useState, useEffect } from "react";

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

const DURATION_PERCENTS = [
  20,
  30,
  40,
  50,
  60,
  75,
  100,
];

const WIDTH_PERCENTS = [
  25,
  50,
  75,
  90,
  100,
];

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

const POS_CLASS: Record<
  OverlayPosition,
  string
> = {
  "top-left":
    "left-[3%] top-[4%]",

  "top-right":
    "right-[3%] top-[4%]",

  "bottom-left":
    "left-[3%] bottom-[4%]",

  "bottom-right":
    "right-[3%] bottom-[4%]",

  "bottom-center":
    "left-1/2 -translate-x-1/2 bottom-0",
};

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

export function VideoCard({
  item,
  overlayUrl,
  index,
  onUpdate,
  onRemove,
  onApplyToAll,
}: Props) {
  const [open, setOpen] =
    useState(index === 0);

  const [showOverlay, setShowOverlay] =
    useState(true);

  const videoRef =
    useRef<HTMLVideoElement>(null);

  const t = computeTiming(item);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) return;

    const onTime = () => {
      const relativeTime =
        video.currentTime - t.start;

      setShowOverlay(
        relativeTime >= t.overlayStart &&
          relativeTime <= t.overlayEnd,
      );

      if (video.currentTime > t.end) {
        video.currentTime = t.start;
      }
    };

    video.addEventListener(
      "timeupdate",
      onTime,
    );

    return () => {
      video.removeEventListener(
        "timeupdate",
        onTime,
      );
    };
  }, [
    t.start,
    t.end,
    t.overlayStart,
    t.overlayEnd,
  ]);

  /*
   * scale is stored as a fraction:
   *
   * 0.25 = 25%
   * 0.50 = 50%
   * 0.75 = 75%
   * 1.00 = 100%
   */
  const widthPercent =
    Math.round(
      item.settings.scale * 100,
    );

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">
              {item.name}
            </p>

            <p className="text-sm text-muted-foreground">
              {fmtTime(item.duration)}
              {" · "}
              {item.width} × {item.height}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setOpen((o) => !o)
              }
            >
              {open ? "Close" : "Edit"}
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

        {/* Processing */}
        {item.status ===
          "processing" && (
          <div className="space-y-1">
            <Progress
              value={item.progress}
            />

            <p className="text-xs text-muted-foreground">
              Processing…{" "}
              {item.progress}%
            </p>
          </div>
        )}

        {/* Error */}
        {item.status === "error" && (
          <p className="text-sm text-destructive">
            {item.error}
          </p>
        )}

        {/* Finished */}
        {item.status === "done" &&
          item.outputUrl && (
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-sm font-medium">
                ✓ {item.outputName}
              </p>

              <p className="text-xs text-muted-foreground">
                Original{" "}
                {fmtTime(item.duration)}
                {" · "}
                Final{" "}
                {fmtTime(
                  t.finalDuration,
                )}
                {" · "}
                Geotag Duration{" "}
                {item.settings.percent}%
                {" · "}
                Geotag Width{" "}
                {widthPercent}%
              </p>

              <video
                src={item.outputUrl}
                controls
                className="w-full rounded-md"
              />

              <Button
                size="sm"
                onClick={() =>
                  item.outputBlob &&
                  downloadBlob(
                    item.outputBlob,
                    item.outputName!,
                  )
                }
              >
                Download
              </Button>
            </div>
          )}

        {open && (
          <div className="space-y-4 border-t pt-4">

            {/* VIDEO PREVIEW */}
            <div className="relative overflow-hidden rounded-md bg-black">
              <video
                ref={videoRef}
                src={item.url}
                controls
                className="block w-full"
              />

              {overlayUrl &&
                showOverlay && (
                  <img
                    src={overlayUrl}
                    alt="Geotag overlay preview"
                    className={`pointer-events-none absolute ${POS_CLASS[item.settings.position]}`}
                    style={{
                      width: `${widthPercent}%`,
                      height: "auto",
                      opacity:
                        item.settings.opacity,
                    }}
                  />
                )}
            </div>

            {/* TRIM */}
            <div className="grid grid-cols-2 gap-4">

              <div className="space-y-2">
                <Label>
                  Start (s)
                </Label>

                <Input
                  type="number"
                  min={0}
                  max={item.duration}
                  step={0.1}
                  value={
                    item.settings
                      .trimStart
                  }
                  onChange={(e) =>
                    onUpdate(
                      item.id,
                      {
                        trimStart:
                          Number(
                            e.target
                              .value,
                          ),
                      },
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>
                  End (s)
                </Label>

                <Input
                  type="number"
                  min={0}
                  max={item.duration}
                  step={0.1}
                  value={
                    item.settings
                      .trimEnd
                  }
                  onChange={(e) =>
                    onUpdate(
                      item.id,
                      {
                        trimEnd:
                          Number(
                            e.target
                              .value,
                          ),
                      },
                    )
                  }
                />
              </div>

            </div>

            <p className="text-sm text-muted-foreground">
              Original{" "}
              {fmtTime(item.duration)}
              {" → "}
              Final{" "}
              {fmtTime(
                t.finalDuration,
              )}
            </p>

            {/* GEOTAG DURATION */}
            <div className="space-y-2">

              <Label>
                Geotag Duration
              </Label>

              <div className="flex flex-wrap gap-2">

                {DURATION_PERCENTS.map(
                  (p) => (
                    <Button
                      key={p}
                      size="sm"
                      variant={
                        item.settings
                          .percent === p
                          ? "default"
                          : "outline"
                      }
                      onClick={() =>
                        onUpdate(
                          item.id,
                          {
                            percent: p,
                          },
                        )
                      }
                    >
                      {p}%
                    </Button>
                  ),
                )}

              </div>

              <Slider
                value={[
                  item.settings.percent,
                ]}
                min={5}
                max={100}
                step={1}
                onValueChange={([
                  value,
                ]) =>
                  onUpdate(
                    item.id,
                    {
                      percent:
                        value ??
                        item.settings
                          .percent,
                    },
                  )
                }
              />

              <p className="text-sm">
                Geotag will appear for{" "}
                <strong>
                  {t.geotagDuration.toFixed(
                    1,
                  )}{" "}
                  seconds
                </strong>{" "}
                of this video.
              </p>

            </div>

            {/* TIMING */}
            <div className="space-y-2">

              <Label>
                Timing
              </Label>

              <div className="flex gap-2">

                {(
                  [
                    "beginning",
                    "end",
                  ] as const
                ).map((tm) => (
                  <Button
                    key={tm}
                    size="sm"
                    variant={
                      item.settings
                        .timing === tm
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      onUpdate(
                        item.id,
                        {
                          timing: tm,
                        },
                      )
                    }
                  >
                    {tm ===
                    "beginning"
                      ? "Beginning"
                      : "End"}
                  </Button>
                ))}

              </div>

            </div>

            {/* POSITION */}
            <div className="space-y-2">

              <Label>
                Geotag Position
              </Label>

              <div className="flex flex-wrap gap-2">

                {POSITIONS.map(
                  (p) => (
                    <Button
                      key={p.key}
                      size="sm"
                      variant={
                        item.settings
                          .position ===
                        p.key
                          ? "default"
                          : "outline"
                      }
                      onClick={() =>
                        onUpdate(
                          item.id,
                          {
                            position:
                              p.key,
                          },
                        )
                      }
                    >
                      {p.label}
                    </Button>
                  ),
                )}

              </div>

            </div>

            {/* GEOTAG WIDTH */}
            <div className="space-y-4 rounded-lg border p-4">

              <div>
                <Label className="text-base">
                  Geotag Width
                </Label>

                <p className="text-xs text-muted-foreground">
                  Controls how much of the
                  video's width the geotag
                  covers. Height is calculated
                  automatically to preserve the
                  geotag's proportions.
                </p>
              </div>

              {/* QUICK WIDTH BUTTONS */}
              <div className="flex flex-wrap gap-2">

                {WIDTH_PERCENTS.map(
                  (p) => (
                    <Button
                      key={p}
                      size="sm"
                      variant={
                        widthPercent === p
                          ? "default"
                          : "outline"
                      }
                      onClick={() =>
                        onUpdate(
                          item.id,
                          {
                            scale:
                              p / 100,
                          },
                        )
                      }
                    >
                      {p}%
                    </Button>
                  ),
                )}

              </div>

              {/* WIDTH SLIDER */}
              <div className="space-y-2">

                <div className="flex justify-between">

                  <Label>
                    Width
                  </Label>

                  <span className="text-sm font-medium">
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
                  onValueChange={([
                    value,
                  ]) =>
                    onUpdate(
                      item.id,
                      {
                        scale:
                          (value ??
                            widthPercent) /
                          100,
                      },
                    )
                  }
                />

              </div>

              {/* EXACT WIDTH INPUT */}
              <div className="space-y-2">

                <Label>
                  Enter Width (%)
                </Label>

                <div className="flex gap-2">

                  <Input
                    type="number"
                    min={10}
                    max={100}
                    step={1}
                    value={widthPercent}
                    onChange={(e) => {
                      const value =
                        Number(
                          e.target
                            .value,
                        );

                      if (
                        !Number.isFinite(
                          value,
                        )
                      ) {
                        return;
                      }

                      const clamped =
                        Math.min(
                          100,
                          Math.max(
                            10,
                            value,
                          ),
                        );

                      onUpdate(
                        item.id,
                        {
                          scale:
                            clamped /
                            100,
                        },
                      );
                    }}
                  />

                  <span className="flex items-center text-sm text-muted-foreground">
                    %
                  </span>

                </div>

              </div>

              {/* 100% INFORMATION */}
              {widthPercent ===
                100 && (
                <div className="rounded-md bg-muted p-3 text-sm">
                  <strong>
                    Full Width
                  </strong>

                  <p className="text-xs text-muted-foreground">
                    The geotag will cover the
                    complete width of the
                    video. Its height will
                    automatically maintain its
                    original aspect ratio.
                  </p>
                </div>
              )}

            </div>

            {/* OPACITY */}
            <div className="space-y-2">

              <Label>
                Opacity (
                {Math.round(
                  item.settings
                    .opacity * 100,
                )}
                %)
              </Label>

              <Slider
                value={[
                  item.settings
                    .opacity * 100,
                ]}
                min={20}
                max={100}
                step={1}
                onValueChange={([
                  value,
                ]) =>
                  onUpdate(
                    item.id,
                    {
                      opacity:
                        (value ??
                          item.settings
                            .opacity *
                            100) /
                        100,
                    },
                  )
                }
              />

            </div>

            {/* APPLY TO ALL */}
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                onApplyToAll(item.id)
              }
            >
              Apply Current Settings to
              All Videos
            </Button>

          </div>
        )}

      </CardContent>
    </Card>
  );
}
