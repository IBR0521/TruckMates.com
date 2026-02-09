import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Test basic connection
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1)
    
    if (error) {
      return NextResponse.json(
        { 
          success: false, 
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
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
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Unknown error',
        type: error.name || 'Error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}












