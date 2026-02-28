import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Test connection endpoint - requires authentication
 * SECURITY: Protected to prevent leaking DB error details publicly
 */
export async function GET() {
  const supabase = await createClient()
  
  // Require authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    )
  }

  try {
    // Test basic connection
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1)
    
    if (error) {
      // Don't leak error details - just return generic message
      console.error('[Test Connection] Database error:', error)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Database connection failed'
        },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Connection successful',
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    // Don't leak error details
    console.error('[Test Connection] Unexpected error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Connection test failed'
      },
      { status: 500 }
    )
  }
}












