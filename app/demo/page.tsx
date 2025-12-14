"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Logo } from "@/components/logo"
import { setupDemoCompany } from "@/app/actions/demo"
import { createClient } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"

const DEMO_EMAIL = "demo@truckmates.com"
const DEMO_PASSWORD = "demo123456"

export default function DemoPage() {
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "error">("loading")
  const [errorMessage, setErrorMessage] = useState("")
  const supabase = createClient()

  useEffect(() => {
    async function handleDemo() {
      try {
        // Try to sign in first (demo user might already exist)
        let signInResult = await supabase.auth.signInWithPassword({
          email: DEMO_EMAIL,
          password: DEMO_PASSWORD,
        })

        let userId: string | null = null
        let isNewUser = false

        // If sign-in fails, create the user
        if (signInResult.error) {
          console.log("Sign-in failed, creating new demo user:", signInResult.error.message)
          
          const signUpResult = await supabase.auth.signUp({
            email: DEMO_EMAIL,
            password: DEMO_PASSWORD,
            options: {
              emailRedirectTo: undefined,
              data: {
                is_demo: true
              }
            }
          })

          if (signUpResult.error) {
            console.error("Demo sign-up error:", signUpResult.error)
            setStatus("error")
            setErrorMessage(`Failed to create demo account: ${signUpResult.error.message}`)
            return
          }

          if (!signUpResult.data.user) {
            setStatus("error")
            setErrorMessage("Failed to create demo user. Please try again.")
            return
          }

          userId = signUpResult.data.user.id
          isNewUser = true

          // Wait a bit for user record to be created by trigger
          await new Promise(resolve => setTimeout(resolve, 1500))

          // Now sign in with the newly created account
          signInResult = await supabase.auth.signInWithPassword({
            email: DEMO_EMAIL,
            password: DEMO_PASSWORD,
          })
        } else {
          // Sign-in succeeded, get user ID
          userId = signInResult.data.user?.id || null
        }

        if (signInResult.error || !signInResult.data.user) {
          console.error("Final sign-in error:", signInResult.error)
          setStatus("error")
          setErrorMessage(`Sign-in failed: ${signInResult.error?.message || "Unknown error"}`)
          return
        }

        // Now setup company and subscription (server action)
        const result = await setupDemoCompany(userId)

        if (result.error) {
          console.error("Demo company setup error:", result.error)
          // Continue anyway - user is signed in, company setup can be done later
        }

        // User is signed in, redirect to dashboard

        // Redirect to dashboard
        router.push("/dashboard")
      } catch (error: any) {
        console.error("Demo setup error:", error)
        setStatus("error")
        setErrorMessage(error?.message || "Failed to start demo. Please check the console for details.")
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
