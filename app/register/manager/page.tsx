"use client"

import type React from "react"

import { useState, useEffect, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { Logo } from "@/components/logo"
import { createClient } from "@/lib/supabase/client"
import { useRouter, useSearchParams } from "next/navigation"
import { checkCompanyNameExists, createCompanyAndLinkUser } from "@/app/actions/registration"

function ManagerRegisterForm() {
  const searchParams = useSearchParams()
  const accountType = searchParams.get("type") // Legacy: 'manager', 'broker', 'carrier'
  
  const [formData, setFormData] = useState({
    companyName: "",
    email: "",
    password: "",
    phone: "",
    companyType: "" as 'broker' | 'carrier' | 'both' | '' | null,
  })
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Set company type based on URL parameter (backward compatibility)
  useEffect(() => {
    if (accountType === "broker") {
      setFormData(prev => ({ ...prev, companyType: "broker" }))
    } else if (accountType === "carrier") {
      setFormData(prev => ({ ...prev, companyType: "carrier" }))
    } else {
      // manager or no type = regular company
      setFormData(prev => ({ ...prev, companyType: null }))
    }
  }, [accountType])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleCompanyTypeChange = (value: string) => {
    setFormData({ ...formData, companyType: value === "regular" ? null : value as 'broker' | 'carrier' | 'both' })
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
            role: 'super_admin'
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

      // Step 2: Create company and link user (using server action)
      const companyResult = await createCompanyAndLinkUser({
        companyName: formData.companyName.trim(),
        email: formData.email,
        phone: formData.phone,
        userId: authData.user.id,
        companyType: formData.companyType || null,
      })

      if (companyResult.error) {
        toast.error(companyResult.error)
        setIsLoading(false)
        return
      }

      toast.success("Account created successfully!")
      setTimeout(() => {
        router.push("/account-setup/manager")
      }, 500)
    } catch (error) {
      console.error("Registration error:", error)
      toast.error("An error occurred. Please try again.")
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
          <h1 className="text-2xl font-bold text-foreground mb-2 text-center">
            Company Registration
          </h1>
          <p className="text-center text-muted-foreground mb-8">
            Set up your company account
          </p>

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
            {accountType && accountType !== "manager" ? (
              // Show read-only company type if selected from main page
              <div>
                <label className="text-sm font-medium text-foreground">Account Type</label>
                <div className="mt-2 p-3 bg-primary/10 border border-primary/20 rounded-md">
                  <p className="text-sm font-medium text-foreground">
                    {accountType === "broker" && "Broker Account"}
                    {accountType === "carrier" && "Carrier Account"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {accountType === "broker" && "You can post loads to the marketplace. Accepted loads will appear in your dashboard."}
                    {accountType === "carrier" && "You can accept loads from the marketplace. Accepted loads will automatically appear in your loads list."}
                  </p>
                </div>
              </div>
            ) : (
              // Show company type selector if coming from manager or direct URL
              <div>
                <label className="text-sm font-medium text-foreground">Company Type</label>
                <Select 
                  value={formData.companyType || "regular"} 
                  onValueChange={handleCompanyTypeChange}
                >
                  <SelectTrigger className="mt-2 bg-input border-border text-foreground">
                    <SelectValue placeholder="Select company type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">Regular Company (Fleet Management Only)</SelectItem>
                    <SelectItem value="broker">Broker (Post Loads to Marketplace)</SelectItem>
                    <SelectItem value="carrier">Carrier (Accept Loads from Marketplace)</SelectItem>
                    <SelectItem value="both">Both (Post & Accept Loads)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.companyType === "broker" && "You can post loads to the marketplace"}
                  {formData.companyType === "carrier" && "You can accept loads from the marketplace"}
                  {formData.companyType === "both" && "You can post and accept loads in the marketplace"}
                  {(!formData.companyType || formData.companyType === "regular") && "Standard fleet management platform access"}
                </p>
              </div>
            )}
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

export default function ManagerRegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    }>
      <ManagerRegisterForm />
    </Suspense>
  )
}
