import * as pdfjs from 'pdfjs-dist';
// pdf.js ships its own worker; pointing at it keeps parsing off the main thread for free, which is
// why this suite needs no hand-written render worker.
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type LoadedPdf = pdfjs.PDFDocumentProxy;

/**
 * An open document and the way to release it. `destroy` lives on the loading task rather than the
 * document, and forgetting it leaks a worker per file – hence the pairing.
 */
export type PdfHandle = { pdf: LoadedPdf; close: () => Promise<void> };

/**
 * Open a PDF for reading. Encrypted files reject with `PasswordException`, which callers turn into
 * a password prompt rather than a failure.
 *
 * @param bytes - The whole file.
 * @param password - Supplied on a retry once the user has typed one.
 * @returns The opened document and its release function.
 */
export async function openPdf(bytes: Uint8Array, password?: string): Promise<PdfHandle> {
  // pdf.js transfers and neuters the buffer it is given, so it gets a copy: the original bytes are
  // still needed later to build the output.
  const data = new Uint8Array(bytes);
  const task = pdfjs.getDocument(password === undefined ? { data } : { data, password });
  const pdf = await task.promise;
  return { pdf, close: () => task.destroy() };
}

/** Whether a thrown error is pdf.js asking for a password. */
export function isPasswordError(error: unknown): boolean {
  return error instanceof Error && error.name === 'PasswordException';
}

/**
 * Draw one page into a canvas at a width that fits `maxWidth`.
 *
 * @param pdf - An opened document.
 * @param pageNumber - 1-based, as pdf.js counts.
 * @param maxWidth - Target width in CSS pixels.
 * @returns A canvas holding the rendered page.
 */
export async function renderPageToCanvas(
  pdf: LoadedPdf,
  pageNumber: number,
  maxWidth: number,
): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(pageNumber);
  const unscaled = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: maxWidth / unscaled.width });

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));

  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error('canvas 2d context unavailable');
  }

  await page.render({ canvas, canvasContext: context, viewport }).promise;
  return canvas;
}

/** A canvas as a blob, at the given type and quality. */
export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob === null) {
          reject(new Error('canvas encoding failed'));
          return;
        }
        resolve(blob);
      },
      type,
      quality,
    );
  });
}
