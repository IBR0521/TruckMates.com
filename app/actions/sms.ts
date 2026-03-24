"use server"

/**
 * SMS Notification Service using Twilio
 * 
 * To use SMS notifications:
 * 1. Install Twilio SDK: npm install twilio
 * 2. Add environment variables:
 *    - TWILIO_ACCOUNT_SID
 *    - TWILIO_AUTH_TOKEN
 *    - TWILIO_PHONE_NUMBER (your Twilio phone number, e.g., +1234567890)
 * 3. Update notification preferences to enable SMS alerts
 */

import { createClient } from "@/lib/supabase/server"
import { errorMessage } from "@/lib/error-message"
import { getCachedAuthContext } from "@/lib/auth/server"
import * as Sentry from "@sentry/nextjs"

// Get Twilio client (returns null if not configured)
async function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN

  if (!accountSid || !authToken) {
    return null
  }

  try {
    // Dynamically import Twilio to avoid errors if not installed
    // Use Function constructor to prevent Next.js from analyzing the import at build time
    const dynamicImport = new Function('moduleName', 'return import(moduleName)')
    const twilioModule = await dynamicImport("twilio").catch(() => null)
    if (!twilioModule || !twilioModule.default) {
      Sentry.captureMessage("[SMS] Twilio SDK not installed. Run: npm install twilio", "warning")
      return null
    }
    return twilioModule.default(accountSid, authToken)
  } catch (error) {
    Sentry.captureMessage("[SMS] Twilio SDK not installed. Run: npm install twilio", "warning")
    return null
  }
}

// Send SMS notification
export async function sendSMS(phoneNumber: string, message: string) {
  const twilio = await getTwilioClient()

  if (!twilio) {
    return {
      sent: false,
      error: "SMS service not configured. Please add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to environment variables.",
    }
  }

  const fromNumber = process.env.TWILIO_PHONE_NUMBER

  if (!fromNumber) {
    return {
      sent: false,
      error: "TWILIO_PHONE_NUMBER not configured",
    }
  }

  try {
    // FIXED: Proper phone number normalization for international numbers
    // Check if phone number already has country code
    let normalizedPhone = phoneNumber.trim()
    
    if (!normalizedPhone.startsWith("+")) {
      // If no country code, validate it's a valid format
      // For now, assume US numbers if no country code (legacy behavior)
      // But log a warning for international numbers
      const digitsOnly = normalizedPhone.replace(/\D/g, "")
      
      // If it's 10 digits, assume US (+1)
      if (digitsOnly.length === 10) {
        normalizedPhone = `+1${digitsOnly}`
      } else if (digitsOnly.length === 11 && digitsOnly.startsWith("1")) {
        // Already has US country code without +
        normalizedPhone = `+${digitsOnly}`
      } else {
        // Invalid format - return error instead of silently failing
        return {
          sent: false,
          error: `Invalid phone number format: ${phoneNumber}. Phone numbers must include country code (e.g., +1234567890 for US, +447911123456 for UK).`,
        }
      }
    } else {
      // Has country code, validate E.164 format
      const e164Pattern = /^\+[1-9]\d{1,14}$/
      if (!e164Pattern.test(normalizedPhone.replace(/\s/g, ""))) {
        return {
          sent: false,
          error: `Invalid phone number format: ${phoneNumber}. Must be in E.164 format (e.g., +1234567890).`,
        }
      }
      // Remove any spaces
      normalizedPhone = normalizedPhone.replace(/\s/g, "")
    }

    const result = await twilio.messages.create({
      body: message,
      from: fromNumber,
      to: normalizedPhone,
    })

    return {
      sent: true,
      messageId: result.sid,
      error: null,
    }
  } catch (error: unknown) {
    Sentry.captureException(error)
    return {
      sent: false,
      error: errorMessage(error, "Failed to send SMS"),
    }
  }
}

