import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { mapLegacyRole } from '@/lib/roles'

/** Avoid hanging forever when Supabase is unreachable or misconfigured (browser spinner on /dashboard/*). */
const SUPABASE_MIDDLEWARE_FETCH_MS = 12_000

function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const combined = new AbortController()
  const t = setTimeout(() => combined.abort(), SUPABASE_MIDDLEWARE_FETCH_MS)
  const userSignal = init?.signal
  if (userSignal) {
    if (userSignal.aborted) {
      clearTimeout(t)
      return Promise.reject(new DOMException('Aborted', 'AbortError'))
    }
    userSignal.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        combined.abort()
      },
      { once: true }
    )
  }
  return fetch(input, {
    ...init,
    signal: combined.signal,
  }).finally(() => clearTimeout(t))
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const isBillingActivationRoute = pathname.startsWith('/billing/activate')
  const isAccountSetupRoute = pathname.startsWith('/account-setup')
  const isDashboardRoute = pathname.startsWith('/dashboard')

  const isProtectedRoute =
    isDashboardRoute ||
    pathname.startsWith('/billing') ||
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
      global: { fetch: fetchWithTimeout },
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

    // Enforce setup + subscription gates.
    if (isDashboardRoute || isAccountSetupRoute) {
      const { data: profile } = await supabase
        .from('users')
        .select('role, company_id')
        .eq('id', user.id)
        .maybeSingle()

      const isManager = ['super_admin', 'operations_manager'].includes(String(profile?.role || ''))
      if (profile?.company_id) {
        // Setup flow is manager-only.
        if (isManager) {
          const { data: company } = await supabase
            .from('companies')
            .select('setup_complete')
            .eq('id', profile.company_id)
            .maybeSingle()
          const setupComplete = Boolean((company as { setup_complete?: boolean } | null)?.setup_complete)

          if (!setupComplete && isDashboardRoute) {
            const url = request.nextUrl.clone()
            url.pathname = '/account-setup/manager'
            return NextResponse.redirect(url)
          }

          if (setupComplete && isAccountSetupRoute) {
            const url = request.nextUrl.clone()
            url.pathname = '/dashboard'
            return NextResponse.redirect(url)
          }
        } else if (isAccountSetupRoute) {
          // Non-managers should never use manager setup route.
          const url = request.nextUrl.clone()
          url.pathname = '/dashboard'
          return NextResponse.redirect(url)
        }

        if (!isDashboardRoute) {
          return response
        }

        const { data: subscription } = await supabase
          .from('subscriptions')
          .select(`
            status,
            trial_end,
            stripe_subscription_id,
            subscription_plans(name)
          `)
          .eq('company_id', profile.company_id)
          .maybeSingle()

        const planRaw = (subscription as any)?.subscription_plans
        const planName = (Array.isArray(planRaw) ? planRaw[0]?.name : planRaw?.name || 'free') as string
        const status = String((subscription as any)?.status || '')
        const trialEnd = (subscription as any)?.trial_end ? new Date((subscription as any).trial_end) : null
        const trialExpired = !!trialEnd && trialEnd.getTime() < Date.now()
        const hasPaidSubscription = !!(subscription as any)?.stripe_subscription_id

        const hasSubscriptionAccess =
          !!subscription &&
          planName.toLowerCase() !== 'free' &&
          hasPaidSubscription &&
          (status === 'active' || (status === 'trialing' && !trialExpired))

        if (!hasSubscriptionAccess && !isBillingActivationRoute) {
          const url = request.nextUrl.clone()
          url.pathname = '/billing/activate'
          url.searchParams.set('required', '1')
          return NextResponse.redirect(url)
        }
      }
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
  // Exclude all `/_next/*` (RSC, webpack HMR, chunks) and `/api/*` — middleware must not run on these.
  matcher: [
    '/((?!_next/|api/|favicon.ico|icon\\.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
