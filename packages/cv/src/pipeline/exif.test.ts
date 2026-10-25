import { describe, expect, it } from 'vitest';

import { readExifOrientation } from './exif';

/** SOI, an APP1 Exif segment with one IFD entry for orientation, then SOS. */
function jpegWithOrientation(orientation: number, little: boolean): Uint8Array {
  const tiff = new DataView(new ArrayBuffer(8 + 2 + 12 + 4));
  tiff.setUint16(0, little ? 0x4949 : 0x4d4d);
  tiff.setUint16(2, 42, little);
  tiff.setUint32(4, 8, little);
  tiff.setUint16(8, 1, little);
  tiff.setUint16(10, 0x0112, little);
  tiff.setUint16(12, 3, little);
  tiff.setUint32(14, 1, little);
  tiff.setUint16(18, orientation, little);
  const exif = [0x45, 0x78, 0x69, 0x66, 0, 0, ...new Uint8Array(tiff.buffer)];
  const size = exif.length + 2;
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xe1,
    size >> 8,
    size & 0xff,
    ...exif,
    0xff,
    0xda,
    0,
    2,
  ]);
}

describe('readExifOrientation', () => {
  it('reads big and little endian orientation', () => {
    expect(readExifOrientation(jpegWithOrientation(6, false))).toBe(6);
    expect(readExifOrientation(jpegWithOrientation(8, true))).toBe(8);
  });

  it('is 1 without Exif, for non-JPEG bytes and for out-of-range values', () => {
    expect(readExifOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]))).toBe(1);
    expect(readExifOrientation(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(1);
    expect(readExifOrientation(jpegWithOrientation(12, true))).toBe(1);
    expect(readExifOrientation(jpegWithOrientation(6, true).slice(0, 20))).toBe(1);
  });
});
