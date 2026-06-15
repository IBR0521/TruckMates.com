import { FeatureLock } from "@/components/billing/feature-lock"
import { EdiPageClient } from "./edi-page-client"

export default function EdiPage() {
  return (
    <FeatureLock
      featureKey="edi_receiving"
      title="EDI receiving"
      description="Import broker and shipper EDI inbound — eliminate manual entry and reconcile loads faster across terminals."
    >
      <EdiPageClient />
    </FeatureLock>
  )
}
