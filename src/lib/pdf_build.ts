import { PDFDocument, degrees } from '@cantoo/pdf-lib';

import { isImageKind } from './file_type.js';
import type { FileKind } from './file_type.js';
import type { Deck, DeckPage } from './page_deck.js';

/**
 * Turning the deck into a file.
 *
 * The deck is the only source of order and rotation, so this walks it start to finish and copies
 * each page from whichever source it came from. Sources are opened once and reused – re-parsing a
 * document per page is what makes a naive merge quadratic.
 */

/** The bytes of each loaded file, keyed by source id. */
export type SourceBytes = ReadonlyMap<string, { kind: FileKind; bytes: Uint8Array }>;

/** Embedding needs the raw image; pdf-lib only decodes JPEG and PNG itself. */
const DIRECTLY_EMBEDDABLE: readonly FileKind[] = ['jpeg', 'png'];

/** Whether an image can be embedded as-is, or has to be re-encoded through a canvas first. */
export function canEmbedDirectly(kind: FileKind): boolean {
  return DIRECTLY_EMBEDDABLE.includes(kind);
}

async function embedImagePage(
  out: PDFDocument,
  kind: FileKind,
  bytes: Uint8Array,
  rotation: number,
): Promise<void> {
  const image = kind === 'png' ? await out.embedPng(bytes) : await out.embedJpg(bytes);
  // The page takes the image's own size, so nothing is cropped or letterboxed.
  const page = out.addPage([image.width, image.height]);
  page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  if (rotation !== 0) {
    page.setRotation(degrees(rotation));
  }
}

/**
 * Build one PDF containing every page of the deck, in deck order, with deck rotations applied.
 *
 * @param deck - The ordered pages.
 * @param sources - Raw bytes for each source, already normalized to JPEG/PNG for images.
 * @param onProgress - Called with a 0..1 fraction as pages are copied.
 * @returns The assembled PDF.
 */
export async function buildPdf(
  deck: Deck,
  sources: SourceBytes,
  onProgress?: (fraction: number) => void,
): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const opened = new Map<string, PDFDocument>();

  const openSource = async (sourceId: string): Promise<PDFDocument> => {
    const existing = opened.get(sourceId);
    if (existing !== undefined) {
      return existing;
    }
    const source = sources.get(sourceId);
    if (source === undefined) {
      throw new Error(`missing bytes for source ${sourceId}`);
    }
    const doc = await PDFDocument.load(source.bytes);
    opened.set(sourceId, doc);
    return doc;
  };

  for (const [index, page] of deck.pages.entries()) {
    const source = sources.get(page.sourceId);
    if (source === undefined) {
      throw new Error(`missing bytes for source ${page.sourceId}`);
    }

    if (isImageKind(source.kind)) {
      await embedImagePage(out, source.kind, source.bytes, page.rotation);
    } else {
      const doc = await openSource(page.sourceId);
      const [copied] = await out.copyPages(doc, [page.sourceIndex]);
      if (copied === undefined) {
        throw new Error(`could not copy page ${String(page.sourceIndex)}`);
      }
      if (page.rotation !== 0) {
        // Add to whatever the page already carried; a scan is often stored pre-rotated.
        copied.setRotation(degrees(copied.getRotation().angle + page.rotation));
      }
      out.addPage(copied);
    }

    onProgress?.((index + 1) / deck.pages.length);
  }

  return out.save();
}

/**
 * Build one PDF per group of pages – what split and extract produce.
 *
 * @param deck - The ordered pages.
 * @param groups - Each group is a list of deck indices, in output order.
 * @param sources - Raw bytes per source.
 * @returns One PDF per group, in the same order.
 */
export async function buildPdfGroups(
  deck: Deck,
  groups: readonly (readonly number[])[],
  sources: SourceBytes,
): Promise<Uint8Array[]> {
  const out: Uint8Array[] = [];
  for (const group of groups) {
    const pages = group
      .map((index) => deck.pages[index])
      .filter((page): page is DeckPage => page !== undefined);
    out.push(await buildPdf({ ...deck, pages }, sources));
  }
  return out;
}
