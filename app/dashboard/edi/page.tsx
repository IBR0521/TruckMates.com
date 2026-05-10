import { PlanGateLayout } from "@/components/billing/plan-gate-layout"
import { Card } from "@/components/ui/card"

export default async function EdiPage() {
  return (
    <PlanGateLayout
      feature="edi_receiving"
      title="EDI receiving"
      description="Import and process EDI documents from brokers and shippers."
      requiredPlanLabel="This capability is included starting on the Fleet plan."
    >
      <div className="p-8 max-w-4xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">EDI</h1>
        <Card className="p-6 border-border">
          <p className="text-muted-foreground text-sm">
            Configure EDI connections and inbound document routing for your terminals. (Connect integrations in Settings
            when your plan includes EDI.)
          </p>
        </Card>
      </div>
    </PlanGateLayout>
  )
}
