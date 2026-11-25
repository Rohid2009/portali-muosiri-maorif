/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'same-origin' },
  // Маълумоти кӯдакон набояд дар Google индекс шавад
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
];

const nextConfig = {
  poweredByHeader: false,
  experimental: {
    // ҳуҷҷати «сабабнок» то 2 МБ
    serverActions: { bodySizeLimit: '3mb' },
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
