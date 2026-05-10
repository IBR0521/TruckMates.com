import { FeatureLock } from "@/components/billing/feature-lock"
import { Card } from "@/components/ui/card"

export default function PermitsPage() {
  return (
    <FeatureLock
      featureKey="permit_management"
      title="Permit management"
      description="Centralize oversized and trip permits with renewals, attachments, and load linkage so roadside exposure drops."
    >
      <div className="p-8 max-w-4xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Permits</h1>
        <Card className="p-6 border-border">
          <p className="text-muted-foreground text-sm">
            Centralize state permits, expirations, and attachments. Link permits to loads and routes from load details.
          </p>
        </Card>
      </div>
    </FeatureLock>
  )
}
