import { redirect } from "next/navigation"
import { getCachedAuthContext } from "@/lib/auth/server"
import { mapLegacyRole } from "@/lib/roles"
import { FeatureLock } from "@/components/billing/feature-lock"
import { AutomationActivityClientPage } from "./ui-client"

export default async function AutomationActivityPage() {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.user) {
    redirect("/dashboard")
  }

  const role = mapLegacyRole(ctx.user.role)
  if (role !== "super_admin" && role !== "operations_manager") {
    redirect("/dashboard")
  }

  return (
    <FeatureLock
      featureKey="ai_autonomous_agent"
      title="Autonomous AI agent"
      description="See everything TruckMates AI has handled, evaluated, or flagged for you."
    >
      <AutomationActivityClientPage companyId={ctx.companyId} />
    </FeatureLock>
  )
}
