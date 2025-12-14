"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Logo } from "@/components/logo"
import { createDemoAccount } from "@/app/actions/demo"
import { createClient } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"

export default function DemoPage() {
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "error">("loading")
  const [errorMessage, setErrorMessage] = useState("")
  const supabase = createClient()

  useEffect(() => {
    async function handleDemo() {
      try {
        // First, create/setup demo account (server action)
        const result = await createDemoAccount()

        if (result.error) {
          setStatus("error")
          setErrorMessage(result.error)
          return
        }

        if (result.data) {
          // Now sign in on client side (this sets cookies properly)
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: result.data.email,
            password: result.data.password,
          })

          if (signInError || !signInData.user) {
            setStatus("error")
            setErrorMessage(signInError?.message || "Failed to sign in demo account")
            return
          }

          // Redirect to dashboard
          router.push("/dashboard")
        }
      } catch (error: any) {
        setStatus("error")
        setErrorMessage(error.message || "Failed to start demo")
      }
    }

    handleDemo()
  }, [router, supabase])

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
