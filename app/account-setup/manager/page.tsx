"use client"

import { Suspense } from "react"
import { useRouter } from "next/navigation"
import { Logo } from "@/components/logo"
import { SetupWizard } from "@/components/account-setup/setup-wizard"

function ManagerAccountSetupContent() {
  const router = useRouter()

  function handleComplete() {
    router.push("/dashboard")
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

