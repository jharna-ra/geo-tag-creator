export interface CropRect {
  /**
   * Normalized values from 0 to 1.
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
  const width = Math.min(
    1,
    Math.max(0.05, crop.width),
  );

  const height = Math.min(
    1,
    Math.max(0.05, crop.height),
  );

  const x = Math.min(
    1 - width,
    Math.max(0, crop.x),
  );

  const y = Math.min(
    1 - height,
    Math.max(0, crop.y),
  );

  return {
    x,
    y,
    width,
    height,
  };
}

export function cropIsFullVideo(
  crop: CropRect,
): boolean {
  return (
    crop.x <= 0 &&
    crop.y <= 0 &&
    crop.width >= 1 &&
    crop.height >= 1
  );
}
