import { redirect } from "next/navigation"
import { getCachedAuthContext } from "@/lib/auth/server"
import { mapLegacyRole } from "@/lib/roles"
import { FeatureLock } from "@/components/billing/feature-lock"
import { AiAutomationClientPage } from "./ui-client"

export default async function AiAutomationSettingsPage() {
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
      description="Delegate repetitive dispatch and inbox triage to an audited agent loop — fewer surprise gaps between chat and executed work."
    >
      <AiAutomationClientPage companyId={ctx.companyId} />
    </FeatureLock>
  )
}
