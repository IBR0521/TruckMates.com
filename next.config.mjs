/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Disable static optimization for better cache control
  experimental: {
    isrMemoryCacheSize: 0,
  },
}

export default nextConfig
