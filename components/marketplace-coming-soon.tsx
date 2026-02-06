"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Truck, Clock, Bell } from "lucide-react"
import Link from "next/link"

export function MarketplaceComingSoon() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background/95 to-background/90 p-4">
      <Card className="max-w-2xl w-full p-8 md:p-12 text-center border-2 border-primary/20 shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl"></div>
            <div className="relative bg-primary/10 p-6 rounded-full">
              <Truck className="w-16 h-16 text-primary" />
            </div>
          </div>
        </div>
        
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
          Marketplace Coming Soon
        </h1>
        
        <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-md mx-auto">
          We're building an amazing marketplace experience for brokers and carriers. 
          Stay tuned for updates!
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-5 h-5" />
            <span>Launching Soon</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Bell className="w-5 h-5" />
            <span>Get Notified</span>
          </div>
        </div>

        <div className="space-y-4">
          <Link href="/dashboard">
            <Button size="lg" className="w-full sm:w-auto">
              Back to Dashboard
            </Button>
          </Link>
        </div>

        <div className="mt-12 pt-8 border-t border-border">
          <p className="text-sm text-muted-foreground">
            The marketplace will connect brokers and carriers, making load posting and acceptance seamless.
          </p>
        </div>
      </Card>
    </div>
  )
}





