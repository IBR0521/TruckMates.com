"use client"

import { Card } from "@/components/ui/card"

export default function Loading() {
  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Drivers</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your fleet drivers</p>
      </div>

      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-4">
          <Card className="border-border/50 p-4 h-20 animate-pulse" />
          <Card className="border-border/50 p-6 h-28 animate-pulse" />
          <Card className="border-border/50 p-6 h-28 animate-pulse" />
          <Card className="border-border/50 p-6 h-28 animate-pulse" />
        </div>
      </div>
    </div>
  )
}
