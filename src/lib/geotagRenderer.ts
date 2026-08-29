import type {
  GeotagData,
  GeotagOptions,
} from "@/types/geotag";

import { flagEmoji } from "./geocoding";
import {
  mapAttribution,
  renderMapCanvas,
} from "./mapProvider";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export interface RenderResult {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export interface GeotagRenderOptions extends GeotagOptions {
  stampHeight?: number;
  mapWidth?: number;
  geotagOpacity?: number;
  cornerRadius?: number;
  logoX?: number;
  logoY?: number;
  logoSize?: number;
  logoOpacity?: number;
  darkOpacity?: number;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(
    radius,
    width / 2,
    height / 2,
  );

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(
    x + width,
    y,
    x + width,
    y + r,
  );
  ctx.lineTo(
    x + width,
    y + height - r,
  );
  ctx.quadraticCurveTo(
    x + width,
    y + height,
    x + width - r,
    y + height,
  );
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(
    x,
    y + height,
    x,
    y + height - r,
  );
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(
    x,
    y,
    x + r,
    y,
  );
  ctx.closePath();
}

export function formatDateLine(
  data: GeotagData,
  opts: GeotagOptions,
  clockOverride?: string,
): string {
  if (!data.date) return "";

  const parts = data.date.split("-");

  const y = Number(parts[0] ?? 0);
  const m = Number(parts[1] ?? 1);
  const d = Number(parts[2] ?? 1);

  const dt = new Date(y, m - 1, d);

  const day = DAYS[dt.getDay()] ?? "";

  const date =
    `${String(d).padStart(2, "0")}/` +
    `${String(m).padStart(2, "0")}/` +
    `${y}`;

  let result = `${day}, ${date}`;

  if (
    opts.showTime &&
    (clockOverride || data.time)
  ) {
    result += ` ${clockOverride || data.time}`;
  }

  return result;
}

export function headlineText(
  data: GeotagData,
): string {
  const parts = [
    data.city,
    data.state,
    data.country,
  ].filter(Boolean);

  const flag = flagEmoji(
    data.countryCode,
  );

  const location =
    parts.length
      ? parts.join(", ")
      : data.address || "Location";

  return (
    location +
    (flag ? ` ${flag}` : "")
  );
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (
    ctx.measureText(text).width <=
    maxWidth
  ) {
    return text;
  }

  let value = text;

  while (
    value.length > 1 &&
    ctx.measureText(
      value + "…",
    ).width > maxWidth
  ) {
    value = value.slice(0, -1);
  }

  return value + "…";
}

function drawCameraLogo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  opacity: number,
) {
  ctx.save();

  ctx.globalAlpha = opacity;

  const radius = size * 0.20;

  roundedRect(
    ctx,
    x,
    y,
    size,
    size,
    radius,
  );

  ctx.fillStyle = "#1595d0";
  ctx.fill();

  const bodyX = x + size * 0.17;
  const bodyY = y + size * 0.32;
  const bodyW = size * 0.66;
  const bodyH = size * 0.39;

  roundedRect(
    ctx,
    bodyX,
    bodyY,
    bodyW,
    bodyH,
    size * 0.055,
  );

  ctx.fillStyle = "#ffffff";
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(
    bodyX + size * 0.10,
    bodyY,
  );
  ctx.lineTo(
    bodyX + size * 0.20,
    bodyY - size * 0.09,
  );
  ctx.lineTo(
    bodyX + size * 0.37,
    bodyY - size * 0.09,
  );
  ctx.lineTo(
    bodyX + size * 0.43,
    bodyY,
  );
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#1595d0";

  ctx.beginPath();
  ctx.arc(
    x + size * 0.50,
    y + size * 0.52,
    size * 0.145,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.fillStyle = "#ffffff";

  ctx.beginPath();
  ctx.arc(
    x + size * 0.50,
    y + size * 0.52,
    size * 0.070,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.restore();
}

export async function renderGeotag(
  data: GeotagData,
  opts: GeotagOptions,
  width = 1200,
  clockOverride?: string,
): Promise<RenderResult> {
  const custom =
    opts as GeotagRenderOptions;

  const stampHeightPercent =
    Math.max(
      5,
      Math.min(
        90,
        Number(
          custom.stampHeight ?? 23,
        ),
      ),
    );

  const mapWidthPercent =
    Math.max(
      10,
      Math.min(
        70,
        Number(
          custom.mapWidth ?? 23,
        ),
      ),
    );

  const geotagOpacity =
    Math.max(
      0,
      Math.min(
        1,
        Number(
          custom.geotagOpacity ?? 1,
        ) / 100,
      ),
    );

  const height = Math.round(
    width * 0.56,
  );

  const canvas =
    document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const ctx =
    canvas.getContext("2d")!;

  ctx.clearRect(
    0,
    0,
    width,
    height,
  );

  /*
   * This renderer creates the stamp itself.
   * The caller can place this rendered stamp
   * over a photograph or video frame.
   */

  const stampH = Math.max(
    70,
    Math.round(
      height *
      stampHeightPercent /
      100,
    ),
  );

  const stampY =
    height - stampH;

  const mapW = Math.round(
    width *
    mapWidthPercent /
    100,
  );

  const radius = Math.max(
    10,
    Number(
      custom.cornerRadius ??
      stampH * 0.10,
    ),
  );

  ctx.save();

  /*
   * Overall geotag opacity.
   */
  ctx.globalAlpha =
    geotagOpacity;

  /*
   * Rounded outer stamp.
   */
  roundedRect(
    ctx,
    0,
    stampY,
    width,
    stampH,
    radius,
  );

  ctx.clip();

  /*
   * Dark background.
   */
  ctx.fillStyle =
    "#111111";

  ctx.fillRect(
    0,
    stampY,
    width,
    stampH,
  );

  /*
   * Map.
   */
  const lat = data.latitude;
  const lon = data.longitude;

  if (
    lat != null &&
    lon != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lon)
  ) {
    try {
      const mapCanvas =
        await renderMapCanvas(
          lat,
          lon,
          Math.max(
            mapW,
            stampH,
          ),
          opts.mapType,
          15,
        );

      ctx.drawImage(
        mapCanvas,
        0,
        stampY,
        mapW,
        stampH,
      );
    } catch {
      ctx.fillStyle =
        "#41484d";

      ctx.fillRect(
        0,
        stampY,
        mapW,
        stampH,
      );
    }
  } else {
    ctx.fillStyle =
      "#41484d";

    ctx.fillRect(
      0,
      stampY,
      mapW,
      stampH,
    );
  }

  /*
   * Dark information area.
   */
  const infoOpacity =
    Number(
      custom.darkOpacity ?? 88,
    ) / 100;

  ctx.fillStyle =
    `rgba(0,0,0,${infoOpacity})`;

  ctx.fillRect(
    mapW,
    stampY,
    width - mapW,
    stampH,
  );

  /*
   * Map attribution.
   */
  ctx.font =
    `${Math.max(
      8,
      stampH * 0.055,
    )}px Arial`;

  ctx.fillStyle =
    "rgba(255,255,255,.90)";

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  ctx.fillText(
    mapAttribution(
      opts.mapType,
    ),
    stampH * 0.05,
    stampY +
      stampH -
      stampH * 0.05,
  );

  /*
   * Text.
   */
  const pad =
    Math.max(
      14,
      stampH * 0.12,
    );

  const textX =
    mapW + pad;

  const maxW =
    Math.max(
      100,
      width -
      textX -
      pad,
    );

  let y =
    stampY +
    stampH * 0.17;

  ctx.textBaseline =
    "middle";

  ctx.textAlign =
    "left";

  /*
   * Headline.
   */
  const headlineSize =
    Math.max(
      15,
      stampH * 0.155,
    );

  ctx.font =
    `700 ${headlineSize}px Arial`;

  ctx.fillStyle =
    "#ffffff";

  ctx.fillText(
    fitText(
      ctx,
      headlineText(data),
      maxW,
    ),
    textX,
    y,
  );

  y +=
    stampH * 0.20;

  /*
   * Body.
   */
  const bodySize =
    Math.max(
      10,
      stampH * 0.095,
    );

  ctx.font =
    `400 ${bodySize}px Arial`;

  ctx.fillStyle =
    "rgba(255,255,255,.97)";

  const lines: string[] = [];

  if (
    opts.showAddress &&
    data.address
  ) {
    lines.push(
      data.address,
    );
  }

  if (
    opts.showCoordinates &&
    lat != null &&
    lon != null
  ) {
    lines.push(
      `Lat ${lat.toFixed(6)}°  Long ${lon.toFixed(6)}°`,
    );
  }

  if (opts.showDate) {
    const dateLine =
      formatDateLine(
        data,
        opts,
        clockOverride,
      );

    if (dateLine) {
      lines.push(dateLine);
    }
  } else if (
    opts.showTime &&
    (clockOverride || data.time)
  ) {
    lines.push(
      clockOverride ||
      data.time ||
      "",
    );
  }

  if (
    opts.showAltitude &&
    data.altitude
  ) {
    lines.push(
      `Altitude ${data.altitude}`,
    );
  }

  if (
    opts.showAccuracy &&
    data.accuracy
  ) {
    lines.push(
      `Accuracy ${data.accuracy}`,
    );
  }

  const lineGap =
    Math.max(
      14,
      stampH * 0.13,
    );

  for (const line of lines) {
    if (
      y >
      stampY +
      stampH -
      bodySize
    ) {
      break;
    }

    ctx.fillText(
      fitText(
        ctx,
        line,
        maxW,
      ),
      textX,
      y,
    );

    y += lineGap;
  }

  /*
   * Blue camera logo.
   *
   * Values are percentages, so the user
   * can move it anywhere inside the info area.
   */
  const logoSize =
    Math.max(
      30,
      Math.min(
        Number(
          custom.logoSize ??
          stampH * 0.45,
        ),
        stampH * 0.80,
      ),
    );

  const defaultLogoX =
    width -
    logoSize -
    pad;

  const defaultLogoY =
    stampY +
    stampH -
    logoSize -
    pad * 0.55;

  const logoX =
    custom.logoX != null
      ? Math.max(
          0,
          Math.min(
            width - logoSize,
            Number(custom.logoX),
          ),
        )
      : defaultLogoX;

  const logoY =
    custom.logoY != null
      ? Math.max(
          stampY,
          Math.min(
            stampY +
            stampH -
            logoSize,
            Number(custom.logoY),
          ),
        )
      : defaultLogoY;

  drawCameraLogo(
    ctx,
    logoX,
    logoY,
    logoSize,
    Number(
      custom.logoOpacity ?? 100,
    ) / 100,
  );

  ctx.restore();

  return {
    canvas,
    width,
    height,
  };
}

export async function renderGeotagBlob(
  data: GeotagData,
  opts: GeotagOptions,
  width: number,
  clockOverride?: string,
): Promise<Blob> {
  const result =
    await renderGeotag(
      data,
      opts,
      width,
      clockOverride,
    );

  return new Promise(
    (resolve, reject) => {
      result.canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(
              new Error(
                "Failed to render geotag image",
              ),
            );
          }
        },
        "image/png",
      );
    },
  );
}
