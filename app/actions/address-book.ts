"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"

export interface AddressBookContact {
  id: string
  type: "customer" | "vendor" | "driver" | "employee"
  name: string
  company_name?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  status?: string
  metadata?: any // Additional type-specific data
}

// Get all contacts from all sources (unified address book)
export async function getAddressBookContacts(filters?: {
  search?: string
  type?: "customer" | "vendor" | "driver" | "employee" | "all"
  status?: string
}): Promise<{
  data: AddressBookContact[]
  error: string | null
}> {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId || !ctx.userId) {
    return { data: [], error: ctx.error || "Not authenticated" }
  }

  const allContacts: AddressBookContact[] = []

  try {
    // Get Customers
    if (!filters?.type || filters.type === "all" || filters.type === "customer") {
      let customerQuery = supabase
        .from("customers")
        .select("id, name, company_name, email, phone, address_line1, address_line2, city, state, zip, status, customer_type, payment_terms")
        .eq("company_id", ctx.companyId)

      if (filters?.status) {
        customerQuery = customerQuery.eq("status", filters.status)
      } 

      if (filters?.search) {
        customerQuery = customerQuery.or(
          `name.ilike.%${filters.search}%,company_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
        )
      }

      // V3-007 FIX: Add LIMIT to prevent unbounded queries
      const { data: customers, error: customersError } = await customerQuery.limit(1000)

      if (!customersError && customers) {
        customers.forEach((customer: any) => {
          const address = [customer.address_line1, customer.address_line2]
            .filter(Boolean)
            .join(", ")
          allContacts.push({
            id: customer.id,
            type: "customer",
            name: customer.name || "",
            company_name: customer.company_name,
            email: customer.email,
            phone: customer.phone,
            address,
            city: customer.city,
            state: customer.state,
            zip: customer.zip,
            status: customer.status,
            metadata: {
              customer_type: customer.customer_type,
              payment_terms: customer.payment_terms,
            },
          })
        })
      }
    }

    // Get Vendors
    if (!filters?.type || filters.type === "all" || filters.type === "vendor") {
      let vendorQuery = supabase
        .from("vendors")
        .select("id, name, company_name, email, phone, address_line1, address_line2, city, state, zip, status, vendor_type, payment_terms")
        .eq("company_id", ctx.companyId)

      if (filters?.status) {
        vendorQuery = vendorQuery.eq("status", filters.status)
      }

      if (filters?.search) {
        vendorQuery = vendorQuery.or(
          `name.ilike.%${filters.search}%,company_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
        )
      }

      // V3-007 FIX: Add LIMIT to prevent unbounded queries
      const { data: vendors, error: vendorsError } = await vendorQuery.limit(1000)

      if (!vendorsError && vendors) {
        vendors.forEach((vendor: any) => {
          const address = [vendor.address_line1, vendor.address_line2]
            .filter(Boolean)
            .join(", ")
          allContacts.push({
            id: vendor.id,
            type: "vendor",
            name: vendor.name || "",
            company_name: vendor.company_name,
            email: vendor.email,
            phone: vendor.phone,
            address,
            city: vendor.city,
            state: vendor.state,
            zip: vendor.zip,
            status: vendor.status,
            metadata: {
              vendor_type: vendor.vendor_type,
              payment_terms: vendor.payment_terms,
            },
          })
        })
      }
    }

    // Get Drivers
    if (!filters?.type || filters.type === "all" || filters.type === "driver") {
      let driverQuery = supabase
        .from("drivers")
        .select("id, name, email, phone, address, city, state, zip, status, license_number, license_expiry")
        .eq("company_id", ctx.companyId)

      if (filters?.status) {
        driverQuery = driverQuery.eq("status", filters.status)
      }

      if (filters?.search) {
        driverQuery = driverQuery.or(
          `name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,license_number.ilike.%${filters.search}%`
        )
      }

      // V3-007 FIX: Add LIMIT to prevent unbounded queries
      const { data: drivers, error: driversError } = await driverQuery.limit(1000)

      if (!driversError && drivers) {
        drivers.forEach((driver: any) => {
          allContacts.push({
            id: driver.id,
            type: "driver",
            name: driver.name || "",
            email: driver.email,
            phone: driver.phone,
            address: driver.address,
            city: driver.city,
            state: driver.state,
            zip: driver.zip,
            status: driver.status,
            metadata: {
              license_number: driver.license_number,
              license_expiry: driver.license_expiry,
            },
          })
        })
      }
    }

    // Get Employees
    if (!filters?.type || filters.type === "all" || filters.type === "employee") {
      let employeeQuery = supabase
        .from("users")
        .select("id, name, email, phone, role, company_id")
        .eq("company_id", ctx.companyId)
        .neq("id", ctx.userId) // Exclude current user

      if (filters?.search) {
        employeeQuery = employeeQuery.or(
          `name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`
        )
      }

      // V3-007 FIX: Add LIMIT to prevent unbounded queries
      const { data: employees, error: employeesError } = await employeeQuery.limit(1000)

      if (!employeesError && employees) {
        employees.forEach((employee: any) => {
          allContacts.push({
            id: employee.id,
            type: "employee",
            name: employee.name || "",
            email: employee.email,
            phone: employee.phone,
            status: "active", // Employees are always active
            metadata: {
              role: employee.role,
            },
          })
        })
      }
    }

    // Apply search filter only if searching across all types (not already filtered in DB)
    // For type-specific searches, DB filter is sufficient and consistent
    let filteredContacts = allContacts
    if (filters?.search && (filters.type === "all" || !filters.type)) {
      // Only apply JavaScript filter for cross-type searches
      // Use same fields as DB filters for consistency
      const searchLower = filters.search.toLowerCase()
      filteredContacts = allContacts.filter(
        (contact) =>
          contact.name.toLowerCase().includes(searchLower) ||
          contact.company_name?.toLowerCase().includes(searchLower) ||
          contact.email?.toLowerCase().includes(searchLower) ||
          contact.phone?.toLowerCase().includes(searchLower)
          // Note: address fields not included here to match DB filter behavior
          // DB filters don't search address fields, so JS filter shouldn't either
      )
    }

    // Sort by name
    filteredContacts.sort((a, b) => a.name.localeCompare(b.name))

    return { data: filteredContacts, error: null }
  } catch (error: any) {
    console.error("[getAddressBookContacts] Unexpected error:", error)
    return { data: [], error: error?.message || "Failed to fetch contacts" }
  }
}

