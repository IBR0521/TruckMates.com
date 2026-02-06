import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  // Validate environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Please check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
    )
  }

  // Validate URL format
  try {
    new URL(supabaseUrl)
  } catch {
    throw new Error(`Invalid Supabase URL format: ${supabaseUrl}`)
  }

  const cookieStore = await cookies()

  // Create client with timeout and connection settings
  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
      global: {
        fetch: async (url, options = {}) => {
          // Add timeout to fetch requests (10 seconds for poor connections)
          try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 10000) // Increased to 10 seconds
            
            const response = await fetch(url, {
              ...options,
              signal: controller.signal,
            }).catch((fetchError: any) => {
              clearTimeout(timeoutId)
              // Handle network errors
              if (fetchError.name === 'AbortError' || fetchError.message?.includes('aborted')) {
                throw new Error('Connection timeout. Please check your internet connection.')
              }
              if (fetchError.message?.includes('fetch') || 
                  fetchError.message?.includes('ECONNREFUSED') ||
                  fetchError.message?.includes('network') ||
                  fetchError.code === 'ECONNREFUSED') {
                throw new Error('Failed to connect to database. Please check your connection and Supabase configuration.')
              }
              throw fetchError
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
            // Re-throw if it's already our custom error
            if (error.message?.includes('Connection timeout') || 
                error.message?.includes('Failed to connect') ||
                error.message?.includes('Database server error')) {
              throw error
            }
            // Handle other errors
            if (error.name === 'AbortError') {
              throw new Error('Connection timeout. Please check your internet connection.')
            }
            if (error.message?.includes('fetch') || 
                error.message?.includes('ECONNREFUSED') ||
                error.code === 'ECONNREFUSED') {
              throw new Error('Failed to connect to database. Please check your connection and Supabase configuration.')
            }
            throw error
          }
        },
      },
    }
  )
}

