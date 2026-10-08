#!/usr/bin/env node
// Subpath routing smoke test for seo-stat (standard library only).
//
// Usage: node scripts/smoke-subpath.mjs [baseUrl]
//   baseUrl defaults to http://127.0.0.1:3000 (the Next.js server).
// Env:
//   EXPECT_DB=up|down   expected database result for /seo-stat/api/health
//                       (default: up)
//
// Expects the Next.js production server to be running and, for API checks, the
// NestJS server to be reachable through the same-origin proxy.

const base = (process.argv[2] ?? process.env.BASE_URL ?? 'http://127.0.0.1:3012').replace(/\/+$/, '');
const expectDb = (process.env.EXPECT_DB ?? 'up').toLowerCase();
const expectHealthStatus = expectDb === 'up' ? 200 : 503;

const failures = [];

function ok(name, detail = '') {
  console.log(`  PASS  ${name}${detail ? ` (${detail})` : ''}`);
}

function fail(name, detail) {
  console.error(`  FAIL  ${name}: ${detail}`);
  failures.push(`${name}: ${detail}`);
}

async function get(path, init) {
  return fetch(`${base}${path}`, { redirect: 'follow', ...init });
}

async function expectStatus(name, path, statuses, init) {
  try {
    const res = await get(path, init);
    if (statuses.includes(res.status)) ok(name, `status ${res.status}`);
    else fail(name, `expected ${statuses.join('/')} but got ${res.status}`);
    return res;
  } catch (error) {
    fail(name, `request error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log(`Subpath smoke test against ${base} (EXPECT_DB=${expectDb})`);

  await expectStatus('overview page', '/seo-stat/', [200]);
  await expectStatus('schedules page', '/seo-stat/schedules/', [200]);
  await expectStatus('run history page', '/seo-stat/runs/', [200]);
  await expectStatus('public asset', '/seo-stat/robots.txt', [200]);

  // Canonical redirect from /seo-stat to /seo-stat/.
  try {
    const res = await fetch(`${base}/seo-stat`, { redirect: 'manual' });
    const location = res.headers.get('location') ?? '';
    if ([301, 307, 308].includes(res.status) && location.endsWith('/seo-stat/')) {
      ok('canonical redirect', `${res.status} -> ${location}`);
    } else {
      fail('canonical redirect', `got ${res.status} location=${location || '(none)'}`);
    }
  } catch (error) {
    fail('canonical redirect', `request error: ${error.message}`);
  }

  // Discover a Next.js static asset from the page and confirm it is served
  // under the base path (and not from the site root).
  let assetPath = '';
  try {
    const res = await get('/seo-stat/');
    const html = await res.text();
    if (html.includes('/seo-stat/seo-stat')) {
      fail('no duplicate prefix', 'page HTML contains /seo-stat/seo-stat');
    } else {
      ok('no duplicate prefix');
    }
    const match = html.match(/\/seo-stat\/_next\/static\/[^"'\s]+/);
    if (match) {
      assetPath = match[0];
      ok('static asset reference', assetPath);
    } else {
      fail('static asset reference', 'no /seo-stat/_next/static asset found in HTML');
    }
  } catch (error) {
    fail('static asset reference', `request error: ${error.message}`);
  }

  if (assetPath) {
    await expectStatus('static asset under prefix', assetPath, [200]);
    await expectStatus('static asset at root rejected', assetPath.replace('/seo-stat', ''), [404]);
  }

  await expectStatus('root /api/ rejected', '/api/health', [404]);

  try {
    const res = await get('/seo-stat/api/health');
    const body = await res.json().catch(() => ({}));
    if (res.status === expectHealthStatus && body.database === expectDb) {
      ok('health via same-origin proxy', `status ${res.status}, database ${body.database}`);
    } else {
      fail(
        'health via same-origin proxy',
        `expected ${expectHealthStatus}/${expectDb} but got ${res.status}/${String(body.database)}`,
      );
    }
  } catch (error) {
    fail('health via same-origin proxy', `request error: ${error.message}`);
  }

  console.log('');
  if (failures.length > 0) {
    console.error(`Subpath smoke test FAILED (${failures.length} problem(s)).`);
    process.exit(1);
  }
  console.log('Subpath smoke test passed.');
}

main();
