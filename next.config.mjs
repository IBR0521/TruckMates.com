import { createRequire } from 'node:module'
import crypto from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const isProd = process.env.NODE_ENV === "production"

// Build output directory.
// - Vercel/CI: always `.next` in the repo.
// - Local: default `.next` in-repo so webpack/dev server are not split across volumes (Desktop/iCloud
//   project + `~/.cache/...` dist was causing requests to hang forever with 0-byte responses).
// - Opt-in old behavior: set `NEXT_DIST_IN_HOME=1` in `.env.local` if you prefer dist under ~/.cache
//   (some iCloud Desktop setups prefer keeping `.next` out of synced folders).
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectKey = crypto.createHash('sha256').update(__dirname).digest('hex').slice(0, 12)
const distDir =
  process.env.VERCEL === '1' || process.env.CI === 'true'
    ? '.next'
    : process.env.NEXT_DIST_IN_HOME === '1'
      ? path.join(os.homedir(), '.cache', 'truckmates-next', projectKey, '.next')
      : '.next'

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir,
  typescript: {
    // BUG-002 FIX: Enable TypeScript error checking - critical for production safety
    ignoreBuildErrors: false,
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
  // Note: swcMinify is deprecated in Next.js 16 - minification is enabled by default
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
  // Optimize output file tracing to reduce memory usage and deployment size
  outputFileTracingExcludes: {
    '*': [
      'node_modules/@swc/core-linux-x64-gnu',
      'node_modules/@swc/core-linux-x64-musl',
      'node_modules/@esbuild/linux-x64',
      'node_modules/webpack',
      'node_modules/canvas/**',
      'node_modules/puppeteer/**',
      'node_modules/.cache/**',
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
    ],
  },
  // Configure Turbopack (Next.js 16 uses Turbopack by default)
  // Optimize for smaller build output
  turbopack: {},
  // Disable static optimization for pages that use client components with hooks
  // This prevents build-time errors when React isn't fully initialized
  output: 'standalone', // Use standalone output to avoid static generation issues
  // Performance: Enable React strict mode for better development experience
  reactStrictMode: true,
  // Dev: allow webpack HMR when the browser uses http://127.0.0.1 while Next binds to [::1]
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  async redirects() {
    return [
      {
        source: "/dashboard/employees",
        destination: "/dashboard/settings/users",
        permanent: true,
      },
    ]
  },
  async headers() {
    // In development, a strict CSP breaks Next.js HMR (needs ws://), third-party scripts (Maps),
    // and can yield a blank white screen while the tab "loads". Ship CSP only in production.
    if (!isProd) {
      return [
        {
          source: "/(.*)",
          headers: [{ key: "X-Content-Type-Options", value: "nosniff" }],
        },
      ]
    }

    const securityHeaders = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    ]

    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ]
  },
  // Externalize optional dependencies to prevent build errors
  // These packages are dynamically imported and may not be installed
  // Next dev with --webpack stores PackFileCache under `.next/dev/cache`. That layer is fragile on
  // iCloud/Desktop sync and some disks (missing *.pack.gz → unhandledRejection → torn manifests
  // like app-paths-manifest.json / routes-manifest.json → 500 / "unable to handle request").
  // Default: no persistent webpack cache in dev. Opt in with NEXT_WEBPACK_DISK_CACHE=1 if your
  // project lives on a fast local disk and you want faster rebuilds.
  webpack: (config, { dev }) => {
    if (dev && process.env.NEXT_WEBPACK_DISK_CACHE !== '1') {
      config.cache = false
    }
    // Webpack can mis-resolve `styled-jsx` when pulling recharts → lodash, yielding
    // `createStyleRegistry is not a function` at runtime. Pin to the package entry.
    // `dom-helpers/*` subpaths use tiny package.json stubs; on some disks / sync (e.g. Desktop+iCloud)
    // resolution fails with "No file content" — alias to the real modules (react-transition-group).
    config.resolve.alias = {
      ...config.resolve.alias,
      'styled-jsx': require.resolve('styled-jsx'),
      'dom-helpers/addClass': path.join(__dirname, 'node_modules/dom-helpers/esm/addClass.js'),
      'dom-helpers/removeClass': path.join(__dirname, 'node_modules/dom-helpers/esm/removeClass.js'),
    }
    return config
  },
  serverExternalPackages: [
    'twilio',
    'canvas',
    'pdfjs-dist',
    '@upstash/ratelimit',
    '@upstash/redis',
    'import-in-the-middle',
    'require-in-the-middle',
    'puppeteer', // Optional - only needed for PDF generation
    'puppeteer-core', // Optional - serverless version
    '@sparticuz/chromium', // Optional - Chromium for serverless
    '@tanstack/react-query', // Fix Turbopack timeout issues
  ],
}

export default nextConfig
