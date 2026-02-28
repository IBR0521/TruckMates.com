"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Logo } from "@/components/logo"
import { SetupWizard } from "@/components/account-setup/setup-wizard"
import { getSetupStatus } from "@/app/actions/account-setup"
import { toast } from "sonner"

export default function ManagerAccountSetupPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [showWizard, setShowWizard] = useState(false)

  useEffect(() => {
    checkSetupStatus()
  }, [])

  async function checkSetupStatus() {
    try {
      const result = await getSetupStatus()
      if (result.error) {
        toast.error(result.error)
        router.push("/dashboard")
        return
      }

      if (result.data?.setup_complete) {
        // Setup already complete, redirect to dashboard
        router.push("/dashboard")
      } else {
        // Show wizard
        setShowWizard(true)
      }
    } catch (error: any) {
      console.error("Failed to check setup status:", error)
      // Show wizard anyway
      setShowWizard(true)
    } finally {
      setIsLoading(false)
    }
  }

  function handleComplete() {
    router.push("/dashboard")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8">
            <Logo size="lg" />
          </div>
          <div className="text-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!showWizard) {
    return null
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-4xl">
        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Welcome to TruckMates!</h1>
          <p className="text-muted-foreground">
            Let's get your account set up in just a few steps
          </p>
        </div>
        <SetupWizard onComplete={handleComplete} />
      </div>
    </div>
  )
}

