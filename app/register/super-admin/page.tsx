"use client"

import { useState, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { Logo } from "@/components/logo"
import { useRouter, useSearchParams } from "next/navigation"
import { checkCompanyName, registerSuperAdmin } from "@/app/actions/auth"
import { ROLES, type EmployeeRole } from "@/lib/roles"

function SuperAdminRegisterForm() {
  const searchParams = useSearchParams()
  const selectedRole = (searchParams.get('role') as EmployeeRole) || 'super_admin'
  const roleInfo = ROLES[selectedRole] || ROLES.super_admin

  const [formData, setFormData] = useState({
    companyName: "",
    email: "",
    password: "",
    phone: "",
    companyType: null as 'broker' | 'carrier' | 'both' | null,
  })
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

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
      // Check company name
      const nameCheck = await checkCompanyName(formData.companyName)
      if (nameCheck.error) {
        toast.error(nameCheck.error)
        setIsLoading(false)
        return
      }
      if (!nameCheck.available) {
        toast.error("A company with this name already exists. Please choose a different name.")
        setIsLoading(false)
        return
      }

      // Register
      const result = await registerSuperAdmin({
        companyName: formData.companyName.trim(),
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        companyType: formData.companyType || null,
      })

      if (result.error) {
        toast.error(result.error)
        setIsLoading(false)
        return
      }

      toast.success("Account created successfully!")
      setTimeout(() => {
        router.push("/account-setup/manager")
      }, 500)
    } catch (error: any) {
      toast.error(error?.message || "An error occurred. Please try again.")
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <Link
        href="/register"
        className="absolute top-6 left-6 flex items-center gap-2 text-muted-foreground hover:text-foreground transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Back</span>
      </Link>

      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Logo size="lg" />
        </div>

        <Card className="bg-card border-border p-8">
          <h1 className="text-2xl font-bold text-foreground mb-2 text-center">
            Company Registration
          </h1>
          <p className="text-center text-muted-foreground mb-2">
            Registering as: <span className="font-semibold text-foreground">{roleInfo.name}</span>
          </p>
          <p className="text-center text-xs text-muted-foreground mb-8">
            {roleInfo.description}
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
                required
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
                required
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
                required
              />
            </div>
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
            <div>
              <label className="text-sm font-medium text-foreground">Password</label>
              <Input
                type="password"
                name="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                className="mt-2 bg-input border-border text-foreground placeholder:text-muted-foreground"
                required
                minLength={8}
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

export default function SuperAdminRegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <SuperAdminRegisterForm />
    </Suspense>
  )
}

