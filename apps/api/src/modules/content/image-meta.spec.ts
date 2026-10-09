import { describe, expect, it } from 'vitest';
import { detectImageMime } from './image-meta.js';

describe('detectImageMime', () => {
  it('detects PNG, JPEG, and WebP from signatures', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    expect(detectImageMime(png)).toBe('image/png');
    expect(detectImageMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]);
    expect(detectImageMime(webp)).toBe('image/webp');
  });

  it('returns null for unknown or short data', () => {
    expect(detectImageMime(Buffer.from('not an image'))).toBeNull();
    expect(detectImageMime(Buffer.from([0xff, 0xd8]))).toBeNull();
  });
});
