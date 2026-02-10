/**
 * Function Registry for TruckMates AI
 * Maps natural language to platform actions
 */

import { TruckMatesInternetAccess } from "./internet-access"

export interface FunctionDefinition {
  name: string
  description: string
  parameters: {
    type: string
    properties: Record<string, any>
    required: string[]
  }
  handler: (args: any) => Promise<any>
}

/**
 * Function Registry
 * Registers all available functions for AI to call
 */
export class TruckMatesFunctionRegistry {
  private functions: Map<string, FunctionDefinition> = new Map()
  private internetAccess: TruckMatesInternetAccess

  constructor() {
    this.internetAccess = new TruckMatesInternetAccess()
    this.registerAllFunctions()
  }

  /**
   * Register all available functions
   */
  private registerAllFunctions() {
    // ========== LOAD MANAGEMENT ==========

    this.register({
      name: "create_load",
      description: "Create a new load/shipment",
      parameters: {
        type: "object",
        properties: {
          shipment_number: { type: "string", description: "Shipment number" },
          origin: { type: "string", description: "Pickup address" },
          destination: { type: "string", description: "Delivery address" },
          weight: { type: "string", description: "Weight in lbs" },
          value: { type: "number", description: "Rate in dollars" },
          pickup_date: { type: "string", description: "Pickup date (YYYY-MM-DD)" },
          estimated_delivery: { type: "string", description: "Estimated delivery date" }
        },
        required: ["shipment_number", "origin", "destination"]
      },
      handler: async (args) => {
        const { createLoad } = await import("@/app/actions/loads")
        return await createLoad(args)
      }
    })

    this.register({
      name: "get_load",
      description: "Get details of a specific load",
      parameters: {
        type: "object",
        properties: {
          load_id: { type: "string", description: "Load ID" }
        },
        required: ["load_id"]
      },
      handler: async (args) => {
        const { getLoad } = await import("@/app/actions/loads")
        return await getLoad(args.load_id)
      }
    })

    this.register({
      name: "update_load",
      description: "Update an existing load",
      parameters: {
        type: "object",
        properties: {
          load_id: { type: "string", description: "Load ID" },
          status: { type: "string", description: "Load status" },
          driver_id: { type: "string", description: "Driver ID" },
          truck_id: { type: "string", description: "Truck ID" }
        },
        required: ["load_id"]
      },
      handler: async (args) => {
        const { updateLoad } = await import("@/app/actions/loads")
        const { load_id, ...updateData } = args
        return await updateLoad(load_id, updateData)
      }
    })

    this.register({
      name: "assign_driver_to_load",
      description: "Assign a driver to a load",
      parameters: {
        type: "object",
        properties: {
          load_id: { type: "string", description: "Load ID" },
          driver_id: { type: "string", description: "Driver ID" }
        },
        required: ["load_id", "driver_id"]
      },
      handler: async (args) => {
        const { updateLoad } = await import("@/app/actions/loads")
        return await updateLoad(args.load_id, { driver_id: args.driver_id })
      }
    })

    // ========== DRIVER MANAGEMENT ==========

    this.register({
      name: "get_driver",
      description: "Get details of a specific driver",
      parameters: {
        type: "object",
        properties: {
          driver_id: { type: "string", description: "Driver ID" }
        },
        required: ["driver_id"]
      },
      handler: async (args) => {
        const { getDriver } = await import("@/app/actions/drivers")
        return await getDriver(args.driver_id)
      }
    })

    this.register({
      name: "get_drivers",
      description: "Get list of drivers with optional filters",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter by status" },
          limit: { type: "number", description: "Maximum number of results" }
        },
        required: []
      },
      handler: async (args) => {
        const { getDrivers } = await import("@/app/actions/drivers")
        return await getDrivers(args)
      }
    })

    // ========== TRUCK MANAGEMENT ==========

    this.register({
      name: "get_truck",
      description: "Get details of a specific truck",
      parameters: {
        type: "object",
        properties: {
          truck_id: { type: "string", description: "Truck ID" }
        },
        required: ["truck_id"]
      },
      handler: async (args) => {
        const { getTruck } = await import("@/app/actions/trucks")
        return await getTruck(args.truck_id)
      }
    })

    this.register({
      name: "get_trucks",
      description: "Get list of trucks with optional filters",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter by status" },
          limit: { type: "number", description: "Maximum number of results" }
        },
        required: []
      },
      handler: async (args) => {
        const { getTrucks } = await import("@/app/actions/trucks")
        return await getTrucks(args)
      }
    })

    // ========== ROUTE MANAGEMENT ==========

    this.register({
      name: "create_route",
      description: "Create a new route",
      parameters: {
        type: "object",
        properties: {
          origin: { type: "string", description: "Origin address" },
          destination: { type: "string", description: "Destination address" },
          distance: { type: "number", description: "Distance in miles" },
          estimated_time: { type: "string", description: "Estimated time" }
        },
        required: ["origin", "destination"]
      },
      handler: async (args) => {
        const { createRoute } = await import("@/app/actions/routes")
        return await createRoute(args)
      }
    })

    this.register({
      name: "optimize_route",
      description: "Optimize a route for multiple stops",
      parameters: {
        type: "object",
        properties: {
          route_id: { type: "string", description: "Route ID" },
          stops: { type: "array", description: "Array of stop addresses" }
        },
        required: ["route_id", "stops"]
      },
      handler: async (args) => {
        const { optimizeRouteOrder } = await import("@/app/actions/route-optimization")
        return await optimizeRouteOrder(args.stops)
      }
    })

    // ========== INVOICE MANAGEMENT ==========

    this.register({
      name: "create_invoice",
      description: "Create an invoice for a load",
      parameters: {
        type: "object",
        properties: {
          load_id: { type: "string", description: "Load ID" },
          customer_id: { type: "string", description: "Customer ID" },
          amount: { type: "number", description: "Invoice amount" }
        },
        required: ["load_id"]
      },
      handler: async (args) => {
        const { createInvoice } = await import("@/app/actions/accounting")
        return await createInvoice(args)
      }
    })

    // ========== DFM MATCHING ==========

    this.register({
      name: "find_matching_trucks",
      description: "Find matching trucks for a load using DFM algorithm",
      parameters: {
        type: "object",
        properties: {
          load_id: { type: "string", description: "Load ID" },
          max_results: { type: "number", description: "Maximum number of results" }
        },
        required: ["load_id"]
      },
      handler: async (args) => {
        const { findMatchingTrucksForLoad } = await import("@/app/actions/dfm-matching")
        return await findMatchingTrucksForLoad(args.load_id, args.max_results || 5)
      }
    })

    this.register({
      name: "find_matching_loads",
      description: "Find matching loads for a truck using DFM algorithm",
      parameters: {
        type: "object",
        properties: {
          truck_id: { type: "string", description: "Truck ID" },
          max_results: { type: "number", description: "Maximum number of results" }
        },
        required: ["truck_id"]
      },
      handler: async (args) => {
        const { findMatchingLoadsForTruck } = await import("@/app/actions/dfm-matching")
        return await findMatchingLoadsForTruck(args.truck_id, args.max_results || 10)
      }
    })

    // ========== RATE ANALYSIS ==========

    this.register({
      name: "get_market_rate",
      description: "Get market rate suggestion for a lane",
      parameters: {
        type: "object",
        properties: {
          origin: { type: "string", description: "Origin address" },
          destination: { type: "string", description: "Destination address" },
          equipment_type: { type: "string", description: "Equipment type" }
        },
        required: ["origin", "destination"]
      },
      handler: async (args) => {
        const { getMarketRateSuggestion } = await import("@/app/actions/rate-analysis")
        return await getMarketRateSuggestion(
          args.origin,
          args.destination,
          args.equipment_type || 'dry_van'
        )
      }
    })

    // ========== INTERNET ACCESS FUNCTIONS ==========

    this.register({
      name: "search_web",
      description: "Search the internet for information. Use this when you need current data, news, or information not in TruckMates database.",
      parameters: {
        type: "object",
        properties: {
          query: { 
            type: "string", 
            description: "Search query (e.g., 'current diesel fuel prices Chicago', 'trucking industry news', 'weather forecast Dallas')" 
          },
          max_results: { 
            type: "number", 
            description: "Maximum number of results (default: 5)" 
          }
        },
        required: ["query"]
      },
      handler: async (args) => {
        return await this.internetAccess.searchWeb(
          args.query,
          args.max_results || 5
        )
      }
    })

    this.register({
      name: "get_fuel_prices",
      description: "Get current diesel fuel prices for a location. Uses internet data for real-time prices.",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "City or location name" },
          state: { type: "string", description: "State code (optional)" }
        },
        required: ["location"]
      },
      handler: async (args) => {
        return await this.internetAccess.getFuelPrices(args.location, args.state)
      }
    })

    this.register({
      name: "get_weather",
      description: "Get current weather conditions for a location. Useful for route planning and driver safety.",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "City or location name" }
        },
        required: ["location"]
      },
      handler: async (args) => {
        return await this.internetAccess.getWeather(args.location)
      }
    })

    this.register({
      name: "get_traffic_conditions",
      description: "Get real-time traffic conditions for a route. Helps with ETA calculations and route optimization.",
      parameters: {
        type: "object",
        properties: {
          origin: { type: "string", description: "Origin address" },
          destination: { type: "string", description: "Destination address" }
        },
        required: ["origin", "destination"]
      },
      handler: async (args) => {
        return await this.internetAccess.getTrafficConditions(args.origin, args.destination)
      }
    })

    this.register({
      name: "get_market_rates_web",
      description: "Get current market freight rates from internet sources. Combines with TruckMates internal rate data.",
      parameters: {
        type: "object",
        properties: {
          origin: { type: "string", description: "Origin city/address" },
          destination: { type: "string", description: "Destination city/address" },
          equipment_type: { type: "string", description: "Equipment type (dry_van, flatbed, etc.)" }
        },
        required: ["origin", "destination"]
      },
      handler: async (args) => {
        return await this.internetAccess.getMarketRateFromWeb(
          args.origin,
          args.destination,
          args.equipment_type || 'dry_van'
        )
      }
    })

    // ========== HYBRID FUNCTIONS (Internal + Internet) ==========

    this.register({
      name: "create_load_with_market_check",
      description: "Create a load and automatically check current market rates from internet to suggest optimal pricing.",
      parameters: {
        type: "object",
        properties: {
          shipment_number: { type: "string" },
          origin: { type: "string" },
          destination: { type: "string" },
          weight: { type: "number" },
          proposed_rate: { type: "number", description: "Your proposed rate" }
        },
        required: ["shipment_number", "origin", "destination"]
      },
      handler: async (args) => {
        // Step 1: Get market rate from internet
        const marketRate = await this.internetAccess.getMarketRateFromWeb(
          args.origin,
          args.destination
        )
        
        // Step 2: Create load
        const { createLoad } = await import("@/app/actions/loads")
        const loadResult = await createLoad({
          shipment_number: args.shipment_number,
          origin: args.origin,
          destination: args.destination,
          weight: args.weight?.toString(),
          value: args.proposed_rate
        })
        
        return {
          load: loadResult,
          market_rate_suggestion: marketRate.data,
          recommendation: args.proposed_rate && marketRate.data
            ? (args.proposed_rate < (marketRate.data.rate || 0) * 0.9 
                ? "Your rate is below market average. Consider increasing."
                : "Your rate is competitive with market rates")
            : null
        }
      }
    })

    // Add more functions as needed...
  }

  register(func: FunctionDefinition) {
    this.functions.set(func.name, func)
  }

  getFunction(name: string): FunctionDefinition | undefined {
    return this.functions.get(name)
  }

  getAllFunctions(): FunctionDefinition[] {
    return Array.from(this.functions.values())
  }

  /**
   * Get function definitions in format suitable for LLM
   */
  getFunctionDefinitions(): Array<{
    name: string
    description: string
    parameters: any
  }> {
    return this.getAllFunctions().map(func => ({
      name: func.name,
      description: func.description,
      parameters: func.parameters
    }))
  }
}


