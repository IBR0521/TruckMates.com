import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  // BUG-004 FIX: Fail-closed authentication - timeout should redirect to login, not allow access
  // Increase timeout to 5 seconds for better reliability
  let user = null
  try {
    const getUserPromise = supabase.auth.getUser()
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => {
        resolve({ data: { user: null }, timeout: true })
      }, 5000) // 5 second timeout - more lenient but still fail-closed
    })
    
    const result = await Promise.race([getUserPromise, timeoutPromise]) as any
    
    // Only set user if we didn't timeout
    if (!result.timeout) {
      user = result?.data?.user || null
    }
    // If timeout occurred, user stays null - we'll redirect to login (fail-closed)
  } catch (error) {
    // If auth check fails, user stays null - we'll redirect to login (fail-closed)
    user = null
  }

  // BUG-004 FIX: Fail-closed - redirect to login if no user (including timeout cases)
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/register') &&
    !request.nextUrl.pathname.startsWith('/plans') &&
    !request.nextUrl.pathname.startsWith('/demo') &&
    request.nextUrl.pathname.startsWith('/dashboard')
  ) {
    // No user found (including timeout) - redirect to login (fail-closed)
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

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
}

