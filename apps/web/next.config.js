/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === 'production';

// The Next origin cannot reach the API's relative media URLs directly, so
// proxy them: `<img src="/api/v1/media/...">` (uploaded thumbnails, player
// posters, VOD frames) rewrites to the API instead of 404ing on :3000.
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const apiOrigin = apiBaseUrl.replace(/\/api\/v1\/?$/, '');

// `unsafe-eval` is only needed by Next.js's dev-time webpack HMR. Dropping it
// in production meaningfully hardens CSP against script injection: an attacker
// who lands JavaScript still can't fall back to eval()-based payloads.
const scriptSrc = isProduction ? "'self' 'unsafe-inline'" : "'self' 'unsafe-inline' 'unsafe-eval'";

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      `script-src ${scriptSrc}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' blob: data: https://lh3.googleusercontent.com",
      "object-src 'none'",
      "connect-src 'self' ws: wss: https: http://localhost:*",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  async rewrites() {
    // Keep media delivery on the same origin as the page so CSP's
    // `img-src 'self'` and the browser work without exposing the API origin.
    return [
      {
        source: '/api/v1/media/:path*',
        destination: `${apiOrigin}/api/v1/media/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        pathname: '/**',
      },
    ],
  },
};

module.exports = nextConfig;
