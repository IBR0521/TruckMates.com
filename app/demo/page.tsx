"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Sparkles } from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/logo"

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <Link
        href="/"
        className="absolute top-6 left-6 flex items-center gap-2 text-muted-foreground hover:text-foreground transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Back to Home</span>
      </Link>

      <div className="w-full max-w-2xl">
        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>

        <Card className="bg-card border-border p-8">
          <h1 className="text-3xl font-bold text-foreground mb-2 text-center">Try the interactive demo</h1>
          <p className="text-center text-muted-foreground mb-6">
            Browse a realistic, pre-populated fleet workspace — dispatch, loads, AI assistant screens, ELD and
            geofencing areas, safety scorecards, billing, and more. No signup required to explore the UI.
          </p>
          <p className="text-center text-xs text-muted-foreground border border-border/70 rounded-lg py-3 px-4 mb-10 bg-muted/30">
            Uses a shared read-focused demo tenant. Sensitive paid actions stay disabled unless you{" "}
            <Link href="/register" className="text-primary font-medium hover:underline">
              create your own account
            </Link>
            .
          </p>

          <Button
            asChild
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-6 text-lg font-semibold"
          >
            <Link href="/demo/setup">
              <Sparkles className="w-5 h-5 mr-2" />
              View All Features
            </Link>
          </Button>
          <p className="text-center text-sm text-muted-foreground mt-4">
            You&apos;ll sign in automatically as a demo manager scoped to shared sample data
          </p>

          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Want to create a real account?{" "}
              <Link href="/register" className="text-primary hover:underline font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
