"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PlugZap, X } from "lucide-react"
import { getEldConnectionCount } from "@/app/actions/eld-wizard"

const DISMISS_KEY = "tm:no-eld-banner-dismissed"

export function NoEldBanner() {
  const [show, setShow] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") {
        setDismissed(true)
        return
      }
    } catch {
      // ignore
    }
    void getEldConnectionCount().then((r) => {
      if (r.data && r.data.count === 0) setShow(true)
    })
  }, [])

  if (!show || dismissed) return null

  return (
    <Card className="border-primary/30 bg-primary/5 p-4 md:p-5 relative">
      <button
        type="button"
        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
        onClick={() => {
          setDismissed(true)
          try {
            sessionStorage.setItem(DISMISS_KEY, "1")
          } catch {
            // ignore
          }
        }}
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between pr-8">
        <div className="flex gap-3">
          <PlugZap className="h-8 w-8 text-primary shrink-0" />
          <div>
            <h3 className="font-semibold text-foreground">Connect your ELD to unlock automation</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Your existing Samsara, Motive, or Geotab works with TruckMates. No new hardware — about a
              5-minute setup.
            </p>
          </div>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/dashboard/eld/connect">Get started</Link>
        </Button>
      </div>
    </Card>
  )
}
