/**
 * What the deck can hold, and why those are the numbers.
 *
 * Nothing here is a security control – the files never leave the browser, so the only thing at
 * stake is the user's own tab. These are memory limits.
 *
 * A PDF's file size says little about its cost: a 5 MB scan of 300 photographed pages costs far
 * more to render than a 20 MB text document, because every visible page becomes a canvas bitmap.
 * So both the bytes and the page count are capped, and the render cache is what the page cap
 * really protects.
 */
export const MAX_TOTAL_BYTES = 200 * 1024 * 1024;
export const MAX_PAGES = 500;
export const MAX_FILES = 50;

const MB = 1024 * 1024;

/** Below this reported RAM the caps are halved. */
const LOW_MEMORY_THRESHOLD_GB = 4;

export const TOO_MANY_FILES_MESSAGE = `That is more than ${String(MAX_FILES)} files at once.`;

export function tooLargeMessage(maxBytes: number): string {
  return `That would be over ${String(Math.round(maxBytes / MB))} MB. Everything is processed in your browser, which cannot hold that much at once.`;
}

export function tooManyPagesMessage(maxPages: number): string {
  return `That would be over ${String(maxPages)} pages. Everything is processed in your browser, which cannot hold that many at once.`;
}

/**
 * The caps for a device reporting this much RAM.
 *
 * @param deviceMemoryGb - `navigator.deviceMemory`, or undefined when the browser hides it.
 * @returns The byte and page caps to enforce.
 */
export function limitsFor(deviceMemoryGb: number | undefined): { maxBytes: number; maxPages: number } {
  // ponytail: deviceMemory is absent on iOS Safari, the platform most likely to need this. Treating
  // "unknown" as "roomy" is deliberate – refusing real work on a capable device is the worse failure.
  const small = deviceMemoryGb !== undefined && deviceMemoryGb <= LOW_MEMORY_THRESHOLD_GB;
  return small
    ? { maxBytes: MAX_TOTAL_BYTES / 2, maxPages: MAX_PAGES / 2 }
    : { maxBytes: MAX_TOTAL_BYTES, maxPages: MAX_PAGES };
}

/**
 * Whether adding this much more would break a cap.
 *
 * @param current - Bytes and pages already loaded.
 * @param incoming - Bytes and pages about to be added.
 * @param deviceMemoryGb - `navigator.deviceMemory`, when known.
 * @returns A message to show the user, or null when the deck can take it.
 */
export function validateAddition(
  current: { bytes: number; pages: number },
  incoming: { bytes: number; pages: number; files: number },
  deviceMemoryGb: number | undefined,
): string | null {
  const { maxBytes, maxPages } = limitsFor(deviceMemoryGb);
  if (incoming.files > MAX_FILES) {
    return TOO_MANY_FILES_MESSAGE;
  }
  if (current.bytes + incoming.bytes > maxBytes) {
    return tooLargeMessage(maxBytes);
  }
  if (current.pages + incoming.pages > maxPages) {
    return tooManyPagesMessage(maxPages);
  }
  return null;
}
