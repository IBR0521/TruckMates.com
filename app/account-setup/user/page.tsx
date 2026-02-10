"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Key } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Logo } from "@/components/logo"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { verifyCompanyInvitationCode } from "@/app/actions/employees"
import { createClient } from "@/lib/supabase/client"
import { getCurrentUser } from "@/app/actions/user"

export default function UserAccountSetupPage() {
  const [invitationCode, setInvitationCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Check if user already has a company
    async function checkUserCompany() {
      const userResult = await getCurrentUser()
      if (userResult.data?.company_id) {
        // User already has a company, redirect to dashboard
        router.push("/dashboard")
        return
      }
      if (userResult.data?.role) {
        setUserRole(userResult.data.role)
      }
    }
    checkUserCompany()
  }, [router])

  const handleVerifyCode = async () => {
    if (!invitationCode.trim()) {
      toast.error("Please enter an invitation code")
      return
    }

    if (!userRole) {
      toast.error("Unable to determine your role. Please try again.")
      return
    }

    setIsLoading(true)

    try {
      // Verify and use company invitation code
      const result = await verifyCompanyInvitationCode(invitationCode.trim(), userRole)

      if (result.error) {
        toast.error(result.error)
        setIsLoading(false)
        return
      }

      // If invitation is valid, user is now linked to company
      toast.success("Invitation code accepted! Linking your account...")
      setTimeout(() => {
        router.push("/dashboard")
      }, 1500)
    } catch (error: any) {
      toast.error(error.message || "Invalid invitation code. Please check and try again.")
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>

        {/* Setup Card */}
        <Card className="bg-card border-border p-8">
          <div className="text-center mb-6">
            <Key className="w-12 h-12 text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-2">Enter Invitation Code</h1>
            <p className="text-sm text-muted-foreground">
              You need a company invitation code to access the platform. Get one from your Super Admin.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Company Invitation Code
              </label>
              <Input
                type="text"
                value={invitationCode}
                onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
                placeholder="Enter invitation code (e.g., A1B2C3D4)"
                className="w-full bg-input border-border text-foreground placeholder:text-muted-foreground font-mono text-lg tracking-wider"
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    handleVerifyCode()
                  }
                }}
              />
              <p className="text-xs text-muted-foreground mt-2">
                The code expires in 15 minutes. Contact your Super Admin for a new code if needed.
              </p>
            </div>

            <Button
              onClick={handleVerifyCode}
              disabled={isLoading || !invitationCode.trim()}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isLoading ? "Verifying..." : "Verify & Continue"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

