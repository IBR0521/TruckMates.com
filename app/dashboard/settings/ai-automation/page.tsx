import { redirect } from "next/navigation"
import { getCachedAuthContext } from "@/lib/auth/server"
import { mapLegacyRole } from "@/lib/roles"
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

  return <AiAutomationClientPage companyId={ctx.companyId} />
}
