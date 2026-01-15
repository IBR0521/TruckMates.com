import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  try {
    // Validate environment variables first
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      // If env vars are missing, just continue without auth check
      // This allows the app to load even if Supabase isn't configured
      console.warn("[MIDDLEWARE] Missing Supabase environment variables")
      return NextResponse.next({ request })
    }

    let supabaseResponse = NextResponse.next({
      request,
    })

    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // Refresh session to ensure it stays valid - this is critical for session persistence
  try {
    await supabase.auth.getSession()
  } catch (error) {
    // Silently fail - session refresh errors shouldn't break the app
    // The session will be checked again on the next request
  }

  // Add timeout protection to prevent hanging (2 seconds - more lenient)
  // If timeout occurs, allow request to continue - let the page handle auth
  let user = null
  let authCheckCompleted = false
  try {
    const getUserPromise = supabase.auth.getUser()
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => {
        // Timeout occurred - don't set user, but mark as incomplete
        resolve({ data: { user: null }, timeout: true })
      }, 2000) // 2 second timeout - more lenient
    })
    
    const result = await Promise.race([getUserPromise, timeoutPromise]) as any
    
    // Only set user if we didn't timeout
    if (!result.timeout) {
      user = result?.data?.user || null
      authCheckCompleted = true
    }
    // If timeout occurred, authCheckCompleted stays false, user stays null
  } catch (error) {
    // If auth check fails, allow request to continue (will be handled by page)
    // Don't log to avoid spam - just continue
    authCheckCompleted = false
    user = null
  }

  // Only redirect if auth check completed AND user is null AND we're trying to access dashboard
  // If timeout occurred, let the page handle authentication
  // This ensures users stay logged in even if there are temporary network issues
  if (
    authCheckCompleted &&
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/register') &&
    !request.nextUrl.pathname.startsWith('/plans') &&
    !request.nextUrl.pathname.startsWith('/demo') &&
    !request.nextUrl.pathname.startsWith('/privacy') &&
    !request.nextUrl.pathname.startsWith('/terms') &&
    request.nextUrl.pathname.startsWith('/dashboard')
  ) {
    // Auth check completed and no user found - redirect to login
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
  
  // If auth check didn't complete (timeout), allow request to continue
  // The page will handle authentication with its own timeout protection
  // This ensures users don't get logged out due to temporary network issues

    // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
    // creating a new response object with NextResponse.next() make sure to:
    // 1. Pass the request in it, like so:
    //    const myNewResponse = NextResponse.next({ request })
    // 2. Copy over the cookies, like so:
    //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
    // 3. Change the myNewResponse object to fit your needs, but avoid changing
    //    the cookies!
    // 4. Finally:
    //    return myNewResponse
    // If this is not done, you may be causing the browser and server to go out
    // of sync and terminate the user's session prematurely.

    return supabaseResponse
  } catch (error: any) {
    // If middleware fails for any reason, log it but don't crash the app
    console.error("[MIDDLEWARE] Error in updateSession:", error?.message || error)
    // Return a basic response to allow the request to continue
    return NextResponse.next({ request })
  }
}

