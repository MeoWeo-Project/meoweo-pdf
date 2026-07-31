/**
 * What a download is called. One place, so every tool names its output the same way.
 */
const BRAND = 'meoweo.com';

/** Strip a file extension, leaving something safe to build a name from. */
export function baseName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').trim();
  return base === '' ? 'document' : base;
}

/**
 * Name an output file.
 *
 * @param sourceName - The first input's name, so the download is recognizable.
 * @param suffix - What happened, e.g. `merged` or `compressed`.
 * @param extension - Without the dot.
 * @returns A file name such as `report-merged-meoweo.com.pdf`.
 */
export function outputName(sourceName: string, suffix: string, extension: string): string {
  return `${baseName(sourceName)}-${suffix}-${BRAND}.${extension}`;
}

/** Pad page numbers so a zip of 100 pages sorts correctly in a file manager. */
export function pageFileName(index: number, total: number, extension: string): string {
  const width = String(total).length;
  return `page-${String(index + 1).padStart(width, '0')}.${extension}`;
}
