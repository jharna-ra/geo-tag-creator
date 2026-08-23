import type { GeotagData, GeotagOptions } from "@/types/geotag";
import { flagEmoji } from "./geocoding";
import { mapAttribution, renderMapCanvas } from "./mapProvider";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function formatDateLine(data: GeotagData, opts: GeotagOptions): string {
  if (!data.date) return "";
  const parts = data.date.split("-");
  const y = Number(parts[0] ?? 0);
  const m = Number(parts[1] ?? 1);
  const d = Number(parts[2] ?? 1);
  const dt = new Date(y, m - 1, d);
  const day = DAYS[dt.getDay()] ?? "";
  const ddmmyyyy = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
  let line = `${day}, ${ddmmyyyy}`;
  if (opts.showTime && data.time) line += ` ${data.time}`;
  return line;
}

export function headlineText(data: GeotagData): string {
  const parts = [data.city, data.state, data.country].filter(Boolean);
  const flag = flagEmoji(data.countryCode);
  return `${parts.join(", ") || "Unknown location"}${flag ? " " + flag : ""}`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1);
  return t + "…";
}

export interface RenderResult {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

/**
 * Draws the reference-style wide geotag banner:
 * left square map with red pin, right dark charcoal info panel.
 */
export async function renderGeotag(
  data: GeotagData,
  opts: GeotagOptions,
  width = 1200,
): Promise<RenderResult> {
  const height = Math.round(width * 0.235);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const radius = Math.round(height * 0.09);

  ctx.clearRect(0, 0, width, height);
  roundRect(ctx, 0, 0, width, height, radius);
  ctx.save();
  ctx.clip();

  // right charcoal panel
  ctx.fillStyle = "#2b2f33";
  ctx.fillRect(0, 0, width, height);

  const mapW = Math.round(width * 0.225);
  // left map
  const lat = data.latitude;
  const lon = data.longitude;
  if (lat != null && lon != null && isFinite(lat) && isFinite(lon)) {
    try {
      const map = await renderMapCanvas(lat, lon, Math.max(mapW, height), opts.mapType, 15);
      ctx.drawImage(map, 0, 0, mapW, height);
    } catch {
      ctx.fillStyle = "#3a4046";
      ctx.fillRect(0, 0, mapW, height);
    }
  } else {
    ctx.fillStyle = "#3a4046";
    ctx.fillRect(0, 0, mapW, height);
  }

  // map attribution
  ctx.font = `${Math.round(height * 0.062)}px system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.textAlign = "right";
  ctx.fillText(mapAttribution(opts.mapType), mapW - height * 0.05, height - height * 0.05);
  ctx.textAlign = "left";

  // text block
  const padX = Math.round(width * 0.026);
  const x = mapW + padX;
  const maxW = width - x - padX;
  let y = Math.round(height * 0.28);

  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";

  const h1 = Math.round(height * 0.185);
  ctx.font = `700 ${h1}px system-ui, "Segoe UI", sans-serif`;
  ctx.fillText(fitText(ctx, headlineText(data), maxW), x, y);
  y += Math.round(height * 0.2);

  const body = Math.round(height * 0.115);
  const lineGap = Math.round(height * 0.155);

  const lines: string[] = [];
  if (opts.showAddress && data.address) lines.push(data.address);
  if (opts.showCoordinates && lat != null && lon != null)
    lines.push(`Lat ${lat.toFixed(6)}°  Long ${lon.toFixed(6)}°`);
  if (opts.showDate) {
    const dl = formatDateLine(data, opts);
    if (dl) lines.push(dl);
  } else if (opts.showTime && data.time) {
    lines.push(data.time);
  }

  const extras: string[] = [];
  if (opts.showAltitude && data.altitude) extras.push(`Altitude ${data.altitude}`);
  if (opts.showAccuracy && data.accuracy) extras.push(`Accuracy ${data.accuracy}`);
  if (extras.length) lines.push(extras.join("   •   "));

  ctx.font = `400 ${body}px system-ui, "Segoe UI", sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  for (const line of lines) {
    ctx.fillText(fitText(ctx, line, maxW), x, y);
    y += lineGap;
  }

  ctx.restore();
  return { canvas, width, height };
}

export async function renderGeotagBlob(
  data: GeotagData,
  opts: GeotagOptions,
  width: number,
): Promise<Blob> {
  const { canvas } = await renderGeotag(data, opts, width);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to render geotag image"))), "image/png"),
  );
}
