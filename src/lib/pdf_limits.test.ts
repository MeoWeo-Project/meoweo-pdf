import { describe, expect, it } from 'vitest';

import {
  MAX_FILES,
  MAX_PAGES,
  MAX_TOTAL_BYTES,
  limitsFor,
  validateAddition,
} from './pdf_limits';

const empty = { bytes: 0, pages: 0 };

describe('limitsFor', () => {
  it('gives the full caps when memory is unknown', () => {
    expect(limitsFor(undefined)).toEqual({ maxBytes: MAX_TOTAL_BYTES, maxPages: MAX_PAGES });
  });

  it('gives the full caps on a roomy device', () => {
    expect(limitsFor(8).maxPages).toBe(MAX_PAGES);
  });

  it('halves the caps at or below the low-memory threshold', () => {
    expect(limitsFor(4)).toEqual({ maxBytes: MAX_TOTAL_BYTES / 2, maxPages: MAX_PAGES / 2 });
    expect(limitsFor(2).maxPages).toBe(MAX_PAGES / 2);
  });
});

describe('validateAddition', () => {
  it('accepts a modest first drop', () => {
    expect(validateAddition(empty, { bytes: 5_000_000, pages: 20, files: 1 }, undefined)).toBeNull();
  });

  it('rejects too many files at once', () => {
    const problem = validateAddition(empty, { bytes: 10, pages: 1, files: MAX_FILES + 1 }, undefined);
    expect(problem).toMatch(/more than/);
  });

  it('rejects a drop that would exceed the byte cap', () => {
    const problem = validateAddition(empty, { bytes: MAX_TOTAL_BYTES + 1, pages: 1, files: 1 }, undefined);
    expect(problem).toMatch(/MB/);
  });

  it('rejects a drop that would exceed the page cap', () => {
    const problem = validateAddition(empty, { bytes: 10, pages: MAX_PAGES + 1, files: 1 }, undefined);
    expect(problem).toMatch(/pages/);
  });

  it('counts what is already loaded, not just the new files', () => {
    const current = { bytes: MAX_TOTAL_BYTES - 100, pages: 10 };
    expect(validateAddition(current, { bytes: 1000, pages: 1, files: 1 }, undefined)).toMatch(/MB/);
  });

  it('accepts a drop that lands exactly on the cap', () => {
    expect(
      validateAddition(empty, { bytes: MAX_TOTAL_BYTES, pages: MAX_PAGES, files: 1 }, undefined),
    ).toBeNull();
  });

  it('catches what bytes alone cannot: a small file with a huge page count', () => {
    // The reason the page cap exists - every visible page becomes a canvas bitmap.
    expect(validateAddition(empty, { bytes: 2_000_000, pages: MAX_PAGES + 50, files: 1 }, undefined))
      .toMatch(/pages/);
  });

  it('applies the halved caps on a low-memory device', () => {
    const incoming = { bytes: 1000, pages: MAX_PAGES / 2 + 1, files: 1 };
    expect(validateAddition(empty, incoming, 4)).toMatch(/pages/);
    expect(validateAddition(empty, incoming, 16)).toBeNull();
  });
});
