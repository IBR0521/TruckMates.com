"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Check, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, Suspense } from "react"

const plans = [
  {
    name: "Starter",
    price: "$29",
    period: "/month",
    description: "Perfect for small fleets just getting started",
    features: [
      "Up to 10 vehicles",
      "Up to 15 drivers",
      "Up to 10 employees",
      "Basic fleet tracking",
      "Driver management",
      "Route planning",
      "Load management",
      "Basic reports",
      "Invoice & expense tracking",
      "Maintenance scheduling",
      "Document storage",
      "Email notifications",
    ],
    popular: false,
    planId: "starter",
  },
  {
    name: "Professional",
    price: "$59",
    period: "/month",
    description: "For growing businesses that need advanced features",
    features: [
      "Up to 30 vehicles",
      "Up to 40 drivers",
      "Up to 25 employees",
      "ELD Service Integration",
      "Real-time GPS tracking",
      "Hours of Service (HOS) compliance",
      "IFTA reporting with ELD data",
      "Advanced analytics",
      "Route optimization",
      "Custom reports",
      "Priority email support",
    ],
    popular: true,
    planId: "professional",
  },
  {
    name: "Enterprise",
    price: "$99",
    period: "/month",
    description: "Complete solution for large operations",
    features: [
      "Unlimited vehicles",
      "Unlimited drivers",
      "Unlimited employees",
      "Advanced ELD features",
      "AI-powered route optimization",
      "Custom integrations",
      "Advanced security features",
      "Dedicated account manager",
      "24/7 priority support",
      "Custom training",
    ],
    popular: false,
    planId: "enterprise",
  },
]

function PlansContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const userType = searchParams.get("type") || "manager" // "manager" or "user"
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Update back link based on user type
  }, [userType])

  const handleSelectPlan = async (planName: string, planId: string) => {
    setIsLoading(true)
    
    try {
      // Start free trial (no payment required for now)
      const { startFreeTrial } = await import("@/app/actions/subscriptions-trial")
      const result = await startFreeTrial(planId)

      if (result.error) {
        toast.error(result.error)
        setIsLoading(false)
        return
      }

      if (result.data) {
        toast.success(`7-day free trial started! Enjoy full access.`)
        
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          if (userType === "manager") {
            router.push("/account-setup/manager")
          } else {
            router.push("/dashboard")
          }
        }, 1500)
      } else {
        toast.error("Failed to start trial")
        setIsLoading(false)
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to start trial")
      setIsLoading(false)
    }
  }

  const getBackLink = () => {
    // If type parameter exists, user is coming from registration flow
    // If no type parameter, user came from landing page (pricing link)
    const hasTypeParam = searchParams.has("type")
    
    if (hasTypeParam) {
      // Coming from registration flow
      if (userType === "user") {
        return "/account-setup/user"
      }
      return "/register/manager"
    }
    
    // No type param means coming from landing page pricing link
    return "/"
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border py-6 px-4 sm:px-6 lg:px-8">
        <Link
          href={getBackLink()}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </Link>
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold text-foreground mb-2">Choose Your Plan</h1>
          <p className="text-muted-foreground">Select the perfect plan for your fleet management needs</p>
          <div className="mt-4 p-4 bg-primary/10 border border-primary/20 rounded-lg max-w-2xl">
            <p className="text-sm text-foreground font-medium">
              🎉 <strong>7-Day Free Trial</strong> - No credit card required to start. Cancel anytime.
            </p>
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan, i) => (
              <Card
                key={i}
                className={`border-2 p-8 flex flex-col transition ${
                  plan.popular ? "border-primary bg-card/50" : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex items-center gap-2 mb-4">
                  {plan.popular && (
                    <div className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                      MOST POPULAR
                    </div>
                  )}
                  <div className="bg-green-500/10 text-green-500 text-xs font-bold px-3 py-1 rounded-full border border-green-500/20">
                    7-DAY FREE TRIAL
                  </div>
                </div>

                <h3 className="text-2xl font-bold text-foreground mb-2">{plan.name}</h3>
                <p className="text-muted-foreground text-sm mb-6">{plan.description}</p>

                <div className="mb-6">
                  <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>

                <Button
                  onClick={() => handleSelectPlan(plan.name, plan.planId)}
                  disabled={isLoading}
                  className={`w-full mb-8 ${
                    plan.popular
                      ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                      : "bg-secondary hover:bg-secondary/90 text-foreground"
                  }`}
                >
                  {isLoading ? "Processing..." : "Start Free Trial"}
                </Button>

                <div className="space-y-4 flex-1">
                  {plan.features.map((feature, j) => (
                    <div key={j} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-foreground">{feature}</span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export default function PlansPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading plans...</p>
        </div>
      </div>
    }>
      <PlansContent />
    </Suspense>
  )
}
