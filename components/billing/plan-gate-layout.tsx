import { getCachedAuthContext } from "@/lib/auth/server"
import { checkFeatureAccess } from "@/lib/plan-enforcement"
import { planTierLabel, type PlanFeatures } from "@/lib/plan-limits"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Lock } from "lucide-react"

type Props = {
  feature: keyof PlanFeatures
  title: string
  description: string
  requiredPlanLabel?: string
  children: React.ReactNode
}

export async function PlanGateLayout(props: Props) {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return (
      <Card className="border-border p-8 max-w-lg mx-auto">
        <p className="text-muted-foreground">{ctx.error || "Sign in required."}</p>
      </Card>
    )
  }

  const gate = await checkFeatureAccess({ companyId: ctx.companyId, feature: props.feature })
  if (gate.allowed) {
    return <>{props.children}</>
  }

  const tierName = planTierLabel(gate.currentTier)

  return (
    <div className="w-full p-6 md:p-8">
      <Card className="border-border border-dashed max-w-xl mx-auto p-8 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Lock className="h-6 w-6 text-muted-foreground" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{props.title}</h1>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            {props.description} Your workspace is on the <strong>{tierName}</strong> plan.
            {props.requiredPlanLabel ? ` ${props.requiredPlanLabel}` : ""}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button asChild>
            <Link href="/dashboard/settings/billing">View plans & upgrade</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/all-features">Compare features</Link>
          </Button>
        </div>
      </Card>
    </div>
  )
}
