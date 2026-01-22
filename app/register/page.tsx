"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/logo"

export default function RegisterPage() {
  const [role, setRole] = useState<"manager" | "broker" | "carrier" | "user" | null>(null)

  const handleRoleSelect = (selectedRole: "manager" | "broker" | "carrier" | "user") => {
    setRole(selectedRole)
    // Redirect to appropriate registration form
    if (selectedRole === "manager" || selectedRole === "broker" || selectedRole === "carrier") {
      // All use manager registration form, but with different company types
      window.location.href = `/register/manager?type=${selectedRole}`
    } else {
      window.location.href = "/register/user"
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      {/* Header */}
      <Link
        href="/"
        className="absolute top-6 left-6 flex items-center gap-2 text-muted-foreground hover:text-foreground transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Back to Home</span>
      </Link>

      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>

        {/* Register Card */}
        <Card className="bg-card border-border p-8">
          <h1 className="text-3xl font-bold text-foreground mb-2 text-center">Create Account</h1>
          <p className="text-center text-muted-foreground mb-10">Choose your account type to get started</p>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Manager Option */}
            <button
              onClick={() => handleRoleSelect("manager")}
              className="border-2 border-border rounded-xl p-6 hover:border-primary hover:bg-primary/5 transition group text-left"
            >
              <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/30 transition">
                <Logo size="sm" showText={false} />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">Fleet Manager</h3>
              <p className="text-sm text-muted-foreground">
                Standard fleet management - manage drivers, track vehicles, and handle operations
              </p>
            </button>

            {/* Broker Option */}
            <button
              onClick={() => handleRoleSelect("broker")}
              className="border-2 border-border rounded-xl p-6 hover:border-primary hover:bg-primary/5 transition group text-left"
            >
              <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/30 transition">
                <Logo size="sm" showText={false} />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">Broker</h3>
              <p className="text-sm text-muted-foreground">
                Post loads to the marketplace and connect with carriers to move freight
              </p>
            </button>

            {/* Carrier Option */}
            <button
              onClick={() => handleRoleSelect("carrier")}
              className="border-2 border-border rounded-xl p-6 hover:border-primary hover:bg-primary/5 transition group text-left"
            >
              <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/30 transition">
                <Logo size="sm" showText={false} />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">Carrier</h3>
              <p className="text-sm text-muted-foreground">
                Accept loads from the marketplace and automatically manage them in your dashboard
              </p>
            </button>

            {/* Driver/Employee Option */}
            <button
              onClick={() => handleRoleSelect("user")}
              className="border-2 border-border rounded-xl p-6 hover:border-primary hover:bg-primary/5 transition group text-left"
            >
              <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/30 transition">
                <Logo size="sm" showText={false} />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">Driver/Employee</h3>
              <p className="text-sm text-muted-foreground">Join a team as a driver or employee and manage your tasks</p>
            </button>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
