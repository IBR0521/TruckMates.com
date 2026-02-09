import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const resourceType = searchParams.get("resource_type")
    const resourceId = searchParams.get("resource_id")
    
    if (!resourceType || !resourceId) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 })
    }

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const dependencies: Array<{
      type: string
      id: string
      name: string
      link?: string
    }> = []

    // Check dependencies based on resource type
    if (resourceType === "driver") {
      // Check for active loads
      const { data: activeLoads } = await supabase
        .from("loads")
        .select("id, shipment_number, status")
        .eq("driver_id", resourceId)
        .in("status", ["scheduled", "in_transit", "assigned"])

      if (activeLoads) {
        activeLoads.forEach((load) => {
          dependencies.push({
            type: "active_load",
            id: load.id,
            name: `Load #${load.shipment_number} (${load.status})`,
            link: `/dashboard/loads/${load.id}`,
          })
        })
      }

      // Check for assigned truck
      const { data: trucks } = await supabase
        .from("trucks")
        .select("id, truck_number")
        .eq("current_driver_id", resourceId)

      if (trucks) {
        trucks.forEach((truck) => {
          dependencies.push({
            type: "assigned_truck",
            id: truck.id,
            name: `Truck ${truck.truck_number}`,
            link: `/dashboard/trucks/${truck.id}`,
          })
        })
      }
    } else if (resourceType === "truck") {
      // Check for active loads
      const { data: activeLoads } = await supabase
        .from("loads")
        .select("id, shipment_number, status")
        .eq("truck_id", resourceId)
        .in("status", ["scheduled", "in_transit", "assigned"])

      if (activeLoads) {
        activeLoads.forEach((load) => {
          dependencies.push({
            type: "active_load",
            id: load.id,
            name: `Load #${load.shipment_number} (${load.status})`,
            link: `/dashboard/loads/${load.id}`,
          })
        })
      }

      // Check for assigned driver
      const { data: truck } = await supabase
        .from("trucks")
        .select("current_driver_id")
        .eq("id", resourceId)
        .single()

      if (truck?.current_driver_id) {
        const { data: driver } = await supabase
          .from("drivers")
          .select("id, name")
          .eq("id", truck.current_driver_id)
          .single()

        if (driver) {
          dependencies.push({
            type: "assigned_driver",
            id: truck.current_driver_id,
            name: `Driver: ${driver.name}`,
            link: `/dashboard/drivers/${truck.current_driver_id}`,
          })
        }
      }
    } else if (resourceType === "load") {
      // Check if load is in active status
      const { data: load } = await supabase
        .from("loads")
        .select("id, shipment_number, status")
        .eq("id", resourceId)
        .single()

      if (load && ["scheduled", "in_transit", "assigned"].includes(load.status)) {
        dependencies.push({
          type: "active_status",
          id: load.id,
          name: `Load is currently ${load.status}`,
        })
      }

      // Check for associated invoices
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, invoice_number, status")
        .eq("load_id", resourceId)

      if (invoices && invoices.length > 0) {
        invoices.forEach((invoice) => {
          dependencies.push({
            type: "invoice",
            id: invoice.id,
            name: `Invoice ${invoice.invoice_number} (${invoice.status})`,
            link: `/dashboard/accounting/invoices/${invoice.id}`,
          })
        })
      }

      // Check for assigned driver
      const { data: loadData } = await supabase
        .from("loads")
        .select("driver_id, truck_id")
        .eq("id", resourceId)
        .single()

      if (loadData?.driver_id) {
        const { data: driver } = await supabase
          .from("drivers")
          .select("id, name")
          .eq("id", loadData.driver_id)
          .single()

        if (driver) {
          dependencies.push({
            type: "assigned_driver",
            id: loadData.driver_id,
            name: `Assigned to: ${driver.name}`,
            link: `/dashboard/drivers/${loadData.driver_id}`,
          })
        }
      }

      // Check for assigned truck
      if (loadData?.truck_id) {
        const { data: truck } = await supabase
          .from("trucks")
          .select("id, truck_number")
          .eq("id", loadData.truck_id)
          .single()

        if (truck) {
          dependencies.push({
            type: "assigned_truck",
            id: loadData.truck_id,
            name: `Assigned to: Truck ${truck.truck_number}`,
            link: `/dashboard/trucks/${loadData.truck_id}`,
          })
        }
      }
    } else if (resourceType === "route") {
      // Check for associated loads
      const { data: loads } = await supabase
        .from("loads")
        .select("id, shipment_number, status")
        .eq("route_id", resourceId)

      if (loads && loads.length > 0) {
        loads.forEach((load) => {
          dependencies.push({
            type: "assigned_load",
            id: load.id,
            name: `Load #${load.shipment_number} (${load.status})`,
            link: `/dashboard/loads/${load.id}`,
          })
        })
      }

      // Check for route stops
      const { data: stops } = await supabase
        .from("route_stops")
        .select("id")
        .eq("route_id", resourceId)

      if (stops && stops.length > 0) {
        dependencies.push({
          type: "route_stops",
          id: resourceId,
          name: `${stops.length} stop(s) associated with this route`,
        })
      }
    } else if (resourceType === "customer") {
      // Check for associated loads
      const { data: customer } = await supabase
        .from("customers")
        .select("name, id")
        .eq("id", resourceId)
        .single()

      if (customer) {
        const { data: loads } = await supabase
          .from("loads")
          .select("id, shipment_number, status")
          .or(`customer_id.eq.${resourceId},company_name.eq.${customer.name}`)

        if (loads && loads.length > 0) {
          loads.forEach((load) => {
            dependencies.push({
              type: "load",
              id: load.id,
              name: `Load #${load.shipment_number} (${load.status})`,
              link: `/dashboard/loads/${load.id}`,
            })
          })
        }

        // Check for invoices
        const { data: invoices } = await supabase
          .from("invoices")
          .select("id, invoice_number, status")
          .or(`customer_id.eq.${resourceId},customer_name.eq.${customer.name}`)

        if (invoices && invoices.length > 0) {
          invoices.forEach((invoice) => {
            dependencies.push({
              type: "invoice",
              id: invoice.id,
              name: `Invoice ${invoice.invoice_number} (${invoice.status})`,
              link: `/dashboard/accounting/invoices/${invoice.id}`,
            })
          })
        }
      }
    } else if (resourceType === "vendor") {
      // Check for associated expenses
      const { data: vendor } = await supabase
        .from("vendors")
        .select("name, id")
        .eq("id", resourceId)
        .single()

      if (vendor) {
        const { data: expenses } = await supabase
          .from("expenses")
          .select("id, description, date")
          .or(`vendor_id.eq.${resourceId},vendor.eq.${vendor.name}`)

        if (expenses && expenses.length > 0) {
          expenses.forEach((expense) => {
            dependencies.push({
              type: "expense",
              id: expense.id,
              name: `Expense: ${expense.description || "N/A"} (${expense.date || "N/A"})`,
              link: `/dashboard/accounting/expenses/${expense.id}`,
            })
          })
        }

        // Check for maintenance records
        const { data: maintenance } = await supabase
          .from("maintenance")
          .select("id, service_type, scheduled_date")
          .or(`vendor_id.eq.${resourceId},vendor.eq.${vendor.name}`)

        if (maintenance && maintenance.length > 0) {
          maintenance.forEach((record) => {
            dependencies.push({
              type: "maintenance",
              id: record.id,
              name: `Maintenance: ${record.service_type || "N/A"} (${record.scheduled_date || "N/A"})`,
              link: `/dashboard/maintenance/${record.id}`,
            })
          })
        }
      }
    }

    return NextResponse.json({ dependencies })
  } catch (error: any) {
    console.error("Error checking dependencies:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

