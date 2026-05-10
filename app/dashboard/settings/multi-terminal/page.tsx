import { FeatureLock } from "@/components/billing/feature-lock"
import { Card } from "@/components/ui/card"

export default function MultiTerminalSettingsPage() {
  return (
    <FeatureLock
      featureKey="multi_terminal"
      title="Multi-terminal operations"
      description="Run dispatch and reporting per yard or division without duplicating carriers — critical as you add satellite terminals."
    >
      <div className="p-8 max-w-4xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Multi-terminal</h1>
        <Card className="p-6 border-border">
          <p className="text-muted-foreground text-sm">
            Add terminals, assign trucks and users, and filter loads by terminal. Terminal defaults apply to new loads.
          </p>
        </Card>
      </div>
    </FeatureLock>
  )
}
