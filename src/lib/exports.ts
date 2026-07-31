import { downloadBlob } from 'meoweo-shared';

import { compressImage } from './image_encode.js';
import type { CompressionLevel } from './image_encode.js';
import { outputName, pageFileName } from './output_name.js';
import type { Deck } from './page_deck.js';
import { buildPdf, buildPdfGroups } from './pdf_build.js';
import type { SourceBytes } from './pdf_build.js';
import { canvasToBlob, openPdf, renderPageToCanvas } from './pdf_engine.js';
import type { PdfHandle } from './pdf_engine.js';
import { isImageKind } from './file_type.js';
import { zipFiles } from './zip.js';
import type { ZipEntry } from './zip.js';

/**
 * What each tool actually produces.
 *
 * Every one of these walks the deck, so the order and rotation on screen are the order and rotation
 * in the file. None of them touch the network.
 */
export type ExportProgress = (fraction: number) => void;

/** Width images are rendered at when a PDF page becomes a picture. */
const IMAGE_EXPORT_WIDTH = 1654; // ~140 dpi on A4

function blobOf(bytes: Uint8Array, type: string): Blob {
  return new Blob([bytes.slice().buffer], { type });
}

/** The name to base outputs on: whatever was dropped first. */
function firstName(deck: Deck): string {
  return deck.sources[0]?.name ?? 'document';
}

/** Merge the whole deck into one PDF and download it. */
export async function exportMerged(
  deck: Deck,
  sources: SourceBytes,
  onProgress?: ExportProgress,
): Promise<void> {
  const bytes = await buildPdf(deck, sources, onProgress);
  downloadBlob(outputName(firstName(deck), 'merged', 'pdf'), blobOf(bytes, 'application/pdf'));
}

/** Write the chosen pages out as their own PDF. */
export async function exportExtracted(
  deck: Deck,
  sources: SourceBytes,
  indices: readonly number[],
): Promise<void> {
  const [bytes] = await buildPdfGroups(deck, [indices], sources);
  if (bytes === undefined) {
    throw new Error('nothing to extract');
  }
  downloadBlob(outputName(firstName(deck), 'extracted', 'pdf'), blobOf(bytes, 'application/pdf'));
}

/** Split every page into its own PDF, zipped. */
export async function exportSplit(
  deck: Deck,
  sources: SourceBytes,
  onProgress?: ExportProgress,
): Promise<void> {
  const groups = deck.pages.map((_, index) => [index]);
  const built = await buildPdfGroups(deck, groups, sources);
  const entries: ZipEntry[] = built.map((bytes, index) => ({
    name: pageFileName(index, built.length, 'pdf'),
    bytes,
  }));
  onProgress?.(1);
  const archive = await zipFiles(entries);
  downloadBlob(outputName(firstName(deck), 'split', 'zip'), blobOf(archive, 'application/zip'));
}

/**
 * Render every deck page to an image and zip them.
 *
 * Rotation is applied by the renderer, not by the deck, so an image comes out the way the card
 * looks.
 */
export async function exportImages(
  deck: Deck,
  sources: SourceBytes,
  format: 'png' | 'jpeg',
  onProgress?: ExportProgress,
): Promise<void> {
  const mime = format === 'png' ? 'image/png' : 'image/jpeg';
  const entries: ZipEntry[] = [];
  const opened = new Map<string, PdfHandle>();

  try {
    for (const [index, page] of deck.pages.entries()) {
      const source = sources.get(page.sourceId);
      if (source === undefined) {
        continue;
      }

      let blob: Blob;
      if (isImageKind(source.kind)) {
        blob = blobOf(source.bytes, mime);
      } else {
        let handle = opened.get(page.sourceId);
        if (handle === undefined) {
          handle = await openPdf(source.bytes);
          opened.set(page.sourceId, handle);
        }
        const canvas = await renderPageToCanvas(handle.pdf, page.sourceIndex + 1, IMAGE_EXPORT_WIDTH);
        blob = await canvasToBlob(canvas, mime, format === 'jpeg' ? 0.9 : undefined);
      }

      entries.push({
        name: pageFileName(index, deck.pages.length, format === 'jpeg' ? 'jpg' : 'png'),
        bytes: new Uint8Array(await blob.arrayBuffer()),
      });
      onProgress?.((index + 1) / deck.pages.length);
    }
  } finally {
    for (const handle of opened.values()) {
      await handle.close();
    }
  }

  const archive = await zipFiles(entries);
  downloadBlob(outputName(firstName(deck), 'images', 'zip'), blobOf(archive, 'application/zip'));
}

/**
 * Rebuild the deck with every page rasterized and re-encoded smaller.
 *
 * This is what actually shrinks a scanned document: the pages become JPEGs at a lower quality and
 * a capped resolution. It is lossy by definition, which is why the level is the user's choice.
 *
 * @returns The size before and after, so the panel can report the saving honestly.
 */
export async function exportCompressed(
  deck: Deck,
  sources: SourceBytes,
  level: CompressionLevel,
  onProgress?: ExportProgress,
): Promise<{ before: number; after: number }> {
  const before = [...sources.values()].reduce((sum, source) => sum + source.bytes.byteLength, 0);
  const rebuilt = new Map<string, { kind: 'jpeg'; bytes: Uint8Array }>();
  const opened = new Map<string, PdfHandle>();

  // Each deck page becomes its own single-page image source, so order and rotation survive.
  const pages = [];
  try {
    for (const [index, page] of deck.pages.entries()) {
      const source = sources.get(page.sourceId);
      if (source === undefined) {
        continue;
      }

      let raw: Uint8Array;
      if (isImageKind(source.kind)) {
        raw = source.bytes;
      } else {
        let handle = opened.get(page.sourceId);
        if (handle === undefined) {
          handle = await openPdf(source.bytes);
          opened.set(page.sourceId, handle);
        }
        const canvas = await renderPageToCanvas(handle.pdf, page.sourceIndex + 1, IMAGE_EXPORT_WIDTH);
        const rendered = await canvasToBlob(canvas, 'image/jpeg', 0.92);
        raw = new Uint8Array(await rendered.arrayBuffer());
      }

      const squeezed = await compressImage(raw, level);
      const id = `c${String(index)}`;
      rebuilt.set(id, { kind: 'jpeg', bytes: squeezed.bytes });
      pages.push({ id: `${id}:0`, sourceId: id, sourceIndex: 0, rotation: page.rotation });
      onProgress?.((index + 1) / deck.pages.length);
    }
  } finally {
    for (const handle of opened.values()) {
      await handle.close();
    }
  }

  const flat: Deck = {
    sources: [...rebuilt.keys()].map((id) => ({
      id,
      name: id,
      kind: 'jpeg' as const,
      bytes: rebuilt.get(id)?.bytes.byteLength ?? 0,
      pageCount: 1,
    })),
    pages,
  };

  const bytes = await buildPdf(flat, rebuilt);
  downloadBlob(outputName(firstName(deck), 'compressed', 'pdf'), blobOf(bytes, 'application/pdf'));
  return { before, after: bytes.byteLength };
}
