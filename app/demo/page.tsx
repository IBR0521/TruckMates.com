"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Logo } from "@/components/logo"
import { createDemoAccount } from "@/app/actions/demo"
import { Loader2 } from "lucide-react"

export default function DemoPage() {
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "error">("loading")
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    async function handleDemo() {
      try {
        const result = await createDemoAccount()

        if (result.error) {
          setStatus("error")
          setErrorMessage(result.error)
          return
        }

        if (result.data) {
          // Redirect to dashboard
          router.push("/dashboard")
        }
      } catch (error: any) {
        setStatus("error")
        setErrorMessage(error.message || "Failed to start demo")
      }
    }

    handleDemo()
  }, [router])

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md text-center space-y-6">
          <Logo size="lg" />
          <div className="space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            <h2 className="text-2xl font-bold text-foreground">Setting up your demo...</h2>
            <p className="text-muted-foreground">
              We're preparing your demo workspace. This will only take a moment.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-6">
        <Logo size="lg" />
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground text-red-500">Demo Setup Failed</h2>
          <p className="text-muted-foreground">{errorMessage}</p>
          <button
            onClick={() => router.push("/")}
            className="text-primary hover:underline"
          >
            Go back to home
          </button>
        </div>
      </div>
    </div>
  )
}
