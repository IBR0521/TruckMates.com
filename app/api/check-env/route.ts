import { NextResponse } from 'next/server'

/**
 * Diagnostic endpoint to check if environment variables are loaded
 * This helps verify if Vercel environment variables are properly configured
 */
export async function GET() {
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

