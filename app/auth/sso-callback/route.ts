import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isSafeRelativeLoginNext, resolvePostLoginRedirect } from "@/lib/auth/post-login-redirect"

/**
 * Completes Supabase magic-link session after SAML ACS provisioning.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const nextParam = searchParams.get("next")
  const safeNext = isSafeRelativeLoginNext(nextParam) ? nextParam : "/dashboard"

  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(`${origin}/auth/sso-error`)
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${origin}/auth/sso-error`)
  }

  const redirectTo = await resolvePostLoginRedirect(supabase, safeNext)
  return NextResponse.redirect(`${origin}${redirectTo}`)
}
