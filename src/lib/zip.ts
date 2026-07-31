import { zip } from 'fflate';

/**
 * Zipping many outputs into one download.
 *
 * Stored, not deflated: the members are already-compressed PDFs and JPEGs, so deflate would spend
 * real time to save almost nothing.
 */
export type ZipEntry = { name: string; bytes: Uint8Array };

/**
 * Pack entries into a zip.
 *
 * @param entries - Files to include, in order.
 * @returns The zip archive.
 */
export function zipFiles(entries: readonly ZipEntry[]): Promise<Uint8Array> {
  const input: Record<string, [Uint8Array, { level: 0 }]> = {};
  for (const entry of entries) {
    input[entry.name] = [entry.bytes, { level: 0 }];
  }
  return new Promise((resolve, reject) => {
    zip(input, (error, data) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(data);
    });
  });
}
