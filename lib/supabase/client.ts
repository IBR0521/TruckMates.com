import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Validate environment variables - don't throw, return a mock client instead
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables!')
    console.error('Required: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
    console.error('Please configure these in your Vercel project settings → Environment Variables')
    // Return a mock client that will fail gracefully with a helpful error
    return createBrowserClient(
      'https://placeholder.supabase.co',
      'placeholder-key',
      {}
    ) as any
  }

  // Validate URL format
  try {
    new URL(supabaseUrl)
  } catch {
    console.warn(`Invalid Supabase URL format: ${supabaseUrl}`)
    return createBrowserClient(
      'https://placeholder.supabase.co',
      'placeholder-key',
      {}
    ) as any
  }

  // Create client with timeout settings for browser
  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    global: {
      fetch: async (url, options = {}) => {
        // Add timeout to fetch requests (10 seconds for browser - longer than server)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 seconds - faster timeout for better performance
        
        try {
          const response = await fetch(url, {
            ...options,
            signal: controller.signal,
          })
          
          clearTimeout(timeoutId)
          
          // Check if response is ok
          if (!response.ok) {
            // Don't throw for auth errors (401, 403) - let Supabase handle them
            if (response.status === 401 || response.status === 403) {
              return response
            }
            // For other errors, provide better context
            if (response.status >= 500) {
              throw new Error('Database server error. Please try again later.')
            }
          }
          
          return response
        } catch (error: any) {
          clearTimeout(timeoutId)
          
          // Handle network errors
          if (error.name === 'AbortError' || error.message?.includes('aborted')) {
            throw new Error('Connection timeout. Please check your internet connection and try again.')
          }
          if (error.message?.includes('fetch') || 
              error.message?.includes('ECONNREFUSED') ||
              error.message?.includes('network') ||
              error.code === 'ECONNREFUSED') {
            // Check if we're using placeholder values (missing env vars)
            if (supabaseUrl === 'https://placeholder.supabase.co') {
              throw new Error('Supabase configuration missing. Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel project settings.')
            }
            throw new Error('Failed to connect to Supabase. Please check your internet connection and ensure your Supabase project is active.')
          }
          throw error
        }
      },
    },
  })
}

