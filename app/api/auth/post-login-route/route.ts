import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isSafeRelativeLoginNext, resolvePostLoginRedirect } from "@/lib/auth/post-login-redirect"

export async function GET(request: NextRequest) {
  const nextParam = request.nextUrl.searchParams.get("next")
  const safeNext = isSafeRelativeLoginNext(nextParam) ? nextParam : "/dashboard"

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ redirectTo: "/login" }, { status: 401 })
  }

  const redirectTo = await resolvePostLoginRedirect(supabase, safeNext)
  return NextResponse.json({ redirectTo })
}
