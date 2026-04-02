import { NextRequest } from "next/server"
import { errorMessage } from "@/lib/error-message"
import { getCachedAuthContext } from "@/lib/auth/server"
import { createAdminClient } from "@/lib/supabase/admin"

type MobileAuthContext = {
  user: { id: string; email: string; role: string } | null
  userId: string | null
  companyId: string | null
  error: string | null
}

/**
 * Route-handler auth context for mobile API requests.
 * - Primary: Authorization Bearer token from mobile app
 * - Fallback: cookie-based context for web/manual calls
 */
export async function getMobileAuthContext(request: NextRequest): Promise<MobileAuthContext> {
  try {
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization")
    const tokenMatch = authHeader?.match(/^Bearer\s+(.+)$/i)
    const accessToken = tokenMatch?.[1]?.trim()

    if (!accessToken) {
      return getCachedAuthContext()
    }

    const admin = createAdminClient()
    const { data: authData, error: authError } = await admin.auth.getUser(accessToken)
    if (authError || !authData?.user?.id) {
      return { user: null, userId: null, companyId: null, error: "Not authenticated" }
    }

    const userId = String(authData.user.id)
    const { data: userData, error: userError } = await admin
      .from("users")
      .select("id, email, role, company_id")
      .eq("id", userId)
      .maybeSingle()

    if (userError) {
      return { user: null, userId: null, companyId: null, error: userError.message || "Failed to fetch user data" }
    }
    if (!userData) {
      return { user: null, userId: null, companyId: null, error: "User not found" }
    }

    return {
      user: {
        id: String(userData.id),
        email: String(userData.email || authData.user.email || ""),
        role: String(userData.role || "driver"),
      },
      userId,
      companyId: userData.company_id ? String(userData.company_id) : null,
      error: null,
    }
  } catch (error: unknown) {
    return {
      user: null,
      userId: null,
      companyId: null,
      error: String(errorMessage(error) || error || "Authentication failed"),
    }
  }
}
