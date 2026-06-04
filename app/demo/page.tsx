"use client"

import Link from "next/link"
import { Sparkles } from "lucide-react"
import { DotBg } from "@/components/marketing/marketing-ui"

export default function DemoPage() {
  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center px-4 py-16"
      style={{ background: "var(--w-bg)" }}
    >
      <DotBg />
      <Link
        href="/"
        className="absolute top-6 left-6 z-10 text-sm text-[var(--w-blue)]"
        style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
      >
        ← Back
      </Link>

      <div
        className="relative z-10 w-full max-w-[580px] rounded-[20px] border p-12"
        style={{ background: "var(--w-card)", borderColor: "var(--w-border-md)" }}
      >
        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-[14px] border"
          style={{ background: "var(--w-blue-dim)", borderColor: "var(--w-blue-border)" }}
        >
          <Sparkles className="h-[22px] w-[22px] text-[var(--w-blue)]" />
        </div>

        <h1
          className="mt-6 text-center text-[40px] leading-tight font-extrabold text-[var(--w-text)]"
          style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
        >
          Try the interactive demo
        </h1>
        <p
          className="mt-3 text-center text-base leading-relaxed text-[var(--w-text-2)]"
          style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
        >
          Browse a realistic, pre-populated fleet workspace — dispatch, loads, AI assistant screens, ELD and
          geofencing areas, safety scorecards, billing, and more. No signup required to explore the UI.
        </p>
        <div
          className="mt-6 rounded-[10px] border px-[18px] py-3.5 text-[13px] leading-relaxed"
          style={{
            background: "rgba(255,255,255,0.03)",
            borderColor: "var(--w-border)",
            color: "var(--w-text-3)",
            fontFamily: "var(--font-jakarta), sans-serif",
          }}
        >
          Uses a shared read-focused demo tenant. Sensitive paid actions stay disabled unless you{" "}
          <Link href="/register" className="text-[var(--w-blue)] hover:underline">
            create your own account
          </Link>
          .
        </div>

        <Link
          href="/demo/setup"
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-[10px] py-3.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
          style={{
            background: "var(--w-blue)",
            fontFamily: "var(--font-jakarta), sans-serif",
            boxShadow: "0 0 0 1px rgba(59,130,246,0.5), 0 4px 24px var(--w-blue-glow)",
          }}
        >
          Enter the demo →
        </Link>

        <p
          className="mt-4 text-center text-sm text-[var(--w-text-2)]"
          style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
        >
          Or{" "}
          <Link href="/register" className="text-[var(--w-blue)] hover:underline">
            create a free account
          </Link>
        </p>
      </div>
    </div>
  )
}
