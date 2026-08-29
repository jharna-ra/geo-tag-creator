import type { MapType } from "@/types/geotag";

const TILE = 256;

const MAX_TILE_CACHE = 120;

const tileCache = new Map<
  string,
  Promise<HTMLImageElement>
>();

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

function normalizeLongitude(
  lon: number,
): number {
  let value = lon;

  while (value < -180) {
    value += 360;
  }

  while (value > 180) {
    value -= 360;
  }

  return value;
}

function lonToTileX(
  lon: number,
  z: number,
): number {
  return (
    ((normalizeLongitude(lon) + 180) /
      360) *
    Math.pow(2, z)
  );
}

function latToTileY(
  lat: number,
  z: number,
): number {
  /*
   * Web Mercator becomes unstable close to
   * the poles, so keep latitude in a safe range.
   */
  const safeLat = clamp(
    lat,
    -85.05112878,
    85.05112878,
  );

  const rad =
    (safeLat * Math.PI) / 180;

  return (
    (1 -
      Math.log(
        Math.tan(rad) +
          1 / Math.cos(rad),
      ) /
        Math.PI) /
    2 *
    Math.pow(2, z)
  );
}

function tileUrl(
  type: MapType,
  z: number,
  x: number,
  y: number,
): string {
  if (type === "satellite") {
    return (
      `https://server.arcgisonline.com/ArcGIS/rest/services/` +
      `World_Imagery/MapServer/tile/${z}/${y}/${x}`
    );
  }

  return (
    `https://tile.openstreetmap.org/` +
    `${z}/${x}/${y}.png`
  );
}

export function mapAttribution(
  type: MapType,
): string {
  return type === "satellite"
    ? "Esri, Maxar"
    : "© OpenStreetMap contributors";
}

/* =========================================================
   IMAGE LOADING
========================================================= */

function loadImage(
  src: string,
): Promise<HTMLImageElement> {
  const cached =
    tileCache.get(src);

  if (cached) {
    return cached;
  }

  const promise =
    new Promise<HTMLImageElement>(
      (resolve, reject) => {
        const img =
          new Image();

        img.crossOrigin =
          "anonymous";

        img.decoding =
          "async";

        img.onload = () => {
          resolve(img);
        };

        img.onerror = () => {
          reject(
            new Error(
              `Map tile failed: ${src}`,
            ),
          );
        };

        img.src = src;
      },
    );

  tileCache.set(
    src,
    promise,
  );

  /*
   * Keep the cache bounded.
   */
  if (
    tileCache.size >
    MAX_TILE_CACHE
  ) {
    const first =
      tileCache.keys()
        .next()
        .value;

    if (first) {
      tileCache.delete(
        first,
      );
    }
  }

  return promise;
}

/* =========================================================
   TILE RANGE
========================================================= */

function wrappedTileX(
  x: number,
  max: number,
): number {
  return (
    ((x % max) + max) %
    max
  );
}

function tileDistance(
  x: number,
  center: number,
  max: number,
): number {
  let d =
    x - center;

  if (
    d >
    max / 2
  ) {
    d -= max;
  }

  if (
    d <
    -max / 2
  ) {
    d += max;
  }

  return d;
}

/* =========================================================
   PIN
========================================================= */

function drawLocationPin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  mapWidth: number,
  mapHeight: number,
): void {
  const size =
    Math.max(
      28,
      Math.min(
        mapWidth,
        mapHeight,
      ) *
        0.14,
    );

  const pinWidth =
    size * 0.62;

  const pinHeight =
    size;

  const radius =
    pinWidth / 2;

  ctx.save();

  /*
   * Shadow.
   */
  ctx.fillStyle =
    "rgba(0,0,0,0.32)";

  ctx.beginPath();

  ctx.ellipse(
    x,
    y + 3,
    radius * 0.65,
    radius * 0.25,
    0,
    0,
    Math.PI * 2,
  );

  ctx.fill();

  /*
   * Pin.
   */
  ctx.fillStyle =
    "#e53935";

  ctx.strokeStyle =
    "rgba(255,255,255,0.95)";

  ctx.lineWidth =
    Math.max(
      1.5,
      size * 0.035,
    );

  ctx.beginPath();

  const top =
    y - pinHeight;

  ctx.arc(
    x,
    top + radius,
    radius,
    Math.PI,
    0,
  );

  ctx.quadraticCurveTo(
    x + radius,
    top +
      radius * 1.85,
    x,
    y,
  );

  ctx.quadraticCurveTo(
    x - radius,
    top +
      radius * 1.85,
    x - radius,
    top + radius,
  );

  ctx.closePath();

  ctx.fill();

  ctx.stroke();

  /*
   * Center.
   */
  ctx.fillStyle =
    "#ffffff";

  ctx.beginPath();

  ctx.arc(
    x,
    top + radius,
    radius * 0.36,
    0,
    Math.PI * 2,
  );

  ctx.fill();

  ctx.restore();
}

