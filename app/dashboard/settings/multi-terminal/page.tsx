import { FeatureLock } from "@/components/billing/feature-lock"
import { MultiTerminalClientPage } from "./ui-client"

export default function MultiTerminalSettingsPage() {
  return (
    <FeatureLock
      featureKey="multi_terminal"
      title="Multi-terminal operations"
      description="Run dispatch and reporting per yard or division without duplicating carriers — critical as you add satellite terminals."
    >
      <MultiTerminalClientPage />
    </FeatureLock>
  )
}
