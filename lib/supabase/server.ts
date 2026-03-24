import { createServerClient } from '@supabase/ssr'
import { errorMessage } from "@/lib/error-message"
import { cookies } from 'next/headers'

export async function createClient() {
  // Validate environment variables - handle gracefully
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Check for missing or placeholder values
  const isPlaceholder = !supabaseUrl || 
                        !supabaseAnonKey || 
                        supabaseUrl.includes('placeholder') || 
                        supabaseUrl === '' ||
                        supabaseAnonKey.includes('placeholder') ||
                        supabaseAnonKey === ''

  if (isPlaceholder) {
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'
    
    // BUG-016 FIX: Throw error in production instead of silently using mock client
    if (isProduction) {
      throw new Error(
        'CRITICAL: Supabase environment variables are missing in production. ' +
        'Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in ' +
        'Vercel project settings → Environment Variables → Production, then redeploy.'
      )
    }
    
    // In development, log warning but allow mock client
    console.warn('Missing Supabase environment variables - app will work in limited mode (development only)')
    const cookieStore = await cookies()
    return createServerClient(
      'https://placeholder.supabase.co',
      'placeholder-key',
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll() {
            // No-op for mock client
          },
        },
      }
    ) as any
  }

  // Validate URL format
  try {
    new URL(supabaseUrl)
  } catch {
    console.warn(`Invalid Supabase URL format: ${supabaseUrl}`)
    const cookieStore = await cookies()
    return createServerClient(
      'https://placeholder.supabase.co',
      'placeholder-key',
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll() {
            // No-op for mock client
          },
        },
      }
    ) as any
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
          // Add timeout to fetch requests (5 seconds for better performance)
          try {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 seconds - faster timeout
            
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
          } catch (error: unknown) {
            const msg = errorMessage(error)
            const code =
              typeof error === "object" && error !== null && "code" in error
                ? (error as { code?: unknown }).code
                : undefined
            // Re-throw if it's already our custom error
            if (msg.includes('Connection timeout') || 
                msg.includes('Failed to connect') ||
                msg.includes('Database server error')) {
              throw error
            }
            // Handle other errors
            if (error instanceof Error && error.name === 'AbortError') {
              throw new Error('Connection timeout. Please check your internet connection.')
            }
            if (msg.includes('fetch') || 
                msg.includes('ECONNREFUSED') ||
                code === 'ECONNREFUSED') {
              throw new Error('Failed to connect to database. Please check your connection and Supabase configuration.')
            }
            throw error
          }
        },
      },
    }
  )
}

