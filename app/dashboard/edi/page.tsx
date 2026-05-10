import { FeatureLock } from "@/components/billing/feature-lock"
import { Card } from "@/components/ui/card"

export default function EdiPage() {
  return (
    <FeatureLock
      featureKey="edi_receiving"
      title="EDI receiving"
      description="Import broker and shipper EDI inbound — eliminate manual entry and reconcile loads faster across terminals."
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
    </FeatureLock>
  )
}
