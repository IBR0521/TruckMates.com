import { NextResponse } from 'next/server'
import { createClient } from "@/lib/supabase/server"
import { mapLegacyRole } from "@/lib/roles"

/**
 * Diagnostic endpoint to check if environment variables are loaded
 * SECURITY: Requires authentication to prevent information disclosure
 * This helps verify if Vercel environment variables are properly configured
 */
export async function GET() {
  // SECURITY: Require authentication
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    )
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError) {
    return NextResponse.json({ error: "Failed to verify authorization" }, { status: 500 })
  }

  if (mapLegacyRole(profile?.role) !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Check environment variables (without exposing sensitive values)
  const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL
  const hasAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const hasServiceRoleKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY
  
  // Check if values are placeholders
  const urlValue = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const isPlaceholder = urlValue.includes('placeholder') || urlValue === ''
  
  // Get URL prefix to verify it's correct format
  const urlPrefix = urlValue.length > 30 ? urlValue.substring(0, 30) + '...' : urlValue
  
  return NextResponse.json({
    environment: process.env.NODE_ENV,
    isVercel: !!process.env.VERCEL,
    variables: {
      NEXT_PUBLIC_SUPABASE_URL: {
        exists: hasUrl,
        isPlaceholder,
        prefix: hasUrl && !isPlaceholder ? urlPrefix : 'not set',
        valid: hasUrl && !isPlaceholder && urlValue.includes('.supabase.co')
      },
      NEXT_PUBLIC_SUPABASE_ANON_KEY: {
        exists: hasAnonKey,
        length: hasAnonKey ? 'set' : 'not set'
      },
      SUPABASE_SERVICE_ROLE_KEY: {
        exists: hasServiceRoleKey,
        length: hasServiceRoleKey ? 'set' : 'not set'
      }
    },
    status: hasUrl && hasAnonKey && !isPlaceholder ? 'ok' : 'missing',
    message: hasUrl && hasAnonKey && !isPlaceholder 
      ? 'Environment variables are configured'
      : 'Some environment variables are missing or invalid'
  })
}

