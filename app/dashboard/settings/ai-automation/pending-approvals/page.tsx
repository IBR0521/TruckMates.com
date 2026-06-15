import { redirect } from "next/navigation"
import { getCachedAuthContext } from "@/lib/auth/server"
import { mapLegacyRole } from "@/lib/roles"
import { FeatureLock } from "@/components/billing/feature-lock"
import { PendingApprovalsClientPage } from "./ui-client"

export default async function PendingApprovalsPage() {
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
      description="Review and approve AI-suggested actions before they run in your fleet."
    >
      <PendingApprovalsClientPage companyId={ctx.companyId} />
    </FeatureLock>
  )
}
