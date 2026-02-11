"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Logo } from "@/components/logo"
import { Card } from "@/components/ui/card"
import { Key } from "lucide-react"

export default function ManagerAccountSetupPage() {
  const router = useRouter()

  useEffect(() => {
    // Super Admin account is already set up with company
    router.push("/dashboard")
  }, [router])

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>
        <Card className="bg-card border-border p-8 text-center">
          <Key className="w-12 h-12 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Welcome to TruckMates!</h1>
          <p className="text-muted-foreground">Redirecting to dashboard...</p>
          <p className="text-sm text-muted-foreground mt-4">
            Your account is set up and ready to use.
          </p>
        </Card>
      </div>
    </div>
  )
}

