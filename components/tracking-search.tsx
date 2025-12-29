"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { useRouter } from "next/navigation"

export function TrackingSearch() {
  const [trackingId, setTrackingId] = useState("")
  const router = useRouter()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (trackingId.trim()) {
      router.push(`/tracking/${encodeURIComponent(trackingId.trim())}`)
    }
  }

  return (
    <form onSubmit={handleSearch} className="flex gap-2 max-w-md mx-auto">
      <Input
        type="text"
        value={trackingId}
        onChange={(e) => setTrackingId(e.target.value)}
        placeholder="Enter tracking number"
        className="flex-1 bg-background border-border"
      />
      <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
        <Search className="w-4 h-4" />
      </Button>
    </form>
  )
}


