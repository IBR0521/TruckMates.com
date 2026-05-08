import { redirect } from "next/navigation"
import { getCachedAuthContext } from "@/lib/auth/server"
import { mapLegacyRole } from "@/lib/roles"
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

  return <PendingApprovalsClientPage companyId={ctx.companyId} />
}
