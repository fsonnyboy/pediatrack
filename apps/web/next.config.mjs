/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@peditrack/types', '@peditrack/utils'],

  images: {
    /**
     * SEC-011 fix: removed the wildcard hostname: '**' pattern.
     * A wildcard allows Next.js's image optimisation proxy to fetch and relay
     * content from ANY HTTPS host, making /_next/image?url=https://internal-svc/...
     * an SSRF vector usable by authenticated attackers to probe internal services.
     *
     * Replace the placeholder hostnames below with the actual CDN / storage hosts
     * used in your deployment. Common examples are left as commented-out starters.
     *
     * Allowed sources should be the minimal set needed:
     *   - An avatar / photo upload bucket (e.g. S3, GCS, Cloudinary)
     *   - Your own domain if you self-host images
     *
     * Leave the array EMPTY if the application serves no remote images —
     * omitting the key defaults to allowing nothing external.
     */
    remotePatterns: [
      // ── Uncomment and customise for your deployment ──────────────────────
      // AWS S3:
      // { protocol: 'https', hostname: 'your-bucket.s3.amazonaws.com', pathname: '/avatars/**' },
      // Google Cloud Storage:
      // { protocol: 'https', hostname: 'storage.googleapis.com', pathname: '/peditrack-assets/**' },
      // Cloudinary:
      // { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/peditrack/**' },
      // Self-hosted CDN / media server:
      // { protocol: 'https', hostname: 'cdn.your-clinic.com' },
    ],
  },

  eslint: { ignoreDuringBuilds: false },
};

export default nextConfig;
