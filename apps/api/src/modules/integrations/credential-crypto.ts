import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

const DEFAULT_KEY_FILE = '/srv/seo-stat/config/integration.key';

function parseKey(raw: string): Buffer | null {
  const trimmed = raw.trim();
  if (/^[0-9a-f]{64}$/i.test(trimmed)) return Buffer.from(trimmed, 'hex');
  try {
    const decoded = Buffer.from(trimmed, 'base64');
    if (decoded.length === 32) return decoded;
  } catch {
    // fall through
  }
  return null;
}

/**
 * Authenticated encryption (AES-256-GCM) for stored integration credentials.
 *
 * The 32-byte key is deployment-managed and lives outside the release
 * directories: either inline as `INTEGRATION_ENCRYPTION_KEY` (hex or base64) or
 * in the file named by `INTEGRATION_ENCRYPTION_KEY_FILE` (default
 * `/srv/seo-stat/config/integration.key`). When no key is configured, storing or
 * reading credentials fails closed with 503.
 */
@Injectable()
export class CredentialCrypto {
  private cached: Buffer | null = null;
  private loaded = false;

  private key(): Buffer | null {
    if (this.loaded) return this.cached;
    this.loaded = true;
    const inline = process.env.INTEGRATION_ENCRYPTION_KEY?.trim() ?? '';
    const file = process.env.INTEGRATION_ENCRYPTION_KEY_FILE?.trim() || DEFAULT_KEY_FILE;
    let raw = inline;
    if (!raw) {
      try {
        raw = readFileSync(file, 'utf8').trim();
      } catch {
        raw = '';
      }
    }
    this.cached = raw ? parseKey(raw) : null;
    return this.cached;
  }

  isConfigured(): boolean {
    return this.key() !== null;
  }

  encrypt(plaintext: string): string {
    const key = this.key();
    if (!key) throw new ServiceUnavailableException('Integration encryption key is not configured on the server.');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1.${iv.toString('base64')}.${tag.toString('base64')}.${ciphertext.toString('base64')}`;
  }

  decrypt(payload: string): string {
    const key = this.key();
    if (!key) throw new ServiceUnavailableException('Integration encryption key is not configured on the server.');
    const parts = payload.split('.');
    const version = parts[0];
    const ivB64 = parts[1];
    const tagB64 = parts[2];
    const dataB64 = parts[3];
    if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64 || parts.length !== 4) {
      throw new Error('Stored credential is not readable.');
    }
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
  }
}
