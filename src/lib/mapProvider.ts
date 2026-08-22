import type { MapType } from "@/types/geotag";

const TILE = 256;

function lonToTileX(lon: number, z: number) {
  return ((lon + 180) / 360) * Math.pow(2, z);
}
function latToTileY(lat: number, z: number) {
  const rad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, z);
}

function tileUrl(type: MapType, z: number, x: number, y: number) {
  return type === "satellite"
    ? `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`
    : `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

export function mapAttribution(type: MapType) {
  return type === "satellite" ? "Esri, Maxar" : "© OpenStreetMap";
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("tile failed"));
    img.src = src;
  });
}

/**
 * Renders a square map image centred on lat/lon with a red pin.
 * Returns a canvas that is safe to draw into another canvas (CORS-clean tiles).
 */
export async function renderMapCanvas(
  lat: number,
  lon: number,
  size: number,
  type: MapType,
  zoom = 15,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#1b2b1f";
  ctx.fillRect(0, 0, size, size);

  const cx = lonToTileX(lon, zoom);
  const cy = latToTileY(lat, zoom);
  const tilesNeeded = Math.ceil(size / TILE) + 2;
  const half = Math.floor(tilesNeeded / 2);

  const centerPxX = size / 2;
  const centerPxY = size / 2;

  const jobs: Promise<void>[] = [];
  for (let dx = -half; dx <= half; dx++) {
    for (let dy = -half; dy <= half; dy++) {
      const tx = Math.floor(cx) + dx;
      const ty = Math.floor(cy) + dy;
      const max = Math.pow(2, zoom);
      if (tx < 0 || ty < 0 || tx >= max || ty >= max) continue;
      const px = centerPxX + (tx - cx) * TILE;
      const py = centerPxY + (ty - cy) * TILE;
      jobs.push(
        loadImage(tileUrl(type, zoom, tx, ty))
          .then((img) => {
            ctx.drawImage(img, Math.round(px), Math.round(py), TILE, TILE);
          })
          .catch(() => {}),
      );
    }
  }
  await Promise.all(jobs);

  // red pin
  const pinH = Math.max(26, size * 0.16);
  const pinW = pinH * 0.68;
  const bx = centerPxX;
  const by = centerPxY;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(bx, by + 2, pinW * 0.35, pinW * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e02424";
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = Math.max(1, size * 0.006);
  ctx.beginPath();
  const r = pinW / 2;
  const topY = by - pinH;
  ctx.arc(bx, topY + r, r, Math.PI, 0, false);
  ctx.quadraticCurveTo(bx + r, topY + r * 1.9, bx, by);
  ctx.quadraticCurveTo(bx - r, topY + r * 1.9, bx - r, topY + r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(bx, topY + r, r * 0.38, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  return canvas;
}
