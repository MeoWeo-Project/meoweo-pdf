import { describe, expect, it } from 'vitest';

import { detectFileKind, isImageKind, SIGNATURE_BYTES } from './file_type';

/** Build a header of at least SIGNATURE_BYTES so short-buffer handling is not what is under test. */
function header(...bytes: number[]): Uint8Array {
  const out = new Uint8Array(SIGNATURE_BYTES + 4);
  out.set(bytes);
  return out;
}

describe('detectFileKind', () => {
  it('recognizes a PDF by %PDF', () => {
    expect(detectFileKind(header(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37))).toBe('pdf');
  });

  it('recognizes a PNG', () => {
    expect(detectFileKind(header(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('png');
  });

  it('recognizes a JPEG', () => {
    expect(detectFileKind(header(0xff, 0xd8, 0xff, 0xe0))).toBe('jpeg');
  });

  it('recognizes a WebP, ignoring the RIFF size field', () => {
    // "RIFF" + 4 arbitrary size bytes + "WEBP"
    expect(
      detectFileKind(
        header(0x52, 0x49, 0x46, 0x46, 0x2a, 0x00, 0x13, 0x37, 0x57, 0x45, 0x42, 0x50),
      ),
    ).toBe('webp');
  });

  it('does not mistake a non-WebP RIFF (e.g. a WAV) for an image', () => {
    // "RIFF" .... "WAVE"
    expect(
      detectFileKind(
        header(0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45),
      ),
    ).toBeNull();
  });

  it('recognizes a GIF', () => {
    expect(detectFileKind(header(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe('gif');
  });

  it('recognizes a BMP', () => {
    expect(detectFileKind(header(0x42, 0x4d))).toBe('bmp');
  });

  it('recognizes TIFF in both byte orders', () => {
    expect(detectFileKind(header(0x49, 0x49, 0x2a, 0x00))).toBe('tiff');
    expect(detectFileKind(header(0x4d, 0x4d, 0x00, 0x2a))).toBe('tiff');
  });

  it('returns null for unknown content', () => {
    expect(detectFileKind(header(0x00, 0x01, 0x02, 0x03))).toBeNull();
  });

  it('returns null rather than throwing on a truncated buffer', () => {
    expect(detectFileKind(new Uint8Array([0x25, 0x50]))).toBeNull();
    expect(detectFileKind(new Uint8Array())).toBeNull();
  });

  it('trusts bytes over the extension: a renamed JPEG is still a JPEG', () => {
    // What a file called "invoice.pdf" containing JPEG bytes must report.
    expect(detectFileKind(header(0xff, 0xd8, 0xff, 0xdb))).toBe('jpeg');
  });
});

describe('isImageKind', () => {
  it('treats every non-PDF as an image', () => {
    expect(isImageKind('png')).toBe(true);
    expect(isImageKind('jpeg')).toBe(true);
    expect(isImageKind('tiff')).toBe(true);
  });

  it('treats a PDF as not an image', () => {
    expect(isImageKind('pdf')).toBe(false);
  });
});
