// src/lib/geotagRenderer.ts
import { GeotagData, GeotagDisplayOptions, SIZE_PRESET_WIDTH } from "../types/geotag";
import { renderMapCanvas } from "./mapProvider";

const PANEL_BG = "#1e2327"; // dark charcoal
const TEXT_WHITE = "#ffffff";
const TEXT_MUTED = "rgba(255,255,255,0.72)";

function countryFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "";
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function formatDayDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  const day = d.toLocaleDateString(undefined, { weekday: "long" });
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${day}, ${dd}/${mm}/${yyyy}`;
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Wraps text to at most `maxLines`, truncating the final line with "…". */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
): number {
  const words = text.split(" ");
  let line = "";
  let lines = 0;
  let cursorY = y;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = words[i];
      cursorY += lineHeight;
      lines++;
      if (lines >= maxLines - 1) {
        const rest = words.slice(i).join(" ");
        let truncated = rest;
        while (ctx.measureText(truncated + "…").width > maxWidth && truncated.length > 0) {
          truncated = truncated.slice(0, -1);
        }
        ctx.fillText(truncated + (truncated.length < rest.length ? "…" : ""), x, cursorY);
        return cursorY + lineHeight;
      }
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cursorY);
  return cursorY + lineHeight;
}

/**
 * Renders the full geotag banner (map panel + dark info panel) matching the
 * reference design, as a canvas ready to export to PNG.
 */
export async function renderGeotagCanvas(
  data: GeotagData,
  options: GeotagDisplayOptions
): Promise<HTMLCanvasElement> {
  const width = SIZE_PRESET_WIDTH[options.sizePreset];
  const height = Math.round(width * (300 / 1200)); // reference aspect ratio
  const scale = width / 1200;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const radius = 18 * scale;
  const mapW = width * 0.23;

  ctx.save();
  roundedRectPath(ctx, 0, 0, width, height, radius);
  ctx.clip();

  // --- Map panel (left ~23%) ---
  const mapCanvas = await renderMapCanvas(data.latitude, data.longitude, options.mapType, 1024);
  ctx.drawImage(mapCanvas, 0, 0, mapW, height);

  // --- Dark info panel (right) ---
  ctx.fillStyle = PANEL_BG;
  ctx.fillRect(mapW, 0, width - mapW, height);

  const padX = 28 * scale;
  let cursorY = 54 * scale;
  const textX = mapW + padX;
  const maxTextW = width - mapW - padX * 2;

  // Line 1: City, State, Country + flag
  const flag = countryFlagEmoji(data.countryCode);
  const headline =
    [data.city, data.state, data.country].filter(Boolean).join(", ") + (flag ? ` ${flag}` : "");
  ctx.fillStyle = TEXT_WHITE;
  ctx.font = `600 ${Math.round(32 * scale)}px Arial`;
  ctx.fillText(headline, textX, cursorY, maxTextW);
  cursorY += 40 * scale;

  // Line 2: Address (wraps up to 2 lines)
  if (options.showAddress && data.address) {
    ctx.fillStyle = TEXT_MUTED;
    ctx.font = `${Math.round(19 * scale)}px Arial`;
    cursorY = wrapText(ctx, data.address, textX, cursorY, maxTextW, 24 * scale, 2);
  }

  // Line 3: Coordinates
  if (options.showCoordinates) {
    ctx.fillStyle = TEXT_MUTED;
    ctx.font = `${Math.round(19 * scale)}px Arial`;
    ctx.fillText(
      `Lat ${data.latitude.toFixed(6)}°  Long ${data.longitude.toFixed(6)}°`,
      textX,
      cursorY,
      maxTextW
    );
    cursorY += 26 * scale;
  }

  // Line 4: Date / time
  if (options.showDate && data.date) {
    let line = formatDayDate(data.date);
    if (options.showTime && data.time) line += ` ${data.time}`;
    ctx.fillStyle = TEXT_MUTED;
    ctx.font = `${Math.round(19 * scale)}px Arial`;
    ctx.fillText(line, textX, cursorY, maxTextW);
    cursorY += 26 * scale;
  }

  // Bottom row: altitude / accuracy
  const bottomBits: string[] = [];
  if (options.showAltitude && data.altitude) bottomBits.push(`Alt ${data.altitude}`);
  if (options.showAccuracy && data.accuracy) bottomBits.push(`Accuracy ${data.accuracy}`);
  if (bottomBits.length) {
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = `${Math.round(16 * scale)}px Arial`;
    ctx.fillText(bottomBits.join("   •   "), textX, height - 18 * scale, maxTextW);
  }

  ctx.restore();

  if (options.opacity < 1) {
    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = width;
    finalCanvas.height = height;
    const fctx = finalCanvas.getContext("2d")!;
    fctx.globalAlpha = options.opacity;
    fctx.drawImage(canvas, 0, 0);
    return finalCanvas;
  }

  return canvas;
}

/** Renders the geotag straight to a PNG Blob, ready to feed to FFmpeg. */
export async function renderGeotagPNGBlob(
  data: GeotagData,
  options: GeotagDisplayOptions
): Promise<Blob> {
  const canvas = await renderGeotagCanvas(data, options);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Failed to export geotag PNG"))),
      "image/png"
    );
  });
}
