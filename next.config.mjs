/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    // Enable image optimization for better performance
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  // Note: bodySizeLimit moved to experimental in Next.js 16
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // Allow up to 10MB file uploads
    },
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  // Performance: Enable React strict mode for better development experience
  reactStrictMode: true,
  // Externalize optional dependencies to prevent build errors
  // These packages are dynamically imported and may not be installed
  serverExternalPackages: [
    'twilio',
    'canvas',
    'pdfjs-dist',
    '@upstash/ratelimit',
    '@upstash/redis',
    'import-in-the-middle',
    'require-in-the-middle',
  ],
}

export default nextConfig
