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
    name: "Simple",
    price: "$25",
    period: "/month",
    description: "Perfect for small operations",
    features: [
      "Up to 15 simple users",
      "Up to 20 truck drivers",
      "Basic fleet tracking",
      "Driver management",
      "Monthly reports",
    ],
    popular: false,
  },
  {
    name: "Standard",
    price: "$49",
    period: "/month",
    description: "For growing teams",
    features: [
      "Up to 25 simple users",
      "Up to 35 truck drivers",
      "Advanced analytics",
      "Route optimization",
      "Priority support",
      "Custom reports",
    ],
    popular: true,
  },
  {
    name: "Premium",
    price: "$99",
    period: "/month",
    description: "Enterprise solution",
    features: [
      "Unlimited drivers",
      "Unlimited users",
      "Real-time GPS tracking",
      "AI-powered routing",
      "24/7 dedicated support",
      "Custom integrations",
      "Advanced security",
    ],
    popular: false,
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

  const handleSelectPlan = async (planName: string) => {
    setIsLoading(true)
    toast.success(`${planName} plan selected successfully`)

    // TODO: Save subscription to Supabase
    // const { data, error } = await supabase
    //   .from('subscriptions')
    //   .insert({
    //     user_id: user.id,
    //     plan: planName,
    //     status: 'active'
    //   })

    setTimeout(() => {
      if (userType === "manager") {
        // Managers go to account setup to add employees
        router.push("/account-setup/manager")
      } else {
        // Simple users go directly to dashboard
        router.push("/dashboard")
      }
      setIsLoading(false)
    }, 1000)
  }

  const getBackLink = () => {
    if (userType === "user") {
      return "/account-setup/user"
    }
    return "/register/manager"
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
                {plan.popular && (
                  <div className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full w-fit mb-4">
                    MOST POPULAR
                  </div>
                )}

                <h3 className="text-2xl font-bold text-foreground mb-2">{plan.name}</h3>
                <p className="text-muted-foreground text-sm mb-6">{plan.description}</p>

                <div className="mb-6">
                  <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>

                <Button
                  onClick={() => handleSelectPlan(plan.name)}
                  disabled={isLoading}
                  className={`w-full mb-8 ${
                    plan.popular
                      ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                      : "bg-secondary hover:bg-secondary/90 text-foreground"
                  }`}
                >
                  {isLoading ? "Processing..." : "Select Plan"}
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
