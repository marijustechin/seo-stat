import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { isIP } from 'node:net';

/**
 * Shared outbound-URL protections used by every server-side fetch (analysis
 * research and external integrations). Only http/https on ports 80/443 are
 * allowed; credentials, localhost/internal hostnames, and private/loopback/
 * link-local/metadata/reserved addresses are rejected at connect time (DNS
 * resolution and every redirect hop).
 */

export type FetchFailureKind =
  | 'invalid-url'
  | 'blocked-host'
  | 'blocked-address'
  | 'too-many-redirects'
  | 'too-large'
  | 'timeout'
  | 'http-error'
  | 'unsupported-content'
  | 'cross-origin-redirect'
  | 'invalid-response'
  | 'network-error';

export class SafeFetchError extends Error {
  constructor(
    readonly kind: FetchFailureKind,
    message: string,
  ) {
    super(message);
    this.name = 'SafeFetchError';
  }
}

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const ALLOWED_PORTS = new Set(['', '80', '443']);
const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal']);

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split('.').map((value) => Number(value));
  if (parts.length !== 4 || parts.some((value) => Number.isNaN(value) || value < 0 || value > 255)) {
    return true;
  }
  const [a = 0, b = 0] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::' || lower === '::1') return true;
  if (lower.startsWith('fe80') || lower.startsWith('fc') || lower.startsWith('fd')) return true;
  if (lower.startsWith('::ffff:')) {
    const mapped = lower.slice('::ffff:'.length);
    return isIP(mapped) === 4 ? isBlockedIpv4(mapped) : true;
  }
  return false;
}

export function isBlockedAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isBlockedIpv4(ip);
  if (family === 6) return isBlockedIpv6(ip);
  return true;
}

export function validateUrlShape(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SafeFetchError('invalid-url', 'Not a valid absolute URL.');
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new SafeFetchError('invalid-url', 'Only http and https are allowed.');
  }
  if (url.username || url.password) {
    throw new SafeFetchError('invalid-url', 'URLs with credentials are not allowed.');
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    throw new SafeFetchError('invalid-url', 'Only ports 80 and 443 are allowed.');
  }
  const hostname = url.hostname.toLowerCase();
  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    throw new SafeFetchError('blocked-host', `Blocked host: ${hostname}`);
  }
  return url;
}

/** Same scheme, host, and port. Used to decide whether authentication may follow a redirect. */
export function sameOrigin(a: URL, b: URL): boolean {
  return a.protocol === b.protocol && a.hostname === b.hostname && a.port === b.port;
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address?: string | LookupAddress[], family?: number) => void;

/**
 * A DNS lookup that rejects private, loopback, link-local, and reserved
 * addresses at connect time. This runs for every redirect hop because each
 * request performs its own lookup.
 */
export function safeLookup(hostname: string, options: unknown, callback: LookupCallback): void {
  dnsLookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
    if (error) {
      callback(error);
      return;
    }
    if (!addresses || addresses.length === 0) {
      callback(new SafeFetchError('network-error', `No addresses for ${hostname}`));
      return;
    }
    for (const entry of addresses) {
      if (isBlockedAddress(entry.address)) {
        callback(new SafeFetchError('blocked-address', `Blocked address for ${hostname}`));
        return;
      }
    }
    const wantsAll = typeof options === 'object' && options !== null && 'all' in options && Boolean(options.all);
    if (wantsAll) {
      callback(null, addresses);
    } else {
      const first = addresses[0];
      if (!first) {
        callback(new SafeFetchError('network-error', `No addresses for ${hostname}`));
        return;
      }
      callback(null, first.address, first.family);
    }
  });
}
