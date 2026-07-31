import { describe, expect, it } from 'vitest';

import { formatPageRanges, parsePageRanges } from './page_ranges';

/** Unwrap a parse that is expected to succeed. */
function indices(input: string, pageCount = 10): number[] {
  const result = parsePageRanges(input, pageCount);
  if ('error' in result) {
    throw new Error(`expected a parse, got: ${result.error}`);
  }
  return result.indices;
}

function errorOf(input: string, pageCount = 10): string {
  const result = parsePageRanges(input, pageCount);
  if (!('error' in result)) {
    throw new Error('expected an error');
  }
  return result.error;
}

describe('parsePageRanges', () => {
  it('reads a single page, 1-based in and 0-based out', () => {
    expect(indices('1')).toEqual([0]);
    expect(indices('7')).toEqual([6]);
  });

  it('reads a range inclusively at both ends', () => {
    expect(indices('1-3')).toEqual([0, 1, 2]);
  });

  it('reads a mixed list, keeping the order written', () => {
    expect(indices('3, 1, 5-6')).toEqual([2, 0, 4, 5]);
  });

  it('tolerates whitespace', () => {
    expect(indices('  1 -  3 ,  7  ')).toEqual([0, 1, 2, 6]);
  });

  it('deduplicates overlapping ranges', () => {
    expect(indices('1-3, 2-4')).toEqual([0, 1, 2, 3]);
  });

  it('counts down when the range is written backwards', () => {
    expect(indices('3-1')).toEqual([2, 1, 0]);
  });

  it('rejects an empty expression', () => {
    expect(errorOf('')).toMatch(/Enter page numbers/);
    expect(errorOf('   ')).toMatch(/Enter page numbers/);
  });

  it('rejects nonsense', () => {
    expect(errorOf('abc')).toMatch(/not a page or a range/);
    expect(errorOf('1-')).toMatch(/not a page or a range/);
    expect(errorOf('1--3')).toMatch(/not a page or a range/);
  });

  it('rejects page zero, since the cards are 1-based', () => {
    expect(errorOf('0')).toMatch(/between 1 and/);
  });

  it('rejects pages past the end', () => {
    expect(errorOf('11', 10)).toMatch(/between 1 and 10/);
    expect(errorOf('5-99', 10)).toMatch(/between 1 and 10/);
  });

  it('accepts the last page exactly', () => {
    expect(indices('10', 10)).toEqual([9]);
  });
});

describe('formatPageRanges', () => {
  it('collapses a run', () => {
    expect(formatPageRanges([0, 1, 2])).toBe('1-3');
  });

  it('writes isolated pages separately', () => {
    expect(formatPageRanges([0, 2, 4])).toBe('1, 3, 5');
  });

  it('mixes runs and singles', () => {
    expect(formatPageRanges([0, 1, 2, 6, 9, 10])).toBe('1-3, 7, 10-11');
  });

  it('sorts and deduplicates first', () => {
    expect(formatPageRanges([4, 0, 1, 0, 2])).toBe('1-3, 5');
  });

  it('is empty for no pages', () => {
    expect(formatPageRanges([])).toBe('');
  });

  it('round-trips through parsePageRanges', () => {
    const original = [0, 1, 2, 6, 9];
    expect(indices(formatPageRanges(original), 20)).toEqual(original);
  });
});
