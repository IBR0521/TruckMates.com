import { PlanGateLayout } from "@/components/billing/plan-gate-layout"
import { Card } from "@/components/ui/card"

export default async function HazmatPage() {
  return (
    <PlanGateLayout
      feature="hazmat_module"
      title="HAZMAT"
      description="Dedicated hazmat workflows, segregation checks, and shipping paper tools."
      requiredPlanLabel="The hazmat module unlocks on the Fleet plan."
    >
      <div className="p-8 max-w-4xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">HAZMAT hub</h1>
        <Card className="p-6 border-border">
          <p className="text-muted-foreground text-sm">
            Access hazmat-specific routing guidance, endorsement checks on assignment, and printable shipping papers from
            load details.
          </p>
        </Card>
      </div>
    </PlanGateLayout>
  )
}
