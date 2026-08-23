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
import { fmtTime, type VideoItem, type VideoSettings } from "@/types/video";

const PERCENTS = [20, 30, 40, 50, 60, 75, 100];
const POSITIONS: { key: OverlayPosition; label: string }[] = [
  { key: "top-left", label: "Top Left" },
  { key: "top-right", label: "Top Right" },
  { key: "bottom-left", label: "Bottom Left" },
  { key: "bottom-right", label: "Bottom Right" },
  { key: "bottom-center", label: "Bottom Center" },
];

const POS_CLASS: Record<OverlayPosition, string> = {
  "top-left": "left-[3%] top-[4%]",
  "top-right": "right-[3%] top-[4%]",
  "bottom-left": "left-[3%] bottom-[4%]",
  "bottom-right": "right-[3%] bottom-[4%]",
  "bottom-center": "left-1/2 -translate-x-1/2 bottom-[4%]",
};

interface Props {
  item: VideoItem;
  overlayUrl: string | null;
  index: number;
  onUpdate: (id: string, patch: Partial<VideoSettings>) => void;
  onRemove: (id: string) => void;
  onApplyToAll: (id: string) => void;
}

export function VideoCard({ item, overlayUrl, index, onUpdate, onRemove, onApplyToAll }: Props) {
  const [open, setOpen] = useState(index === 0);
  const [showOverlay, setShowOverlay] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const t = computeTiming(item);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      const rel = v.currentTime - t.start;
      setShowOverlay(rel >= t.overlayStart && rel <= t.overlayEnd);
      if (v.currentTime > t.end) v.currentTime = t.start;
    };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, [t.start, t.end, t.overlayStart, t.overlayEnd]);

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">{item.name}</p>
            <p className="text-sm text-muted-foreground">
              {fmtTime(item.duration)} · {item.width} × {item.height}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>
              {open ? "Close" : "Edit"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => onRemove(item.id)}>
              Remove
            </Button>
          </div>
        </div>

        {item.status === "processing" && (
          <div className="space-y-1">
            <Progress value={item.progress} />
            <p className="text-xs text-muted-foreground">Processing… {item.progress}%</p>
          </div>
        )}
        {item.status === "error" && <p className="text-sm text-destructive">{item.error}</p>}
        {item.status === "done" && item.outputUrl && (
          <div className="space-y-2 rounded-md border p-3">
            <p className="text-sm font-medium">✓ {item.outputName}</p>
            <p className="text-xs text-muted-foreground">
              Original {fmtTime(item.duration)} · Final {fmtTime(t.finalDuration)} · Geotag {item.settings.percent}%
            </p>
            <video src={item.outputUrl} controls className="w-full rounded-md" />
            <Button
              size="sm"
              onClick={() => item.outputBlob && downloadBlob(item.outputBlob, item.outputName!)}
            >
              Download
            </Button>
          </div>
        )}

        {open && (
          <div className="space-y-4 border-t pt-4">
            <div className="relative overflow-hidden rounded-md bg-black">
              <video ref={videoRef} src={item.url} controls className="w-full" />
              {overlayUrl && showOverlay && (
                <img
                  src={overlayUrl}
                  alt="Geotag overlay preview"
                  className={`pointer-events-none absolute ${POS_CLASS[item.settings.position]}`}
                  style={{ width: `${item.settings.scale * 100}%`, opacity: item.settings.opacity }}
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start (s)</Label>
                <Input
                  type="number"
                  min={0}
                  max={item.duration}
                  step={0.1}
                  value={item.settings.trimStart}
                  onChange={(e) => onUpdate(item.id, { trimStart: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>End (s)</Label>
                <Input
                  type="number"
                  min={0}
                  max={item.duration}
                  step={0.1}
                  value={item.settings.trimEnd}
                  onChange={(e) => onUpdate(item.id, { trimEnd: Number(e.target.value) })}
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Original {fmtTime(item.duration)} → Final {fmtTime(t.finalDuration)}
            </p>

            <div className="space-y-2">
              <Label>Geotag Duration</Label>
              <div className="flex flex-wrap gap-2">
                {PERCENTS.map((p) => (
                  <Button
                    key={p}
                    size="sm"
                    variant={item.settings.percent === p ? "default" : "outline"}
                    onClick={() => onUpdate(item.id, { percent: p })}
                  >
                    {p}%
                  </Button>
                ))}
              </div>
              <Slider
                value={[item.settings.percent]}
                min={5}
                max={100}
                step={1}
                onValueChange={([v]) =>
                  onUpdate(item.id, { percent: v ?? item.settings.percent })
                }
              />
              <p className="text-sm">
                Geotag will appear for <strong>{t.geotagDuration.toFixed(1)} seconds</strong> of this video (
                {fmtTime(t.overlayStart)} → {fmtTime(t.overlayEnd)}).
              </p>
            </div>

            <div className="space-y-2">
              <Label>Timing</Label>
              <div className="flex gap-2">
                {(["beginning", "end"] as const).map((tm) => (
                  <Button
                    key={tm}
                    size="sm"
                    variant={item.settings.timing === tm ? "default" : "outline"}
                    onClick={() => onUpdate(item.id, { timing: tm })}
                  >
                    {tm === "beginning" ? "Beginning" : "End"}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Position</Label>
              <div className="flex flex-wrap gap-2">
                {POSITIONS.map((p) => (
                  <Button
                    key={p.key}
                    size="sm"
                    variant={item.settings.position === p.key ? "default" : "outline"}
                    onClick={() => onUpdate(item.id, { position: p.key })}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Size ({Math.round(item.settings.scale * 100)}%)</Label>
                <Slider
                  value={[item.settings.scale * 100]}
                  min={30}
                  max={100}
                  step={1}
                  onValueChange={([v]) =>
                    onUpdate(item.id, { scale: (v ?? item.settings.scale * 100) / 100 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Opacity ({Math.round(item.settings.opacity * 100)}%)</Label>
                <Slider
                  value={[item.settings.opacity * 100]}
                  min={20}
                  max={100}
                  step={1}
                  onValueChange={([v]) =>
                    onUpdate(item.id, { opacity: (v ?? item.settings.opacity * 100) / 100 })
                  }
                />
              </div>
            </div>

            <Button size="sm" variant="secondary" onClick={() => onApplyToAll(item.id)}>
              Apply Current Settings to All Videos
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
