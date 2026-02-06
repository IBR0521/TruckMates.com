/**
 * 123Loadboard API Client
 * 
 * API Documentation: Check 123Loadboard developer portal
 * Base URL: https://api.123loadboard.com/v1 (or check latest docs)
 * 
 * Authentication: API Key + Username/Password
 */

interface Loadboard123Credentials {
  api_key: string
  username: string
  password: string
}

interface Loadboard123Load {
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

export class Loadboard123Client {
  private apiKey: string
  private username: string
  private password: string
  private baseUrl: string = "https://api.123loadboard.com/v1" // Update with actual base URL
  private accessToken: string | null = null
  private tokenExpiresAt: number = 0

  constructor(credentials: Loadboard123Credentials) {
    this.apiKey = credentials.api_key
    this.username = credentials.username
    this.password = credentials.password
  }

  /**
   * Authenticate with 123Loadboard API
   */
  private async authenticate(): Promise<{ success: boolean; error?: string }> {
    try {
      // TODO: Implement actual authentication
      // 123Loadboard typically uses API Key + Username/Password
      
      const response = await fetch(`${this.baseUrl}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": this.apiKey,
        },
        body: JSON.stringify({
          username: this.username,
          password: this.password,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        return { success: false, error: `Authentication failed: ${error}` }
      }

      const data = await response.json()
      this.accessToken = data.token || data.access_token
      this.tokenExpiresAt = Date.now() + ((data.expires_in || 3600) * 1000)

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
   * Test connection to 123Loadboard API
   */
  async testConnection(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const authResult = await this.authenticate()
      if (!authResult.success) {
        return { success: false, error: authResult.error }
      }

      // Test by making a simple API call
      // TODO: Update with actual 123Loadboard API endpoint for testing
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
  }): Promise<{ data: Loadboard123Load[] | null; error: string | null }> {
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

      // TODO: Update with actual 123Loadboard API endpoint
      const response = await fetch(`${this.baseUrl}/loads?${params.toString()}`, {
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
      
      // TODO: Parse 123Loadboard response format
      const loads = data.data || data.loads || data.results || []

      return { data: loads, error: null }
    } catch (error: any) {
      return { data: null, error: error.message || "Failed to search loads" }
    }
  }

  /**
   * Get single load details
   */
  async getLoadDetails(loadId: string): Promise<{ data: Loadboard123Load | null; error: string | null }> {
    try {
      const authHeader = await this.getAuthHeader()

      // TODO: Update with actual 123Loadboard API endpoint
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
   * Transform 123Loadboard load format to internal format
   */
  transformLoad(loadboard123Load: Loadboard123Load, integrationId: string, companyId: string): any {
    return {
      integration_id: integrationId,
      company_id: companyId,
      external_load_id: loadboard123Load.id,
      external_board: "123loadboard",
      external_url: loadboard123Load.url || `https://www.123loadboard.com/loads/${loadboard123Load.id}`,
      origin: `${loadboard123Load.origin.city}, ${loadboard123Load.origin.state}${loadboard123Load.origin.zip ? ` ${loadboard123Load.origin.zip}` : ""}`,
      destination: `${loadboard123Load.destination.city}, ${loadboard123Load.destination.state}${loadboard123Load.destination.zip ? ` ${loadboard123Load.destination.zip}` : ""}`,
      rate: loadboard123Load.rate || null,
      rate_type: loadboard123Load.rate_type || "flat",
      equipment_type: loadboard123Load.equipment_type || null,
      weight_lbs: loadboard123Load.weight || null,
      weight_kg: loadboard123Load.weight ? Math.round(loadboard123Load.weight * 0.453592) : null,
      pickup_date: loadboard123Load.pickup_date || null,
      delivery_date: loadboard123Load.delivery_date || null,
      distance_miles: loadboard123Load.distance || null,
      broker_name: loadboard123Load.broker?.name || null,
      broker_mc_number: loadboard123Load.broker?.mc_number || null,
      broker_rating: loadboard123Load.broker?.rating || null,
      load_description: loadboard123Load.description || null,
      special_requirements: loadboard123Load.special_requirements || null,
      contact_name: loadboard123Load.contact?.name || null,
      contact_phone: loadboard123Load.contact?.phone || null,
      contact_email: loadboard123Load.contact?.email || null,
      status: "available",
      expires_at: loadboard123Load.expires_at || null,
      raw_data: loadboard123Load,
    }
  }
}

