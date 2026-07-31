import { canvasToBlob } from './pdf_engine.js';
import { fitInside, readImageSize } from './image_size.js';
import type { FileKind } from './file_type.js';
import { canEmbedDirectly } from './pdf_build.js';

/**
 * Re-encoding images through a canvas.
 *
 * Two jobs use this. Embedding needs every image as JPEG or PNG, because those are the only formats
 * pdf-lib decodes – a WebP or TIFF has to be converted first. Compression needs the same path with
 * a lower quality and a size cap, which is where the real saving on a scanned document comes from.
 */

/** Quality passed to the JPEG encoder when re-encoding for size. */
export type CompressionLevel = 'light' | 'balanced' | 'strong';

type CompressionSetting = { quality: number; maxEdge: number };

const SETTINGS: Record<CompressionLevel, CompressionSetting> = {
  light: { quality: 0.9, maxEdge: 3000 },
  balanced: { quality: 0.75, maxEdge: 2000 },
  strong: { quality: 0.55, maxEdge: 1400 },
};

export const COMPRESSION_LEVELS: readonly CompressionLevel[] = ['light', 'balanced', 'strong'];

/** The knobs a level turns, exposed so the panel can describe what it will do. */
export function compressionSetting(level: CompressionLevel): CompressionSetting {
  return SETTINGS[level];
}

async function drawToCanvas(blob: Blob, maxEdge: number): Promise<HTMLCanvasElement> {
  const size = await readImageSize(blob);
  const target = fitInside(size, maxEdge, maxEdge);

  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext('2d');
    if (context === null) {
      throw new Error('canvas 2d context unavailable');
    }
    context.drawImage(bitmap, 0, 0, target.width, target.height);
    return canvas;
  } finally {
    bitmap.close();
  }
}

/**
 * Make an image embeddable: JPEG and PNG pass through untouched, anything else is re-encoded.
 *
 * Passing bytes through unchanged matters – re-encoding a JPEG that needs no change would lose
 * quality for nothing.
 *
 * @param kind - What the bytes actually are.
 * @param bytes - The original file.
 * @returns Bytes pdf-lib can embed, and the kind they now are.
 */
export async function toEmbeddable(
  kind: FileKind,
  bytes: Uint8Array,
): Promise<{ kind: FileKind; bytes: Uint8Array }> {
  if (canEmbedDirectly(kind)) {
    return { kind, bytes };
  }
  // The buffer may be a view into a larger ArrayBuffer; slice so Blob sees only these bytes.
  const blob = new Blob([bytes.slice().buffer]);
  const canvas = await drawToCanvas(blob, Number.MAX_SAFE_INTEGER);
  const encoded = await canvasToBlob(canvas, 'image/png');
  return { kind: 'png', bytes: new Uint8Array(await encoded.arrayBuffer()) };
}

/**
 * Re-encode an image smaller.
 *
 * @param bytes - The original image.
 * @param level - How hard to squeeze.
 * @returns JPEG bytes, or the original when the re-encode came out larger.
 */
export async function compressImage(
  bytes: Uint8Array,
  level: CompressionLevel,
): Promise<{ kind: FileKind; bytes: Uint8Array }> {
  const { quality, maxEdge } = SETTINGS[level];
  const blob = new Blob([bytes.slice().buffer]);
  const canvas = await drawToCanvas(blob, maxEdge);
  const encoded = await canvasToBlob(canvas, 'image/jpeg', quality);

  // Compressing an already-small image can grow it; keeping the original is the honest outcome.
  if (encoded.size >= bytes.byteLength) {
    return { kind: 'jpeg', bytes };
  }
  return { kind: 'jpeg', bytes: new Uint8Array(await encoded.arrayBuffer()) };
}
