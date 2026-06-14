/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  async rewrites() {
    if (process.env.NODE_ENV === 'development') {
      return [
        { source: '/app/:path*', destination: 'http://localhost:5173/app/:path*' },
        { source: '/auth/:path*', destination: 'http://localhost:3000/auth/:path*' },
        { source: '/v1/:path*', destination: 'http://localhost:3000/v1/:path*' },
        { source: '/metrics', destination: 'http://localhost:3000/metrics' },
        { source: '/healthz', destination: 'http://localhost:3000/healthz' },
        { source: '/readyz', destination: 'http://localhost:3000/readyz' },
      ]
    }
    // Production: copy apps/dashboard/dist/ to public/app/ then serve as static
    return []
  },
}

export default nextConfig
