import { PlanGateLayout } from "@/components/billing/plan-gate-layout"
import { Card } from "@/components/ui/card"

export default async function MultiTerminalSettingsPage() {
  return (
    <PlanGateLayout
      feature="multi_terminal"
      title="Multi-terminal operations"
      description="Run dispatch, accounting, and reporting separately per terminal or yard."
      requiredPlanLabel="Multi-terminal is included starting on the Fleet plan."
    >
      <div className="p-8 max-w-4xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Multi-terminal</h1>
        <Card className="p-6 border-border">
          <p className="text-muted-foreground text-sm">
            Add terminals, assign trucks and users, and filter loads by terminal. Terminal defaults apply to new loads.
          </p>
        </Card>
      </div>
    </PlanGateLayout>
  )
}
