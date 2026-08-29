// src/lib/mapProvider.ts
export type MapType = "satellite" | "street";

function lonLatToTile(lon: number, lat: number, zoom: number) {
  const latRad = (lat * Math.PI) / 180;
  const n = Math.pow(2, zoom);
  const x = ((lon + 180) / 360) * n;
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

function tileUrl(type: MapType, z: number, x: number, y: number) {
  if (type === "satellite") {
    // Esri World Imagery — free, no API key required.
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  }
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Renders a map centered on lat/lon with a red pin, as a square canvas.
 * zoom=17 (street-level detail) and a large base `size` avoid the blurry
 * look you get from zooming a low-res tile grid too far in.
 */
export async function renderMapCanvas(
  lat: number,
  lon: number,
  type: MapType,
  size = 1024,
  zoom = 17
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#e5e5e5";
  ctx.fillRect(0, 0, size, size);

  const t = lonLatToTile(lon, lat, zoom);
  const cx = Math.floor(t.x);
  const cy = Math.floor(t.y);
  const tile = size / 3;

  const loads: Promise<void>[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const url = tileUrl(type, zoom, cx + dx, cy + dy);
      loads.push(
        loadImage(url).then((img) => {
          if (!img) return;
          const px = size / 2 + (dx - (t.x - cx)) * tile;
          const py = size / 2 + (dy - (t.y - cy)) * tile;
          ctx.drawImage(img, px, py, tile, tile);
        })
      );
    }
  }
  await Promise.all(loads);

  // Red location pin, centered.
  const r = size * 0.014;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
  ctx.fillStyle = "#e53935";
  ctx.fill();
  ctx.lineWidth = size * 0.005;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();

  // Attribution (required by both Esri and OpenStreetMap terms of use).
  const label =
    type === "satellite"
      ? "Esri, Maxar, Earthstar Geographics"
      : "© OpenStreetMap contributors";
  ctx.font = `${Math.round(size * 0.015)}px Arial`;
  const textW = ctx.measureText(label).width;
  ctx.fillStyle = "rgba(0,0,0,.55)";
  ctx.fillRect(size * 0.01, size - size * 0.04, textW + size * 0.02, size * 0.028);
  ctx.fillStyle = "#fff";
  ctx.fillText(label, size * 0.02, size - size * 0.018);

  return canvas;
}
