/**
 * File purpose: Calculates proportional, contain-style placement for organization logos in generated documents.
 * Fallback/error behavior: Invalid or non-positive dimensions return a zero-sized rectangle centered in the target bounds.
 */

export type ImageBounds = { x: number; y: number; width: number; height: number };

/** Scales an image proportionally so the complete image is centered within the supplied bounds. */
export function containImage(image: Pick<ImageBounds, 'width' | 'height'>, bounds: ImageBounds): ImageBounds {
  if (image.width <= 0 || image.height <= 0 || bounds.width <= 0 || bounds.height <= 0) {
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2, width: 0, height: 0 };
  }

  const scale = Math.min(bounds.width / image.width, bounds.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return {
    x: bounds.x + (bounds.width - width) / 2,
    y: bounds.y + (bounds.height - height) / 2,
    width,
    height,
  };
}
