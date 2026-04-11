"use server"

import * as Sentry from "@sentry/nextjs"
import { mapLegacyRole, type EmployeeRole } from "./roles"
/**
 * Create/edit/delete/manage checks call `requireActiveSubscriptionForWrite()` so inactive
 * subscriptions cannot mutate data. Use these helpers from server actions (loads/routes/etc.).
 */
import { requireActiveSubscriptionForWrite } from "./subscription-access"
import {
  canViewFeature,
  canCreateFeature,
  canEditFeature,
  canDeleteFeature,
  canManageFeature,
  type FeatureCategory,
} from "./feature-permissions"
import { getCachedAuthContext } from "./auth/server"

function permissionCheckErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Permission check failed"
}

/** Uses cached auth context so auth + user lookup run once per request across all permission checks. */
export async function getUserRole(): Promise<EmployeeRole | null> {
  try {
    const { user, error } = await getCachedAuthContext()
    if (error || !user) return null
    const role = user.role || null
    return role ? (mapLegacyRole(role) as EmployeeRole) : null
  } catch (error: unknown) {
    Sentry.captureException(error)
    return null
  }
}

// Server-side permission checks
export async function checkViewPermission(feature: FeatureCategory): Promise<{
  allowed: boolean
  role: EmployeeRole | null
  error: string | null
}> {
  try {
    const role = await getUserRole()
    if (!role) {
      return { allowed: false, role: null, error: "User not authenticated" }
    }

    const allowed = canViewFeature(role, feature)
    return {
      allowed,
      role,
      error: allowed ? null : "You don't have permission to view this feature",
    }
  } catch (error: unknown) {
    return {
      allowed: false,
      role: null,
      error: permissionCheckErrorMessage(error),
    }
  }
}

export async function checkCreatePermission(feature: FeatureCategory): Promise<{
  allowed: boolean
  role: EmployeeRole | null
  error: string | null
}> {
  try {
    const role = await getUserRole()
    if (!role) {
      return { allowed: false, role: null, error: "User not authenticated" }
    }

    const subscription = await requireActiveSubscriptionForWrite()
    if (!subscription.allowed) {
      return {
        allowed: false,
        role,
        error: subscription.error || "Subscription inactive. Please update billing to continue.",
      }
    }

    const allowed = canCreateFeature(role, feature)
    return {
      allowed,
      role,
      error: allowed ? null : "You don't have permission to create this feature",
    }
  } catch (error: unknown) {
    return {
      allowed: false,
      role: null,
      error: permissionCheckErrorMessage(error),
    }
  }
}

export async function checkEditPermission(feature: FeatureCategory): Promise<{
  allowed: boolean
  role: EmployeeRole | null
  error: string | null
}> {
  try {
    const role = await getUserRole()
    if (!role) {
      return { allowed: false, role: null, error: "User not authenticated" }
    }

    const subscription = await requireActiveSubscriptionForWrite()
    if (!subscription.allowed) {
      return {
        allowed: false,
        role,
        error: subscription.error || "Subscription inactive. Please update billing to continue.",
      }
    }

    const allowed = canEditFeature(role, feature)
    return {
      allowed,
      role,
      error: allowed ? null : "You don't have permission to edit this feature",
    }
  } catch (error: unknown) {
    return {
      allowed: false,
      role: null,
      error: permissionCheckErrorMessage(error),
    }
  }
}

export async function checkDeletePermission(feature: FeatureCategory): Promise<{
  allowed: boolean
  role: EmployeeRole | null
  error: string | null
}> {
  try {
    const role = await getUserRole()
    if (!role) {
      return { allowed: false, role: null, error: "User not authenticated" }
    }

    const subscription = await requireActiveSubscriptionForWrite()
    if (!subscription.allowed) {
      return {
        allowed: false,
        role,
        error: subscription.error || "Subscription inactive. Please update billing to continue.",
      }
    }

    const allowed = canDeleteFeature(role, feature)
    return {
      allowed,
      role,
      error: allowed ? null : "You don't have permission to delete this feature",
    }
  } catch (error: unknown) {
    return {
      allowed: false,
      role: null,
      error: permissionCheckErrorMessage(error),
    }
  }
}

export async function checkManagePermission(feature: FeatureCategory): Promise<{
  allowed: boolean
  role: EmployeeRole | null
  error: string | null
}> {
  try {
    const role = await getUserRole()
    if (!role) {
      return { allowed: false, role: null, error: "User not authenticated" }
    }

    const subscription = await requireActiveSubscriptionForWrite()
    if (!subscription.allowed) {
      return {
        allowed: false,
        role,
        error: subscription.error || "Subscription inactive. Please update billing to continue.",
      }
    }

    const allowed = canManageFeature(role, feature)
    return {
      allowed,
      role,
      error: allowed ? null : "You don't have permission to manage this feature",
    }
  } catch (error: unknown) {
    return {
      allowed: false,
      role: null,
      error: permissionCheckErrorMessage(error),
    }
  }
}






