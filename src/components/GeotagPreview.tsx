import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

import {
  renderGeotag,
  type GeotagRenderOptions,
} from "@/lib/geotagRenderer";

import type {
  GeotagData,
  GeotagOptions,
} from "@/types/geotag";

interface Props {
  data: GeotagData;
  options: GeotagOptions;
  onOptions: (
    patch: Partial<GeotagOptions>,
  ) => void;
}

const TOGGLES: {
  key: keyof GeotagOptions;
  label: string;
}[] = [
  {
    key: "showAddress",
    label: "Show Address",
  },
  {
    key: "showCoordinates",
    label: "Show Coordinates",
  },
  {
    key: "showDate",
    label: "Show Date",
  },
  {
    key: "showTime",
    label: "Show Time",
  },
  {
    key: "showAltitude",
    label: "Show Altitude",
  },
  {
    key: "showAccuracy",
    label: "Show Accuracy",
  },
];

export function GeotagPreview({
  data,
  options,
  onOptions,
}: Props) {
  const holder =
    useRef<HTMLDivElement>(null);

  const [busy, setBusy] =
    useState(false);

  const [stampHeight, setStampHeight] =
    useState(25);

  const [mapWidth, setMapWidth] =
    useState(23);

  const [geotagOpacity, setGeotagOpacity] =
    useState(100);

  const [cornerRadius, setCornerRadius] =
    useState(24);

  const [logoX, setLogoX] =
    useState<number | null>(null);

  const [logoY, setLogoY] =
    useState<number | null>(null);

  const [logoSize, setLogoSize] =
    useState(70);

  const [logoOpacity, setLogoOpacity] =
    useState(100);

  useEffect(() => {
    let cancelled = false;

    setBusy(true);

    const renderOptions =
      {
        ...options,
        stampHeight,
        mapWidth,
        geotagOpacity,
        cornerRadius,
        logoX:
          logoX === null
            ? undefined
            : logoX,
        logoY:
          logoY === null
            ? undefined
            : logoY,
        logoSize,
        logoOpacity,
      } as GeotagRenderOptions;

    renderGeotag(
      data,
      renderOptions,
      1200,
    )
      .then(({ canvas }) => {
        if (
          cancelled ||
          !holder.current
        ) {
          return;
        }

        canvas.className =
          "w-full h-auto rounded-xl shadow-lg";

        holder.current.replaceChildren(
          canvas,
        );
      })
      .catch((error) => {
        console.error(
          "Geotag rendering failed:",
          error,
        );
      })
      .finally(() => {
        if (!cancelled) {
          setBusy(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    data,
    options,
    stampHeight,
    mapWidth,
    geotagOpacity,
    cornerRadius,
    logoX,
    logoY,
    logoSize,
    logoOpacity,
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Geotag Preview
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        <div
          ref={holder}
          className="min-h-24 w-full overflow-hidden rounded-xl"
        />

        {busy && (
          <p className="text-xs text-muted-foreground">
            Rendering map…
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={
              options.mapType ===
              "satellite"
                ? "default"
                : "outline"
            }
            onClick={() =>
              onOptions({
                mapType: "satellite",
              })
            }
          >
            Satellite
          </Button>

          <Button
            size="sm"
            variant={
              options.mapType ===
              "street"
                ? "default"
                : "outline"
            }
            onClick={() =>
              onOptions({
                mapType: "street",
              })
            }
          >
            Street
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TOGGLES.map((toggle) => (
            <div
              key={String(toggle.key)}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <Label
                htmlFor={String(
                  toggle.key,
                )}
                className="text-sm font-normal"
              >
                {toggle.label}
              </Label>

              <Switch
                id={String(
                  toggle.key,
                )}
                checked={Boolean(
                  options[
                    toggle.key
                  ],
                )}
                onCheckedChange={(
                  checked,
                ) =>
                  onOptions({
                    [toggle.key]:
                      checked,
                  })
                }
              />
            </div>
          ))}
        </div>

        <div className="space-y-4 rounded-xl border p-4">
          <h3 className="text-sm font-semibold">
            Stamp Appearance
          </h3>

          <Slider
            label="Stamp height"
            value={stampHeight}
            min={5}
            max={90}
            suffix="%"
            onChange={setStampHeight}
          />

          <Slider
            label="Map width"
            value={mapWidth}
            min={10}
            max={70}
            suffix="%"
            onChange={setMapWidth}
          />

          <Slider
            label="Geotag opacity"
            value={geotagOpacity}
            min={10}
            max={100}
            suffix="%"
            onChange={setGeotagOpacity}
          />

          <Slider
            label="Rounded edges"
            value={cornerRadius}
            min={0}
            max={100}
            suffix="px"
            onChange={setCornerRadius}
          />

          <Slider
            label="Camera logo size"
            value={logoSize}
            min={30}
            max={200}
            suffix="px"
            onChange={setLogoSize}
          />

          <Slider
            label="Camera logo opacity"
            value={logoOpacity}
            min={0}
            max={100}
            suffix="%"
            onChange={setLogoOpacity}
          />
        </div>

        <div className="space-y-4 rounded-xl border p-4">
          <h3 className="text-sm font-semibold">
            Blue Camera Position
          </h3>

          <p className="text-xs text-muted-foreground">
            Adjust the logo position manually.
            Reset returns it to the bottom-right.
          </p>

          <Slider
            label="Logo X"
            value={
              logoX === null
                ? 100
                : logoX
            }
            min={0}
            max={1200}
            suffix=""
            onChange={setLogoX}
          />

          <Slider
            label="Logo Y"
            value={
              logoY === null
                ? 100
                : logoY
            }
            min={0}
            max={700}
            suffix=""
            onChange={setLogoY}
          />

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setLogoX(null);
              setLogoY(null);
            }}
          >
            Reset Camera Position
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span className="font-semibold">
          {Math.round(value)}
          {suffix}
        </span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) =>
          onChange(
            Number(
              event.target.value,
            ),
          )
        }
        className="w-full"
      />
    </div>
  );
}
