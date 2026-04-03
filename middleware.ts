import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { mapLegacyRole } from '@/lib/roles'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/marketplace/dashboard') ||
    pathname.startsWith('/account-setup') ||
    pathname.startsWith('/portal') ||
    pathname.startsWith('/tracking')

  // Skip Supabase for public routes so marketing/login pages are not blocked by
  // session refresh / getUser network latency (or hangs when offline / misconfigured).
  if (!isProtectedRoute) {
    return NextResponse.next({ request })
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.next({ request })
    }

    let response = NextResponse.next({ request })

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    })

    await supabase.auth.getSession()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    // Drivers use a single HOS page at /dashboard/eld — block fleet ELD sub-routes.
    const eldPath = pathname.replace(/\/$/, '') || '/'
    if (eldPath.startsWith('/dashboard/eld') && eldPath !== '/dashboard/eld') {
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      if (mapLegacyRole(profile?.role) === 'driver') {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard/eld'
        return NextResponse.redirect(url)
      }
    }

    return response
  } catch {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
