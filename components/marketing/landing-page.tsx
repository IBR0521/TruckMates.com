"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { Menu, X } from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/logo"
import { AppShell, DashboardPreview } from "@/components/marketing/previews"
import { DotBg, WGhostButton, WPrimaryButton } from "@/components/marketing/marketing-ui"
import { cn } from "@/lib/utils"

const LandingPageBelowFold = dynamic(() => import("./landing-page-below-fold"), {
  loading: () => (
    <div className="min-h-[45vh] w-full animate-pulse" style={{ background: "var(--w-bg-2)" }} aria-hidden />
  ),
})

const NAV_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Integrations", href: "/integrations" },
  { label: "About", href: "/about" },
] as const

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (!mobileOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileOpen])

  return (
    <div className="min-h-screen" style={{ background: "var(--w-bg)" }} suppressHydrationWarning>
      {/* Bar must NOT use backdrop-filter — it breaks position:fixed for children */}
      <header
        className={cn(
          "fixed top-0 right-0 left-0 z-50 border-b lg:block",
          mobileOpen ? "max-lg:hidden" : "max-lg:block",
        )}
        style={{
          background: "#06080F",
          borderColor: "var(--w-border)",
        }}
        suppressHydrationWarning
      >
        <nav
          className="mx-auto grid h-[60px] max-w-[1280px] grid-cols-[1fr_auto] items-center px-6 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
          aria-label="Main"
        >
          <Link href="/" className="justify-self-start shrink-0">
            <Logo size="sm" variant="onDark" showText />
          </Link>

          <div className="hidden items-center justify-center gap-8 lg:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm transition-colors duration-150 hover:text-[var(--w-blue)]"
                style={{
                  fontFamily: "var(--font-jakarta), sans-serif",
                  color: "var(--w-text-2)",
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden items-center justify-end gap-6 lg:flex">
            <Link
              href="/login"
              className="text-sm transition-colors duration-150 hover:text-[var(--w-blue)]"
              style={{
                fontFamily: "var(--font-jakarta), sans-serif",
                color: "var(--w-text-2)",
              }}
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="rounded-[10px] px-[18px] py-[9px] text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{
                background: "var(--w-blue)",
                fontFamily: "var(--font-jakarta), sans-serif",
                boxShadow: "0 0 0 1px rgba(59,130,246,0.5), 0 4px 24px var(--w-blue-glow)",
              }}
            >
              Get started
            </Link>
          </div>

          <button
            type="button"
            className="justify-self-end rounded-lg p-2 lg:hidden"
            style={{ color: "var(--w-text-2)" }}
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
        </nav>
      </header>

      {/* Full-screen mobile menu — sibling of header, NOT inside it (backdrop-filter trap) */}
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-[200] flex flex-col lg:hidden"
          style={{ background: "#06080F" }}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <div
            className="flex h-[60px] shrink-0 items-center justify-between border-b px-6"
            style={{ borderColor: "var(--w-border)" }}
          >
            <Link href="/" onClick={() => setMobileOpen(false)}>
              <Logo size="sm" variant="onDark" showText />
            </Link>
            <button
              type="button"
              className="rounded-lg p-2"
              style={{ color: "var(--w-text-2)" }}
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-8 py-10">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xl font-semibold text-[var(--w-text)]"
                style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-4 border-t pt-8" style={{ borderColor: "var(--w-border)" }}>
              <Link
                href="/login"
                className="block text-base text-[var(--w-text-2)]"
                style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
                onClick={() => setMobileOpen(false)}
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="mt-4 inline-flex rounded-[10px] px-6 py-3 text-sm font-semibold text-white"
                style={{ background: "var(--w-blue)", fontFamily: "var(--font-jakarta), sans-serif" }}
                onClick={() => setMobileOpen(false)}
              >
                Get started
              </Link>
            </div>
          </nav>
        </div>
      ) : null}

      <section className="relative z-0 overflow-hidden pt-[60px]" suppressHydrationWarning>
        <DotBg />
        <div
          className="pointer-events-none absolute top-0 left-1/2 h-[600px] w-[900px] -translate-x-1/2 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.10) 0%, transparent 65%)" }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute right-0 bottom-0 h-[400px] w-[400px] blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(34,211,238,0.06) 0%, transparent 70%)" }}
          aria-hidden
        />

        <div className="relative mx-auto max-w-[1180px] px-4 pt-[120px] pb-0 text-center sm:px-6">
          <span
            className="inline-block rounded-full border px-3.5 py-1.5 text-[11px] font-semibold tracking-widest uppercase text-[var(--w-blue)]"
            style={{
              background: "rgba(59,130,246,0.10)",
              borderColor: "rgba(59,130,246,0.20)",
              fontFamily: "var(--font-mono-display), monospace",
            }}
          >
            Fleet Management Platform
          </span>
          <h1
            className="mx-auto mt-6 max-w-[820px] text-[clamp(40px,5.5vw,68px)] leading-[1.05] font-extrabold tracking-[-0.025em] text-[var(--w-text)]"
            style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
          >
            Your whole operation. One screen.
          </h1>
          <p
            className="mx-auto mt-5 max-w-[540px] text-lg leading-[1.65] text-[var(--w-text-2)]"
            style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
          >
            Dispatch, compliance, IFTA, invoicing, and an AI that knows trucking — in one platform built for US
            carriers.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3.5 sm:flex-row">
            <WPrimaryButton href="/demo">Try the demo →</WPrimaryButton>
            <WGhostButton href="/register">Start free</WGhostButton>
          </div>
          <p
            className="mt-4 text-[13px]"
            style={{ color: "var(--w-text-3)", fontFamily: "var(--font-jakarta), sans-serif" }}
          >
            No credit card · Free Starter trial · Setup in minutes
          </p>

          <div className="relative z-0 mx-auto mt-12 max-w-[1100px] pb-8 sm:mt-16">
            <div
              className="max-h-[min(68vh,620px)] overflow-hidden rounded-[14px]"
              aria-hidden
            >
              <AppShell className="pointer-events-none select-none">
                <DashboardPreview />
              </AppShell>
            </div>
            <div
              className="pointer-events-none absolute right-0 bottom-0 left-0 h-24"
              style={{
                background: "linear-gradient(to bottom, transparent, var(--w-bg))",
              }}
              aria-hidden
            />
          </div>
        </div>
      </section>

      <LandingPageBelowFold />
    </div>
  )
}
