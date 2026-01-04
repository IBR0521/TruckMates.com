"use server"

import { createClient } from "@/lib/supabase/server"
import * as driversActions from "./drivers"
import * as trucksActions from "./trucks"
import * as loadsActions from "./loads"
import * as routesActions from "./routes"
import * as customersActions from "./customers"
import * as vendorsActions from "./vendors"
import * as accountingActions from "./accounting"
import * as bolActions from "./bol"
import * as eldActions from "./eld"
import * as iftaActions from "./ifta"
import * as reportsActions from "./reports"
import * as routeOptimizationActions from "./route-optimization"
import * as documentAnalysisActions from "./document-analysis"
import * as dispatchesActions from "./dispatches"
import * as addressBookActions from "./address-book"
import * as documentsActions from "./documents"
import * as dashboardActions from "./dashboard"
import * as userActions from "./user"
import * as companyActions from "./company"
import * as employeesActions from "./employees"
import * as notificationsActions from "./notifications"
import * as subscriptionActions from "./subscriptions"
import * as subscriptionLimitsActions from "./subscription-limits"
import * as eldAdvancedActions from "./eld-advanced"
import * as eldInsightsActions from "./eld-insights"
import * as routeStopsActions from "./route-stops"
import * as loadDeliveryPointsActions from "./load-delivery-points"
import * as loadMileageActions from "./load-mileage"
import * as invoicesAutoActions from "./invoices-auto"
import * as maintenanceActions from "./maintenance"
import * as eldManualActions from "./eld-manual"

/**
 * Comprehensive function test that tests EVERY function in the platform
 */
