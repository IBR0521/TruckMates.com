import { FeatureLock } from "@/components/billing/feature-lock"
import { HazmatPageClient } from "./hazmat-page-client"

export default function HazmatPage() {
  return (
    <FeatureLock
      featureKey="hazmat_module"
      title="HAZMAT"
      description="Segregation checks, endorsement validation, and shipping-paper tooling designed for placarded freight."
    >
      <HazmatPageClient />
    </FeatureLock>
  )
}
