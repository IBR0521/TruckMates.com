/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Increase body size limit for Server Actions (for file uploads)
  serverActions: {
    bodySizeLimit: '10mb', // Allow up to 10MB file uploads
  },
}

export default nextConfig
