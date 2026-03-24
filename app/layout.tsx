import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ClientProviders } from "@/components/providers/client-providers"
import { ErrorBoundary } from "@/app/error-boundary"
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
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased bg-background text-foreground`} suppressHydrationWarning>
        {/* Accessibility: Skip to main content link */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <ErrorBoundary>
          <ClientProviders>
            {children}
          </ClientProviders>
        </ErrorBoundary>
        <Analytics />
      </body>
    </html>
  )
}

