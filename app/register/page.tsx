"use client"

import { Card } from "@/components/ui/card"
import { ArrowLeft, Building2, Radio, Truck, Shield, DollarSign, User } from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/logo"
import { useRouter } from "next/navigation"
import { ROLES, type EmployeeRole } from "@/lib/roles"

const roleIcons = {
  super_admin: Building2,
  operations_manager: Radio,
  dispatcher: Truck,
  safety_compliance: Shield,
  financial_controller: DollarSign,
  driver: User,
}

export default function RegisterPage() {
  const router = useRouter()

  const handleRoleSelect = (role: EmployeeRole) => {
    if (role === "super_admin") {
      router.push("/register/manager")
    } else {
      router.push(`/register/user?role=${role}`)
    }
  }

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

      <div className="w-full max-w-6xl">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>

        {/* Register Card */}
        <Card className="bg-card border-border p-8">
          <h1 className="text-3xl font-bold text-foreground mb-2 text-center">Create Account</h1>
          <p className="text-center text-muted-foreground mb-10">
            Choose your role to get started
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.values(ROLES).map((role) => {
              const Icon = roleIcons[role.id]
              const isCompanyCreator = role.id === "super_admin"
              
              return (
                <button
                  key={role.id}
                  onClick={() => handleRoleSelect(role.id)}
                  className="border-2 border-border rounded-xl p-6 hover:border-primary hover:bg-primary/5 transition group text-left h-full flex flex-col"
                >
                  <div className="w-14 h-14 bg-primary/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/30 transition">
                    <Icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{role.name}</h3>
                  <p className="text-sm text-muted-foreground flex-1">
                    {role.description}
                  </p>
                  {isCompanyCreator && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <span className="text-xs font-medium text-primary">Creates Company</span>
                    </div>
                  )}
                  {!isCompanyCreator && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <span className="text-xs font-medium text-muted-foreground">Joins Existing Company</span>
                    </div>
                  )}
                </button>
              )
            })}
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
