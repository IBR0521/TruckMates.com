import { createClient } from "@/lib/supabase/server"
import * as Sentry from "@sentry/nextjs"

function platformResendApiKey(): string | undefined {
  return (
    process.env.RESEND_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_RESEND_API_KEY?.trim() ||
    undefined
  )
}

/**
 * Resend client for transactional email.
 *
 * **Platform key (your deployment env):** `RESEND_API_KEY` — used for every company.
 * No Settings row, no per-tenant keys. This is the normal production setup.
 *
 * **Optional BYOK:** If the platform key is unset, falls back to
 * `company_integrations.resend_api_key` and respects `resend_enabled === false`.
 */
export async function getResendClientForCompany(
  companyId: string | null | undefined,
): Promise<import("resend").Resend | null> {
  const envKey = platformResendApiKey()
  if (envKey) {
    try {
      const { Resend } = await import("resend")
      return new Resend(envKey)
    } catch (error) {
      Sentry.captureException(error)
      return null
    }
  }

  let companyKey: string | undefined
  let resendEnabled: boolean | undefined

  if (companyId) {
    try {
      const supabase = await createClient()
      const { data: integrations, error } = await supabase
        .from("company_integrations")
        .select("resend_enabled, resend_api_key")
        .eq("company_id", companyId)
        .maybeSingle()

      if (error) {
        Sentry.captureException(error)
      } else if (integrations) {
        companyKey = integrations.resend_api_key?.trim() || undefined
        resendEnabled = integrations.resend_enabled ?? undefined
      }
    } catch (e) {
      Sentry.captureException(e)
    }
  }

  const apiKey = companyKey
  if (!apiKey) {
    return null
  }

  if (resendEnabled === false) {
    Sentry.captureMessage("[RESEND] Integration disabled for company", "info")
    return null
  }

  try {
    const { Resend } = await import("resend")
    return new Resend(apiKey)
  } catch (error) {
    Sentry.captureException(error)
    return null
  }
}
