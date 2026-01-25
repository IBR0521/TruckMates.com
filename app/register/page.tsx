"use client"

import { Card } from "@/components/ui/card"
import { ArrowLeft, Building2, Users } from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/logo"
import { useRouter } from "next/navigation"

export default function RegisterPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8">
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
          <p className="text-center text-muted-foreground mb-10">
            Choose your account type to get started
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Manager Registration */}
            <button
              onClick={() => router.push("/register/manager")}
              className="border-2 border-border rounded-xl p-8 hover:border-primary hover:bg-primary/5 transition group text-left h-full"
            >
              <div className="w-16 h-16 bg-primary/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/30 transition">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Manager</h3>
              <p className="text-sm text-muted-foreground">
                Create a company account and manage your fleet operations
              </p>
            </button>

            {/* Employee/Driver Registration */}
            <button
              onClick={() => router.push("/register/user")}
              className="border-2 border-border rounded-xl p-8 hover:border-primary hover:bg-primary/5 transition group text-left h-full"
            >
              <div className="w-16 h-16 bg-primary/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/30 transition">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Employee / Driver</h3>
              <p className="text-sm text-muted-foreground">
                Join an existing company with a manager ID
              </p>
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
