"use client"

import type React from "react"

import { useState, Suspense, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { Logo } from "@/components/logo"
import { createClient } from "@/lib/supabase/client"
import { useRouter, useSearchParams } from "next/navigation"
import { ROLES, type EmployeeRole } from "@/lib/roles"

function UserRegisterForm() {
  const searchParams = useSearchParams()
  const selectedRole = searchParams.get("role") as EmployeeRole | null
  const roleInfo = selectedRole ? ROLES[selectedRole] : null

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    managerId: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // If no role is selected, redirect back to registration page
    if (!selectedRole || !roleInfo) {
      router.push("/register")
    }
  }, [selectedRole, roleInfo, router])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    if (!selectedRole) {
      toast.error("Please select a role")
      setIsLoading(false)
      return
    }

    try {
      // Step 1: Create auth user (trigger will automatically create public.users record)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            role: selectedRole
          }
        }
      })

      if (authError) {
        toast.error(authError.message || "Failed to create account")
        setIsLoading(false)
        return
      }

      if (!authData.user) {
        toast.error("Failed to create user")
        setIsLoading(false)
        return
      }

      // Step 2: Update user record with full name and role
      const { error: userError } = await supabase
        .from('users')
        .update({ 
          full_name: formData.fullName,
          role: selectedRole
        })
        .eq('id', authData.user.id)

      if (userError) {
        toast.error(userError.message || "Failed to update user")
        setIsLoading(false)
        return
      }

      toast.success("Account created successfully!")
      setTimeout(() => {
        router.push("/account-setup/user")
      }, 500)
    } catch (error) {
      toast.error("An error occurred. Please try again.")
      setIsLoading(false)
    }
  }

  if (!selectedRole || !roleInfo) {
    return null
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      {/* Header */}
      <Link
        href="/register"
        className="absolute top-6 left-6 flex items-center gap-2 text-muted-foreground hover:text-foreground transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Back</span>
      </Link>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>

        {/* Registration Card */}
        <Card className="bg-card border-border p-8">
          <h1 className="text-2xl font-bold text-foreground mb-2 text-center">
            {roleInfo.name} Registration
          </h1>
          <p className="text-center text-muted-foreground mb-8">
            Join an existing company
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Full Name</label>
              <Input
                type="text"
                name="fullName"
                placeholder="John Doe"
                value={formData.fullName}
                onChange={handleChange}
                className="mt-2 bg-input border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Email</label>
              <Input
                type="email"
                name="email"
                placeholder="you@company.com"
                value={formData.email}
                onChange={handleChange}
                className="mt-2 bg-input border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Password</label>
              <Input
                type="password"
                name="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                className="mt-2 bg-input border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Company Invitation Code</label>
              <Input
                type="text"
                name="managerId"
                placeholder="Enter the invitation code provided by your company"
                value={formData.managerId}
                onChange={handleChange}
                className="mt-2 bg-input border-border text-foreground placeholder:text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground mt-1">
                You'll be linked to the company after account creation
              </p>
            </div>

            <Button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mt-6"
            >
              {isLoading ? "Creating account..." : "Create Account"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}

export default function UserRegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    }>
      <UserRegisterForm />
    </Suspense>
  )
}
