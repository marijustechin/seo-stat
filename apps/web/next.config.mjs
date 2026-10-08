const apiTarget = process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3011';

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/seo-stat',
  trailingSlash: true,
  reactStrictMode: true,
  async rewrites() {
    // Same-origin API proxy to the NestJS service. The sources include the
    // base path explicitly and set basePath: false so Next does not prefix them
    // again (which would produce /seo-stat/seo-stat/api/...).
    //
    // In the real deployment nginx routes /seo-stat/api/ to NestJS directly, so
    // this rewrite is only exercised by `next dev` and local production runs.
    return [
      {
        source: '/seo-stat/api/',
        destination: `${apiTarget}/seo-stat/api/`,
        basePath: false,
      },
      {
        source: '/seo-stat/api/:path*/',
        destination: `${apiTarget}/seo-stat/api/:path*/`,
        basePath: false,
      },
    ];
  },
};

export default nextConfig;
