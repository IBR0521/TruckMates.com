import { createAdminClient } from "@/lib/supabase/admin"

async function pickRecipientUserId(admin: ReturnType<typeof createAdminClient>, companyId: string): Promise<string | null> {
  const { data: preferred } = await admin
    .from("users")
    .select("id")
    .eq("company_id", companyId)
    .neq("role", "driver")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  if (preferred && typeof (preferred as { id: string }).id === "string") return (preferred as { id: string }).id
  return null
}

export async function notifyDocumentDiscrepancy(params: {
  companyId: string
  documentId: string
  title: string
  message: string
  priority: "high" | "normal" | "critical"
  metadata: Record<string, unknown>
}): Promise<{ ok: boolean }> {
  try {
    const admin = createAdminClient()
    const userId = await pickRecipientUserId(admin, params.companyId)
    if (!userId) return { ok: false }

    await admin.from("notifications").insert({
      user_id: userId,
      company_id: params.companyId,
      type: "alert",
      title: params.title,
      message: params.message,
      priority: params.priority,
      metadata: { ...params.metadata, document_id: params.documentId, kind: "document_discrepancy" },
      read: false,
      source: "event",
    })
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

