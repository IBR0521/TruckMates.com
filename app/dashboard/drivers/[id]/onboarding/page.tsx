"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  ArrowLeft, 
  CheckCircle2, 
  Circle, 
  FileText, 
  User, 
  Shield, 
  GraduationCap,
  Clock,
  AlertCircle
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { use } from "react"
import { 
  getDriverOnboarding, 
  updateOnboardingStep, 
  completeDriverOnboarding,
  getAllDriverOnboarding 
} from "@/app/actions/driver-onboarding"
import { getDriver } from "@/app/actions/drivers"

export default function DriverOnboardingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [onboarding, setOnboarding] = useState<any>(null)
  const [driver, setDriver] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [id])

  async function loadData() {
    setIsLoading(true)
    try {
      const [onboardingResult, driverResult] = await Promise.all([
        getDriverOnboarding(id),
        getDriver(id),
      ])

      if (onboardingResult.error && onboardingResult.error !== "Onboarding record not found") {
        toast.error(onboardingResult.error)
      } else {
        setOnboarding(onboardingResult.data)
      }

      if (driverResult.error) {
        toast.error(driverResult.error)
      } else {
        setDriver(driverResult.data)
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to load data")
    } finally {
      setIsLoading(false)
    }
  }

  const steps = [
    {
      number: 1,
      name: "Personal Information",
      icon: User,
      description: "Basic contact and personal details",
      required: ["name", "email", "phone", "address"],
    },
    {
      number: 2,
      name: "License & Certifications",
      icon: Shield,
      description: "CDL license and medical card",
      required: ["license", "medical_card"],
    },
    {
      number: 3,
      name: "Employment Documents",
      icon: FileText,
      description: "W9, I9, and tax forms",
      required: ["w9", "i9"],
    },
    {
      number: 4,
      name: "Background Check",
      icon: Shield,
      description: "Background check and drug test",
      required: ["background_check", "drug_test"],
    },
    {
      number: 5,
      name: "Training & Orientation",
      icon: GraduationCap,
      description: "Company training and orientation",
      required: ["orientation", "training"],
    },
  ]

  const getStepStatus = (stepNumber: number) => {
    if (!onboarding) return "pending"
    if (stepNumber < onboarding.current_step) return "completed"
    if (stepNumber === onboarding.current_step) return "current"
    return "pending"
  }

  const getDocumentStatus = (docType: string) => {
    if (!onboarding) return false
    const completed = Array.isArray(onboarding.documents_completed) ? onboarding.documents_completed : []
    return onboarding[`${docType}_uploaded`] || completed.some((doc: any) => doc === docType)
  }

  if (isLoading) {
    return (
      <div className="w-full p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="p-6">
            <p className="text-muted-foreground">Loading onboarding status...</p>
          </Card>
        </div>
      </div>
    )
  }

  if (!driver) {
    return (
      <div className="w-full p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="p-6">
            <p className="text-muted-foreground">Driver not found.</p>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <Link href={`/dashboard/drivers/${id}`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Driver
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <GraduationCap className="w-6 h-6" />
            Driver Onboarding
          </h1>
          <p className="text-muted-foreground mt-2">
            {driver.name || "Driver"} - Onboarding Progress
          </p>
        </div>

        {/* Onboarding Status */}
        {onboarding ? (
          <>
            {/* Progress Overview */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold mb-2">Onboarding Progress</h2>
                  <p className="text-sm text-muted-foreground">
                    Status: <Badge variant={onboarding.status === "completed" ? "default" : "outline"}>
                      {onboarding.status.replace("_", " ").toUpperCase()}
                    </Badge>
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-primary">
                    {onboarding.completion_percentage}%
                  </div>
                  <p className="text-sm text-muted-foreground">Complete</p>
                </div>
              </div>
              <Progress value={onboarding.completion_percentage} className="h-2" />
              <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>Started: {new Date(onboarding.started_at).toLocaleDateString()}</span>
                </div>
                {onboarding.completed_at && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span>Completed: {new Date(onboarding.completed_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </Card>

            {/* Steps */}
            <div className="space-y-4">
              {steps.map((step) => {
                const status = getStepStatus(step.number)
                const Icon = step.icon
                const isCompleted = status === "completed"
                const isCurrent = status === "current"

                return (
                  <Card key={step.number} className={`p-6 ${isCurrent ? "border-primary" : ""}`}>
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg ${
                        isCompleted ? "bg-green-500/10" : isCurrent ? "bg-primary/10" : "bg-muted"
                      }`}>
                        {isCompleted ? (
                          <CheckCircle2 className={`w-6 h-6 ${isCompleted ? "text-green-500" : ""}`} />
                        ) : (
                          <Icon className={`w-6 h-6 ${isCurrent ? "text-primary" : "text-muted-foreground"}`} />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-foreground">
                              Step {step.number}: {step.name}
                            </h3>
                            <p className="text-sm text-muted-foreground">{step.description}</p>
                          </div>
                          <Badge variant={isCompleted ? "default" : isCurrent ? "default" : "outline"}>
                            {isCompleted ? "Completed" : isCurrent ? "In Progress" : "Pending"}
                          </Badge>
                        </div>

                        {/* Document Checklist */}
                        <div className="mt-4 space-y-2">
                          {step.required.map((doc) => {
                            const docStatus = getDocumentStatus(doc)
                            return (
                              <div key={doc} className="flex items-center gap-2 text-sm">
                                {docStatus ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                                ) : (
                                  <Circle className="w-4 h-4 text-muted-foreground" />
                                )}
                                <span className={docStatus ? "text-foreground" : "text-muted-foreground"}>
                                  {doc.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                                </span>
                              </div>
                            )
                          })}
                        </div>

                        {isCurrent && (
                          <div className="mt-4">
                            <Link href={`/dashboard/drivers/${id}/edit`}>
                              <Button size="sm" variant="outline">
                                Complete Step {step.number}
                              </Button>
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>

            {/* Complete Onboarding Button */}
            {onboarding.status !== "completed" && onboarding.completion_percentage >= 100 && (
              <Card className="p-6 border-primary/20 bg-primary/5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold mb-1">Ready to Complete</h3>
                    <p className="text-sm text-muted-foreground">
                      All required documents and steps have been completed.
                    </p>
                  </div>
                  <Button
                    onClick={async () => {
                      const result = await completeDriverOnboarding(id)
                      if (result.error) {
                        toast.error(result.error)
                      } else {
                        toast.success("Onboarding completed successfully!")
                        loadData()
                      }
                    }}
                  >
                    Complete Onboarding
                  </Button>
                </div>
              </Card>
            )}
          </>
        ) : (
          <Card className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Onboarding Not Started</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Onboarding workflow has not been initialized for this driver.
            </p>
            <Link href={`/dashboard/drivers/${id}/edit`}>
              <Button>Start Onboarding</Button>
            </Link>
          </Card>
        )}
      </div>
    </div>
  )
}