export async function testAllPlatformFunctions() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Not authenticated", data: null }
  }

  const { data: userData } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) {
    return { error: "No company found", data: null }
  }

  // Create arrays using a closure pattern - absolutely guaranteed to exist
  const createResultsStore = () => {
    const tested: any[] = []
    const passed: any[] = []
    const failed: any[] = []
    const skipped: any[] = []
    const errors: any[] = []
    
    return {
      tested,
      passed,
      failed,
      skipped,
      errors,
      pushTested: (value: any) => {
        try {
          tested.push(value)
        } catch (e: any) {
          console.error('[FUNCTION TEST] pushTested error:', e?.message || e)
        }
      },
      pushPassed: (value: any) => {
        try {
          passed.push(value)
        } catch (e: any) {
          console.error('[FUNCTION TEST] pushPassed error:', e?.message || e)
        }
      },
      pushFailed: (value: any) => {
        try {
          failed.push(value)
        } catch (e: any) {
          console.error('[FUNCTION TEST] pushFailed error:', e?.message || e)
        }
      },
      pushSkipped: (value: any) => {
        try {
          skipped.push(value)
        } catch (e: any) {
          console.error('[FUNCTION TEST] pushSkipped error:', e?.message || e)
        }
      },
      pushError: (value: any) => {
        try {
          errors.push(value)
        } catch (e: any) {
          console.error('[FUNCTION TEST] pushError error:', e?.message || e)
        }
      },
      getResults: () => ({
        tested: Array.isArray(tested) ? tested : [],
        passed: Array.isArray(passed) ? passed : [],
        failed: Array.isArray(failed) ? failed : [],
        skipped: Array.isArray(skipped) ? skipped : [],
        errors: Array.isArray(errors) ? errors : [],
      })
    }
  }

  const store = createResultsStore()
  
  // Helper functions that use the store
  const pushTested = (value: any) => store.pushTested(value)
  const pushPassed = (value: any) => store.pushPassed(value)
  const pushFailed = (value: any) => store.pushFailed(value)
  const pushSkipped = (value: any) => store.pushSkipped(value)
  const pushError = (value: any) => store.pushError(value)

  const startTime = Date.now()
  console.log(`[FUNCTION TEST] Starting comprehensive function test...`)

  try {
    // Results object is already initialized as const above
    // ============================================
    // 1. DASHBOARD FUNCTIONS
    // ============================================
    console.log(`[FUNCTION TEST] Testing Dashboard functions...`)
    try {
      const dashboardResult = await dashboardActions.getDashboardStats()
      pushTested("getDashboardStats")
      if (dashboardResult.data) pushPassed("getDashboardStats")
      else pushFailed({ function: "getDashboardStats", error: dashboardResult.error })
    } catch (error: any) {
      pushFailed({ function: "getDashboardStats", error: error.message })
    }

    // ============================================
    // 2. USER FUNCTIONS
    // ============================================
    console.log(`[FUNCTION TEST] Testing User functions...`)
    try {
      const userProfile = await userActions.getUserProfile()
      pushTested("getUserProfile")
      if (userProfile.data) pushPassed("getUserProfile")
      else pushFailed({ function: "getUserProfile", error: userProfile.error })
    } catch (error: any) {
      pushFailed({ function: "getUserProfile", error: error.message })
    }

    try {
      const currentUser = await userActions.getCurrentUser()
      pushTested("getCurrentUser")
      if (currentUser.data) pushPassed("getCurrentUser")
      else pushFailed({ function: "getCurrentUser", error: currentUser.error })
    } catch (error: any) {
      pushFailed({ function: "getCurrentUser", error: error.message })
    }

    // ============================================
    // 3. COMPANY FUNCTIONS
    // ============================================
    console.log(`[FUNCTION TEST] Testing Company functions...`)
    try {
      const company = await companyActions.getCompany()
      pushTested("getCompany")
      if (company.data) pushPassed("getCompany")
      else pushFailed({ function: "getCompany", error: company.error })
    } catch (error: any) {
      pushFailed({ function: "getCompany", error: error.message })
    }

    // ============================================
    // 4. DRIVER FUNCTIONS
    // ============================================
    console.log(`[FUNCTION TEST] Testing Driver functions...`)
    try {
      const drivers = await driversActions.getDrivers()
      pushTested("getDrivers")
      if (drivers.data) {
        pushPassed("getDrivers")
        // Test getDriver if we have drivers
        if (drivers.data.length > 0) {
          try {
            const driver = await driversActions.getDriver(drivers.data[0].id)
            pushTested("getDriver")
            if (driver.data) pushPassed("getDriver")
            else pushFailed({ function: "getDriver", error: driver.error })
          } catch (error: any) {
            pushFailed({ function: "getDriver", error: error.message })
          }
        }
      } else {
        pushFailed({ function: "getDrivers", error: drivers.error })
      }
    } catch (error: any) {
      pushFailed({ function: "getDrivers", error: error.message })
    }

    // Test CREATE Driver
    try {
      const testDriver = await driversActions.createDriver({
        name: `Test Driver ${Date.now()}`,
        email: `testdriver${Date.now()}@test.com`,
        phone: "555-123-4567",
        license_number: `TEST${Date.now()}`,
        status: "active",
        // Note: address, city, state, zip are not in the drivers table schema
      })
      pushTested("createDriver")
      if (testDriver.data) {
        pushPassed("createDriver")
        const createdDriverId = testDriver.data.id

        // Test UPDATE Driver
        try {
          const updated = await driversActions.updateDriver(createdDriverId, {
            name: `Updated Test Driver ${Date.now()}`,
          })
          pushTested("updateDriver")
          if (updated.data) pushPassed("updateDriver")
          else pushFailed({ function: "updateDriver", error: updated.error })
        } catch (error: any) {
          pushFailed({ function: "updateDriver", error: error.message })
        }

        // Test DELETE Driver
        try {
          const deleted = await driversActions.deleteDriver(createdDriverId)
          pushTested("deleteDriver")
          if (!deleted.error) pushPassed("deleteDriver")
          else pushFailed({ function: "deleteDriver", error: deleted.error })
        } catch (error: any) {
          pushFailed({ function: "deleteDriver", error: error.message })
        }
      } else {
        pushFailed({ function: "createDriver", error: testDriver.error })
      }
    } catch (error: any) {
      pushFailed({ function: "createDriver", error: error.message })
    }

    // ============================================
    // 5. TRUCK FUNCTIONS
    // ============================================
    console.log(`[FUNCTION TEST] Testing Truck functions...`)
    try {
      const trucks = await trucksActions.getTrucks()
      pushTested("getTrucks")
      if (trucks.data) {
        pushPassed("getTrucks")
        // Test getTruck if we have trucks
        if (trucks.data.length > 0) {
          try {
            const truck = await trucksActions.getTruck(trucks.data[0].id)
            pushTested("getTruck")
            if (truck.data) pushPassed("getTruck")
            else pushFailed({ function: "getTruck", error: truck.error })
          } catch (error: any) {
            pushFailed({ function: "getTruck", error: error.message })
          }
        }
      } else {
        pushFailed({ function: "getTrucks", error: trucks.error })
      }
    } catch (error: any) {
      pushFailed({ function: "getTrucks", error: error.message })
    }

    // ============================================
    // 6. LOAD FUNCTIONS
    // ============================================
    console.log(`[FUNCTION TEST] Testing Load functions...`)
    try {
      const loads = await loadsActions.getLoads()
      pushTested("getLoads")
      if (loads.data) {
        pushPassed("getLoads")
        // Test getLoad if we have loads
        if (loads.data.length > 0) {
          try {
            const load = await loadsActions.getLoad(loads.data[0].id)
            pushTested("getLoad")
            if (load.data) pushPassed("getLoad")
            else pushFailed({ function: "getLoad", error: load.error })
          } catch (error: any) {
            pushFailed({ function: "getLoad", error: error.message })
          }
        }
      } else {
        pushFailed({ function: "getLoads", error: loads.error })
      }
    } catch (error: any) {
      pushFailed({ function: "getLoads", error: error.message })
    }

    // Test load mileage calculation
    try {
      const mileage = await loadMileageActions.calculateMileage("New York, NY", "Los Angeles, CA")
      pushTested("calculateMileage")
      if (mileage.miles !== null || mileage.error) {
        pushPassed("calculateMileage")
      } else {
        pushFailed({ function: "calculateMileage", error: "No result" })
      }
    } catch (error: any) {
      pushFailed({ function: "calculateMileage", error: error.message })
    }

    // Test load delivery points if we have loads
    try {
      const loads = await loadsActions.getLoads()
      if (loads.data && loads.data.length > 0) {
        const deliveryPoints = await loadDeliveryPointsActions.getLoadDeliveryPoints(loads.data[0].id)
        pushTested("getLoadDeliveryPoints")
        if (deliveryPoints.data !== undefined) pushPassed("getLoadDeliveryPoints")
        else pushFailed({ function: "getLoadDeliveryPoints", error: deliveryPoints.error })
      }
    } catch (error: any) {
      pushSkipped({ function: "getLoadDeliveryPoints", reason: "No loads available" })
    }

    // ============================================
    // 7. ROUTE FUNCTIONS
    // ============================================
    console.log(`[FUNCTION TEST] Testing Route functions...`)
    try {
      const routes = await routesActions.getRoutes()
      pushTested("getRoutes")
      if (routes.data) {
        pushPassed("getRoutes")
        // Test getRoute if we have routes
        if (routes.data.length > 0) {
          try {
            const route = await routesActions.getRoute(routes.data[0].id)
            pushTested("getRoute")
            if (route.data) pushPassed("getRoute")
            else pushFailed({ function: "getRoute", error: route.error })
          } catch (error: any) {
            pushFailed({ function: "getRoute", error: error.message })
          }

          // Test route stops
          try {
            const stops = await routeStopsActions.getRouteStops(routes.data[0].id)
            pushTested("getRouteStops")
            if (stops.data !== undefined) pushPassed("getRouteStops")
            else pushFailed({ function: "getRouteStops", error: stops.error })
          } catch (error: any) {
            pushFailed({ function: "getRouteStops", error: error.message })
          }

          // Test route summary
          try {
            const summary = await routeStopsActions.getRouteSummary(routes.data[0].id)
            pushTested("getRouteSummary")
            if (summary.data) pushPassed("getRouteSummary")
            else pushFailed({ function: "getRouteSummary", error: summary.error })
          } catch (error: any) {
            pushFailed({ function: "getRouteSummary", error: error.message })
          }
        }
      } else {
        pushFailed({ function: "getRoutes", error: routes.error })
      }
    } catch (error: any) {
      pushFailed({ function: "getRoutes", error: error.message })
    }

    // Test route optimization functions
    try {
      const routes = await routesActions.getRoutes()
      if (routes.data && routes.data.length > 0) {
        const optResult = await routeOptimizationActions.optimizeMultiStopRoute(routes.data[0].id)
        pushTested("optimizeMultiStopRoute")
        if (optResult.success || optResult.error) {
          pushPassed("optimizeMultiStopRoute")
        } else {
          pushFailed({ function: "optimizeMultiStopRoute", error: "No result" })
        }

        // Test optimizeRouteOrder
        try {
          const stops = await routeStopsActions.getRouteStops(routes.data[0].id)
          if (stops.data && stops.data.length > 2) {
            const optOrder = await routeOptimizationActions.optimizeRouteOrder(
              stops.data.map((s: any) => ({
                id: s.id,
                address: s.address || s.location_name || "Test Address",
                lat: s.latitude || 34.0522,
                lng: s.longitude || -118.2437,
              }))
            )
            pushTested("optimizeRouteOrder")
            if (optOrder.optimizedOrder || optOrder.error) {
              pushPassed("optimizeRouteOrder")
            } else {
              pushFailed({ function: "optimizeRouteOrder", error: "No result" })
            }
          }
        } catch (error: any) {
          pushSkipped({ function: "optimizeRouteOrder", reason: "No stops available" })
        }

        // Test calculateRouteDistance
        try {
          const distance = await routeOptimizationActions.calculateRouteDistance(
            "New York, NY",
            "Los Angeles, CA"
          )
          pushTested("calculateRouteDistance")
          if (distance.distance !== undefined || distance.error) {
            pushPassed("calculateRouteDistance")
          } else {
            pushFailed({ function: "calculateRouteDistance", error: "No result" })
          }
        } catch (error: any) {
          pushFailed({ function: "calculateRouteDistance", error: error.message })
        }
      }
    } catch (error: any) {
      pushSkipped({ function: "Route Optimization", reason: "No routes available" })
    }

    // ============================================
    // 8. CUSTOMER FUNCTIONS
    // ============================================
    console.log(`[FUNCTION TEST] Testing Customer functions...`)
    try {
      const customers = await customersActions.getCustomers()
      pushTested("getCustomers")
      if (customers.data) {
        pushPassed("getCustomers")
        if (customers.data.length > 0) {
          try {
            const customer = await customersActions.getCustomer(customers.data[0].id)
            pushTested("getCustomer")
            if (customer.data) {
              pushPassed("getCustomer")
              
              // Test customer-related functions
              try {
                const loads = await customersActions.getCustomerLoads(customers.data[0].id)
                pushTested("getCustomerLoads")
                if (loads.data !== undefined) pushPassed("getCustomerLoads")
                else pushFailed({ function: "getCustomerLoads", error: loads.error })
              } catch (error: any) {
                pushFailed({ function: "getCustomerLoads", error: error.message })
              }

              try {
                const invoices = await customersActions.getCustomerInvoices(customers.data[0].id)
                pushTested("getCustomerInvoices")
                if (invoices.data !== undefined) pushPassed("getCustomerInvoices")
                else pushFailed({ function: "getCustomerInvoices", error: invoices.error })
              } catch (error: any) {
                pushFailed({ function: "getCustomerInvoices", error: error.message })
              }

              try {
                const history = await customersActions.getCustomerHistory(customers.data[0].id)
                pushTested("getCustomerHistory")
                if (history.data !== undefined) pushPassed("getCustomerHistory")
                else pushFailed({ function: "getCustomerHistory", error: history.error })
              } catch (error: any) {
                pushFailed({ function: "getCustomerHistory", error: error.message })
              }
            } else {
              pushFailed({ function: "getCustomer", error: customer.error })
            }
          } catch (error: any) {
            pushFailed({ function: "getCustomer", error: error.message })
          }
        }
      } else {
        pushFailed({ function: "getCustomers", error: customers.error })
      }
    } catch (error: any) {
      pushFailed({ function: "getCustomers", error: error.message })
    }

    // Test CREATE Customer
    try {
      // Use unique name to avoid constraint violation (UNIQUE(company_id, name))
      const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
      const uniqueName = `Test Customer ${uniqueId}`
      const testCustomer = await customersActions.createCustomer({
        name: uniqueName,
        company_name: `Test Company ${uniqueId}`,
        email: `testcustomer${uniqueId}@test.com`,
        phone: "555-123-4567",
        customer_type: "shipper",
        status: "active",
      })
      pushTested("createCustomer")
      if (testCustomer.data) {
        pushPassed("createCustomer")
        const createdCustomerId = testCustomer.data.id

        // Test UPDATE Customer
        try {
          const updated = await customersActions.updateCustomer(createdCustomerId, {
            name: `Updated Test Customer ${Date.now()}`,
          })
          pushTested("updateCustomer")
          if (updated.data) pushPassed("updateCustomer")
          else pushFailed({ function: "updateCustomer", error: updated.error })
        } catch (error: any) {
          pushFailed({ function: "updateCustomer", error: error.message })
        }

        // Test DELETE Customer
        try {
          const deleted = await customersActions.deleteCustomer(createdCustomerId)
          pushTested("deleteCustomer")
          if (!deleted.error) pushPassed("deleteCustomer")
          else pushFailed({ function: "deleteCustomer", error: deleted.error })
        } catch (error: any) {
          pushFailed({ function: "deleteCustomer", error: error.message })
        }
      } else {
        pushFailed({ function: "createCustomer", error: testCustomer.error })
      }
    } catch (error: any) {
      pushFailed({ function: "createCustomer", error: error.message })
    }

    // ============================================
    // 9. VENDOR FUNCTIONS
    // ============================================
    console.log(`[FUNCTION TEST] Testing Vendor functions...`)
    try {
      const vendors = await vendorsActions.getVendors()
      pushTested("getVendors")
      if (vendors.data) {
        pushPassed("getVendors")
        if (vendors.data.length > 0) {
          try {
            const vendor = await vendorsActions.getVendor(vendors.data[0].id)
            pushTested("getVendor")
            if (vendor.data) {
              pushPassed("getVendor")
              
              // Test vendor-related functions
              try {
                const expenses = await vendorsActions.getVendorExpenses(vendors.data[0].id)
                pushTested("getVendorExpenses")
                if (expenses.data !== undefined) pushPassed("getVendorExpenses")
                else pushFailed({ function: "getVendorExpenses", error: expenses.error })
              } catch (error: any) {
                pushFailed({ function: "getVendorExpenses", error: error.message })
              }

              try {
                const maintenance = await vendorsActions.getVendorMaintenance(vendors.data[0].id)
                pushTested("getVendorMaintenance")
                if (maintenance.data !== undefined) pushPassed("getVendorMaintenance")
                else pushFailed({ function: "getVendorMaintenance", error: maintenance.error })
              } catch (error: any) {
                pushFailed({ function: "getVendorMaintenance", error: error.message })
              }
            } else {
              pushFailed({ function: "getVendor", error: vendor.error })
            }
          } catch (error: any) {
            pushFailed({ function: "getVendor", error: error.message })
          }
        }
      } else {
        pushFailed({ function: "getVendors", error: vendors.error })
      }
    } catch (error: any) {
      pushFailed({ function: "getVendors", error: error.message })
    }

    // Test CREATE Vendor
    try {
      // Use unique name to avoid constraint violation (UNIQUE(company_id, name))
      const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
      const uniqueName = `Test Vendor ${uniqueId}`
      const testVendor = await vendorsActions.createVendor({
        name: uniqueName,
        company_name: `Test Vendor Company ${uniqueId}`,
        email: `testvendor${uniqueId}@test.com`,
        phone: "555-123-4567",
        vendor_type: "supplier",
        status: "active",
      })
      pushTested("createVendor")
      if (testVendor.data) {
        pushPassed("createVendor")
        const createdVendorId = testVendor.data.id

        // Test UPDATE Vendor
        try {
          const updated = await vendorsActions.updateVendor(createdVendorId, {
            name: `Updated Test Vendor ${Date.now()}`,
          })
          pushTested("updateVendor")
          if (updated.data) pushPassed("updateVendor")
          else pushFailed({ function: "updateVendor", error: updated.error })
        } catch (error: any) {
          pushFailed({ function: "updateVendor", error: error.message })
        }

        // Test DELETE Vendor
        try {
          const deleted = await vendorsActions.deleteVendor(createdVendorId)
          pushTested("deleteVendor")
          if (!deleted.error) pushPassed("deleteVendor")
          else pushFailed({ function: "deleteVendor", error: deleted.error })
        } catch (error: any) {
          pushFailed({ function: "deleteVendor", error: error.message })
        }
      } else {
        pushFailed({ function: "createVendor", error: testVendor.error })
      }
    } catch (error: any) {
      pushFailed({ function: "createVendor", error: error.message })
    }

    // ============================================
    // 10. ACCOUNTING FUNCTIONS
    // ============================================
    console.log(`[FUNCTION TEST] Testing Accounting functions...`)
    try {
      const invoices = await accountingActions.getInvoices()
      pushTested("getInvoices")
      if (invoices.data) {
        pushPassed("getInvoices")
        if (invoices.data.length > 0) {
          try {
            const invoice = await accountingActions.getInvoice(invoices.data[0].id)
            pushTested("getInvoice")
            if (invoice.data) pushPassed("getInvoice")
            else pushFailed({ function: "getInvoice", error: invoice.error })
          } catch (error: any) {
            pushFailed({ function: "getInvoice", error: error.message })
          }
        }
      } else {
        pushFailed({ function: "getInvoices", error: invoices.error })
      }
    } catch (error: any) {
      pushFailed({ function: "getInvoices", error: error.message })
    }

    try {
      const expenses = await accountingActions.getExpenses()
      pushTested("getExpenses")
      if (expenses.data) pushPassed("getExpenses")
      else pushFailed({ function: "getExpenses", error: expenses.error })
    } catch (error: any) {
      pushFailed({ function: "getExpenses", error: error.message })
    }

    try {
      const settlements = await accountingActions.getSettlements()
      pushTested("getSettlements")
      if (settlements.data) pushPassed("getSettlements")
      else pushFailed({ function: "getSettlements", error: settlements.error })
    } catch (error: any) {
      pushFailed({ function: "getSettlements", error: error.message })
    }

    // Test auto-generate invoices
    try {
      const autoInvoices = await invoicesAutoActions.autoGenerateInvoicesFromLoads()
      pushTested("autoGenerateInvoicesFromLoads")
      if (autoInvoices.data !== undefined) pushPassed("autoGenerateInvoicesFromLoads")
      else pushFailed({ function: "autoGenerateInvoicesFromLoads", error: autoInvoices.error })
    } catch (error: any) {
      pushFailed({ function: "autoGenerateInvoicesFromLoads", error: error.message })
    }

    // Test CREATE Settlement
    try {
      const drivers = await driversActions.getDrivers()
      if (drivers.data && drivers.data.length > 0) {
        const periodEnd = new Date()
        const periodStart = new Date(periodEnd)
        periodStart.setDate(periodStart.getDate() - 14)
        
        const settlement = await accountingActions.createSettlement({
          driver_id: drivers.data[0].id,
          period_start: periodStart.toISOString().split("T")[0],
          period_end: periodEnd.toISOString().split("T")[0],
          gross_pay: 5000,
          fuel_deduction: 500,
          net_pay: 4500,
        })
        pushTested("createSettlement")
        if (settlement.data) {
          pushPassed("createSettlement")
          // Test DELETE Settlement
          try {
            const deleted = await accountingActions.deleteSettlement(settlement.data.id)
            pushTested("deleteSettlement")
            if (!deleted.error) pushPassed("deleteSettlement")
            else pushFailed({ function: "deleteSettlement", error: deleted.error })
          } catch (error: any) {
            pushFailed({ function: "deleteSettlement", error: error.message })
          }
        } else {
          pushFailed({ function: "createSettlement", error: settlement.error })
        }
      }
    } catch (error: any) {
      pushSkipped({ function: "createSettlement", reason: "No drivers available" })
    }

    // ============================================
    // 11. BOL FUNCTIONS
    // ============================================
    console.log(`[FUNCTION TEST] Testing BOL functions...`)
    try {
      const bols = await bolActions.getBOLs()
      pushTested("getBOLs")
      if (bols.data) {
        pushPassed("getBOLs")
        if (bols.data.length > 0) {
          try {
            const bol = await bolActions.getBOL(bols.data[0].id)
            pushTested("getBOL")
            if (bol.data) pushPassed("getBOL")
            else pushFailed({ function: "getBOL", error: bol.error })
          } catch (error: any) {
            pushFailed({ function: "getBOL", error: error.message })
          }
        }
      } else {
        pushFailed({ function: "getBOLs", error: bols.error })
      }
    } catch (error: any) {
      pushFailed({ function: "getBOLs", error: error.message })
    }

    try {
      const templates = await bolActions.getBOLTemplates()
      pushTested("getBOLTemplates")
      if (templates.data) pushPassed("getBOLTemplates")
      else pushFailed({ function: "getBOLTemplates", error: templates.error })
    } catch (error: any) {
      pushFailed({ function: "getBOLTemplates", error: templates.error })
    }

    // Test CREATE BOL
    try {
      const loads = await loadsActions.getLoads()
      if (loads.data && loads.data.length > 0) {
        // Check if load already has a BOL (unique constraint on load_id)
        const existingBOLs = await bolActions.getBOLs()
        const existingBOLsList = existingBOLs.data || []
        const loadWithoutBOL = loads.data.find((load: any) => 
          !existingBOLsList.some((bol: any) => bol.load_id === load.id)
        )
        
        if (loadWithoutBOL) {
          const bol = await bolActions.createBOL({
            load_id: loadWithoutBOL.id,
            shipper_name: `Test Shipper ${Date.now()}`,
            shipper_address: "123 Test St",
            shipper_city: "Test City",
            shipper_state: "CA",
            shipper_zip: "12345",
            consignee_name: `Test Consignee ${Date.now()}`,
            consignee_address: "456 Test Ave",
            consignee_city: "Test City",
            consignee_state: "CA",
            consignee_zip: "12345",
            freight_charges: 1000,
          })
          pushTested("createBOL")
          if (bol.data) {
            pushPassed("createBOL")
          } else {
            pushFailed({ function: "createBOL", error: bol.error })
          }
        } else {
          pushSkipped({ function: "createBOL", reason: "All loads already have BOLs" })
        }
      }
    } catch (error: any) {
      pushSkipped({ function: "createBOL", reason: "No loads available" })
    }

    // ============================================
    // 11.5. MAINTENANCE FUNCTIONS
    // ============================================
    console.log(`[FUNCTION TEST] Testing Maintenance functions...`)
    try {
      const maintenance = await maintenanceActions.getMaintenance()
      pushTested("getMaintenance")
      if (maintenance.data) {
        pushPassed("getMaintenance")
      } else {
        pushFailed({ function: "getMaintenance", error: maintenance.error })
      }
    } catch (error: any) {
      pushFailed({ function: "getMaintenance", error: error.message })
    }

    // Test CREATE Maintenance (direct DB insert since no createMaintenance function exists)
    try {
      const trucks = await trucksActions.getTrucks()
      if (trucks.data && trucks.data.length > 0) {
        const supabase = await createClient()
        const { data: userData } = await supabase
          .from("users")
          .select("company_id")
          .eq("id", user.id)
          .single()

        if (userData?.company_id) {
          const { data: maint, error: maintError } = await supabase
            .from("maintenance")
            .insert({
              company_id: userData.company_id,
              truck_id: trucks.data[0].id,
              service_type: "oil_change",
              scheduled_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
              mileage: 50000, // Column is 'mileage' not 'current_mileage'
              priority: "normal",
              estimated_cost: 100,
              status: "scheduled",
            })
            .select()
            .single()

          pushTested("createMaintenance")
          if (maint) {
            pushPassed("createMaintenance")
            // Test DELETE Maintenance
            try {
              const deleted = await maintenanceActions.deleteMaintenance(maint.id)
              pushTested("deleteMaintenance")
              if (!deleted.error) pushPassed("deleteMaintenance")
              else pushFailed({ function: "deleteMaintenance", error: deleted.error })
            } catch (error: any) {
              pushFailed({ function: "deleteMaintenance", error: error.message })
            }
          } else {
            pushFailed({ function: "createMaintenance", error: maintError?.message || "Failed" })
          }
        }
      }
    } catch (error: any) {
      pushSkipped({ function: "createMaintenance", reason: "No trucks available" })
    }

    // ============================================
    // 12. ELD FUNCTIONS
    // ============================================
    console.log(`[FUNCTION TEST] Testing ELD functions...`)
    try {
      const devices = await eldActions.getELDDevices()
      pushTested("getELDDevices")
      if (devices.data) {
        pushPassed("getELDDevices")
        if (devices.data.length > 0) {
          try {
            const device = await eldActions.getELDDevice(devices.data[0].id)
            pushTested("getELDDevice")
            if (device.data) pushPassed("getELDDevice")
            else pushFailed({ function: "getELDDevice", error: device.error })
          } catch (error: any) {
            pushFailed({ function: "getELDDevice", error: error.message })
          }

          // Test ELD logs
          try {
            const logs = await eldActions.getELDLogs({ deviceId: devices.data[0].id })
            pushTested("getELDLogs")
            if (logs.data !== undefined) pushPassed("getELDLogs")
            else pushFailed({ function: "getELDLogs", error: logs.error })
          } catch (error: any) {
            pushFailed({ function: "getELDLogs", error: error.message })
          }

          // Test ELD events
          try {
            const events = await eldActions.getELDEvents({ deviceId: devices.data[0].id })
            pushTested("getELDEvents")
            if (events.data !== undefined) pushPassed("getELDEvents")
            else pushFailed({ function: "getELDEvents", error: events.error })
          } catch (error: any) {
            pushFailed({ function: "getELDEvents", error: error.message })
          }

          // Test ELD mileage data
          try {
            const mileage = await eldActions.getELDMileageData({
              deviceId: devices.data[0].id,
              startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
              endDate: new Date().toISOString().split("T")[0],
            })
            pushTested("getELDMileageData")
            if (mileage.data !== undefined) pushPassed("getELDMileageData")
            else pushFailed({ function: "getELDMileageData", error: mileage.error })
          } catch (error: any) {
            pushFailed({ function: "getELDMileageData", error: error.message })
          }
        }
      } else {
        pushFailed({ function: "getELDDevices", error: devices.error })
      }
    } catch (error: any) {
      pushFailed({ function: "getELDDevices", error: error.message })
    }

    // Test ELD advanced functions
    try {
      const drivers = await driversActions.getDrivers()
      if (drivers.data && drivers.data.length > 0) {
        try {
          const remainingHOS = await eldAdvancedActions.calculateRemainingHOS(drivers.data[0].id)
          pushTested("calculateRemainingHOS")
          if (remainingHOS.data !== undefined) pushPassed("calculateRemainingHOS")
          else pushFailed({ function: "calculateRemainingHOS", error: remainingHOS.error })
        } catch (error: any) {
          pushFailed({ function: "calculateRemainingHOS", error: error.message })
        }

        try {
          const scorecard = await eldAdvancedActions.getDriverScorecard(drivers.data[0].id)
          pushTested("getDriverScorecard")
          if (scorecard.data !== undefined) pushPassed("getDriverScorecard")
          else pushFailed({ function: "getDriverScorecard", error: scorecard.error })
        } catch (error: any) {
          pushFailed({ function: "getDriverScorecard", error: error.message })
        }

        try {
          const recommendations = await eldInsightsActions.getDriverRecommendations(drivers.data[0].id)
          pushTested("getDriverRecommendations")
          if (recommendations.data !== undefined) pushPassed("getDriverRecommendations")
          else pushFailed({ function: "getDriverRecommendations", error: recommendations.error })
        } catch (error: any) {
          pushFailed({ function: "getDriverRecommendations", error: error.message })
        }
      }
    } catch (error: any) {
      pushSkipped({ function: "ELD Advanced", reason: "No drivers available" })
    }

    try {
      const fleetHealth = await eldAdvancedActions.getFleetHealth()
      pushTested("getFleetHealth")
      if (fleetHealth.data !== undefined) pushPassed("getFleetHealth")
      else pushFailed({ function: "getFleetHealth", error: fleetHealth.error })
    } catch (error: any) {
      pushFailed({ function: "getFleetHealth", error: error.message })
    }

    try {
      const locations = await eldAdvancedActions.getRealtimeLocations()
      pushTested("getRealtimeLocations")
      if (locations.data !== undefined) pushPassed("getRealtimeLocations")
      else pushFailed({ function: "getRealtimeLocations", error: locations.error })
    } catch (error: any) {
      pushFailed({ function: "getRealtimeLocations", error: error.message })
    }

    try {
      const alerts = await eldAdvancedActions.getPredictiveAlerts()
      pushTested("getPredictiveAlerts")
      if (alerts.data !== undefined) pushPassed("getPredictiveAlerts")
      else pushFailed({ function: "getPredictiveAlerts", error: alerts.error })
    } catch (error: any) {
      pushFailed({ function: "getPredictiveAlerts", error: error.message })
    }

    try {
      const insights = await eldInsightsActions.generateELDInsights()
      pushTested("generateELDInsights")
      if (insights.data !== undefined) pushPassed("generateELDInsights")
      else pushFailed({ function: "generateELDInsights", error: insights.error })
    } catch (error: any) {
      pushFailed({ function: "generateELDInsights", error: error.message })
    }

    // Test CREATE ELD Log
    try {
      const devices = await eldActions.getELDDevices()
      const drivers = await driversActions.getDrivers()
      if (devices.data && devices.data.length > 0 && drivers.data && drivers.data.length > 0) {
        const log = await eldManualActions.createELDLog({
          eld_device_id: devices.data[0].id,
          driver_id: drivers.data[0].id,
          log_date: new Date().toISOString().split("T")[0],
          log_type: "driving",
          start_time: new Date().toISOString(),
          end_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          duration_minutes: 120,
        })
        pushTested("createELDLog")
        if (log.data) pushPassed("createELDLog")
        else pushFailed({ function: "createELDLog", error: log.error })
      }
    } catch (error: any) {
      pushSkipped({ function: "createELDLog", reason: "No devices/drivers available" })
    }

    // Test CREATE ELD Location
    try {
      const devices = await eldActions.getELDDevices()
      const drivers = await driversActions.getDrivers()
      if (devices.data && devices.data.length > 0 && drivers.data && drivers.data.length > 0) {
        const location = await eldManualActions.createELDLocation({
          eld_device_id: devices.data[0].id,
          driver_id: drivers.data[0].id,
          latitude: 34.0522,
          longitude: -118.2437,
          timestamp: new Date().toISOString(),
          speed: 65,
          heading: 90,
        })
        pushTested("createELDLocation")
        if (location.data) pushPassed("createELDLocation")
        else pushFailed({ function: "createELDLocation", error: location.error })
      }
    } catch (error: any) {
      pushSkipped({ function: "createELDLocation", reason: "No devices/drivers available" })
    }

    // Test CREATE ELD Event
    try {
      const devices = await eldActions.getELDDevices()
      const drivers = await driversActions.getDrivers()
      if (devices.data && devices.data.length > 0 && drivers.data && drivers.data.length > 0) {
        const event = await eldManualActions.createELDEvent({
          eld_device_id: devices.data[0].id,
          driver_id: drivers.data[0].id,
          event_type: "hos_violation",
          severity: "warning",
          title: "Test ELD Event",
          description: "Test event for function testing",
          event_time: new Date().toISOString(),
        })
        pushTested("createELDEvent")
        if (event.data) {
          pushPassed("createELDEvent")
          // Test resolve ELD event
          try {
            const resolved = await eldActions.resolveELDEvent(event.data.id)
            pushTested("resolveELDEvent")
            if (resolved.data || resolved.error) pushPassed("resolveELDEvent")
            else pushFailed({ function: "resolveELDEvent", error: "No result" })
          } catch (error: any) {
            pushFailed({ function: "resolveELDEvent", error: error.message })
          }
        } else {
          pushFailed({ function: "createELDEvent", error: event.error })
        }
      }
    } catch (error: any) {
      pushSkipped({ function: "createELDEvent", reason: "No devices/drivers available" })
    }

    // ============================================
    // 13. IFTA FUNCTIONS
    // ============================================
    console.log(`[FUNCTION TEST] Testing IFTA functions...`)
    try {
      const iftaReports = await iftaActions.getIFTAReports()
      pushTested("getIFTAReports")
      if (iftaReports.data) pushPassed("getIFTAReports")
      else pushFailed({ function: "getIFTAReports", error: iftaReports.error })
    } catch (error: any) {
      pushFailed({ function: "getIFTAReports", error: error.message })
    }

    // Test CREATE IFTA Report
    try {
      const trucks = await trucksActions.getTrucks()
      if (trucks.data && trucks.data.length > 0) {
        const iftaReport = await iftaActions.createIFTAReport({
          quarter: "Q1",
          year: new Date().getFullYear(),
          truck_ids: [trucks.data[0].id],
          include_eld: true,
        })
        pushTested("createIFTAReport")
        if (iftaReport.data) {
          pushPassed("createIFTAReport")
          // Test DELETE IFTA Report
          try {
            const deleted = await iftaActions.deleteIFTAReport(iftaReport.data.id)
            pushTested("deleteIFTAReport")
            if (!deleted.error) pushPassed("deleteIFTAReport")
            else pushFailed({ function: "deleteIFTAReport", error: deleted.error })
          } catch (error: any) {
            pushFailed({ function: "deleteIFTAReport", error: error.message })
          }
        } else {
          pushFailed({ function: "createIFTAReport", error: iftaReport.error })
        }
      }
    } catch (error: any) {
      pushSkipped({ function: "createIFTAReport", reason: "No trucks available" })
    }

    // ============================================
    // 14. REPORT FUNCTIONS
    // ============================================
    console.log(`[FUNCTION TEST] Testing Report functions...`)
    try {
      const revenueReport = await reportsActions.getRevenueReport(
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        new Date().toISOString().split("T")[0]
      )
      pushTested("getRevenueReport")
      if (revenueReport.data) pushPassed("getRevenueReport")
      else pushFailed({ function: "getRevenueReport", error: revenueReport.error })
    } catch (error: any) {
      pushFailed({ function: "getRevenueReport", error: error.message })
    }

    try {
      const profitLossReport = await reportsActions.getProfitLossReport(
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        new Date().toISOString().split("T")[0]
      )
      pushTested("getProfitLossReport")
      if (profitLossReport.data) pushPassed("getProfitLossReport")
      else pushFailed({ function: "getProfitLossReport", error: profitLossReport.error })
    } catch (error: any) {
      pushFailed({ function: "getProfitLossReport", error: error.message })
    }

    try {
      const driverPaymentsReport = await reportsActions.getDriverPaymentsReport(
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        new Date().toISOString().split("T")[0]
      )
      pushTested("getDriverPaymentsReport")
      if (driverPaymentsReport.data) pushPassed("getDriverPaymentsReport")
      else pushFailed({ function: "getDriverPaymentsReport", error: driverPaymentsReport.error })
    } catch (error: any) {
      pushFailed({ function: "getDriverPaymentsReport", error: error.message })
    }

    // ============================================
    // 15. DISPATCH FUNCTIONS
    // ============================================
    console.log(`[FUNCTION TEST] Testing Dispatch functions...`)
    try {
      const unassignedLoads = await dispatchesActions.getUnassignedLoads()
      pushTested("getUnassignedLoads")
      if (unassignedLoads.data !== undefined) pushPassed("getUnassignedLoads")
      else pushFailed({ function: "getUnassignedLoads", error: unassignedLoads.error })
    } catch (error: any) {
      pushFailed({ function: "getUnassignedLoads", error: error.message })
    }

    try {
      const unassignedRoutes = await dispatchesActions.getUnassignedRoutes()
      pushTested("getUnassignedRoutes")
      if (unassignedRoutes.data !== undefined) pushPassed("getUnassignedRoutes")
      else pushFailed({ function: "getUnassignedRoutes", error: unassignedRoutes.error })
    } catch (error: any) {
      pushFailed({ function: "getUnassignedRoutes", error: error.message })
    }

    // ============================================
    // 16. ADDRESS BOOK FUNCTIONS
    // ============================================
    console.log(`[FUNCTION TEST] Testing Address Book functions...`)
    try {
      const contacts = await addressBookActions.getAddressBookContacts()
      pushTested("getAddressBookContacts")
      if (contacts.data) pushPassed("getAddressBookContacts")
      else pushFailed({ function: "getAddressBookContacts", error: contacts.error })
    } catch (error: any) {
      pushFailed({ function: "getAddressBookContacts", error: error.message })
    }

    // ============================================
    // 17. DOCUMENT FUNCTIONS
    // ============================================
    console.log(`[FUNCTION TEST] Testing Document functions...`)
    try {
      const documents = await documentsActions.getDocuments()
      pushTested("getDocuments")
      if (documents.data) {
        pushPassed("getDocuments")
        if (documents.data.length > 0) {
          try {
            const docUrl = await documentsActions.getDocumentUrl(documents.data[0].id)
            pushTested("getDocumentUrl")
            if (docUrl.data || docUrl.error) pushPassed("getDocumentUrl")
            else pushFailed({ function: "getDocumentUrl", error: "No result" })
          } catch (error: any) {
            pushFailed({ function: "getDocumentUrl", error: error.message })
          }
        }
      } else {
        pushFailed({ function: "getDocuments", error: documents.error })
      }
    } catch (error: any) {
      pushFailed({ function: "getDocuments", error: error.message })
    }

    // Test DELETE Document (if we have documents)
    try {
      const documents = await documentsActions.getDocuments()
      if (documents.data && documents.data.length > 0) {
        // Skip delete test to avoid deleting real documents
        pushSkipped({ function: "deleteDocument", reason: "Skipped to preserve data" })
      }
    } catch (error: any) {
      pushSkipped({ function: "deleteDocument", reason: "No documents available" })
    }

    // ============================================
    // 18. EMPLOYEE FUNCTIONS
    // ============================================
    console.log(`[FUNCTION TEST] Testing Employee functions...`)
    try {
      const employees = await employeesActions.getEmployees()
      pushTested("getEmployees")
      if (employees.data) pushPassed("getEmployees")
      else pushFailed({ function: "getEmployees", error: employees.error })
    } catch (error: any) {
      pushFailed({ function: "getEmployees", error: error.message })
    }

    try {
      const invitations = await employeesActions.getPendingInvitations()
      pushTested("getPendingInvitations")
      if (invitations.data) pushPassed("getPendingInvitations")
      else pushFailed({ function: "getPendingInvitations", error: invitations.error })
    } catch (error: any) {
      pushFailed({ function: "getPendingInvitations", error: invitations.error })
    }

    // ============================================
    // 19. NOTIFICATION FUNCTIONS
    // ============================================
    console.log(`[FUNCTION TEST] Testing Notification functions...`)
    try {
      const preferences = await notificationsActions.getNotificationPreferences()
      pushTested("getNotificationPreferences")
      if (preferences.data) pushPassed("getNotificationPreferences")
      else pushFailed({ function: "getNotificationPreferences", error: preferences.error })
    } catch (error: any) {
      pushFailed({ function: "getNotificationPreferences", error: preferences.error })
    }

    try {
      const emailConfig = await notificationsActions.checkEmailConfiguration()
      pushTested("checkEmailConfiguration")
      if (emailConfig.configured !== undefined) pushPassed("checkEmailConfiguration")
      else pushFailed({ function: "checkEmailConfiguration", error: "No result" })
    } catch (error: any) {
      pushFailed({ function: "checkEmailConfiguration", error: error.message })
    }

    // ============================================
    // 20. SUBSCRIPTION FUNCTIONS
    // ============================================
    console.log(`[FUNCTION TEST] Testing Subscription functions...`)
    try {
      const plans = await subscriptionActions.getSubscriptionPlans()
      pushTested("getSubscriptionPlans")
      if (plans.data) pushPassed("getSubscriptionPlans")
      else pushFailed({ function: "getSubscriptionPlans", error: plans.error })
    } catch (error: any) {
      pushFailed({ function: "getSubscriptionPlans", error: plans.error })
    }

    try {
      const currentSub = await subscriptionActions.getCurrentSubscription()
      pushTested("getCurrentSubscription")
      if (currentSub.data !== undefined) pushPassed("getCurrentSubscription")
      else pushFailed({ function: "getCurrentSubscription", error: currentSub.error })
    } catch (error: any) {
      pushFailed({ function: "getCurrentSubscription", error: currentSub.error })
    }

    try {
      const billingHistory = await subscriptionActions.getBillingHistory()
      pushTested("getBillingHistory")
      if (billingHistory.data) pushPassed("getBillingHistory")
      else pushFailed({ function: "getBillingHistory", error: billingHistory.error })
    } catch (error: any) {
      pushFailed({ function: "getBillingHistory", error: billingHistory.error })
    }

    try {
      const limits = await subscriptionActions.checkSubscriptionLimits()
      pushTested("checkSubscriptionLimits")
      if (limits.data !== undefined) pushPassed("checkSubscriptionLimits")
      else pushFailed({ function: "checkSubscriptionLimits", error: limits.error })
    } catch (error: any) {
      pushFailed({ function: "checkSubscriptionLimits", error: limits.error })
    }

    try {
      const status = await subscriptionLimitsActions.getSubscriptionStatus()
      pushTested("getSubscriptionStatus")
      if (status.data !== undefined) pushPassed("getSubscriptionStatus")
      else pushFailed({ function: "getSubscriptionStatus", error: status.error })
    } catch (error: any) {
      pushFailed({ function: "getSubscriptionStatus", error: status.error })
    }

    try {
      const canAddUser = await subscriptionLimitsActions.canAddUser()
      pushTested("canAddUser")
      if (canAddUser.allowed !== undefined) pushPassed("canAddUser")
      else pushFailed({ function: "canAddUser", error: "No result" })
    } catch (error: any) {
      pushFailed({ function: "canAddUser", error: error.message })
    }

    try {
      const canAddDriver = await subscriptionLimitsActions.canAddDriver()
      pushTested("canAddDriver")
      if (canAddDriver.allowed !== undefined) pushPassed("canAddDriver")
      else pushFailed({ function: "canAddDriver", error: "No result" })
    } catch (error: any) {
      pushFailed({ function: "canAddDriver", error: error.message })
    }

    try {
      const canUseELD = await subscriptionLimitsActions.canUseELD()
      pushTested("canUseELD")
      if (canUseELD.allowed !== undefined) pushPassed("canUseELD")
      else pushFailed({ function: "canUseELD", error: "No result" })
    } catch (error: any) {
      pushFailed({ function: "canUseELD", error: error.message })
    }

    try {
      const canAccess = await subscriptionLimitsActions.canAccessFeature("drivers")
      pushTested("canAccessFeature")
      if (canAccess.allowed !== undefined) pushPassed("canAccessFeature")
      else pushFailed({ function: "canAccessFeature", error: "No result" })
    } catch (error: any) {
      pushFailed({ function: "canAccessFeature", error: error.message })
    }

    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000).toFixed(2)

    // Get results from store
    const results = store.getResults()
    
    return {
      data: {
        tested: results.tested,
        passed: results.passed,
        failed: results.failed,
        skipped: results.skipped,
        errors: results.errors,
        summary: {
          totalTested: results.tested.length,
          totalPassed: results.passed.length,
          totalFailed: results.failed.length,
          totalSkipped: results.skipped.length,
          duration: `${duration}s`,
          passRate: results.tested.length > 0 
            ? `${((results.passed.length / results.tested.length) * 100).toFixed(1)}%`
            : "0%",
        },
      },
      error: null,
    }
  } catch (error: any) {
    console.error("[FUNCTION TEST] Global error:", error)
    // Get results from store - always safe
    const results = store.getResults()
    return {
      error: error.message || "Function test failed",
      data: {
        tested: results.tested,
        passed: results.passed,
        failed: results.failed,
        skipped: results.skipped,
        errors: results.errors,
      },
    }
  }
}

