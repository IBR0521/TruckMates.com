"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, UserPlus, X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Logo } from "@/components/logo"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { createEmployeeInvitation } from "@/app/actions/employees"

export default function ManagerAccountSetupPage() {
  const [showAddEmployees, setShowAddEmployees] = useState(false)
  const [employeeEmail, setEmployeeEmail] = useState("")
  const [employeeIds, setEmployeeIds] = useState<Array<{ email: string; id: string }>>([])
  const router = useRouter()

  const handleSkip = () => {
    router.push("/dashboard")
  }

  const handleAddEmployee = async () => {
    if (!employeeEmail.trim()) {
      toast.error("Please enter an email address")
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(employeeEmail)) {
      toast.error("Please enter a valid email address")
      return
    }

    try {
      // Create invitation in database
      const result = await createEmployeeInvitation(employeeEmail)

      if (result.error) {
        toast.error(result.error)
        return
      }

      if (result.data) {
        // Add to list
        setEmployeeIds([...employeeIds, { 
          email: employeeEmail, 
          id: result.data.invitation_code 
        }])
        setEmployeeEmail("")
        toast.success(`Invitation sent to ${employeeEmail}. Code: ${result.data.invitation_code}`)
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to create invitation")
    }
  }

  const handleRemoveEmployee = (index: number) => {
    setEmployeeIds(employeeIds.filter((_, i) => i !== index))
  }

  const handleFinish = () => {
    if (employeeIds.length > 0) {
      toast.success(`${employeeIds.length} employee ID(s) generated successfully!`)
    }
    router.push("/dashboard")
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      {/* Header */}
      <Link
        href="/plans"
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
          <h1 className="text-3xl font-bold text-foreground mb-2 text-center">Welcome to TruckMates!</h1>
          <p className="text-center text-muted-foreground mb-8">Would you like to add employees now?</p>

          {!showAddEmployees ? (
            <div className="space-y-4">
              <Button
                onClick={() => setShowAddEmployees(true)}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Yes, Add Employees
              </Button>
              <Button onClick={handleSkip} variant="outline" className="w-full">
                Skip for Now
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Enter Employee Email Address
                </label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    value={employeeEmail}
                    onChange={(e) => setEmployeeEmail(e.target.value)}
                    placeholder="employee@example.com"
                    className="flex-1"
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        handleAddEmployee()
                      }
                    }}
                  />
                  <Button onClick={handleAddEmployee} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    Add
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  If the email exists in our system, an ID will be generated. Share this ID with the employee.
                </p>
              </div>

              {/* Generated IDs List */}
              {employeeIds.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Generated Employee IDs:</h3>
                  {employeeIds.map((emp, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg border border-border"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{emp.email}</p>
                        <p className="text-xs text-muted-foreground mt-1">ID: {emp.id}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveEmployee(index)}
                        className="text-red-400 hover:text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button onClick={handleFinish} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
                  Finish Setup
                </Button>
                <Button onClick={handleSkip} variant="outline">
                  Skip
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

