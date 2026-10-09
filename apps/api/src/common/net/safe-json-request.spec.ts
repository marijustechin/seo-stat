import { describe, expect, it } from 'vitest';
import { headersForRedirect } from './safe-json-request.js';

describe('redirect header handling', () => {
  it('keeps authentication on same-origin redirects', () => {
    const headers = { authorization: 'Basic abc', accept: 'application/json' };
    expect(headersForRedirect(headers, false)).toEqual(headers);
  });

  it('never forwards authentication headers across origins', () => {
    const headers = {
      authorization: 'Basic abc',
      cookie: 'session=1',
      'proxy-authorization': 'Basic xyz',
      accept: 'application/json',
    };
    const next = headersForRedirect(headers, true);
    expect(next).not.toHaveProperty('authorization');
    expect(next).not.toHaveProperty('cookie');
    expect(next).not.toHaveProperty('proxy-authorization');
    expect(next).toEqual({ accept: 'application/json' });
  });
});
