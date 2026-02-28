import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Health check endpoint to test database connection
 */
export async function GET() {
  try {
    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // Check for missing or placeholder values
    const isPlaceholder = supabaseUrl?.includes('placeholder') || 
                          supabaseUrl === '' || 
                          supabaseAnonKey?.includes('placeholder') ||
                          supabaseAnonKey === ''

    if (!supabaseUrl || !supabaseAnonKey || isPlaceholder) {
      // Don't leak environment details
      console.error('[Health Check] Missing Supabase environment variables')
      return NextResponse.json(
        {
          status: 'error',
          message: 'Service unavailable',
        },
        { status: 503 }
      )
    }

    // Test Supabase connection
    try {
      const supabase = await createClient()
      const { data, error } = await supabase.from('users').select('count').limit(1)

      if (error) {
        // Don't leak error details - log server-side only
        console.error('[Health Check] Database error:', error)
        return NextResponse.json(
          {
            status: 'error',
            message: 'Service unavailable',
          },
          { status: 503 }
        )
      }

      return NextResponse.json({
        status: 'ok',
        message: 'Connection successful',
        timestamp: new Date().toISOString(),
      })
    } catch (dbError: any) {
      // Don't leak error details
      console.error('[Health Check] Database connection error:', dbError)
      return NextResponse.json(
        {
          status: 'error',
          message: 'Service unavailable',
        },
        { status: 503 }
      )
    }
  } catch (error: any) {
    // Don't leak error details
    console.error('[Health Check] Unexpected error:', error)
    return NextResponse.json(
      {
        status: 'error',
        message: 'Service unavailable',
      },
      { status: 503 }
    )
  }
}








