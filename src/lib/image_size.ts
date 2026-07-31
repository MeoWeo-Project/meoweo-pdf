/**
 * How big an image is, without decoding it into a canvas.
 *
 * `createImageBitmap` is the cheapest way to ask, and it also proves the browser can actually
 * decode the file – a check worth having before a card promises to render it.
 */
export type ImageSize = { width: number; height: number };

/**
 * Measure an image file.
 *
 * @param blob - The image.
 * @returns Its pixel dimensions.
 */
export async function readImageSize(blob: Blob): Promise<ImageSize> {
  const bitmap = await createImageBitmap(blob);
  try {
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

/**
 * Scale dimensions to fit inside a box, never enlarging.
 *
 * @param size - The original size.
 * @param maxWidth - Width of the box.
 * @param maxHeight - Height of the box.
 * @returns The fitted size.
 */
export function fitInside(size: ImageSize, maxWidth: number, maxHeight: number): ImageSize {
  const scale = Math.min(maxWidth / size.width, maxHeight / size.height, 1);
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}
