import { detectFileKind, isImageKind, SIGNATURE_BYTES, UNSUPPORTED_FILE_MESSAGE } from './file_type.js';
import type { FileKind } from './file_type.js';
import { toEmbeddable } from './image_encode.js';
import { isPasswordError, openPdf } from './pdf_engine.js';
import type { DeckSource } from './page_deck.js';

/**
 * Turning dropped files into deck sources.
 *
 * Type is decided by the bytes, never the extension, and a PDF's page count is read by actually
 * opening it – a file that will not open is better refused here than half-way through an export.
 */
export type LoadedSource = {
  source: DeckSource;
  /** Bytes as the builder needs them: PDFs untouched, images normalized to JPEG/PNG. */
  bytes: Uint8Array;
  kind: FileKind;
};

export type LoadFailure = { name: string; message: string; needsPassword: boolean };

export type LoadResult = { loaded: LoadedSource[]; failures: LoadFailure[] };

const ENCRYPTED_MESSAGE = 'That PDF is password-protected. Remove the password first.';
const UNREADABLE_MESSAGE = 'That file could not be opened.';

let counter = 0;

/** Ids must be unique even when the same file is dropped twice. */
function nextSourceId(): string {
  counter += 1;
  return `s${String(counter)}`;
}

async function loadOne(file: File): Promise<LoadedSource> {
  const head = new Uint8Array(await file.slice(0, SIGNATURE_BYTES).arrayBuffer());
  const kind = detectFileKind(head);
  if (kind === null) {
    throw new Error(UNSUPPORTED_FILE_MESSAGE);
  }

  const raw = new Uint8Array(await file.arrayBuffer());
  const id = nextSourceId();

  if (isImageKind(kind)) {
    const embeddable = await toEmbeddable(kind, raw);
    return {
      source: { id, name: file.name, kind, bytes: file.size, pageCount: 1 },
      bytes: embeddable.bytes,
      kind: embeddable.kind,
    };
  }

  const { pdf, close } = await openPdf(raw);
  const pageCount = pdf.numPages;
  await close();
  return {
    source: { id, name: file.name, kind, bytes: file.size, pageCount },
    bytes: raw,
    kind,
  };
}

/**
 * Load every dropped file, keeping the ones that work and reporting the ones that do not.
 *
 * One bad file in a drop of twenty should not lose the other nineteen, so failures are collected
 * rather than thrown.
 *
 * @param files - What was dropped or picked.
 * @returns The loaded sources and a reason for each failure.
 */
export async function loadFiles(files: readonly File[]): Promise<LoadResult> {
  const loaded: LoadedSource[] = [];
  const failures: LoadFailure[] = [];

  for (const file of files) {
    try {
      loaded.push(await loadOne(file));
    } catch (error: unknown) {
      if (isPasswordError(error)) {
        failures.push({ name: file.name, message: ENCRYPTED_MESSAGE, needsPassword: true });
        continue;
      }
      const message = error instanceof Error && error.message === UNSUPPORTED_FILE_MESSAGE
        ? UNSUPPORTED_FILE_MESSAGE
        : UNREADABLE_MESSAGE;
      failures.push({ name: file.name, message, needsPassword: false });
    }
  }

  return { loaded, failures };
}
