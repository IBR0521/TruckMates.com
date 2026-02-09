/**
 * DAT (DAT One / DAT Power) API Client
 * 
 * API Documentation: https://developer.dat.com/
 * Base URL: https://api.dat.com/v1 (or check latest docs)
 * 
 * Authentication: OAuth 2.0 with API Key + Secret
 */

interface DATCredentials {
  api_key: string
  api_secret: string
  username?: string
  password?: string
  subscription_tier?: string
}

interface DATLoad {
  id: string
  origin: {
    city: string
    state: string
    zip?: string
  }
  destination: {
    city: string
    state: string
    zip?: string
  }
  rate?: number
  rate_type?: string
  equipment_type?: string
  weight?: number
  pickup_date?: string
  delivery_date?: string
  distance?: number
  broker?: {
    name: string
    mc_number?: string
    rating?: number
    days_to_pay?: number
  }
  description?: string
  special_requirements?: string
  contact?: {
    name?: string
    phone?: string
    email?: string
  }
  url?: string
  expires_at?: string
}

export class DATClient {
  private apiKey: string
  private apiSecret: string
  private baseUrl: string = "https://api.dat.com/v1" // Update with actual base URL
  private accessToken: string | null = null
  private tokenExpiresAt: number = 0

  constructor(credentials: DATCredentials) {
    this.apiKey = credentials.api_key
    this.apiSecret = credentials.api_secret
  }

  /**
   * Authenticate with DAT API using OAuth 2.0
   */
  private async authenticate(): Promise<{ success: boolean; error?: string }> {
    try {
      // TODO: Implement actual OAuth 2.0 flow
      // This typically involves:
      // 1. Request access token using client credentials grant
      // 2. Store token and expiration time
      // 3. Refresh token when expired
      
      // Example structure (update with actual DAT OAuth endpoint):
      const response = await fetch(`${this.baseUrl}/oauth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: this.apiKey,
          client_secret: this.apiSecret,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        return { success: false, error: `Authentication failed: ${error}` }
      }

      const data = await response.json()
      this.accessToken = data.access_token
      this.tokenExpiresAt = Date.now() + (data.expires_in * 1000)

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message || "Authentication error" }
    }
  }

  /**
   * Get authorization header
   */
  private async getAuthHeader(): Promise<string> {
    // Refresh token if expired
    if (!this.accessToken || Date.now() >= this.tokenExpiresAt) {
      const authResult = await this.authenticate()
      if (!authResult.success) {
        throw new Error(authResult.error || "Authentication failed")
      }
    }

    return `Bearer ${this.accessToken}`
  }

  /**
   * Test connection to DAT API
   */
  async testConnection(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const authResult = await this.authenticate()
      if (!authResult.success) {
        return { success: false, error: authResult.error }
      }

      // Test by making a simple API call (e.g., get account info or search with limit 1)
      // TODO: Update with actual DAT API endpoint for testing
      const authHeader = await this.getAuthHeader()
      const response = await fetch(`${this.baseUrl}/account`, {
        method: "GET",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const error = await response.text()
        return { success: false, error: `Connection test failed: ${error}` }
      }

      return { success: true, message: "Connection successful" }
    } catch (error: any) {
      return { success: false, error: error.message || "Connection test error" }
    }
  }

  /**
   * Search for loads
   */
  async searchLoads(filters?: {
    origin?: string
    destination?: string
    equipment_type?: string
    min_rate?: number
    max_rate?: number
    limit?: number
    offset?: number
  }): Promise<{ data: DATLoad[] | null; error: string | null }> {
    try {
      const authHeader = await this.getAuthHeader()

      // Build query parameters
      const params = new URLSearchParams()
      if (filters?.origin) params.append("origin", filters.origin)
      if (filters?.destination) params.append("destination", filters.destination)
      if (filters?.equipment_type) params.append("equipment_type", filters.equipment_type)
      if (filters?.min_rate) params.append("min_rate", filters.min_rate.toString())
      if (filters?.max_rate) params.append("max_rate", filters.max_rate.toString())
      if (filters?.limit) params.append("limit", filters.limit.toString())
      if (filters?.offset) params.append("offset", filters.offset.toString())

      // TODO: Update with actual DAT API endpoint for load search
      // Common endpoints: /loads/search, /loads, /postings/search
      const response = await fetch(`${this.baseUrl}/loads/search?${params.toString()}`, {
        method: "GET",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const error = await response.text()
        return { data: null, error: `Failed to search loads: ${error}` }
      }

      const data = await response.json()
      
      // TODO: Parse DAT response format
      // DAT typically returns: { data: [...], pagination: {...} }
      const loads = data.data || data.loads || data.results || []

      return { data: loads, error: null }
    } catch (error: any) {
      return { data: null, error: error.message || "Failed to search loads" }
    }
  }

  /**
   * Get single load details
   */
  async getLoadDetails(loadId: string): Promise<{ data: DATLoad | null; error: string | null }> {
    try {
      const authHeader = await this.getAuthHeader()

      // TODO: Update with actual DAT API endpoint
      const response = await fetch(`${this.baseUrl}/loads/${loadId}`, {
        method: "GET",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const error = await response.text()
        return { data: null, error: `Failed to get load: ${error}` }
      }

      const data = await response.json()
      return { data: data.data || data, error: null }
    } catch (error: any) {
      return { data: null, error: error.message || "Failed to get load details" }
    }
  }

  /**
   * Transform DAT load format to internal format
   */
  transformLoad(datLoad: DATLoad, integrationId: string, companyId: string): any {
    return {
      integration_id: integrationId,
      company_id: companyId,
      external_load_id: datLoad.id,
      external_board: "dat",
      external_url: datLoad.url || `https://www.dat.com/loads/${datLoad.id}`,
      origin: `${datLoad.origin.city}, ${datLoad.origin.state}${datLoad.origin.zip ? ` ${datLoad.origin.zip}` : ""}`,
      destination: `${datLoad.destination.city}, ${datLoad.destination.state}${datLoad.destination.zip ? ` ${datLoad.destination.zip}` : ""}`,
      rate: datLoad.rate || null,
      rate_type: datLoad.rate_type || "flat",
      equipment_type: datLoad.equipment_type || null,
      weight_lbs: datLoad.weight || null,
      weight_kg: datLoad.weight ? Math.round(datLoad.weight * 0.453592) : null,
      pickup_date: datLoad.pickup_date || null,
      delivery_date: datLoad.delivery_date || null,
      distance_miles: datLoad.distance || null,
      broker_name: datLoad.broker?.name || null,
      broker_mc_number: datLoad.broker?.mc_number || null,
      broker_rating: datLoad.broker?.rating || null,
      broker_days_to_pay: datLoad.broker?.days_to_pay || null,
      load_description: datLoad.description || null,
      special_requirements: datLoad.special_requirements || null,
      contact_name: datLoad.contact?.name || null,
      contact_phone: datLoad.contact?.phone || null,
      contact_email: datLoad.contact?.email || null,
      status: "available",
      expires_at: datLoad.expires_at || null,
      raw_data: datLoad,
    }
  }
}


