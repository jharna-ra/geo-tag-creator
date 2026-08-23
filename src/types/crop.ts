export interface CropRect {
  /**
   * Values are normalized from 0 to 1.
   *
   * x      = left position
   * y      = top position
   * width  = crop width
   * height = crop height
   */
  x: number;
  y: number;
  width: number;
  height: number;
}

export const DEFAULT_CROP: CropRect = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
};

export function clampCrop(
  crop: CropRect,
): CropRect {
  const x = Math.max(
    0,
    Math.min(1, crop.x),
  );

  const y = Math.max(
    0,
    Math.min(1, crop.y),
  );

  const width = Math.max(
    0.01,
    Math.min(1 - x, crop.width),
  );

  const height = Math.max(
    0.01,
    Math.min(1 - y, crop.height),
  );

  return {
    x,
    y,
    width,
    height,
  };
}
