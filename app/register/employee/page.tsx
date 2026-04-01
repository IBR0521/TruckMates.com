"use client"

import { useState, useEffect, Suspense } from "react"
import { errorMessage } from "@/lib/error-message"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { Logo } from "@/components/logo"
import { useRouter, useSearchParams } from "next/navigation"
import { registerEmployee } from "@/app/actions/auth"
import { ROLES, type EmployeeRole } from "@/lib/roles"

function EmployeeRegisterForm() {
  const searchParams = useSearchParams()
  const roleParam = searchParams.get("role") as EmployeeRole | null
  const invitationCode = searchParams.get("invitation")
  const hasInvitation = Boolean(invitationCode)

  // Roles that are allowed for self-registration (no managers or super admins)
  const selfRegisterRoles: EmployeeRole[] = [
    "dispatcher",
    "safety_compliance",
    "financial_controller",
    "driver",
  ]

  const defaultRole: EmployeeRole =
    roleParam && (selfRegisterRoles.includes(roleParam) || roleParam === "operations_manager")
      ? roleParam
      : "driver"

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    role: defaultRole,
    companyId: "",
    invitationCode: invitationCode || "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (roleParam && selfRegisterRoles.includes(roleParam)) {
      setFormData(prev => ({ ...prev, role: roleParam }))
    }
    if (invitationCode) {
      setFormData(prev => ({ ...prev, invitationCode }))
    }
  }, [roleParam, invitationCode])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const result = await registerEmployee({
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role,
        companyId: formData.companyId.trim() || undefined,
        invitationCode: formData.invitationCode.trim() || undefined,
      } as any)

      if (result.error) {
        toast.error(result.error)
        setIsLoading(false)
        return
      }

      toast.success("Account created successfully!", {
        description: "Please check your email and confirm your account before signing in.",
        duration: 5000,
      })
      setTimeout(() => {
        router.push("/dashboard")
      }, 500)
    } catch (error: unknown) {
      toast.error(errorMessage(error, "An error occurred. Please try again."))
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
            {invitationCode ? "Accept Invitation" : "Employee Registration"}
          </h1>
          <p className="text-center text-muted-foreground mb-8">
            {invitationCode 
              ? "You've been invited to join a company. Create your account to accept the invitation."
              : "Create your account and join a company"}
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
              <label className="text-sm font-medium text-foreground">Role</label>
              <Select 
                value={formData.role} 
                onValueChange={(value) => setFormData({ ...formData, role: value as EmployeeRole })}
              >
                <SelectTrigger className="mt-2 bg-input border-border text-foreground" disabled={hasInvitation}>
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(ROLES)
                    .filter(role => selfRegisterRoles.includes(role.id) || role.id === "operations_manager")
                    .map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {hasInvitation && (
                <p className="text-xs text-primary mt-1">
                  Role is locked by the invitation link.
                </p>
              )}
              {formData.role && ROLES[formData.role] && (
                <p className="text-xs text-muted-foreground mt-1">
                  {ROLES[formData.role].description}
                </p>
              )}
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
            {invitationCode ? (
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-md">
                <p className="text-sm text-primary font-medium">
                  ✓ Invitation code detected. Your account will be linked to the company automatically.
                </p>
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium text-foreground">Company ID or Invitation Code (Optional)</label>
                <Input
                  type="text"
                  name="companyId"
                  placeholder="Enter company ID or invitation code"
                  value={formData.companyId}
                  onChange={handleChange}
                  className="mt-2 bg-input border-border text-foreground placeholder:text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  If you have a company invitation link, the code will be automatically filled in
                </p>
              </div>
            )}

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

export default function EmployeeRegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <EmployeeRegisterForm />
    </Suspense>
  )
}

