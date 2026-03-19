"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"

/**
 * Remove all demo data from the current user's company
 * This identifies demo data by common patterns (DEMO- prefix, demo email domains, etc.)
 */
export async function removeAllDemoData() {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { error: ctx.error || "Not authenticated", data: null }
  }
  const company_id = ctx.companyId

  try {
    // Delete demo data in order (respecting foreign keys)
    
    // 1. Delete demo invoices (DEMO-INV- prefix)
    await supabase
      .from("invoices")
      .delete()
      .eq("company_id", company_id)
      .like("invoice_number", "DEMO-INV-%")

    // 2. Delete demo loads (DEMO-LOAD- prefix)
    await supabase
      .from("loads")
      .delete()
      .eq("company_id", company_id)
      .like("shipment_number", "DEMO-LOAD-%")

    // 3. Delete demo routes
    await supabase
      .from("routes")
      .delete()
      .eq("company_id", company_id)
      .in("name", ["LA to NYC Route", "Dallas to Chicago", "Houston to Atlanta"])

    // 4. Delete demo trucks (DEMO-TRK- prefix)
    await supabase
      .from("trucks")
      .delete()
      .eq("company_id", company_id)
      .like("truck_number", "DEMO-TRK-%")

    // 5. Delete demo drivers (by email domain @demo.com)
    await supabase
      .from("drivers")
      .delete()
      .eq("company_id", company_id)
      .like("email", "%@demo.com")

    // 6. Delete demo customers (common demo names)
    await supabase
      .from("customers")
      .delete()
      .eq("company_id", company_id)
      .in("name", [
        "TechCorp Distribution",
        "National Freight Brokers",
        "Metro Retail Chain"
      ])

    // 7. Delete demo ELD devices (ELD- prefix)
    await supabase
      .from("eld_devices")
      .delete()
      .eq("company_id", company_id)
      .like("device_serial_number", "ELD-%")

    // 8. Delete demo expenses
    await supabase
      .from("expenses")
      .delete()
      .eq("company_id", company_id)
      .in("vendor", [
        "Pilot Travel Center",
        "Love's Travel Stop",
        "Mobile Mechanic Services",
        "ProTire Supply"
      ])

    // 9. Delete demo maintenance records
    await supabase
      .from("maintenance")
      .delete()
      .eq("company_id", company_id)
      .in("vendor", [
        "Mobile Mechanic Services",
        "ProTire Supply"
      ])

    // 10. Delete demo BOLs
    await supabase
      .from("bols")
      .delete()
      .eq("company_id", company_id)
      .like("bol_number", "BOL-%")

    // 11. Delete demo DVIR reports
    await supabase
      .from("dvir")
      .delete()
      .eq("company_id", company_id)

    // 12. Delete demo IFTA reports
    await supabase
      .from("ifta_reports")
      .delete()
      .eq("company_id", company_id)

    // 13. Delete demo geofences
    await supabase
      .from("geofences")
      .delete()
      .eq("company_id", company_id)
      .in("name", [
        "Los Angeles Distribution Center",
        "New York Warehouse",
        "Dallas Hub"
      ])

    // 14. Delete demo address book entries
    await supabase
      .from("address_book")
      .delete()
      .eq("company_id", company_id)
      .in("name", [
        "TechCorp Warehouse",
        "Metro Retail Distribution",
        "National Freight Hub",
        "Mobile Mechanic Services",
        "Pilot Travel Center"
      ])

    // 15. Delete demo settlements
    await supabase
      .from("settlements")
      .delete()
      .eq("company_id", company_id)

    // 16. Delete demo ELD logs
    await supabase
      .from("eld_logs")
      .delete()
      .eq("company_id", company_id)

    return {
      data: { success: true, message: "All demo data removed successfully" },
      error: null,
    }
  } catch (error: any) {
    return {
      error: error.message || "Failed to remove demo data",
      data: null,
    }
  }
}

