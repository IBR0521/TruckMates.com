"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { Logo } from "@/components/logo"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { checkCompanyNameExists, createCompanyAndLinkUser } from "@/app/actions/registration"

export default function ManagerRegisterPage() {
  const [formData, setFormData] = useState({
    companyName: "",
    email: "",
    password: "",
    phone: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Step 0: Check if company name already exists (using server action)
      const nameCheck = await checkCompanyNameExists(formData.companyName)
      if (nameCheck.exists) {
        toast.error("A company with this name already exists. Please choose a different name.")
        setIsLoading(false)
        return
      }

      // Step 1: Create auth user (trigger will automatically create public.users record)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.companyName.trim(),
            role: 'manager'
          }
        }
      })

      if (authError) {
        // Check if it's an email already exists error
        if (authError.message.includes("already registered") || authError.message.includes("already exists") || authError.message.includes("User already registered")) {
          // Check if user exists in public.users and has a company
          const { data: existingUserRecord } = await supabase
            .from('users')
            .select('id, company_id, email')
            .eq('email', formData.email)
            .maybeSingle()

          if (existingUserRecord?.company_id) {
            toast.error("This email is already registered with a company. Please log in instead.")
          } else {
            toast.error("This email is already registered. Please log in or use a different email.")
          }
        } else {
          toast.error(authError.message || "Failed to create account")
        }
        setIsLoading(false)
        return
      }

      if (!authData.user) {
        toast.error("Failed to create user")
        setIsLoading(false)
        return
      }

      // Step 2: Create company and link user (using server action to bypass RLS)
      const companyResult = await createCompanyAndLinkUser({
        companyName: formData.companyName,
        email: formData.email,
        phone: formData.phone,
        userId: authData.user.id
      })

      if (companyResult.error) {
        toast.error(companyResult.error || "Failed to create company. Please try again or contact support.")
        setIsLoading(false)
        return
      }

      toast.success("Account created successfully!")
      setTimeout(() => {
        router.push("/plans?type=manager")
      }, 500)
    } catch (error: any) {
      console.error("Registration error:", error)
      toast.error(error?.message || "An error occurred. Please try again.")
      setIsLoading(false)
    }
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
          <h1 className="text-2xl font-bold text-foreground mb-2 text-center">Manager Registration</h1>
          <p className="text-center text-muted-foreground mb-8">Set up your fleet management account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Company Name</label>
              <Input
                type="text"
                name="companyName"
                placeholder="Your Company"
                value={formData.companyName}
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
              <label className="text-sm font-medium text-foreground">Phone</label>
              <Input
                type="tel"
                name="phone"
                placeholder="+1 (555) 123-4567"
                value={formData.phone}
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

            <Button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mt-6"
            >
              {isLoading ? "Creating account..." : "Continue to Plans"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
