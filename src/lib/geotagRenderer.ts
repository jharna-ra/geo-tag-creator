import type {
  GeotagData,
  GeotagOptions,
} from "@/types/geotag";

import {
  flagEmoji,
} from "./geocoding";

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
    DAYS[dt.getDay()] ?? "";

  const ddmmyyyy =
    `${String(d).padStart(2, "0")}/` +
    `${String(m).padStart(2, "0")}/` +
    `${y}`;

  let line =
    `${day}, ${ddmmyyyy}`;

  if (
    opts.showTime &&
    (clockOverride || data.time)
  ) {

    line +=
      ` ${clockOverride || data.time}`;

  }

  return line;
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
    `${location}` +
    `${flag ? " " + flag : ""}`
  );
}

/* =========================================================
   TEXT FIT
========================================================= */

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {

  if (
    ctx.measureText(text).width
    <= maxWidth
  ) {
    return text;
  }

  let t = text;

  while (
    t.length > 1 &&
    ctx.measureText(
      t + "…",
    ).width > maxWidth
  ) {

    t =
      t.slice(
        0,
        -1,
      );

  }

  return t + "…";
}

/* =========================================================
   RENDER RESULT
========================================================= */

export interface RenderResult {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

/* =========================================================
   RENDER GEOTAG
========================================================= */

export async function renderGeotag(
  data: GeotagData,
  opts: GeotagOptions,
  width = 1200,
  clockOverride?: string,
): Promise<RenderResult> {

  const height =
    Math.round(
      width * 0.235,
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
    canvas.getContext(
      "2d",
    )!;

  /*
   * Clear.
   */

  ctx.clearRect(
    0,
    0,
    width,
    height,
  );

  /*
   * Rounded outer banner.
   */

  const radius =
    Math.max(
      10,
      Math.round(
        height * 0.10,
      ),
    );

  ctx.save();

  ctx.beginPath();

  ctx.roundRect(
    0,
    0,
    width,
    height,
    radius,
  );

  ctx.clip();

  /*
   * Background.
   */

  ctx.fillStyle =
    "#606060";

  ctx.fillRect(
    0,
    0,
    width,
    height,
  );

  /*
   * Map.
   */

  const mapW =
    Math.round(
      width * 0.225,
    );

  const lat =
    data.latitude;

  const lon =
    data.longitude;

  if (
    lat != null &&
    lon != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lon)
  ) {

    try {

      const map =
        await renderMapCanvas(
          lat,
          lon,
          Math.max(
            mapW,
            height,
          ),
          opts.mapType,
          15,
        );

      ctx.drawImage(
        map,
        0,
        0,
        mapW,
        height,
      );

    } catch {

      ctx.fillStyle =
        "#3a4046";

      ctx.fillRect(
        0,
        0,
        mapW,
        height,
      );

    }

  } else {

    ctx.fillStyle =
      "#3a4046";

    ctx.fillRect(
      0,
      0,
      mapW,
      height,
    );

  }

  /*
   * Map attribution.
   */

  ctx.font =
    `${Math.max(
      8,
      Math.round(
        height * 0.062,
      ),
    )}px system-ui, sans-serif`;

  ctx.fillStyle =
    "rgba(255,255,255,0.9)";

  ctx.textAlign =
    "left";

  ctx.fillText(
    mapAttribution(
      opts.mapType,
    ),
    Math.round(
      height * 0.05,
    ),
    height -
      Math.round(
        height * 0.05,
      ),
  );

  /*
   * Text area.
   */

  const padX =
    Math.round(
      width * 0.026,
    );

  const x =
    mapW + padX;

  const maxW =
    width -
    x -
    padX;

  let y =
    Math.round(
      height * 0.28,
    );

  ctx.fillStyle =
    "#ffffff";

  ctx.textBaseline =
    "middle";

  /*
   * Headline.
   */

  const h1 =
    Math.round(
      height * 0.185,
    );

  ctx.font =
    `700 ${h1}px system-ui, ` +
    `"Segoe UI", sans-serif`;

  ctx.fillText(
    fitText(
      ctx,
      headlineText(
        data,
      ),
      maxW,
    ),
    x,
    y,
  );

  y +=
    Math.round(
      height * 0.2,
    );

  /*
   * Body.
   */

  const body =
    Math.round(
      height * 0.115,
    );

  const lineGap =
    Math.round(
      height * 0.155,
    );

  const lines: string[] =
    [];

  /*
   * Address.
   */

  if (
    opts.showAddress &&
    data.address
  ) {

    lines.push(
      data.address,
    );

  }

  /*
   * Coordinates.
   */

  if (
    opts.showCoordinates &&
    lat != null &&
    lon != null
  ) {

    lines.push(
      `Lat ${lat.toFixed(
        6,
      )}°  Long ${lon.toFixed(
        6,
      )}°`,
    );

  }

  /*
   * Date/time.
   */

  if (
    opts.showDate
  ) {

    const dl =
      formatDateLine(
        data,
        opts,
        clockOverride,
      );

    if (dl) {
      lines.push(dl);
    }

  } else if (
    opts.showTime &&
    (clockOverride || data.time)
  ) {

    lines.push(
      clockOverride ||
      data.time,
    );

  }

  /*
   * Altitude / accuracy.
   */

  const extras: string[] =
    [];

  if (
    opts.showAltitude &&
    data.altitude
  ) {

    extras.push(
      `Altitude ${data.altitude}`,
    );

  }

  if (
    opts.showAccuracy &&
    data.accuracy
  ) {

    extras.push(
      `Accuracy ${data.accuracy}`,
    );

  }

  if (
    extras.length
  ) {

    lines.push(
      extras.join(
        "   •   ",
      ),
    );

  }

  /*
   * Draw body.
   */

  ctx.font =
    `400 ${body}px system-ui, ` +
    `"Segoe UI", sans-serif`;

  ctx.fillStyle =
    "rgba(255,255,255,0.95)";

  for (
    const line of lines
  ) {

    ctx.fillText(
      fitText(
        ctx,
        line,
        maxW,
      ),
      x,
      y,
    );

    y +=
      lineGap;

  }

  ctx.restore();

  return {
    canvas,
    width,
    height,
  };
}

/* =========================================================
   RENDER STATIC BLOB
========================================================= */

export async function renderGeotagBlob(
  data: GeotagData,
  opts: GeotagOptions,
  width: number,
  clockOverride?: string,
): Promise<Blob> {

  const {
    canvas,
  } =
    await renderGeotag(
      data,
      opts,
      width,
      clockOverride,
    );

  return await new Promise<Blob>(
    (
      resolve,
      reject,
    ) => {

      canvas.toBlob(
        (blob) => {

          if (blob) {

            resolve(
              blob,
            );

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
