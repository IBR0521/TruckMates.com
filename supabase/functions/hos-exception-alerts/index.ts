// Supabase Edge Function: HOS Exception Alerts
// Runs every 15 minutes to scan driver HOS status and send proactive alerts

// @ts-expect-error — Deno URL imports are not resolved by the app TypeScript project
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-expect-error — Deno URL imports are not resolved by the app TypeScript project
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Deno global type declaration for TypeScript
declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
}

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

serve(async (req: Request) => {
  try {
    // Validate required environment variables
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // BUG-005 FIX: Process drivers per company to avoid cross-company PII leak
    // First, get all companies
    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select("id")
    
    if (companiesError || !companies) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch companies", details: companiesError }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    const allAlerts: HOSAlert[] = []
    let totalDriversChecked = 0

    // Process each company separately
    for (const company of companies) {
      // BUG-005 FIX: Scope driver query by company_id
      const { data: drivers, error: driversError } = await supabase
        .from("drivers")
        .select("id, name, company_id, phone")
        .eq("status", "active")
        .eq("company_id", company.id)

      if (driversError || !drivers) {
        console.error(`[HOS Alerts] Error fetching drivers for company ${company.id}:`, driversError)
        continue // Skip this company, continue with others
      }

      totalDriversChecked += drivers.length

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

          // Validate hosData structure before destructuring
          if (typeof hosData !== 'object' || hosData === null) {
            console.error(`[HOS Alerts] Invalid HOS data structure for driver ${driver.id}`)
            continue
          }

          const remaining_driving = typeof hosData.remaining_driving === 'number' ? hosData.remaining_driving : 0
          const remaining_on_duty = typeof hosData.remaining_on_duty === 'number' ? hosData.remaining_on_duty : 0
          const needs_break = Boolean(hosData.needs_break)

          // Alert 1: Approaching 11-hour driving limit (< 2 hours remaining)
          if (remaining_driving < 2 && remaining_driving > 0) {
            allAlerts.push({
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
            allAlerts.push({
              driver_id: driver.id,
              driver_name: driver.name,
              company_id: driver.company_id,
              type: "break_required",
              message: `${driver.name} needs a 30-minute break (has driven 8+ hours).`,
            })
          }

          // FIXED: Prioritize alerts - if driving limit reached, don't also fire on-duty limit
          // Alert 3: Driving limit reached (0 hours remaining) - highest priority
          if (remaining_driving <= 0) {
            allAlerts.push({
              driver_id: driver.id,
              driver_name: driver.name,
              company_id: driver.company_id,
              type: "limit_reached",
              message: `${driver.name} has reached the 11-hour driving limit. Must take 10-hour break.`,
            })
          } else if (remaining_on_duty <= 0) {
            // Alert 5: On-duty limit reached (only if driving limit not reached)
            allAlerts.push({
              driver_id: driver.id,
              driver_name: driver.name,
              company_id: driver.company_id,
              type: "limit_reached",
              message: `${driver.name} has reached the 14-hour on-duty limit. Must take 10-hour break.`,
            })
          } else if (remaining_on_duty < 1 && remaining_on_duty > 0) {
            // Alert 4: On-duty limit approaching (< 1 hour remaining, only if driving limit not reached)
            allAlerts.push({
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
      } // End of driver loop
    } // End of company loop

    // Send alerts via SMS and store in database
    const sentAlerts: Array<HOSAlert & { sms_sent?: boolean }> = []
    
    // Batch insert alerts for efficiency
    if (allAlerts.length > 0) {
      const alertInserts = allAlerts.map(alert => ({
        company_id: alert.company_id,
        driver_id: alert.driver_id,
        title: alert.type === "approaching_limit"
          ? "Approaching HOS Limit"
          : alert.type === "break_required"
          ? "Break Required"
          : "HOS Limit Reached",
        message: alert.message,
        event_type: "hos_violation",
        priority: alert.type === "limit_reached" ? "critical" : alert.type === "break_required" ? "high" : "normal",
        status: "active",
        metadata: {
          hours_remaining: alert.hours_remaining,
          alert_type: alert.type,
          driver_name: alert.driver_name,
        },
      }))

      const { error: batchAlertError } = await supabase
        .from("alerts")
        .insert(alertInserts)

      if (batchAlertError) {
        console.error(`[HOS Alerts] Error batch storing alerts:`, batchAlertError)
      }
    }
    
    // Store driver phone numbers in a map to avoid redundant queries
    const driverPhoneMap = new Map<string, string>()
    
    for (const alert of allAlerts) {
      try {
        // Get driver phone number (cache to avoid redundant queries)
        if (!driverPhoneMap.has(alert.driver_id)) {
          const { data: driverData } = await supabase
            .from("drivers")
            .select("phone")
            .eq("id", alert.driver_id)
            .eq("company_id", alert.company_id) // BUG FIX: Verify company_id matches
            .maybeSingle()
          
          if (driverData?.phone) {
            driverPhoneMap.set(alert.driver_id, driverData.phone)
          }
        }

        // FIXED: Include all relevant roles for HOS alerts (safety-critical)
        // Get manager, safety_manager, owner, and dispatcher phone numbers
        // BUG FIX: Explicitly scope by company_id to prevent cross-company leaks
        const { data: managers } = await supabase
          .from("users")
          .select("phone, phone_number") // FIXED: Check both phone and phone_number columns
          .eq("company_id", alert.company_id) // BUG FIX: Explicit company scoping
          .in("role", ["manager", "safety_manager", "owner", "dispatcher"])
          .or("phone.not.is.null,phone_number.not.is.null")

        // Send SMS to driver if phone available
        const driverPhone = driverPhoneMap.get(alert.driver_id)
        if (driverPhone && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
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
                  To: driverPhone,
                  Body: `[TruckMates] ${alert.message}`,
                }),
              }
            )

            if (smsResponse.ok) {
              sentAlerts.push({ ...alert, sms_sent: true })
            } else {
              const errorData = await smsResponse.json().catch(() => ({}))
              console.error(`[HOS Alerts] Twilio API error for driver ${alert.driver_id}:`, errorData)
            }
          } catch (smsError) {
            console.error(`[HOS Alerts] Error sending SMS to driver ${alert.driver_id}:`, smsError)
          }
        } else if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
          // Log warning but continue processing other alerts
          console.warn(`[HOS Alerts] Twilio credentials not configured - skipping SMS for driver ${alert.driver_id}`)
        }

        // Send SMS to managers (limit to prevent spam)
        if (managers && managers.length > 0 && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
          // BUG FIX: Limit manager notifications to prevent spam (max 5 managers per alert)
          const managersToNotify = managers.slice(0, 5)
          
          for (const manager of managersToNotify) {
            // FIXED: Use phone or phone_number (handle field name mismatch)
            const phoneNumber = manager.phone || manager.phone_number
            if (phoneNumber) {
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
                      To: phoneNumber,
                      Body: `[TruckMates Alert] ${alert.message}`,
                    }),
                  }
                )
                
                if (!smsResponse.ok) {
                  const errorData = await smsResponse.json().catch(() => ({}))
                  console.error(`[HOS Alerts] Twilio API error for manager:`, errorData)
                }
              } catch (smsError) {
                console.error(`[HOS Alerts] Error sending SMS to manager:`, smsError)
              }
            }
          }
        } else if (managers && managers.length > 0 && (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER)) {
          console.warn(`[HOS Alerts] Twilio credentials not configured - skipping SMS for ${managers.length} managers`)
        }
      } catch (error) {
        console.error(`[HOS Alerts] Error processing alert:`, error)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        drivers_checked: totalDriversChecked,
        alerts_generated: allAlerts.length,
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



