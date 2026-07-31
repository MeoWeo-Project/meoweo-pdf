/**
 * Page ranges, as people write them: `1-3, 7, 10-12`.
 *
 * Written 1-based because that is what the page cards show, and returned 0-based because that is
 * what every array and every PDF API wants. Getting that boundary wrong is an off-by-one that only
 * shows up in the exported file, so the conversion lives here alone and is tested.
 */

export type RangeParse = { indices: number[] } | { error: string };

const RANGE_PATTERN = /^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/;

/**
 * Parse a page-range expression against a known page count.
 *
 * @param input - Text such as `1-3, 7`.
 * @param pageCount - How many pages the deck holds.
 * @returns Zero-based indices in the order written, deduplicated, or an error message.
 */
export function parsePageRanges(input: string, pageCount: number): RangeParse {
  const trimmed = input.trim();
  if (trimmed === '') {
    return { error: 'Enter page numbers, for example 1-3, 7.' };
  }

  const seen = new Set<number>();
  const indices: number[] = [];

  for (const part of trimmed.split(',')) {
    const match = RANGE_PATTERN.exec(part);
    if (match === null) {
      return { error: `"${part.trim()}" is not a page or a range.` };
    }

    const start = Number(match[1]);
    const end = match[2] === undefined ? start : Number(match[2]);
    if (start < 1 || end < 1 || start > pageCount || end > pageCount) {
      return { error: `Pages must be between 1 and ${String(pageCount)}.` };
    }

    const step = start <= end ? 1 : -1;
    for (let page = start; step > 0 ? page <= end : page >= end; page += step) {
      const index = page - 1;
      if (!seen.has(index)) {
        seen.add(index);
        indices.push(index);
      }
    }
  }

  return { indices };
}

/**
 * Render indices back as a compact expression, collapsing runs.
 *
 * @param indices - Zero-based page indices.
 * @returns Text such as `1-3, 7`.
 */
export function formatPageRanges(indices: readonly number[]): string {
  if (indices.length === 0) {
    return '';
  }
  const sorted = [...new Set(indices)].sort((a, b) => a - b);
  const parts: string[] = [];

  let runStart = sorted[0] ?? 0;
  let previous = runStart;

  const flush = (): void => {
    parts.push(runStart === previous ? String(runStart + 1) : `${String(runStart + 1)}-${String(previous + 1)}`);
  };

  for (const index of sorted.slice(1)) {
    if (index === previous + 1) {
      previous = index;
      continue;
    }
    flush();
    runStart = index;
    previous = index;
  }
  flush();

  return parts.join(', ');
}
