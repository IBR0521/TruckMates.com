"use client"

import Link from "next/link"
import type { ReactNode } from "react"

export function DotBg({ className = "" }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 ${className}`}
      aria-hidden
      style={{
        backgroundImage: "radial-gradient(var(--w-dot) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
        maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)",
      }}
    />
  )
}

export function WEyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`mb-3.5 block text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--w-blue)] ${className}`}
      style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
    >
      {children}
    </span>
  )
}

export function WSectionHeading({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <h2
      className={`text-[clamp(30px,4vw,52px)] font-bold leading-[1.1] tracking-[-0.02em] text-[var(--w-text)] ${className}`}
      style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
    >
      {children}
    </h2>
  )
}

export function WBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={`text-[17px] leading-[1.65] text-[var(--w-text-2)] ${className}`}
      style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
    >
      {children}
    </p>
  )
}

export function WPrimaryButton({
  href,
  children,
  className = "",
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-[10px] border-none px-[26px] py-3 text-[15px] font-semibold text-white transition-[box-shadow,transform] duration-150 hover:brightness-110 ${className}`}
      style={{
        background: "var(--w-blue)",
        fontFamily: "var(--font-jakarta), sans-serif",
        boxShadow: "0 0 0 1px rgba(59,130,246,0.5), 0 4px 24px var(--w-blue-glow)",
      }}
    >
      {children}
    </Link>
  )
}

export function WGhostButton({
  href,
  children,
  className = "",
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-[10px] border px-6 py-[11px] text-[15px] font-medium text-[var(--w-text)] transition-[border-color,background] duration-150 hover:border-[var(--w-border-strong)] hover:bg-[rgba(255,255,255,0.03)] ${className}`}
      style={{
        borderColor: "var(--w-border-md)",
        fontFamily: "var(--font-jakarta), sans-serif",
      }}
    >
      {children}
    </Link>
  )
}

export function MarketingFinalCta() {
  return (
    <section
      className="relative overflow-hidden border-t py-24"
      style={{ background: "var(--w-bg)", borderColor: "var(--w-border)" }}
    >
      <DotBg />
      <div className="relative mx-auto max-w-[600px] px-4 text-center sm:px-6">
        <WSectionHeading className="text-center">Ready to run a tighter operation?</WSectionHeading>
        <WBody className="mx-auto mt-4 max-w-lg text-center">
          Try the demo — no signup required. Or create a free account in minutes.
        </WBody>
        <div className="mt-10 flex flex-col items-center justify-center gap-3.5 sm:flex-row">
          <WPrimaryButton href="/demo">Try demo →</WPrimaryButton>
          <WGhostButton href="/register">Start free</WGhostButton>
        </div>
        <p
          className="mt-8 text-sm text-[var(--w-text-2)]"
          style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
        >
          Already registered?{" "}
          <Link href="/login" className="text-[var(--w-blue)] hover:underline">
            Log in →
          </Link>
        </p>
      </div>
    </section>
  )
}
