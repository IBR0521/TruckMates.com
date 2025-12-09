"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, User, Building2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Logo } from "@/components/logo"
import { toast } from "sonner"
import { verifyAndAcceptInvitation } from "@/app/actions/employees"

export default function UserAccountSetupPage() {
  const [workType, setWorkType] = useState<"individual" | "manager" | null>(null)
  const [managerId, setManagerId] = useState("")
  const [showManagerIdInput, setShowManagerIdInput] = useState(false)
  const router = useRouter()

  const handleContinue = () => {
    if (workType === "individual") {
      // Go to subscription page
      router.push("/plans?type=user")
    } else if (workType === "manager" && managerId.trim()) {
      // Verify manager ID and link account
      handleVerifyManagerId()
    } else if (workType === "manager") {
      toast.error("Please enter a manager ID")
    }
  }

  const handleVerifyManagerId = async () => {
    if (!managerId.trim()) {
      toast.error("Please enter an invitation code")
      return
    }

    try {
      // Verify and accept invitation code
      const result = await verifyAndAcceptInvitation(managerId.trim())

      if (result.error) {
        toast.error(result.error)
        return
      }

      // If invitation is valid, user is now linked to company
      toast.success("Invitation accepted! Linking your account...")
      setTimeout(() => {
        router.push("/dashboard")
      }, 1500)
    } catch (error: any) {
      toast.error(error.message || "Invalid invitation code. Please check and try again.")
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      {/* Header */}
      <Link
        href="/register/user"
        className="absolute top-6 left-6 flex items-center gap-2 text-muted-foreground hover:text-foreground transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Back</span>
      </Link>

      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>

        {/* Setup Card */}
        <Card className="bg-card border-border p-8">
          <h1 className="text-3xl font-bold text-foreground mb-2 text-center">Account Setup</h1>
          <p className="text-center text-muted-foreground mb-8">How would you like to use TruckMates?</p>

          <div className="space-y-4 mb-8">
            {/* Individual Option */}
            <button
              onClick={() => {
                setWorkType("individual")
                setShowManagerIdInput(false)
              }}
              className={`w-full border-2 rounded-xl p-6 text-left transition ${
                workType === "individual"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-primary/5"
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    workType === "individual" ? "bg-primary/20" : "bg-secondary"
                  }`}
                >
                  <User className={`w-6 h-6 ${workType === "individual" ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-foreground mb-1">Work Individually</h3>
                  <p className="text-sm text-muted-foreground">
                    Manage your own operations and choose a subscription plan
                  </p>
                </div>
                {workType === "individual" && (
                  <div className="w-5 h-5 rounded-full bg-primary border-4 border-primary/20"></div>
                )}
              </div>
            </button>

            {/* Manager Account Option */}
            <button
              onClick={() => {
                setWorkType("manager")
                setShowManagerIdInput(true)
              }}
              className={`w-full border-2 rounded-xl p-6 text-left transition ${
                workType === "manager"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-primary/5"
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    workType === "manager" ? "bg-primary/20" : "bg-secondary"
                  }`}
                >
                  <Building2
                    className={`w-6 h-6 ${workType === "manager" ? "text-primary" : "text-muted-foreground"}`}
                  />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-foreground mb-1">Work Under Manager Account</h3>
                  <p className="text-sm text-muted-foreground">
                    Join an existing company using a manager-provided ID number
                  </p>
                </div>
                {workType === "manager" && (
                  <div className="w-5 h-5 rounded-full bg-primary border-4 border-primary/20"></div>
                )}
              </div>
            </button>
          </div>

          {/* Manager ID Input */}
          {showManagerIdInput && (
            <div className="mb-6 p-4 bg-secondary/50 rounded-lg border border-border">
              <label className="block text-sm font-medium text-foreground mb-2">
                Enter Invitation Code
              </label>
              <input
                type="text"
                value={managerId}
                onChange={(e) => setManagerId(e.target.value.toUpperCase())}
                placeholder="Enter the invitation code (e.g., EMP-ABC123XYZ)"
                className="w-full px-4 py-2 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Enter the invitation code sent to your email by your manager
              </p>
            </div>
          )}

          <Button
            onClick={handleContinue}
            disabled={!workType || (workType === "manager" && !managerId.trim())}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Continue
          </Button>
        </Card>
      </div>
    </div>
  )
}

