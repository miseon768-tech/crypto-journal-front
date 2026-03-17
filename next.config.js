/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
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
