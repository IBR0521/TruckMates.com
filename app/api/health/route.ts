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
      return NextResponse.json(
        {
          status: 'error',
          message: 'Missing or invalid Supabase environment variables',
          details: {
            hasUrl: !!supabaseUrl && !supabaseUrl.includes('placeholder'),
            hasKey: !!supabaseAnonKey && !supabaseAnonKey.includes('placeholder'),
            isPlaceholder,
            environment: process.env.NODE_ENV,
            hint: 'Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your Vercel project settings → Environment Variables'
          },
        },
        { status: 500 }
      )
    }

    // Test Supabase connection
    try {
      const supabase = await createClient()
      const { data, error } = await supabase.from('users').select('count').limit(1)

      if (error) {
        return NextResponse.json(
          {
            status: 'error',
            message: 'Database connection failed',
            details: {
              error: error.message,
              code: error.code,
            },
          },
          { status: 500 }
        )
      }

      return NextResponse.json({
        status: 'ok',
        message: 'Connection successful',
        timestamp: new Date().toISOString(),
      })
    } catch (dbError: any) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Database connection error',
          details: {
            error: dbError.message,
            type: dbError.name,
          },
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'Health check failed',
        details: {
          error: error.message,
        },
      },
      { status: 500 }
    )
  }
}








