import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { renderGeotag } from "@/lib/geotagRenderer";
import type { GeotagData, GeotagOptions } from "@/types/geotag";

interface Props {
  data: GeotagData;
  options: GeotagOptions;
  onOptions: (patch: Partial<GeotagOptions>) => void;
}

const TOGGLES: { key: keyof GeotagOptions; label: string }[] = [
  { key: "showAddress", label: "Show Address" },
  { key: "showCoordinates", label: "Show Coordinates" },
  { key: "showDate", label: "Show Date" },
  { key: "showTime", label: "Show Time" },
  { key: "showAltitude", label: "Show Altitude" },
  { key: "showAccuracy", label: "Show Accuracy" },
];

export function GeotagPreview({ data, options, onOptions }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    renderGeotag(data, options, 1200)
      .then(({ canvas }) => {
        if (cancelled || !holder.current) return;
        canvas.className = "w-full h-auto rounded-xl";
        holder.current.replaceChildren(canvas);
      })
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
  }, [data, options]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Geotag Preview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div ref={holder} className="min-h-24 w-full" />
        {busy && <p className="text-xs text-muted-foreground">Rendering map…</p>}

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={options.mapType === "satellite" ? "default" : "outline"}
            onClick={() => onOptions({ mapType: "satellite" })}
          >
            Satellite
          </Button>
          <Button
            size="sm"
            variant={options.mapType === "street" ? "default" : "outline"}
            onClick={() => onOptions({ mapType: "street" })}
          >
            Street
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TOGGLES.map((t) => (
            <div key={t.key} className="flex items-center justify-between rounded-md border px-3 py-2">
              <Label htmlFor={t.key} className="text-sm font-normal">
                {t.label}
              </Label>
              <Switch
                id={t.key}
                checked={Boolean(options[t.key])}
                onCheckedChange={(v) => onOptions({ [t.key]: v } as Partial<GeotagOptions>)}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
