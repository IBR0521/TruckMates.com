"use server"

import { createClient } from "@/lib/supabase/server"

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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: [], error: "Not authenticated" }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { data: [], error: "No company found" }
  }

  const allContacts: AddressBookContact[] = []

  try {
    // Get Customers
    if (!filters?.type || filters.type === "all" || filters.type === "customer") {
      let customerQuery = supabase
        .from("customers")
        .select("*")
        .eq("company_id", userData.company_id)

      if (filters?.status) {
        customerQuery = customerQuery.eq("status", filters.status)
      }

      if (filters?.search) {
        customerQuery = customerQuery.or(
          `name.ilike.%${filters.search}%,company_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
        )
      }

      const { data: customers, error: customersError } = await customerQuery

      if (!customersError && customers) {
        customers.forEach((customer) => {
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
        .select("*")
        .eq("company_id", userData.company_id)

      if (filters?.status) {
        vendorQuery = vendorQuery.eq("status", filters.status)
      }

      if (filters?.search) {
        vendorQuery = vendorQuery.or(
          `name.ilike.%${filters.search}%,company_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
        )
      }

      const { data: vendors, error: vendorsError } = await vendorQuery

      if (!vendorsError && vendors) {
        vendors.forEach((vendor) => {
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
        .select("*")
        .eq("company_id", userData.company_id)

      if (filters?.status) {
        driverQuery = driverQuery.eq("status", filters.status)
      }

      if (filters?.search) {
        driverQuery = driverQuery.or(
          `name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,license_number.ilike.%${filters.search}%`
        )
      }

      const { data: drivers, error: driversError } = await driverQuery

      if (!driversError && drivers) {
        drivers.forEach((driver) => {
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
        .eq("company_id", userData.company_id)
        .neq("id", user.id) // Exclude current user

      if (filters?.search) {
        employeeQuery = employeeQuery.or(
          `name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`
        )
      }

      const { data: employees, error: employeesError } = await employeeQuery

      if (!employeesError && employees) {
        employees.forEach((employee) => {
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

    // Apply search filter if not already applied in queries (for cross-type searches)
    let filteredContacts = allContacts
    if (filters?.search && (filters.type === "all" || !filters.type)) {
      const searchLower = filters.search.toLowerCase()
      filteredContacts = allContacts.filter(
        (contact) =>
          contact.name.toLowerCase().includes(searchLower) ||
          contact.company_name?.toLowerCase().includes(searchLower) ||
          contact.email?.toLowerCase().includes(searchLower) ||
          contact.phone?.toLowerCase().includes(searchLower) ||
          contact.address?.toLowerCase().includes(searchLower) ||
          `${contact.city} ${contact.state} ${contact.zip}`
            .toLowerCase()
            .includes(searchLower)
      )
    }

    // Sort by name
    filteredContacts.sort((a, b) => a.name.localeCompare(b.name))

    return { data: filteredContacts, error: null }
  } catch (error: any) {
    return { data: [], error: error.message || "Failed to fetch contacts" }
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: "Not authenticated" }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { data: null, error: "No company found" }
  }

  try {
    let contact: any = null

    switch (type) {
      case "customer": {
        const { data, error } = await supabase
          .from("customers")
          .select("*")
          .eq("id", id)
          .eq("company_id", userData.company_id)
          .single()

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
          .select("*")
          .eq("id", id)
          .eq("company_id", userData.company_id)
          .single()

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
          .select("*")
          .eq("id", id)
          .eq("company_id", userData.company_id)
          .single()

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
          .eq("company_id", userData.company_id)
          .single()

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
    return { data: null, error: error.message || "Failed to fetch contact" }
  }
}

