"use server"

import { createClient } from "@/lib/supabase/server"
import { getCachedUserCompany } from "@/lib/query-optimizer"
import { createAlert } from "./alerts"

/**
 * Get all expiring documents, licenses, and insurance
 * @param daysAhead - Number of days ahead to check (default: 30)
 */
export async function getExpiringItems(daysAhead: number = 30) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id
  const companyError = result.error

  if (companyError || !company_id) {
    return { error: companyError || "No company found", data: null }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const futureDate = new Date()
  futureDate.setDate(today.getDate() + daysAhead)
  futureDate.setHours(23, 59, 59, 999)

  try {
    // Get expiring documents
    const { data: expiringDocuments, error: docsError } = await supabase
      .from("documents")
      .select("id, name, type, expiry_date, truck_id, driver_id")
      .eq("company_id", company_id)
      .not("expiry_date", "is", null)
      .gte("expiry_date", today.toISOString().split("T")[0])
      .lte("expiry_date", futureDate.toISOString().split("T")[0])
      .order("expiry_date", { ascending: true })

    // Get expiring driver licenses
    const { data: expiringLicenses, error: licensesError } = await supabase
      .from("drivers")
      .select("id, name, license_number, license_expiry")
      .eq("company_id", company_id)
      .not("license_expiry", "is", null)
      .gte("license_expiry", today.toISOString().split("T")[0])
      .lte("license_expiry", futureDate.toISOString().split("T")[0])
      .order("license_expiry", { ascending: true })

    // Get expiring truck licenses
    const { data: expiringTruckLicenses, error: truckLicensesError } = await supabase
      .from("trucks")
      .select("id, truck_number, license_expiry_date")
      .eq("company_id", company_id)
      .not("license_expiry_date", "is", null)
      .gte("license_expiry_date", today.toISOString().split("T")[0])
      .lte("license_expiry_date", futureDate.toISOString().split("T")[0])
      .order("license_expiry_date", { ascending: true })

    // Get expiring truck insurance
    const { data: expiringInsurance, error: insuranceError } = await supabase
      .from("trucks")
      .select("id, truck_number, insurance_expiry_date")
      .eq("company_id", company_id)
      .not("insurance_expiry_date", "is", null)
      .gte("insurance_expiry_date", today.toISOString().split("T")[0])
      .lte("insurance_expiry_date", futureDate.toISOString().split("T")[0])
      .order("insurance_expiry_date", { ascending: true })

    // Get expired items (past expiry date)
    const { data: expiredDocuments, error: expiredDocsError } = await supabase
      .from("documents")
      .select("id, name, type, expiry_date, truck_id, driver_id")
      .eq("company_id", company_id)
      .not("expiry_date", "is", null)
      .lt("expiry_date", today.toISOString().split("T")[0])
      .order("expiry_date", { ascending: false })

    const { data: expiredLicenses, error: expiredLicensesError } = await supabase
      .from("drivers")
      .select("id, name, license_number, license_expiry")
      .eq("company_id", company_id)
      .not("license_expiry", "is", null)
      .lt("license_expiry", today.toISOString().split("T")[0])
      .order("license_expiry", { ascending: false })

    const { data: expiredTruckLicenses, error: expiredTruckLicensesError } = await supabase
      .from("trucks")
      .select("id, truck_number, license_expiry_date")
      .eq("company_id", company_id)
      .not("license_expiry_date", "is", null)
      .lt("license_expiry_date", today.toISOString().split("T")[0])
      .order("license_expiry_date", { ascending: false })

    const { data: expiredInsurance, error: expiredInsuranceError } = await supabase
      .from("trucks")
      .select("id, truck_number, insurance_expiry_date")
      .eq("company_id", company_id)
      .not("insurance_expiry_date", "is", null)
      .lt("insurance_expiry_date", today.toISOString().split("T")[0])
      .order("insurance_expiry_date", { ascending: false })

    if (docsError || licensesError || truckLicensesError || insuranceError) {
      return { 
        error: "Failed to fetch expiring items", 
        data: null 
      }
    }

    // Format results
    const expiring = {
      documents: (expiringDocuments || []).map(doc => ({
        id: doc.id,
        name: doc.name,
        type: doc.type,
        expiry_date: doc.expiry_date,
        item_type: "document",
        truck_id: doc.truck_id,
        driver_id: doc.driver_id,
        days_until_expiry: Math.ceil(
          (new Date(doc.expiry_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        ),
      })),
      driver_licenses: (expiringLicenses || []).map(driver => ({
        id: driver.id,
        name: driver.name,
        license_number: driver.license_number,
        expiry_date: driver.license_expiry,
        item_type: "driver_license",
        days_until_expiry: Math.ceil(
          (new Date(driver.license_expiry).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        ),
      })),
      truck_licenses: (expiringTruckLicenses || []).map(truck => ({
        id: truck.id,
        name: truck.truck_number,
        expiry_date: truck.license_expiry_date,
        item_type: "truck_license",
        days_until_expiry: Math.ceil(
          (new Date(truck.license_expiry_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        ),
      })),
      truck_insurance: (expiringInsurance || []).map(truck => ({
        id: truck.id,
        name: truck.truck_number,
        expiry_date: truck.insurance_expiry_date,
        item_type: "truck_insurance",
        days_until_expiry: Math.ceil(
          (new Date(truck.insurance_expiry_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        ),
      })),
    }

    const expired = {
      documents: (expiredDocuments || []).map(doc => ({
        id: doc.id,
        name: doc.name,
        type: doc.type,
        expiry_date: doc.expiry_date,
        item_type: "document",
        truck_id: doc.truck_id,
        driver_id: doc.driver_id,
        days_expired: Math.ceil(
          (today.getTime() - new Date(doc.expiry_date).getTime()) / (1000 * 60 * 60 * 24)
        ),
      })),
      driver_licenses: (expiredLicenses || []).map(driver => ({
        id: driver.id,
        name: driver.name,
        license_number: driver.license_number,
        expiry_date: driver.license_expiry,
        item_type: "driver_license",
        days_expired: Math.ceil(
          (today.getTime() - new Date(driver.license_expiry).getTime()) / (1000 * 60 * 60 * 24)
        ),
      })),
      truck_licenses: (expiredTruckLicenses || []).map(truck => ({
        id: truck.id,
        name: truck.truck_number,
        expiry_date: truck.license_expiry_date,
        item_type: "truck_license",
        days_expired: Math.ceil(
          (today.getTime() - new Date(truck.license_expiry_date).getTime()) / (1000 * 60 * 60 * 24)
        ),
      })),
      truck_insurance: (expiredInsurance || []).map(truck => ({
        id: truck.id,
        name: truck.truck_number,
        expiry_date: truck.insurance_expiry_date,
        item_type: "truck_insurance",
        days_expired: Math.ceil(
          (today.getTime() - new Date(truck.insurance_expiry_date).getTime()) / (1000 * 60 * 60 * 24)
        ),
      })),
    }

    // Combine all expiring items
    const allExpiring = [
      ...expiring.documents,
      ...expiring.driver_licenses,
      ...expiring.truck_licenses,
      ...expiring.truck_insurance,
    ].sort((a, b) => {
      const dateA = new Date(a.expiry_date).getTime()
      const dateB = new Date(b.expiry_date).getTime()
      return dateA - dateB
    })

    // Combine all expired items
    const allExpired = [
      ...expired.documents,
      ...expired.driver_licenses,
      ...expired.truck_licenses,
      ...expired.truck_insurance,
    ].sort((a, b) => {
      const dateA = new Date(a.expiry_date).getTime()
      const dateB = new Date(b.expiry_date).getTime()
      return dateB - dateA // Most recently expired first
    })

    return {
      data: {
        expiring: allExpiring,
        expired: allExpired,
        summary: {
          expiring_count: allExpiring.length,
          expired_count: allExpired.length,
          expiring_documents: expiring.documents.length,
          expiring_driver_licenses: expiring.driver_licenses.length,
          expiring_truck_licenses: expiring.truck_licenses.length,
          expiring_truck_insurance: expiring.truck_insurance.length,
        },
      },
      error: null,
    }
  } catch (error: any) {
    return { error: error.message || "Failed to get expiring items", data: null }
  }
}

/**
 * Create alerts for expiring items
 * This can be called manually or by a cron job
 */
export async function createExpiryAlerts(daysAhead: number = 30) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: "Not authenticated", data: null }
  }

  const result = await getCachedUserCompany(user.id)
  const company_id = result.company_id

  if (!company_id) {
    return { error: "No company found", data: null }
  }

  // Get expiring items
  const expiringResult = await getExpiringItems(daysAhead)
  if (expiringResult.error || !expiringResult.data) {
    return expiringResult
  }

  const { expiring, expired } = expiringResult.data
  const alertsCreated = []

  // Create alerts for expiring items (7 days or less)
  for (const item of expiring) {
    if (item.days_until_expiry <= 7) {
      const alertMessage = getExpiryAlertMessage(item)
      const alertResult = await createAlert({
        title: `Expiring Soon: ${item.name || item.item_type}`,
        message: alertMessage,
        event_type: "document_expiry",
        priority: item.days_until_expiry <= 3 ? "high" : "normal",
        driver_id: item.driver_id || null,
        truck_id: item.truck_id || null,
        metadata: {
          item_type: item.item_type,
          expiry_date: item.expiry_date,
          days_until_expiry: item.days_until_expiry,
        },
      })
      if (!alertResult.error) {
        alertsCreated.push(alertResult.data)
      }
    }
  }

  // Create alerts for expired items
  for (const item of expired) {
    const alertMessage = getExpiredAlertMessage(item)
    const alertResult = await createAlert({
      title: `Expired: ${item.name || item.item_type}`,
      message: alertMessage,
      event_type: "document_expiry",
      priority: "high",
      driver_id: item.driver_id || null,
      truck_id: item.truck_id || null,
      metadata: {
        item_type: item.item_type,
        expiry_date: item.expiry_date,
        days_expired: item.days_expired,
      },
    })
    if (!alertResult.error) {
      alertsCreated.push(alertResult.data)
    }
  }

  return {
    data: {
      alerts_created: alertsCreated.length,
      expiring_count: expiring.length,
      expired_count: expired.length,
    },
    error: null,
  }
}

/**
 * Helper function to generate alert message for expiring items
 */
function getExpiryAlertMessage(item: any): string {
  const days = item.days_until_expiry
  const itemName = item.name || item.item_type
  const itemType = item.item_type.replace("_", " ")

  if (days === 0) {
    return `${itemName} (${itemType}) expires today!`
  } else if (days === 1) {
    return `${itemName} (${itemType}) expires tomorrow!`
  } else {
    return `${itemName} (${itemType}) expires in ${days} days`
  }
}

/**
 * Helper function to generate alert message for expired items
 */
function getExpiredAlertMessage(item: any): string {
  const days = item.days_expired
  const itemName = item.name || item.item_type
  const itemType = item.item_type.replace("_", " ")

  if (days === 0) {
    return `${itemName} (${itemType}) expired today`
  } else if (days === 1) {
    return `${itemName} (${itemType}) expired yesterday`
  } else {
    return `${itemName} (${itemType}) expired ${days} days ago`
  }
}





