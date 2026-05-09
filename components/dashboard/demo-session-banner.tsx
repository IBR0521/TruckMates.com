"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Sparkles } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

/** Shown when the viewer is logged in via the shared interactive demo session. */
export function DemoSessionBanner() {
  const [visible, setVisible] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const meta = user.user_metadata as Record<string, unknown> | undefined
      if (meta?.is_demo === true || String(meta?.is_demo || "").toLowerCase() === "true") {
        setVisible(true)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [supabase])

  if (!visible) return null

  return (
    <div
      className="shrink-0 border-b border-primary/25 bg-primary/10 px-4 py-3 text-center text-sm text-foreground"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-2 sm:flex-row sm:gap-4">
        <span className="inline-flex items-center gap-2 font-medium">
          <Sparkles className="h-4 w-4 text-primary shrink-0" aria-hidden />
          You’re exploring a shared demo workspace with sample data.
        </span>
        <Link
          href="/register"
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Sign up for full access
        </Link>
      </div>
    </div>
  )
}
