/**
 * Reads the EXIF orientation (1 to 8) from JPEG bytes; 1 when absent or unreadable. Browsers apply
 * it while decoding, so only Node callers (the eval) need this.
 */
export function readExifOrientation(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 4 || view.getUint16(0) !== 0xffd8) return 1;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    const marker = view.getUint16(offset);
    const size = view.getUint16(offset + 2);
    if (
      marker === 0xffe1 &&
      offset + 10 <= bytes.length &&
      view.getUint32(offset + 4) === 0x45786966
    ) {
      return orientationFromTiff(view, offset + 10, offset + 2 + size);
    }
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) return 1;
    offset += 2 + size;
  }
  return 1;
}

function orientationFromTiff(view: DataView, start: number, end: number): number {
  if (start + 8 > end || end > view.byteLength) return 1;
  const little = view.getUint16(start) === 0x4949;
  const ifd = start + view.getUint32(start + 4, little);
  if (ifd + 2 > end) return 1;
  const entries = view.getUint16(ifd, little);
  for (let i = 0; i < entries; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > end) return 1;
    if (view.getUint16(entry, little) === 0x0112) {
      const value = view.getUint16(entry + 8, little);
      return value >= 1 && value <= 8 ? value : 1;
    }
  }
  return 1;
}
