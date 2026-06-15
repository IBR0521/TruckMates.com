"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import * as Sentry from "@sentry/nextjs"
import { errorMessage } from "@/lib/error-message"

export type AutoBolResult = {
  bolId?: string
  bolNumber?: string
  alreadyExists?: boolean
  skipped?: boolean
  skipReason?: string
}

/** Create a draft BOL when bol_auto_generate is enabled and load has no BOL yet. */
export async function maybeAutoCreateBOLForLoad(
  loadId: string,
  companyId: string,
): Promise<{ data: AutoBolResult | null; error: string | null }> {
  try {
    const admin = createAdminClient()
    const { data: settings } = await admin
      .from("company_settings")
      .select("bol_auto_generate")
      .eq("company_id", companyId)
      .maybeSingle()

    if (!settings?.bol_auto_generate) {
      return { data: { skipped: true, skipReason: "bol_auto_generate disabled" }, error: null }
    }

    const { data: existing } = await admin
      .from("bols")
      .select("id, bol_number")
      .eq("load_id", loadId)
      .eq("company_id", companyId)
      .maybeSingle()

    if (existing?.id) {
      return {
        data: { alreadyExists: true, bolId: existing.id, bolNumber: existing.bol_number ?? undefined },
        error: null,
      }
    }

    const { createBOL } = await import("./bol")
    const result = await createBOL({ load_id: loadId, auto_populate: true })
    if (result.error) return { error: result.error, data: null }

    const bol = result.data as { id?: string; bol_number?: string } | null
    return {
      data: {
        bolId: bol?.id,
        bolNumber: bol?.bol_number,
      },
      error: null,
    }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return { error: errorMessage(error, "Auto BOL creation failed"), data: null }
  }
}
