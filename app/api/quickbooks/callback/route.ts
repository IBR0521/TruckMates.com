import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

const QUICKBOOKS_CLIENT_ID = process.env.QUICKBOOKS_CLIENT_ID || ""
const QUICKBOOKS_CLIENT_SECRET = process.env.QUICKBOOKS_CLIENT_SECRET || ""
const QUICKBOOKS_REDIRECT_URI = process.env.QUICKBOOKS_REDIRECT_URI || ""
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

// Determine if we're in sandbox or production
const isSandbox = process.env.QUICKBOOKS_SANDBOX !== "false"
const QB_BASE_URL = isSandbox 
  ? "https://sandbox-quickbooks.api.intuit.com"
  : "https://quickbooks.api.intuit.com"
const QB_AUTH_URL = isSandbox
  ? "https://appcenter.intuit.com/connect/oauth2"
  : "https://appcenter.intuit.com/connect/oauth2"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const realmId = searchParams.get("realmId") // QuickBooks Company ID
  const error = searchParams.get("error")

  // Handle OAuth errors
  if (error) {
    console.error("[QuickBooks OAuth] Error:", error)
    return redirect(`${APP_URL}/dashboard/settings/integration?quickbooks_error=${encodeURIComponent(error)}`)
  }

  if (!code || !state || !realmId) {
    return redirect(`${APP_URL}/dashboard/settings/integration?quickbooks_error=missing_parameters`)
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return redirect(`${APP_URL}/login?redirect=/dashboard/settings/integration`)
    }

    // Verify state matches (should be stored in session or database)
    // For now, we'll extract company_id from state if it was encoded
    const companyId = state // In production, decode and verify state

    // Exchange authorization code for access token
    const tokenResponse = await fetch(`${QB_BASE_URL}/oauth2/v1/tokens/bearer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
        "Authorization": `Basic ${Buffer.from(`${QUICKBOOKS_CLIENT_ID}:${QUICKBOOKS_CLIENT_SECRET}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: QUICKBOOKS_REDIRECT_URI || `${APP_URL}/api/quickbooks/callback`,
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error("[QuickBooks OAuth] Token exchange error:", errorData)
      return redirect(`${APP_URL}/dashboard/settings/integration?quickbooks_error=token_exchange_failed`)
    }

    const tokenData = await tokenResponse.json()
    const { access_token, refresh_token, expires_in } = tokenData

    // Get user's company
    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single()

    if (!userData?.company_id) {
      return redirect(`${APP_URL}/dashboard/settings/integration?quickbooks_error=no_company`)
    }

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + (expires_in * 1000)).toISOString()

    // Store tokens in company_integrations (using platform API keys from env)
    const { error: updateError } = await supabase
      .from("company_integrations")
      .upsert({
        company_id: userData.company_id,
        quickbooks_enabled: true,
        quickbooks_company_id: realmId, // QuickBooks Company ID
        quickbooks_access_token: access_token,
        quickbooks_refresh_token: refresh_token,
        quickbooks_token_expires_at: expiresAt,
        quickbooks_sandbox: isSandbox,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "company_id",
      })

    if (updateError) {
      console.error("[QuickBooks OAuth] Database error:", updateError)
      return redirect(`${APP_URL}/dashboard/settings/integration?quickbooks_error=database_error`)
    }

    // Success! Redirect to integration settings
    return redirect(`${APP_URL}/dashboard/settings/integration?quickbooks_success=true`)
  } catch (error: any) {
    console.error("[QuickBooks OAuth] Callback error:", error)
    return redirect(`${APP_URL}/dashboard/settings/integration?quickbooks_error=${encodeURIComponent(error.message)}`)
  }
}