/* =========================================================
   MAP RENDERER
========================================================= */

/**
 * Render a rectangular map centered on latitude/longitude.
 *
 * Unlike the old implementation, width and height are
 * independent. This prevents the square-map -> rectangle
 * stretching problem.
 */
export async function renderMapCanvas(
  lat: number,
  lon: number,
  width: number,
  type: MapType,
  zoom = 15,
  requestedHeight?: number,
): Promise<HTMLCanvasElement> {
  const outputWidth =
    Math.max(
      64,
      Math.round(width),
    );

  const outputHeight =
    Math.max(
      64,
      Math.round(
        requestedHeight ??
          outputWidth,
      ),
    );

  const canvas =
    document.createElement(
      "canvas",
    );

  canvas.width =
    outputWidth;

  canvas.height =
    outputHeight;

  const ctx =
    canvas.getContext("2d");

  if (!ctx) {
    throw new Error(
      "Could not create map canvas.",
    );
  }

  ctx.imageSmoothingEnabled =
    true;

  ctx.imageSmoothingQuality =
    "high";

  /*
   * Do not use a large grey placeholder.
   *
   * The background is deliberately dark and
   * neutral only while tiles are being composed.
   */
  ctx.fillStyle =
    "#1a1d1f";

  ctx.fillRect(
    0,
    0,
    outputWidth,
    outputHeight,
  );

  /*
   * Keep zoom in a safe range.
   */
  const safeZoom =
    clamp(
      Math.round(
        Number(zoom) || 15,
      ),
      1,
      19,
    );

  const worldTiles =
    Math.pow(
      2,
      safeZoom,
    );

  const centerTileX =
    lonToTileX(
      lon,
      safeZoom,
    );

  const centerTileY =
    latToTileY(
      lat,
      safeZoom,
    );

  /*
   * Pixel position of the geographic center.
   */
  const centerWorldX =
    centerTileX *
    TILE;

  const centerWorldY =
    centerTileY *
    TILE;

  /*
   * How many tiles are needed.
   *
   * We render enough tiles to completely cover
   * the rectangular map without grey gaps.
   */
  const tilesX =
    Math.ceil(
      outputWidth /
        TILE,
    ) + 4;

  const tilesY =
    Math.ceil(
      outputHeight /
        TILE,
    ) + 4;

  const centerTileIndexX =
    Math.floor(
      centerTileX,
    );

  const centerTileIndexY =
    Math.floor(
      centerTileY,
    );

  const startX =
    centerTileIndexX -
    Math.floor(
      tilesX / 2,
    );

  const endX =
    centerTileIndexX +
    Math.ceil(
      tilesX / 2,
    );

  const startY =
    centerTileIndexY -
    Math.floor(
      tilesY / 2,
    );

  const endY =
    centerTileIndexY +
    Math.ceil(
      tilesY / 2,
    );

  interface TileJob {
    tx: number;
    ty: number;
    px: number;
    py: number;
    url: string;
  }

  const jobs: TileJob[] =
    [];

  for (
    let ty = startY;
    ty <= endY;
    ty++
  ) {
    /*
     * Web Mercator does not wrap vertically.
     */
    if (
      ty < 0 ||
      ty >= worldTiles
    ) {
      continue;
    }

    for (
      let tx = startX;
      tx <= endX;
      tx++
    ) {
      const wrappedX =
        wrappedTileX(
          tx,
          worldTiles,
        );

      const px =
        outputWidth / 2 +
        tileDistance(
          tx,
          centerTileIndexX,
          worldTiles,
        ) *
          TILE;

      const py =
        outputHeight / 2 +
        (ty -
          centerTileIndexY) *
          TILE;

      jobs.push({
        tx: wrappedX,
        ty,
        px:
          Math.round(
            px,
          ),
        py:
          Math.round(
            py,
          ),
        url: tileUrl(
          type,
          safeZoom,
          wrappedX,
          ty,
        ),
      });
    }
  }

  /*
   * Load tiles in parallel.
   *
   * The browser cache above prevents the same tile
   * from being downloaded repeatedly.
   */
  const loaded =
    await Promise.all(
      jobs.map(
        async (
          job,
        ) => {
          try {
            const image =
              await loadImage(
                job.url,
              );

            return {
              job,
              image,
            };
          } catch {
            return null;
          }
        },
      ),
    );

  /*
   * Draw every successfully loaded tile.
   */
  for (
    const entry of loaded
  ) {
    if (!entry) {
      continue;
    }

    const {
      job,
      image,
    } = entry;

    ctx.drawImage(
      image,
      job.px,
      job.py,
      TILE,
      TILE,
    );
  }

  /*
   * Center location.
   */
  drawLocationPin(
    ctx,
    outputWidth / 2,
    outputHeight / 2,
    outputWidth,
    outputHeight,
  );

  return canvas;
}

/* =========================================================
   TILE CACHE
========================================================= */

export function clearMapTileCache(): void {
  tileCache.clear();
}
