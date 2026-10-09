import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CredentialCrypto } from './credential-crypto.js';

describe('CredentialCrypto', () => {
  const originalKey = process.env.INTEGRATION_ENCRYPTION_KEY;
  const originalFile = process.env.INTEGRATION_ENCRYPTION_KEY_FILE;

  beforeEach(() => {
    delete process.env.INTEGRATION_ENCRYPTION_KEY_FILE;
    process.env.INTEGRATION_ENCRYPTION_KEY = 'a'.repeat(64);
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY;
    else process.env.INTEGRATION_ENCRYPTION_KEY = originalKey;
    if (originalFile === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY_FILE;
    else process.env.INTEGRATION_ENCRYPTION_KEY_FILE = originalFile;
  });

  it('round-trips a secret with authenticated encryption', () => {
    const crypto = new CredentialCrypto();
    expect(crypto.isConfigured()).toBe(true);
    const cipher = crypto.encrypt('abcd efgh ijkl mnop qrst uvwx');
    expect(cipher).toMatch(/^v1\./);
    expect(cipher).not.toContain('abcd');
    expect(crypto.decrypt(cipher)).toBe('abcd efgh ijkl mnop qrst uvwx');
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const crypto = new CredentialCrypto();
    expect(crypto.encrypt('secret')).not.toBe(crypto.encrypt('secret'));
  });

  it('rejects tampered ciphertext', () => {
    const crypto = new CredentialCrypto();
    const cipher = crypto.encrypt('secret');
    const tampered = `${cipher.slice(0, -4)}AAAA`;
    expect(() => crypto.decrypt(tampered)).toThrow();
  });

  it('fails closed when no key is configured', () => {
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
    process.env.INTEGRATION_ENCRYPTION_KEY_FILE = 'C:/nonexistent/integration.key';
    const crypto = new CredentialCrypto();
    expect(crypto.isConfigured()).toBe(false);
    expect(() => crypto.encrypt('secret')).toThrow();
  });
});
