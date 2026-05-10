import { FeatureLock } from "@/components/billing/feature-lock"
import { Card } from "@/components/ui/card"

export default function HazmatPage() {
  return (
    <FeatureLock
      featureKey="hazmat_module"
      title="HAZMAT"
      description="Segregation checks, endorsement validation, and shipping-paper tooling designed for placarded freight."
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
    </FeatureLock>
  )
}
