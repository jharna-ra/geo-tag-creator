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

export interface GeotagRenderOptions
  extends GeotagOptions {
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

/* =========================================================
   BASIC HELPERS
========================================================= */

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.min(
    max,
    Math.max(min, value),
  );
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
    Math.max(0, radius),
    width / 2,
    height / 2,
  );

  ctx.beginPath();

  ctx.moveTo(
    x + r,
    y,
  );

  ctx.lineTo(
    x + width - r,
    y,
  );

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

  ctx.lineTo(
    x + r,
    y + height,
  );

  ctx.quadraticCurveTo(
    x,
    y + height,
    x,
    y + height - r,
  );

  ctx.lineTo(
    x,
    y + r,
  );

  ctx.quadraticCurveTo(
    x,
    y,
    x + r,
    y,
  );

  ctx.closePath();
}

/* =========================================================
   TEXT
========================================================= */

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
      `${value}…`,
    ).width > maxWidth
  ) {
    value =
      value.slice(
        0,
        -1,
      );
  }

  return `${value}…`;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words =
    String(text || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (!words.length) {
    return [];
  }

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate =
      current
        ? `${current} ${word}`
        : word;

    if (
      ctx.measureText(
        candidate,
      ).width <= maxWidth
    ) {
      current = candidate;
    } else {
      if (current) {
        lines.push(current);
      }

      current = word;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

/* =========================================================
   DATE
========================================================= */

export function formatDateLine(
  data: GeotagData,
  opts: GeotagOptions,
  clockOverride?: string,
): string {
  if (!data.date) {
    return "";
  }

  const parts =
    data.date.split("-");

  const y =
    Number(parts[0] ?? 0);

  const m =
    Number(parts[1] ?? 1);

  const d =
    Number(parts[2] ?? 1);

  const dt =
    new Date(
      y,
      m - 1,
      d,
    );

  const day =
    DAYS[dt.getDay()] ??
    "";

  const date =
    `${String(d).padStart(
      2,
      "0",
    )}/` +
    `${String(m).padStart(
      2,
      "0",
    )}/` +
    `${String(y).padStart(
      4,
      "0",
    )}`;

  let result =
    `${day}, ${date}`;

  if (
    opts.showTime &&
    (clockOverride ||
      data.time)
  ) {
    result +=
      ` ${clockOverride || data.time}`;
  }

  return result;
}

/* =========================================================
   HEADLINE
========================================================= */

export function headlineText(
  data: GeotagData,
): string {
  const parts = [
    data.city,
    data.state,
    data.country,
  ].filter(Boolean);

  const flag =
    flagEmoji(
      data.countryCode,
    );

  const location =
    parts.length > 0
      ? parts.join(", ")
      : data.address ||
        "Location";

  return (
    location +
    (flag
      ? ` ${flag}`
      : "")
  );
}

/* =========================================================
   BLUE CAMERA
========================================================= */

function drawCameraLogo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  opacity: number,
) {
  ctx.save();

  ctx.globalAlpha =
    clamp(
      opacity,
      0,
      1,
    );

  /*
   * Blue rounded-square camera.
   */
  const outerRadius =
    size * 0.20;

  roundedRect(
    ctx,
    x,
    y,
    size,
    size,
    outerRadius,
  );

  ctx.fillStyle =
    "#1595D0";

  ctx.fill();

  /*
   * Camera body.
   */
  const bodyX =
    x + size * 0.16;

  const bodyY =
    y + size * 0.34;

  const bodyW =
    size * 0.68;

  const bodyH =
    size * 0.38;

  roundedRect(
    ctx,
    bodyX,
    bodyY,
    bodyW,
    bodyH,
    size * 0.06,
  );

  ctx.fillStyle =
    "#FFFFFF";

  ctx.fill();

  /*
   * Camera top bump.
   */
  ctx.beginPath();

  ctx.moveTo(
    bodyX +
      size * 0.10,
    bodyY,
  );

  ctx.lineTo(
    bodyX +
      size * 0.20,
    bodyY -
      size * 0.10,
  );

  ctx.lineTo(
    bodyX +
      size * 0.38,
    bodyY -
      size * 0.10,
  );

  ctx.lineTo(
    bodyX +
      size * 0.44,
    bodyY,
  );

  ctx.closePath();

  ctx.fill();

  /*
   * Lens outer ring.
   */
  ctx.fillStyle =
    "#1595D0";

  ctx.beginPath();

  ctx.arc(
    x + size * 0.50,
    y + size * 0.53,
    size * 0.145,
    0,
    Math.PI * 2,
  );

  ctx.fill();

  /*
   * Lens center.
   */
  ctx.fillStyle =
    "#FFFFFF";

  ctx.beginPath();

  ctx.arc(
    x + size * 0.50,
    y + size * 0.53,
    size * 0.070,
    0,
    Math.PI * 2,
  );

  ctx.fill();

  /*
   * Small camera indicator.
   */
  ctx.fillStyle =
    "#1595D0";

  ctx.beginPath();

  ctx.arc(
    x + size * 0.75,
    y + size * 0.43,
    size * 0.035,
    0,
    Math.PI * 2,
  );

  ctx.fill();

  ctx.restore();
}

/* =========================================================
   MAP CACHE
========================================================= */

interface MapCacheEntry {
  key: string;
  canvas: HTMLCanvasElement;
}

const mapCache =
  new Map<
    string,
    MapCacheEntry
  >();

function mapCacheKey(
  latitude: number,
  longitude: number,
  width: number,
  height: number,
  mapType: unknown,
): string {
  return [
    latitude.toFixed(6),
    longitude.toFixed(6),
    Math.round(width),
    Math.round(height),
    String(mapType ?? "default"),
  ].join("|");
}

async function getMapCanvas(
  latitude: number,
  longitude: number,
  width: number,
  height: number,
  mapType: GeotagOptions["mapType"],
): Promise<HTMLCanvasElement> {
  const key =
    mapCacheKey(
      latitude,
      longitude,
      width,
      height,
      mapType,
    );

  const cached =
    mapCache.get(key);

  if (cached) {
    return cached.canvas;
  }

  /*
   * Render the map using the actual rectangular
   * dimensions required by the GeoTag.
   *
   * The provider may return a different intrinsic
   * size, so we resize it once here.
   */
  const source =
    await renderMapCanvas(
      latitude,
      longitude,
      Math.max(
        256,
        Math.ceil(width),
      ),
      mapType,
      15,
    );

  const canvas =
    document.createElement(
      "canvas",
    );

  canvas.width =
    Math.max(
      2,
      Math.round(width),
    );

  canvas.height =
    Math.max(
      2,
      Math.round(height),
    );

  const ctx =
    canvas.getContext("2d");

  if (!ctx) {
    throw new Error(
      "Could not create map canvas.",
    );
  }

  /*
   * High-quality resizing.
   */
  ctx.imageSmoothingEnabled =
    true;

  ctx.imageSmoothingQuality =
    "high";

  /*
   * Cover the complete rectangle.
   *
   * This prevents the unwanted grey/empty
   * area caused by mismatched map aspect ratios.
   */
  const sourceRatio =
    source.width /
    source.height;

  const targetRatio =
    width /
    height;

  let sx = 0;
  let sy = 0;
  let sw =
    source.width;
  let sh =
    source.height;

  if (
    sourceRatio >
    targetRatio
  ) {
    sw =
      source.height *
      targetRatio;

    sx =
      (source.width -
        sw) /
      2;
  } else if (
    sourceRatio <
    targetRatio
  ) {
    sh =
      source.width /
      targetRatio;

    sy =
      (source.height -
        sh) /
      2;
  }

  ctx.drawImage(
    source,
    sx,
    sy,
    sw,
    sh,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  mapCache.set(
    key,
    {
      key,
      canvas,
    },
  );

  /*
   * Avoid unlimited cache growth.
   */
  if (
    mapCache.size > 30
  ) {
    const first =
      mapCache.keys().next()
        .value;

    if (first) {
      mapCache.delete(
        first,
      );
    }
  }

  return canvas;
}

/* =========================================================
   MAIN RENDERER
========================================================= */

export async function renderGeotag(
  data: GeotagData,
  opts: GeotagOptions,
  width = 1200,
  clockOverride?: string,
): Promise<RenderResult> {
  const custom =
    opts as GeotagRenderOptions;

  /*
   * Keep the original 16:9 stamp canvas.
   */
  const height =
    Math.max(
      2,
      Math.round(
        width * 0.5625,
      ),
    );

  const canvas =
    document.createElement(
      "canvas",
    );

  canvas.width =
    width;

  canvas.height =
    height;

  const ctx =
    canvas.getContext("2d");

  if (!ctx) {
    throw new Error(
      "Could not create GeoTag canvas.",
    );
  }

  ctx.imageSmoothingEnabled =
    true;

  ctx.imageSmoothingQuality =
    "high";

  /*
   * User controls.
   */
  const stampHeightPercent =
    clamp(
      Number(
        custom.stampHeight ??
        23,
      ),
      5,
      90,
    );

  const mapWidthPercent =
    clamp(
      Number(
        custom.mapWidth ??
        23,
      ),
      10,
      70,
    );

  const geotagOpacity =
    clamp(
      Number(
        custom.geotagOpacity ??
        100,
      ) / 100,
      0,
      1,
    );

  const stampH =
    Math.max(
      70,
      Math.round(
        height *
        stampHeightPercent /
        100,
      ),
    );

  const stampY =
    height -
    stampH;

  const mapW =
    Math.max(
      100,
      Math.round(
        width *
        mapWidthPercent /
        100,
      ),
    );

  /*
   * Radius.
   */
  const radius =
    Math.max(
      8,
      Number(
        custom.cornerRadius ??
        stampH * 0.10,
      ),
    );

  /*
   * Overall clipping.
   */
  ctx.save();

  ctx.globalAlpha =
    geotagOpacity;

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
   * IMPORTANT:
   * Fill the complete stamp first.
   *
   * This eliminates transparent/grey gaps.
   */
  ctx.fillStyle =
    "#101214";

  ctx.fillRect(
    0,
    stampY,
    width,
    stampH,
  );

  /* =======================================================
     MAP
  ======================================================= */

  const lat =
    Number(data.latitude);

  const lon =
    Number(data.longitude);

  if (
    Number.isFinite(lat) &&
    Number.isFinite(lon)
  ) {
    try {
      const map =
        await getMapCanvas(
          lat,
          lon,
          mapW,
          stampH,
          opts.mapType,
        );

      ctx.drawImage(
        map,
        0,
        stampY,
        mapW,
        stampH,
      );
    } catch {
      /*
       * Do NOT create the old large grey block.
       *
       * Use a dark neutral fallback that blends
       * into the stamp instead.
       */
      ctx.fillStyle =
        "#151719";

      ctx.fillRect(
        0,
        stampY,
        mapW,
        stampH,
      );
    }
  } else {
    ctx.fillStyle =
      "#151719";

    ctx.fillRect(
      0,
      stampY,
      mapW,
      stampH,
    );
  }

  /* =======================================================
     INFORMATION PANEL
  ======================================================= */

  const darkOpacity =
    clamp(
      Number(
        custom.darkOpacity ??
        88,
      ) / 100,
      0,
      1,
    );

  ctx.fillStyle =
    `rgba(0,0,0,${darkOpacity})`;

  ctx.fillRect(
    mapW,
    stampY,
    width - mapW,
    stampH,
  );

  /*
   * Subtle separator.
   */
  ctx.fillStyle =
    "rgba(255,255,255,0.08)";

  ctx.fillRect(
    mapW,
    stampY,
    1,
    stampH,
  );

  /* =======================================================
     MAP ATTRIBUTION
  ======================================================= */

  const attributionSize =
    Math.max(
      7,
      stampH * 0.045,
    );

  ctx.font =
    `400 ${attributionSize}px Arial`;

  ctx.fillStyle =
    "rgba(255,255,255,0.82)";

  ctx.textAlign =
    "left";

  ctx.textBaseline =
    "alphabetic";

  ctx.fillText(
    mapAttribution(
      opts.mapType,
    ),
    Math.max(
      6,
      stampH * 0.045,
    ),
    stampY +
      stampH -
      Math.max(
        5,
        stampH * 0.035,
      ),
  );

  /* =======================================================
     TEXT AREA
  ======================================================= */

  const pad =
    Math.max(
      12,
      stampH * 0.095,
    );

  const textX =
    mapW + pad;

  const rightPadding =
    Math.max(
      10,
      stampH * 0.08,
    );

  const logoSize =
    Math.max(
      30,
      Math.min(
        Number(
          custom.logoSize ??
          stampH * 0.42,
        ),
        stampH * 0.72,
      ),
    );

  const defaultLogoX =
    width -
    logoSize -
    rightPadding;

  const defaultLogoY =
    stampY +
    stampH -
    logoSize -
    pad * 0.55;

  const logoX =
    custom.logoX != null
      ? clamp(
          Number(
            custom.logoX,
          ),
          mapW,
          width -
            logoSize,
        )
      : defaultLogoX;

  const logoY =
    custom.logoY != null
      ? clamp(
          Number(
            custom.logoY,
          ),
          stampY,
          stampY +
            stampH -
            logoSize,
        )
      : defaultLogoY;

  /*
   * Leave space for camera logo.
   */
  const textRight =
    Math.max(
      textX + 50,
      logoX -
        Math.max(
          10,
          stampH * 0.055,
        ),
    );

  const textWidth =
    Math.max(
      80,
      textRight -
        textX,
    );

  let y =
    stampY +
    stampH * 0.19;

  ctx.textAlign =
    "left";

  ctx.textBaseline =
    "middle";

  /* =======================================================
     HEADLINE
  ======================================================= */

  const headlineSize =
    Math.max(
      14,
      stampH * 0.145,
    );

  ctx.font =
    `700 ${headlineSize}px Arial`;

  ctx.fillStyle =
    "#FFFFFF";

  ctx.fillText(
    fitText(
      ctx,
      headlineText(data),
      textWidth,
    ),
    textX,
    y,
  );

  y +=
    stampH * 0.19;

  /* =======================================================
     DETAILS
  ======================================================= */

  const bodySize =
    Math.max(
      9,
      stampH * 0.085,
    );

  ctx.font =
    `400 ${bodySize}px Arial`;

  ctx.fillStyle =
    "rgba(255,255,255,0.96)";

  const lines: string[] =
    [];

  if (
    opts.showAddress &&
    data.address
  ) {
    const addressLines =
      wrapText(
        ctx,
        data.address,
        textWidth,
      );

    lines.push(
      ...addressLines.slice(
        0,
        2,
      ),
    );
  }

  if (
    opts.showCoordinates &&
    Number.isFinite(lat) &&
    Number.isFinite(lon)
  ) {
    lines.push(
      `Lat ${lat.toFixed(
        6,
      )}°  Long ${lon.toFixed(
        6,
      )}°`,
    );
  }

  if (
    opts.showDate
  ) {
    const date =
      formatDateLine(
        data,
        opts,
        clockOverride,
      );

    if (date) {
      lines.push(
        date,
      );
    }
  } else if (
    opts.showTime &&
    (clockOverride ||
      data.time)
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
      12,
      stampH * 0.105,
    );

  for (
    const line of lines
  ) {
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
        textWidth,
      ),
      textX,
      y,
    );

    y += lineGap;
  }

  /* =======================================================
     BLUE CAMERA
  ======================================================= */

  drawCameraLogo(
    ctx,
    logoX,
    logoY,
    logoSize,
    clamp(
      Number(
        custom.logoOpacity ??
        100,
      ) / 100,
      0,
      1,
    ),
  );

  ctx.restore();

  return {
    canvas,
    width,
    height,
  };
}

/* =========================================================
   BLOB EXPORT
========================================================= */

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
    (
      resolve,
      reject,
    ) => {
      result.canvas.toBlob(
        (
          blob,
        ) => {
          if (blob) {
            resolve(
              blob,
            );
          } else {
            reject(
              new Error(
                "Failed to render geotag image.",
              ),
            );
          }
        },
        "image/png",
      );
    },
  );
}

/* =========================================================
   CACHE CONTROL
========================================================= */

export function clearGeotagMapCache(): void {
  mapCache.clear();
}
