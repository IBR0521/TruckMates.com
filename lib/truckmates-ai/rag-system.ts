/**
 * RAG System for TruckMates AI
 * Retrieval-Augmented Generation - combines knowledge base with platform data
 */

import { createClient } from "@/lib/supabase/server"
import { LogisticsKnowledgeBase } from "./logistics-knowledge-base"

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
  private supabase: any
  private knowledgeBase: LogisticsKnowledgeBase

  constructor() {
    this.knowledgeBase = new LogisticsKnowledgeBase()
  }

  /**
   * Initialize Supabase client
   */
  private async getSupabase() {
    if (!this.supabase) {
      this.supabase = await createClient()
    }
    return this.supabase
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
    const supabase = await this.getSupabase()

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
    const supabase = await this.getSupabase()
    
    const { data, error } = await supabase
      .from("loads")
      .select("*")
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
    const supabase = await this.getSupabase()
    
    const { data, error } = await supabase
      .from("drivers")
      .select("*")
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
    const supabase = await this.getSupabase()
    
    const { data, error } = await supabase
      .from("trucks")
      .select("*")
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
    const supabase = await this.getSupabase()
    
    const { data, error } = await supabase
      .from("routes")
      .select("*")
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
    const supabase = await this.getSupabase()

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


