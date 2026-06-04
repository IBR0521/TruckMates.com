import type React from "react"
import type { Metadata } from "next"
import { Bricolage_Grotesque, Geist, Geist_Mono, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ClientProviders } from "@/components/providers/client-providers"
import { PostHogProvider } from "@/components/providers/posthog-provider"
import { GoogleMapsRootScript } from "@/components/google-maps-root-script"
import { ErrorBoundary } from "@/app/error-boundary"
import "@/lib/env-validation"
import "./globals.css"

// Load fonts - must be const at module scope
const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-sans",
  adjustFontFallback: true,
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
  // Mono is for code/VINs in the app — not needed for first paint on marketing pages
  preload: false,
  adjustFontFallback: true,
})

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-bricolage",
  adjustFontFallback: true,
})

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-jakarta",
  adjustFontFallback: true,
})

const jetbrainsDisplay = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-mono-display",
  preload: false,
  adjustFontFallback: true,
})

export const metadata: Metadata = {
  title: "TruckMates - Fleet Management Dashboard",
  description: "Professional fleet and logistics management platform for teams",
  icons: {
    icon: [
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
      {
        url: "/icon-dark-32x32.png",
        type: "image/png",
        sizes: "32x32",
      },
      {
        url: "/icon-light-32x32.png",
        type: "image/png",
        sizes: "32x32",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geist.variable} ${geistMono.variable} ${bricolage.variable} ${jakarta.variable} ${jetbrainsDisplay.variable} font-sans antialiased bg-background text-foreground`}
        suppressHydrationWarning
      >
        <GoogleMapsRootScript />
        {/* Accessibility: Skip to main content link */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <ErrorBoundary>
          <PostHogProvider>
            <ClientProviders>
              {children}
            </ClientProviders>
          </PostHogProvider>
        </ErrorBoundary>
        <Analytics />
      </body>
    </html>
  )
}

