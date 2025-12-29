/**
 * Audit Logging Utility
 * 
 * Logs sensitive operations for compliance and security auditing
 */

import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"

export interface AuditLogEntry {
  action: string
  resource_type: string
  resource_id?: string
  user_id?: string
  company_id?: string
  details?: Record<string, unknown>
  ip_address?: string
  user_agent?: string
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      logger.warn("Audit log created without authenticated user", { action: entry.action })
      return
    }

    // Get user's company
    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single()

    // Insert audit log
    const { error } = await supabase
      .from("audit_logs")
      .insert({
        company_id: userData?.company_id || entry.company_id,
        user_id: user.id,
        action: entry.action,
        resource_type: entry.resource_type,
        resource_id: entry.resource_id,
        details: entry.details || {},
        ip_address: entry.ip_address,
        user_agent: entry.user_agent,
        created_at: new Date().toISOString(),
      })

    if (error) {
      logger.error("Failed to create audit log", error, { entry })
    }
  } catch (error) {
    // Don't fail the operation if audit logging fails
    logger.error("Audit log error", error, { entry })
  }
}

/**
 * Audit log helper for common operations
 */
export const auditLog = {
  userLogin: (userId: string, ipAddress?: string, userAgent?: string) =>
    createAuditLog({
      action: "user.login",
      resource_type: "user",
      resource_id: userId,
      user_id: userId,
      ip_address: ipAddress,
      user_agent: userAgent,
    }),

  userLogout: (userId: string) =>
    createAuditLog({
      action: "user.logout",
      resource_type: "user",
      resource_id: userId,
      user_id: userId,
    }),

  dataCreated: (resourceType: string, resourceId: string, details?: Record<string, unknown>) =>
    createAuditLog({
      action: "data.created",
      resource_type: resourceType,
      resource_id: resourceId,
      details,
    }),

  dataUpdated: (resourceType: string, resourceId: string, details?: Record<string, unknown>) =>
    createAuditLog({
      action: "data.updated",
      resource_type: resourceType,
      resource_id: resourceId,
      details,
    }),

  dataDeleted: (resourceType: string, resourceId: string, details?: Record<string, unknown>) =>
    createAuditLog({
      action: "data.deleted",
      resource_type: resourceType,
      resource_id: resourceId,
      details,
    }),

  paymentProcessed: (amount: number, currency: string, details?: Record<string, unknown>) =>
    createAuditLog({
      action: "payment.processed",
      resource_type: "payment",
      details: { amount, currency, ...details },
    }),

  subscriptionChanged: (planId: string, details?: Record<string, unknown>) =>
    createAuditLog({
      action: "subscription.changed",
      resource_type: "subscription",
      resource_id: planId,
      details,
    }),

  accessDenied: (resourceType: string, resourceId?: string, reason?: string) =>
    createAuditLog({
      action: "access.denied",
      resource_type: resourceType,
      resource_id: resourceId,
      details: { reason },
    }),
}

