/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Note: `swcMinify` is no longer recognized in Next.js 16+; Turbopack handles minification.
  // If you want to set the Turbopack workspace root to silence warnings, add `turbopack: { root: __dirname }`.
  // During development, forward API calls under /api/post to the backend server.
  // If NEXT_PUBLIC_BACKEND_URL is set, use it; otherwise default to http://localhost:8080
  async rewrites() {
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';
    return [
      {
        source: '/api/post/:path*',
        destination: `${backend.replace(/\/$/, '')}/api/post/:path*`,
      },
      {
        source: '/api/post',
        destination: `${backend.replace(/\/$/, '')}/api/post`,
      },
    ];
  },
}

module.exports = nextConfig
