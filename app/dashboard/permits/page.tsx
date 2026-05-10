import { PlanGateLayout } from "@/components/billing/plan-gate-layout"
import { Card } from "@/components/ui/card"

export default async function PermitsPage() {
  return (
    <PlanGateLayout
      feature="permit_management"
      title="Permit management"
      description="Track oversize/overweight and trip permits with renewals and document storage."
      requiredPlanLabel="Advanced permit workflows are included starting on the Fleet plan."
    >
      <div className="p-8 max-w-4xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Permits</h1>
        <Card className="p-6 border-border">
          <p className="text-muted-foreground text-sm">
            Centralize state permits, expirations, and attachments. Link permits to loads and routes from load details.
          </p>
        </Card>
      </div>
    </PlanGateLayout>
  )
}
