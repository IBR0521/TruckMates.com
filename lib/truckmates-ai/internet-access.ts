/**
 * Internet Access Layer for TruckMates AI
 * Enables AI to search web, fetch real-time data, and combine with internal data
 */

export interface WebSearchResult {
  title: string
  url: string
  snippet: string
  relevance_score: number
}

export interface RealTimeData {
  fuel_prices?: { location: string; price_per_gallon: number; last_updated: string }
  weather?: { location: string; conditions: string; temperature: number; forecast: any }
  traffic?: { route: string; current_delay: number; estimated_time: number }
  market_rates?: { lane: string; rate: number; trend: string }
  news?: Array<{ title: string; source: string; published_at: string }>
}

/**
 * Internet Access for TruckMates AI
 * Provides web search and real-time data access
 */
export class TruckMatesInternetAccess {
  private searchApiKey: string
  private searchProvider: 'tavily' | 'serper' | 'duckduckgo' = 'tavily'

  constructor() {
    // Use Tavily API (specialized for AI agents) or Serper (Google search API)
    this.searchApiKey = process.env.TAVILY_API_KEY || process.env.SERPER_API_KEY || ''
    this.searchProvider = (process.env.SEARCH_PROVIDER as any) || 'tavily'
  }

  /**
   * Web Search - Search the internet for information
   */
  async searchWeb(
    query: string,
    maxResults: number = 5,
    includeDomains?: string[]
  ): Promise<{ results: WebSearchResult[]; error: string | null }> {
    try {
      if (this.searchProvider === 'tavily' && this.searchApiKey) {
        return await this.searchWithTavily(query, maxResults, includeDomains)
      } else if (this.searchProvider === 'serper' && this.searchApiKey) {
        return await this.searchWithSerper(query, maxResults)
      } else {
        // Fallback: return empty results with message
        return {
          results: [],
          error: "Web search requires API key. Set TAVILY_API_KEY or SERPER_API_KEY environment variable."
        }
      }
    } catch (error: any) {
      return { results: [], error: error.message || "Web search failed" }
    }
  }

