"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Logo } from "@/components/logo"
import { SetupWizard } from "@/components/account-setup/setup-wizard"
import { getSetupStatus } from "@/app/actions/account-setup"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Mail } from "lucide-react"

function ManagerAccountSetupContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(true)
  const [showWizard, setShowWizard] = useState(false)
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false)
  
  // Check if user just registered (from registration flow)
  useEffect(() => {
    const justRegistered = searchParams.get("registered") === "true"
    if (justRegistered) {
      setShowEmailConfirmation(true)
    }
  }, [searchParams])

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
        
        {/* Email Confirmation Alert */}
        {showEmailConfirmation && (
          <Alert className="mb-6 border-blue-500/50 bg-blue-500/10">
            <Mail className="h-4 w-4 text-blue-600" />
            <AlertDescription>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                    Please confirm your email address
                  </p>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    We've sent a confirmation email to your inbox. Please check your email and click the confirmation link before continuing. 
                    You won't be able to sign in until your email is confirmed.
                  </p>
                </div>
                <button
                  onClick={() => setShowEmailConfirmation(false)}
                  className="text-blue-800 dark:text-blue-200 hover:text-blue-900 dark:hover:text-blue-100"
                  aria-label="Dismiss"
                >
                  ×
                </button>
              </div>
            </AlertDescription>
          </Alert>
        )}
        
        <SetupWizard onComplete={handleComplete} />
      </div>
    </div>
  )
}

export default function ManagerAccountSetupPage() {
  return (
    <Suspense fallback={
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
    }>
      <ManagerAccountSetupContent />
    </Suspense>
  )
}

