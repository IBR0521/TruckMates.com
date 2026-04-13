"use client"

import { Card } from "@/components/ui/card"

export default function Loading() {
  return (
    <div className="w-full p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-4">
        <Card className="border-border/50 p-6 h-20 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border/50 p-6 h-36 animate-pulse" />
          <Card className="border-border/50 p-6 h-36 animate-pulse" />
          <Card className="border-border/50 p-6 h-36 animate-pulse" />
          <Card className="border-border/50 p-6 h-36 animate-pulse" />
        </div>
        <Card className="border-border/50 p-6 h-64 animate-pulse" />
      </div>
    </div>
  )
}