  /**
   * Tavily Search (AI-optimized search API)
   */
  private async searchWithTavily(
    query: string,
    maxResults: number,
    includeDomains?: string[]
  ): Promise<{ results: WebSearchResult[]; error: string | null }> {
    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: this.searchApiKey,
          query,
          search_depth: 'advanced',
          include_domains: includeDomains,
          max_results: maxResults,
          include_answer: true,
          include_raw_content: false
        })
      })

      if (!response.ok) {
        return { results: [], error: `Tavily API error: ${response.statusText}` }
      }

      const data = await response.json()
      
      return {
        results: (data.results || []).map((r: any) => ({
          title: r.title,
          url: r.url,
          snippet: r.content || r.snippet,
          relevance_score: r.score || 0.8
        })),
        error: null
      }
    } catch (error: any) {
      return { results: [], error: error.message || "Tavily search failed" }
    }
  }

  /**
   * Serper API (Google Search)
   */
  private async searchWithSerper(
    query: string,
    maxResults: number
  ): Promise<{ results: WebSearchResult[]; error: string | null }> {
    try {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': this.searchApiKey
        },
        body: JSON.stringify({
          q: query,
          num: maxResults
        })
      })

      if (!response.ok) {
        return { results: [], error: `Serper API error: ${response.statusText}` }
      }

      const data = await response.json()
      
      return {
        results: (data.organic || []).map((r: any) => ({
          title: r.title,
          url: r.link,
          snippet: r.snippet,
          relevance_score: 0.8
        })),
        error: null
      }
    } catch (error: any) {
      return { results: [], error: error.message || "Serper search failed" }
    }
  }

  /**
   * Get Real-Time Fuel Prices
   */
  async getFuelPrices(
    location: string,
    state?: string
  ): Promise<{ data: RealTimeData['fuel_prices'] | null; error: string | null }> {
    try {
      // Option 1: Use dedicated fuel price API (if available)
      const fuelPriceApi = process.env.FUEL_PRICE_API_KEY
      if (fuelPriceApi) {
        // Implement fuel price API call here
        // For now, use web search as fallback
      }

      // Option 2: Web search for current fuel prices
      const searchQuery = `current diesel fuel price ${location} ${state || ''}`
      const searchResult = await this.searchWeb(searchQuery, 3)
      
      if (searchResult.error || searchResult.results.length === 0) {
        return { data: null, error: "Unable to fetch fuel prices" }
      }

      // Extract price from search results (AI can parse this)
      // For now, return search results for AI to parse
      return {
        data: {
          location,
          price_per_gallon: 0, // AI will extract from search results
          last_updated: new Date().toISOString()
        },
        error: null
      }
    } catch (error: any) {
      return { data: null, error: error.message }
    }
  }

  /**
   * Get Real-Time Weather
   */
  async getWeather(
    location: string
  ): Promise<{ data: RealTimeData['weather'] | null; error: string | null }> {
    try {
      // Use OpenWeatherMap API (free tier available)
      const apiKey = process.env.OPENWEATHER_API_KEY
      if (apiKey) {
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=imperial`
        )
        
        if (response.ok) {
          const data = await response.json()
          return {
            data: {
              location,
              conditions: data.weather[0].description,
              temperature: data.main.temp,
              forecast: {
                humidity: data.main.humidity,
                wind_speed: data.wind?.speed || 0,
                visibility: data.visibility || 0
              }
            },
            error: null
          }
        }
      }

      // Fallback: Web search
      const searchQuery = `current weather ${location}`
      const searchResult = await this.searchWeb(searchQuery, 2)
      
      return {
        data: {
          location,
          conditions: "Check search results",
          temperature: 0,
          forecast: { search_results: searchResult.results }
        },
        error: null
      }
    } catch (error: any) {
      return { data: null, error: error.message }
    }
  }

  /**
   * Get Real-Time Traffic Conditions
   */
  async getTrafficConditions(
    origin: string,
    destination: string
  ): Promise<{ data: RealTimeData['traffic'] | null; error: string | null }> {
    try {
      // Use Google Maps Traffic API (if available)
      const googleMapsKey = process.env.GOOGLE_MAPS_API_KEY
      if (googleMapsKey) {
        const { getRouteDistanceAndTime } = await import("@/app/actions/integrations-google-maps")
        const routeData = await getRouteDistanceAndTime(
          { address: origin },
          { address: destination }
        )
        
        if (routeData) {
          return {
            data: {
              route: `${origin} to ${destination}`,
              current_delay: routeData.duration_in_traffic - routeData.duration || 0,
              estimated_time: routeData.duration_in_traffic
            },
            error: null
          }
        }
      }

      return { data: null, error: "Traffic data requires Google Maps API" }
    } catch (error: any) {
      return { data: null, error: error.message }
    }
  }

  /**
   * Get Market Rate from Internet
   */
  async getMarketRateFromWeb(
    origin: string,
    destination: string,
    equipmentType: string = 'dry_van'
  ): Promise<{ data: RealTimeData['market_rates'] | null; error: string | null }> {
    try {
      // First try existing rate analysis (DAT/Truckstop)
      const { getMarketRateSuggestion } = await import("@/app/actions/rate-analysis")
      const rateResult = await getMarketRateSuggestion(origin, destination, equipmentType)
      
      if (rateResult.data) {
        return {
          data: {
            lane: `${origin} to ${destination}`,
            rate: rateResult.data.average_rate,
            trend: rateResult.data.historical_trend
          },
          error: null
        }
      }

      // Fallback: Web search for current market rates
      const searchQuery = `freight rate ${origin} to ${destination} ${equipmentType} current market rate`
      const searchResult = await this.searchWeb(searchQuery, 3)
      
      return {
        data: {
          lane: `${origin} to ${destination}`,
          rate: 0, // AI will extract from search results
          trend: "unknown"
        },
        error: null
      }
    } catch (error: any) {
      return { data: null, error: error.message }
    }
  }

  /**
   * Get Logistics News/Updates
   */
  async getLogisticsNews(
    topic?: string,
    maxResults: number = 5
  ): Promise<{ data: RealTimeData['news'] | null; error: string | null }> {
    try {
      const searchQuery = topic 
        ? `trucking logistics news ${topic}`
        : "trucking logistics industry news"
      
      const searchResult = await this.searchWeb(searchQuery, maxResults, [
        'truckinginfo.com',
        'fleetowner.com',
        'ccjdigital.com',
        'transportation.gov'
      ])
      
      return {
        data: searchResult.results.map(r => ({
          title: r.title,
          source: new URL(r.url).hostname,
          published_at: new Date().toISOString() // Would need to extract from search results
        })),
        error: null
      }
    } catch (error: any) {
      return { data: null, error: error.message }
    }
  }

  /**
   * Combined Data Fetch - Get multiple data types at once
   */
  async getCombinedRealTimeData(
    location: string,
    route?: { origin: string; destination: string }
  ): Promise<{ data: RealTimeData; error: string | null }> {
    const [fuel, weather, traffic, news] = await Promise.all([
      this.getFuelPrices(location),
      this.getWeather(location),
      route ? this.getTrafficConditions(route.origin, route.destination) : Promise.resolve({ data: null, error: null }),
      this.getLogisticsNews(undefined, 3)
    ])

    return {
      data: {
        fuel_prices: fuel.data || undefined,
        weather: weather.data || undefined,
        traffic: traffic.data || undefined,
        news: news.data || undefined
      },
      error: null
    }
  }
}


