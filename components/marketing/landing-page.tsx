"use client"

import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { ArrowRight, Play } from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/logo"

const LandingPageBelowFold = dynamic(() => import("./landing-page-below-fold"), {
  loading: () => (
    <div
      className="min-h-[45vh] w-full animate-pulse bg-gradient-to-b from-muted/20 via-background to-background"
      aria-hidden
    />
  ),
})

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background" suppressHydrationWarning>
      {/* Nav — floating pill on wide screens */}
      <header className="fixed top-0 left-0 right-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4 lg:px-8" suppressHydrationWarning>
        <nav
          className="mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/75 px-3 py-2.5 shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-background/65 sm:px-5"
          aria-label="Main"
        >
          <Logo size="sm" />
          <div className="flex items-center gap-0.5 sm:gap-2">
            <Link
              href="/pricing"
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted/80 hover:text-foreground sm:hidden"
            >
              Pricing
            </Link>
            <Link href="/pricing" className="hidden sm:inline-flex">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                Pricing
              </Button>
            </Link>
            <Link href="/login" className="hidden sm:inline-flex">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                Log in
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="rounded-full px-5 shadow-md shadow-primary/20">
                Start free
              </Button>
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden pt-28 pb-16 sm:pt-32 sm:pb-24 lg:pt-36 lg:pb-28" suppressHydrationWarning>
        {/* Background layers */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.06] via-background to-background" />
          <div
            className="absolute -left-1/4 top-0 h-[min(70vh,520px)] w-[min(90vw,640px)] rounded-full bg-primary/[0.09] blur-3xl dark:bg-primary/[0.12]"
            aria-hidden
          />
          <div
            className="absolute -right-1/4 bottom-0 h-[min(50vh,400px)] w-[min(80vw,480px)] rounded-full bg-primary/[0.05] blur-3xl dark:bg-primary/[0.08]"
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-[linear-gradient(to_right,oklch(0.5_0.02_250_/_0.06)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.5_0.02_250_/_0.06)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_bottom,transparent,black_8%,black_88%,transparent)] dark:bg-[linear-gradient(to_right,oklch(0.9_0.02_250_/_0.04)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.9_0.02_250_/_0.04)_1px,transparent_1px)]"
            aria-hidden
          />
        </div>

        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.06] px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-primary dark:border-primary/30 dark:bg-primary/10">
            Fleet ops · Web app
          </p>
          <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl lg:text-[2.75rem] lg:leading-[1.12]">
            Dispatch, IFTA, invoicing, and driver compliance —{" "}
            <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              one platform for fleets under 20 trucks.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            No credit card to start. Try the{" "}
            <Link href="/demo" className="font-medium text-primary underline decoration-primary/30 underline-offset-4 transition hover:decoration-primary">
              interactive demo
            </Link>{" "}
            or open a free account — real screens, not slide decks.
          </p>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground/90">
            No made-up savings figures. Prefer proof?{" "}
            <Link href="#demo-video" className="font-medium text-foreground/90 underline decoration-border underline-offset-4 hover:text-primary">
              Watch the walkthrough
            </Link>{" "}
            below or use the product yourself.
          </p>

          <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:mx-auto sm:max-w-xl sm:flex-row sm:items-center sm:gap-4">
            <Link href="/demo" className="sm:flex-1 sm:max-w-[200px]">
              <Button
                size="lg"
                className="h-12 w-full rounded-xl bg-primary text-base font-semibold shadow-lg shadow-primary/25 transition hover:shadow-xl hover:shadow-primary/30 sm:h-12"
              >
                <Play className="mr-2 h-5 w-5" aria-hidden />
                Try demo
              </Button>
            </Link>
            <Link href="/register" className="sm:flex-1 sm:max-w-[200px]">
              <Button
                size="lg"
                variant="outline"
                className="h-12 w-full rounded-xl border-2 border-border bg-background/50 text-base font-semibold backdrop-blur-sm transition hover:bg-muted/50 dark:bg-card/30"
              >
                Start free
                <ArrowRight className="ml-2 h-5 w-5" aria-hidden />
              </Button>
            </Link>
            <Link href="/pricing" className="sm:flex sm:shrink-0">
              <Button variant="ghost" size="lg" className="h-12 rounded-xl text-base font-medium text-primary">
                See pricing →
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <LandingPageBelowFold />
    </div>
  )
}
