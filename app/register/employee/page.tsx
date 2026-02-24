"use client"

import { useState, useEffect, Suspense } from "react"
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
  const roleParam = searchParams.get('role') as EmployeeRole
  const defaultRole = roleParam && ROLES[roleParam] ? roleParam : 'driver'

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    role: defaultRole as EmployeeRole,
    companyId: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (roleParam && ROLES[roleParam]) {
      setFormData(prev => ({ ...prev, role: roleParam }))
    }
  }, [roleParam])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const result = await registerEmployee({
        fullName: formData.fullName.trim(),
        email: formData.email,
        password: formData.password,
        role: formData.role,
        companyId: formData.companyId || undefined,
      })

      if (result.error) {
        toast.error(result.error)
        setIsLoading(false)
        return
      }

      toast.success("Account created successfully!")
      setTimeout(() => {
        router.push("/dashboard")
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
            Employee Registration
          </h1>
          <p className="text-center text-muted-foreground mb-8">
            Create your account and join a company
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
                <SelectTrigger className="mt-2 bg-input border-border text-foreground">
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(ROLES).map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <div>
              <label className="text-sm font-medium text-foreground">Company ID (Optional)</label>
              <Input
                type="text"
                name="companyId"
                placeholder="Leave empty if you have an invitation"
                value={formData.companyId}
                onChange={handleChange}
                className="mt-2 bg-input border-border text-foreground placeholder:text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground mt-1">
                If you have a company invitation, you can enter the company ID here
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