// Get single contact by ID and type
export async function getAddressBookContact(
  id: string,
  type: "customer" | "vendor" | "driver" | "employee"
): Promise<{
  data: AddressBookContact | null
  error: string | null
}> {
  const supabase = await createClient()
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.companyId) {
    return { data: null, error: ctx.error || "Not authenticated" }
  }

  // V3-014 FIX: Validate input parameters
  if (!id || typeof id !== "string" || id.trim().length === 0) {
    return { data: null, error: "Invalid contact ID" }
  }

  if (!type || !["customer", "vendor", "driver", "employee"].includes(type)) {
    return { data: null, error: "Invalid contact type" }
  }

  // EXT-010 FIX: Add try-catch to prevent unhandled exceptions
  try {
    let contact: any = null

    switch (type) {
      case "customer": {
        const { data, error } = await supabase
          .from("customers")
          .select("id, name, company_name, email, phone, address_line1, address_line2, city, state, zip, status, customer_type, payment_terms")
          .eq("id", id)
          .eq("company_id", ctx.companyId)
          .maybeSingle()

        if (error || !data) break

        const address = [data.address_line1, data.address_line2]
          .filter(Boolean)
          .join(", ")
        contact = {
          id: data.id,
          type: "customer" as const,
          name: data.name || "",
          company_name: data.company_name,
          email: data.email,
          phone: data.phone,
          address,
          city: data.city,
          state: data.state,
          zip: data.zip,
          status: data.status,
          metadata: {
            customer_type: data.customer_type,
            payment_terms: data.payment_terms,
          },
        }
        break
      }

      case "vendor": {
        const { data, error } = await supabase
          .from("vendors")
          .select("id, name, company_name, email, phone, address_line1, address_line2, city, state, zip, status, vendor_type, payment_terms")
          .eq("id", id)
          .eq("company_id", ctx.companyId)
          .maybeSingle()

        if (error || !data) break

        const address = [data.address_line1, data.address_line2]
          .filter(Boolean)
          .join(", ")
        contact = {
          id: data.id,
          type: "vendor" as const,
          name: data.name || "",
          company_name: data.company_name,
          email: data.email,
          phone: data.phone,
          address,
          city: data.city,
          state: data.state,
          zip: data.zip,
          status: data.status,
          metadata: {
            vendor_type: data.vendor_type,
            payment_terms: data.payment_terms,
          },
        }
        break
      }

      case "driver": {
        const { data, error } = await supabase
          .from("drivers")
          .select("id, name, email, phone, address, city, state, zip, status, license_number, license_expiry")
          .eq("id", id)
          .eq("company_id", ctx.companyId)
          .maybeSingle()

        if (error || !data) break

        contact = {
          id: data.id,
          type: "driver" as const,
          name: data.name || "",
          email: data.email,
          phone: data.phone,
          address: data.address,
          city: data.city,
          state: data.state,
          zip: data.zip,
          status: data.status,
          metadata: {
            license_number: data.license_number,
            license_expiry: data.license_expiry,
          },
        }
        break
      }

      case "employee": {
        const { data, error } = await supabase
          .from("users")
          .select("id, name, email, phone, role, company_id")
          .eq("id", id)
          .eq("company_id", ctx.companyId)
          .maybeSingle()

        if (error || !data) break

        contact = {
          id: data.id,
          type: "employee" as const,
          name: data.name || "",
          email: data.email,
          phone: data.phone,
          status: "active",
          metadata: {
            role: data.role,
          },
        }
        break
      }
    }

    return { data: contact, error: contact ? null : "Contact not found" }
  } catch (error: any) {
    console.error("[getAddressBookContact] Unexpected error:", error)
    return { data: null, error: error?.message || "Failed to fetch contact" }
  }
}

