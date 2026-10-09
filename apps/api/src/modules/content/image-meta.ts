export interface ImageDimensions {
  width: number;
  height: number;
}

function png(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function jpeg(buffer: Buffer): ImageDimensions | null {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1] ?? 0;
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return null;
}

function webp(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF') return null;
  const format = buffer.toString('ascii', 12, 16);
  if (format === 'VP8X') {
    return { width: buffer.readUIntLE(24, 3) + 1, height: buffer.readUIntLE(27, 3) + 1 };
  }
  if (format === 'VP8 ') {
    return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  }
  if (format === 'VP8L') {
    const bits = buffer.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

export function imageDimensions(buffer: Buffer, mimeType: string): ImageDimensions | null {
  try {
    if (mimeType === 'image/png') return png(buffer);
    if (mimeType === 'image/jpeg') return jpeg(buffer);
    if (mimeType === 'image/webp') return webp(buffer);
  } catch {
    return null;
  }
  return null;
}
