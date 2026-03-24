/**
 * RAG System for TruckMates AI
 * Retrieval-Augmented Generation - combines knowledge base with platform data
 */

import { createClient } from "@/lib/supabase/server"
import { LogisticsKnowledgeBase } from "./logistics-knowledge-base"

const RAG_LOAD_SELECT =
  "id, company_id, shipment_number, origin, destination, weight, weight_kg, contents, value, carrier_type, status, driver_id, truck_id, route_id, load_date, estimated_delivery, actual_delivery, coordinates, priority, urgency_score, created_at, updated_at"
const RAG_DRIVER_SELECT =
  "id, user_id, company_id, name, email, phone, license_number, license_expiry, status, truck_id, created_at, updated_at"
const RAG_TRUCK_SELECT =
  "id, company_id, truck_number, make, model, year, vin, license_plate, status, current_driver_id, current_location, fuel_level, mileage, height, serial_number, gross_vehicle_weight, license_expiry_date, inspection_date, insurance_provider, insurance_policy_number, insurance_expiry_date, owner_name, cost, color, documents, created_at, updated_at"
const RAG_ROUTE_SELECT =
  "id, company_id, name, origin, destination, distance, estimated_time, priority, driver_id, truck_id, status, waypoints, estimated_arrival, route_start_time, route_departure_time, created_at, updated_at"

export interface RAGContext {
  loads: any[]
  drivers: any[]
  trucks: any[]
  routes: any[]
  knowledgeBase: any[]
}

/**
 * RAG System
 * Retrieves relevant context from knowledge base and platform data
 */
export class TruckMatesRAG {
  private knowledgeBase: LogisticsKnowledgeBase

  constructor() {
    this.knowledgeBase = new LogisticsKnowledgeBase()
  }

  /**
   * Retrieve relevant context for user query
   */
  async retrieveContext(
    query: string,
    userId: string,
    companyId: string,
    maxResults: number = 5
  ): Promise<RAGContext> {
    // Create fresh Supabase client per request to avoid cross-user data leaks
    const supabase = await createClient()

    // Step 1: Search logistics knowledge base
    const knowledgeResults = this.knowledgeBase.search(query)

    // Step 2: Search platform data (loads, drivers, trucks, routes)
    const [loads, drivers, trucks, routes] = await Promise.all([
      this.searchLoads(query, companyId, maxResults),
      this.searchDrivers(query, companyId, maxResults),
      this.searchTrucks(query, companyId, maxResults),
      this.searchRoutes(query, companyId, maxResults)
    ])

    // Step 3: Search vector database (if available)
    let vectorResults: any[] = []
    try {
      vectorResults = await this.vectorSearch(query, companyId, maxResults)
    } catch (error) {
      // Vector search not available, use knowledge base search instead
      console.warn("Vector search not available, using knowledge base search")
    }

    return {
      loads: loads.slice(0, maxResults),
      drivers: drivers.slice(0, maxResults),
      trucks: trucks.slice(0, maxResults),
      routes: routes.slice(0, maxResults),
      knowledgeBase: [...knowledgeResults, ...vectorResults].slice(0, maxResults * 2)
    }
  }

  /**
   * Search loads by keyword
   */
  private async searchLoads(
    query: string,
    companyId: string,
    limit: number
  ): Promise<any[]> {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from("loads")
      .select(RAG_LOAD_SELECT)
      .eq("company_id", companyId)
      .or(`shipment_number.ilike.%${query}%,origin.ilike.%${query}%,destination.ilike.%${query}%,status.ilike.%${query}%`)
      .limit(limit)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error searching loads:", error)
      return []
    }

    return data || []
  }

  /**
   * Search drivers by keyword
   */
  private async searchDrivers(
    query: string,
    companyId: string,
    limit: number
  ): Promise<any[]> {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from("drivers")
      .select(RAG_DRIVER_SELECT)
      .eq("company_id", companyId)
      .or(`name.ilike.%${query}%,license_number.ilike.%${query}%,status.ilike.%${query}%`)
      .limit(limit)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error searching drivers:", error)
      return []
    }

    return data || []
  }

  /**
   * Search trucks by keyword
   */
  private async searchTrucks(
    query: string,
    companyId: string,
    limit: number
  ): Promise<any[]> {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from("trucks")
      .select(RAG_TRUCK_SELECT)
      .eq("company_id", companyId)
      .or(`truck_number.ilike.%${query}%,make.ilike.%${query}%,model.ilike.%${query}%,status.ilike.%${query}%,current_location.ilike.%${query}%`)
      .limit(limit)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error searching trucks:", error)
      return []
    }

    return data || []
  }

  /**
   * Search routes by keyword
   */
  private async searchRoutes(
    query: string,
    companyId: string,
    limit: number
  ): Promise<any[]> {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from("routes")
      .select(RAG_ROUTE_SELECT)
      .eq("company_id", companyId)
      .or(`name.ilike.%${query}%,origin.ilike.%${query}%,destination.ilike.%${query}%,status.ilike.%${query}%`)
      .limit(limit)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error searching routes:", error)
      return []
    }

    return data || []
  }

  /**
   * Vector search in knowledge base (using pgvector)
   * This requires embeddings to be pre-generated and stored
   */
  private async vectorSearch(
    query: string,
    companyId: string,
    limit: number
  ): Promise<any[]> {
    const supabase = await createClient()

    try {
      // Generate query embedding (using local embedding model)
      const queryEmbedding = await this.generateEmbedding(query)

      // Search using pgvector (if available)
      const { data, error } = await supabase.rpc('match_knowledge_base', {
        query_embedding: queryEmbedding,
        match_threshold: 0.7,
        match_count: limit,
        company_id: companyId
      })

      if (error) {
        // Function might not exist yet, that's okay
        return []
      }

      return data || []
    } catch (error) {
      // Vector search not available
      return []
    }
  }

  /**
   * Generate embedding using local model (nomic-embed-text via Ollama)
   * This is a placeholder - actual implementation would call Ollama embedding API
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434"
      const response = await fetch(`${ollamaUrl}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "nomic-embed-text",
          prompt: text
        })
      })

      if (response.ok) {
        const data = await response.json()
        return data.embedding || []
      }
    } catch (error) {
      console.warn("Embedding generation not available")
    }

    // Fallback: return empty array (vector search won't work)
    return []
  }

  /**
   * Get specific knowledge by ID
   */
  getKnowledge(id: string): any {
    return this.knowledgeBase.getKnowledge(id)
  }

  /**
   * Get KPI benchmark
   */
  getKPIBenchmark(metric: string): any {
    return this.knowledgeBase.getKPIBenchmark(metric)
  }

  /**
   * Get terminology definition
   */
  getTerminology(term: string): any {
    return this.knowledgeBase.getTerminology(term)
  }
}










