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
    // Enable remote patterns if needed
    remotePatterns: [],
  },
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  // Optimize production builds
  productionBrowserSourceMaps: false, // Disable source maps in production for faster builds
  // Reduce memory usage
  swcMinify: true, // Use SWC minification (faster, less memory)
  // Note: bodySizeLimit moved to experimental in Next.js 16
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // Allow up to 10MB file uploads
    },
    optimizePackageImports: [
      'lucide-react', 
      '@radix-ui/react-icons',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      'recharts',
      'date-fns',
    ],
  },
  // Optimize output file tracing to reduce memory usage
  outputFileTracingExcludes: {
    '*': [
      'node_modules/@swc/core-linux-x64-gnu',
      'node_modules/@swc/core-linux-x64-musl',
      'node_modules/@esbuild/linux-x64',
      'node_modules/webpack',
    ],
  },
  // Configure Turbopack (Next.js 16 uses Turbopack by default)
  // Optimize for smaller build output
  turbopack: {},
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
    'puppeteer', // Optional - only needed for PDF generation
  ],
  // Note: Webpack config removed - Next.js 16 uses Turbopack by default
  // Turbopack handles bundle optimization automatically
}

export default nextConfig
