"use client"

import { Card } from "@/components/ui/card"

export default function Loading() {
  return (
    <div className="w-full p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-4">
        <Card className="border-border/50 p-5 h-20 animate-pulse" />
        <Card className="border-border/50 p-5 h-24 animate-pulse" />
        <Card className="border-border/50 p-5 h-28 animate-pulse" />
        <Card className="border-border/50 p-5 h-28 animate-pulse" />
      </div>
    </div>
  )
}
