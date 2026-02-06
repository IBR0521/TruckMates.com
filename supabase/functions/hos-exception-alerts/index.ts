// Supabase Edge Function: HOS Exception Alerts
// Runs every 15 minutes to scan driver HOS status and send proactive alerts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? ""
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? ""
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") ?? ""

interface HOSAlert {
  driver_id: string
  driver_name: string
  company_id: string
  type: "approaching_limit" | "break_required" | "limit_reached"
  hours_remaining?: number
  message: string
}

serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get all active drivers
    const { data: drivers, error: driversError } = await supabase
      .from("drivers")
      .select("id, name, company_id, phone")
      .eq("status", "active")

    if (driversError || !drivers) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch drivers", details: driversError }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    const alerts: HOSAlert[] = []

    // Check each driver's HOS status
    for (const driver of drivers) {
      try {
        // Calculate remaining HOS using RPC function
        const { data: hosData, error: hosError } = await supabase.rpc("calculate_remaining_hos", {
          p_driver_id: driver.id,
        })

        if (hosError || !hosData) {
          console.error(`[HOS Alerts] Error calculating HOS for driver ${driver.id}:`, hosError)
          continue
        }

        const { remaining_driving, remaining_on_duty, needs_break } = hosData

        // Alert 1: Approaching 11-hour driving limit (< 2 hours remaining)
        if (remaining_driving < 2 && remaining_driving > 0) {
          alerts.push({
            driver_id: driver.id,
            driver_name: driver.name,
            company_id: driver.company_id,
            type: "approaching_limit",
            hours_remaining: remaining_driving,
            message: `${driver.name} has ${remaining_driving.toFixed(1)} hours of driving time remaining. Plan break soon.`,
          })
        }

        // Alert 2: Break required (30-minute break needed after 8 hours)
        if (needs_break) {
          alerts.push({
            driver_id: driver.id,
            driver_name: driver.name,
            company_id: driver.company_id,
            type: "break_required",
            message: `${driver.name} needs a 30-minute break (has driven 8+ hours).`,
          })
        }

        // Alert 3: Driving limit reached (0 hours remaining)
        if (remaining_driving <= 0) {
          alerts.push({
            driver_id: driver.id,
            driver_name: driver.name,
            company_id: driver.company_id,
            type: "limit_reached",
            message: `${driver.name} has reached the 11-hour driving limit. Must take 10-hour break.`,
          })
        }

        // Alert 4: On-duty limit approaching (< 1 hour remaining)
        if (remaining_on_duty < 1 && remaining_on_duty > 0) {
          alerts.push({
            driver_id: driver.id,
            driver_name: driver.name,
            company_id: driver.company_id,
            type: "approaching_limit",
            hours_remaining: remaining_on_duty,
            message: `${driver.name} has ${remaining_on_duty.toFixed(1)} hours of on-duty time remaining.`,
          })
        }
      } catch (error) {
        console.error(`[HOS Alerts] Error processing driver ${driver.id}:`, error)
        continue
      }
    }

    // Send alerts via SMS and store in database
    const sentAlerts = []
    for (const alert of alerts) {
      try {
        // Store alert in database
        const { error: alertError } = await supabase.from("eld_events").insert({
          company_id: alert.company_id,
          driver_id: alert.driver_id,
          event_type: "hos_alert",
          severity: alert.type === "limit_reached" ? "critical" : "warning",
          title: alert.type === "approaching_limit"
            ? "Approaching HOS Limit"
            : alert.type === "break_required"
            ? "Break Required"
            : "HOS Limit Reached",
          description: alert.message,
          event_time: new Date().toISOString(),
          resolved: false,
          metadata: {
            hours_remaining: alert.hours_remaining,
            alert_type: alert.type,
          },
        })

        if (alertError) {
          console.error(`[HOS Alerts] Error storing alert:`, alertError)
        }

        // Get driver phone number
        const { data: driverData } = await supabase
          .from("drivers")
          .select("phone")
          .eq("id", alert.driver_id)
          .single()

        // Get dispatcher/manager phone numbers for this company
        const { data: managers } = await supabase
          .from("users")
          .select("phone_number")
          .eq("company_id", alert.company_id)
          .eq("role", "manager")
          .not("phone_number", "is", null)

        // Send SMS to driver if phone available
        if (driverData?.phone && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
          try {
            const smsResponse = await fetch(
              `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                  Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
                },
                body: new URLSearchParams({
                  From: TWILIO_PHONE_NUMBER,
                  To: driverData.phone,
                  Body: `[TruckMates] ${alert.message}`,
                }),
              }
            )

            if (smsResponse.ok) {
              sentAlerts.push({ ...alert, sms_sent: true })
            }
          } catch (smsError) {
            console.error(`[HOS Alerts] Error sending SMS to driver:`, smsError)
          }
        }

        // Send SMS to managers
        if (managers && managers.length > 0 && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
          for (const manager of managers) {
            if (manager.phone_number) {
              try {
                await fetch(
                  `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/x-www-form-urlencoded",
                      Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
                    },
                    body: new URLSearchParams({
                      From: TWILIO_PHONE_NUMBER,
                      To: manager.phone_number,
                      Body: `[TruckMates Alert] ${alert.message}`,
                    }),
                  }
                )
              } catch (smsError) {
                console.error(`[HOS Alerts] Error sending SMS to manager:`, smsError)
              }
            }
          }
        }
      } catch (error) {
        console.error(`[HOS Alerts] Error processing alert:`, error)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        drivers_checked: drivers.length,
        alerts_generated: alerts.length,
        alerts_sent: sentAlerts.length,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error("[HOS Alerts] Unhandled error:", error)
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})