// Send SMS notification to user based on their preferences
export async function sendSMSNotification(
  userId: string,
  type: "route_update" | "load_update" | "maintenance_alert" | "payment_reminder" | "dispatch_assigned",
  data: any
) {
  const supabase = await createClient()

  // Get user's notification preferences
  const { data: preferences, error: preferencesError } = await supabase
    .from("notification_preferences")
    .select(
      "id, user_id, sms_alerts, route_updates, load_updates, maintenance_alerts, payment_reminders",
    )
    .eq("user_id", userId)
    .maybeSingle()

  if (preferencesError) {
    return { sent: false, reason: preferencesError.message }
  }

  if (!preferences || !preferences.sms_alerts) {
    return { sent: false, reason: "SMS alerts disabled" }
  }

  // Check if user wants this type of notification
  let shouldNotify = false
  switch (type) {
    case "route_update":
      shouldNotify = preferences.route_updates && preferences.sms_alerts
      break
    case "load_update":
      shouldNotify = preferences.load_updates && preferences.sms_alerts
      break
    case "maintenance_alert":
      shouldNotify = preferences.maintenance_alerts && preferences.sms_alerts
      break
    case "payment_reminder":
      shouldNotify = preferences.payment_reminders && preferences.sms_alerts
      break
    case "dispatch_assigned":
      shouldNotify = preferences.sms_alerts // Always notify for dispatches
      break
  }

  if (!shouldNotify) {
    return { sent: false, reason: "User has disabled this notification type" }
  }

  // Get user phone number
  const { data: userData, error: userDataError } = await supabase
    .from("users")
    .select("phone")
    .eq("id", userId)
    .maybeSingle()

  if (userDataError) {
    return { sent: false, reason: userDataError.message }
  }

  if (!userData?.phone) {
    return { sent: false, reason: "User phone number not found" }
  }

  // Generate SMS message based on type
  const message = generateSMSMessage(type, data)

  // Send SMS
  const result = await sendSMS(userData.phone, message)

  return {
    sent: result.sent,
    messageId: result.messageId,
    error: result.error,
    reason: result.error || (result.sent ? null : "Failed to send SMS"),
  }
}

// Generate SMS message content
function generateSMSMessage(
  type: "route_update" | "load_update" | "maintenance_alert" | "payment_reminder" | "dispatch_assigned",
  data: any
): string {
  switch (type) {
    case "route_update":
      return `TruckMates: Route ${data.routeName || "update"}: ${data.status || "status changed"}. ${data.destination ? `Destination: ${data.destination}` : ""}`

    case "load_update":
      return `TruckMates: Load ${data.shipmentNumber || ""} status: ${data.status || "updated"}. ${data.origin ? `${data.origin} → ${data.destination || ""}` : ""}`

    case "maintenance_alert":
      return `TruckMates: Maintenance alert for ${data.truckNumber || "vehicle"}: ${data.serviceType || "Service required"}. ${data.scheduledDate ? `Scheduled: ${new Date(data.scheduledDate).toLocaleDateString()}` : ""}`

    case "payment_reminder":
      return `TruckMates: Payment reminder for ${data.driverName || "driver"}. ${data.amount ? `Amount: $${data.amount}` : ""}`

    case "dispatch_assigned":
      return `TruckMates: New dispatch assigned! Load: ${data.shipmentNumber || "N/A"}, Origin: ${data.origin || "N/A"}, Destination: ${data.destination || "N/A"}`

    default:
      return `TruckMates: You have a new notification.`
  }
}

// Send SMS to driver (for dispatch notifications)
// EXT-005 FIX: Add company ownership check to prevent cross-company PII exposure
export async function sendSMSToDriver(
  driverId: string,
  message: string
) {
  const supabase = await createClient()
  // EXT-005: Get authenticated user's company_id first
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { sent: false, error: ctx.error || "Not authenticated" }
  }

  // EXT-005: Verify driver belongs to user's company before accessing phone number
  const { data: driver } = await supabase
    .from("drivers")
    .select("phone")
    .eq("id", driverId)
    .eq("company_id", ctx.companyId) // CRITICAL: Company ownership check
    .maybeSingle()

  if (!driver?.phone) {
    return { sent: false, error: "Driver phone number not found or access denied" }
  }

  return await sendSMS(driver.phone, message)
}

// Check SMS configuration
export async function checkSMSConfiguration() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER

  return {
    configured: !!(accountSid && authToken && phoneNumber),
    hasAccountSid: !!accountSid,
    hasAuthToken: !!authToken,
    hasPhoneNumber: !!phoneNumber,
    phoneNumber: phoneNumber || null,
  }
}


