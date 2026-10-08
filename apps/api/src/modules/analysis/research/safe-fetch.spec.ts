import { describe, expect, it } from 'vitest';
import { SafeFetchError, extractText, extractTitle, isBlockedAddress, validateUrlShape } from './safe-fetch.js';

describe('SSRF URL validation', () => {
  it('allows public http and https URLs', () => {
    expect(validateUrlShape('https://example.com/about').hostname).toBe('example.com');
    expect(validateUrlShape('http://example.com').protocol).toBe('http:');
  });

  it('rejects unsafe schemes, credentials, and non-standard ports', () => {
    expect(() => validateUrlShape('ftp://example.com')).toThrow(SafeFetchError);
    expect(() => validateUrlShape('file:///etc/passwd')).toThrow(SafeFetchError);
    expect(() => validateUrlShape('https://user:pass@example.com')).toThrow(SafeFetchError);
    expect(() => validateUrlShape('http://example.com:8080')).toThrow(SafeFetchError);
    expect(() => validateUrlShape('not a url')).toThrow(SafeFetchError);
  });

  it('rejects loopback and internal hostnames', () => {
    expect(() => validateUrlShape('http://localhost/')).toThrow(SafeFetchError);
    expect(() => validateUrlShape('http://foo.local/')).toThrow(SafeFetchError);
    expect(() => validateUrlShape('http://service.internal/')).toThrow(SafeFetchError);
    expect(() => validateUrlShape('http://metadata.google.internal/')).toThrow(SafeFetchError);
  });
});

describe('SSRF address validation', () => {
  it('blocks private, loopback, link-local, and metadata addresses', () => {
    const blocked = [
      '127.0.0.1',
      '10.1.2.3',
      '192.168.1.1',
      '172.16.5.5',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '::1',
      'fc00::1',
      'fe80::1',
      '::ffff:127.0.0.1',
    ];
    for (const ip of blocked) {
      expect(isBlockedAddress(ip)).toBe(true);
    }
  });

  it('allows public addresses', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) {
      expect(isBlockedAddress(ip)).toBe(false);
    }
  });
});

describe('HTML text extraction', () => {
  it('extracts the title and readable text and drops scripts', () => {
    const html =
      '<html><head><title>Hi &amp; Bye</title><script>evil()</script></head><body><h1>Hello</h1><p>World</p></body></html>';
    expect(extractTitle(html)).toBe('Hi & Bye');
    const text = extractText(html);
    expect(text).toContain('Hello');
    expect(text).toContain('World');
    expect(text).not.toContain('evil');
  });
});
