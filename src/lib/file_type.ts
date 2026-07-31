/**
 * What a dropped file actually is, decided by its bytes.
 *
 * The name and the browser's MIME guess are both unreliable – a `.pdf` can be a renamed JPEG, and
 * a drop can arrive with an empty `type`. Every byte is already in the tab, so the signature is
 * cheap to read and is the only answer worth trusting.
 */
export type FileKind = 'pdf' | 'png' | 'jpeg' | 'webp' | 'gif' | 'bmp' | 'tiff';

/** Kinds this suite can place on the page deck. */
export const SUPPORTED_KINDS: readonly FileKind[] = ['pdf', 'png', 'jpeg', 'webp', 'gif', 'bmp', 'tiff'];

/** The `accept` attribute for a file input, so the picker offers exactly what a drop allows. */
export const FILE_ACCEPT_ATTRIBUTE = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tif,.tiff,application/pdf,image/*';

export const UNSUPPORTED_FILE_MESSAGE =
  'Unsupported file. Use a PDF, or a PNG, JPEG, WebP, GIF, BMP or TIFF image.';

/** Longest signature we compare, so callers know how many bytes to read. */
export const SIGNATURE_BYTES = 12;

type Signature = {
  kind: FileKind;
  /** Byte values to match; `null` means "any byte" for container fields such as RIFF sizes. */
  magic: readonly (number | null)[];
  offset?: number;
};

// Ordered longest-first where prefixes could collide; WebP must beat a bare RIFF match.
const SIGNATURES: readonly Signature[] = [
  { kind: 'pdf', magic: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { kind: 'png', magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { kind: 'jpeg', magic: [0xff, 0xd8, 0xff] },
  {
    kind: 'webp',
    // "RIFF" .... "WEBP" – the four size bytes in between are content, not signature.
    magic: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50],
  },
  { kind: 'gif', magic: [0x47, 0x49, 0x46, 0x38] }, // GIF8(7|9)a
  { kind: 'bmp', magic: [0x42, 0x4d] }, // BM
  { kind: 'tiff', magic: [0x49, 0x49, 0x2a, 0x00] }, // little-endian
  { kind: 'tiff', magic: [0x4d, 0x4d, 0x00, 0x2a] }, // big-endian
];

function matches(bytes: Uint8Array, signature: Signature): boolean {
  const start = signature.offset ?? 0;
  if (bytes.length < start + signature.magic.length) {
    return false;
  }
  return signature.magic.every((expected, i) => expected === null || bytes[start + i] === expected);
}

/**
 * Identify a file from its leading bytes.
 *
 * @param bytes - At least {@link SIGNATURE_BYTES} bytes from the start of the file.
 * @returns The kind, or null when nothing matches.
 */
export function detectFileKind(bytes: Uint8Array): FileKind | null {
  return SIGNATURES.find((signature) => matches(bytes, signature))?.kind ?? null;
}

/**
 * Read just enough of a file to identify it.
 *
 * @param file - The dropped or picked file.
 * @returns Its kind, or null when the signature matches nothing supported.
 */
export async function readFileKind(file: Blob): Promise<FileKind | null> {
  const head = await file.slice(0, SIGNATURE_BYTES).arrayBuffer();
  return detectFileKind(new Uint8Array(head));
}

/** Whether a kind becomes one page per file rather than one page per PDF page. */
export function isImageKind(kind: FileKind): boolean {
  return kind !== 'pdf';
}
