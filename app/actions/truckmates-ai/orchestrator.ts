"use server"

/**
 * TruckMates AI Orchestrator
 * Main entry point for AI requests - coordinates all layers
 */

import { TruckMatesAIEngine } from "@/lib/truckmates-ai/llm-engine"
import { TruckMatesRAG } from "@/lib/truckmates-ai/rag-system"
import { TruckMatesFunctionRegistry } from "@/lib/truckmates-ai/function-registry"
import { TruckMatesInternetAccess } from "@/lib/truckmates-ai/internet-access"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthContext } from "@/lib/auth/server"

export interface AIRequest {
  message: string
  conversationHistory?: Array<{ role: string; content: string }>
  context?: {
    currentPage?: string
    userId?: string
    companyId?: string
  }
}

export interface AIResponse {
  response: string
  actions?: Array<{ function: string; result: any; error?: string }>
  internetData?: any
  confidence: number
  error: string | null
}

/**
 * Process AI Request
 * Main orchestrator function that coordinates all AI layers
 */
export async function processAIRequest(
  request: AIRequest
): Promise<AIResponse> {
  const ctx = await getCachedAuthContext()
  if (ctx.error || !ctx.userId || !ctx.companyId) {
    return {
      response: "",
      confidence: 0,
      error: ctx.error || "Not authenticated"
    }
  }

  // Initialize components
  const aiEngine = new TruckMatesAIEngine()
  const ragSystem = new TruckMatesRAG()
  const functionRegistry = new TruckMatesFunctionRegistry()
  const internetAccess = new TruckMatesInternetAccess()

  try {
    // Step 1: Determine if internet access is needed
    const needsInternet = detectInternetNeed(request.message)
    
    // Step 2: Retrieve context (RAG + Internet if needed)
    const [internalContext, internetData] = await Promise.all([
      ragSystem.retrieveContext(
        request.message,
        ctx.userId,
        ctx.companyId
      ),
      needsInternet ? fetchInternetData(request.message, internetAccess) : Promise.resolve(null)
    ])

    // Step 3 & 4: Combine internal + internet context and expose knowledge base
    const combinedContext = {
      ...internalContext,
      internet: internetData,
      logisticsKnowledge: internalContext.knowledgeBase,
    }

    // Step 5: Get available functions
    const availableFunctions = functionRegistry.getFunctionDefinitions()

    // Step 6: Generate AI response with combined context
    const aiResponse = await aiEngine.generate(request.message, {
      conversationHistory: request.conversationHistory,
      retrievedData: [
        ...(combinedContext.loads || []),
        ...(combinedContext.drivers || []),
        ...(combinedContext.trucks || []),
        ...(combinedContext.routes || [])
      ],
      logisticsKnowledge: combinedContext.logisticsKnowledge,
      internetData: combinedContext.internet,
      availableFunctions
    })

    // Step 7: Execute function calls if any
    const actions: Array<{ function: string; result: any; error?: string }> = []
    
    if (aiResponse.functionCalls && aiResponse.functionCalls.length > 0) {
      for (const call of aiResponse.functionCalls) {
        const func = functionRegistry.getFunction(call.name)
        if (func) {
          try {
            const result = await func.handler(call.arguments)
            actions.push({ function: call.name, result })
            
            // BUG-051 FIX: Log AI function calls in audit trail
            try {
              const supabase = await createClient()
              await supabase.from("audit_logs").insert({
                company_id: ctx.companyId,
                user_id: ctx.userId,
                action_type: `ai_${call.name}`,
                resource_type: call.name.replace('create_', '').replace('update_', '').replace('delete_', ''),
                resource_id: result?.id || null,
                details: {
                  source: "ai_chat",
                  function_name: call.name,
                  arguments: call.arguments,
                  result_preview: typeof result === 'object' ? JSON.stringify(result).substring(0, 500) : String(result).substring(0, 500),
                  message_preview: request.message.substring(0, 200)
                }
              }).catch((err: any) => {
                // Log error but don't fail the AI action
                console.error("[AI Orchestrator] Failed to create audit log:", err)
              })
            } catch (auditError: any) {
              // Log error but don't fail the AI action
              console.error("[AI Orchestrator] Audit logging error:", auditError)
            }
          } catch (error: any) {
            actions.push({ 
              function: call.name, 
              result: null,
              error: error.message || "Function execution failed"
            })
          }
        } else {
          actions.push({ 
            function: call.name, 
            result: null,
            error: `Function ${call.name} not found`
          })
        }
      }
    }

    return {
      response: aiResponse.response,
      actions: actions.length > 0 ? actions : undefined,
      internetData: internetData || undefined,
      confidence: aiResponse.confidence,
      error: null
    }
  } catch (error: any) {
    console.error("AI Orchestrator error:", error)
    return {
      response: "",
      confidence: 0,
      error: error.message || "AI processing failed"
    }
  }
}

/**
 * Detect if user query needs internet access
 */
function detectInternetNeed(message: string): boolean {
  const internetKeywords = [
    'current', 'latest', 'today', 'now', 'real-time', 'real time',
    'weather', 'fuel price', 'traffic', 'news', 'market rate',
    'what is', 'how much', 'search', 'find', 'look up',
    'forecast', 'conditions', 'temperature'
  ]
  
  return internetKeywords.some(keyword => 
    message.toLowerCase().includes(keyword)
  )
}

/**
 * Fetch relevant internet data based on query
 */
async function fetchInternetData(
  query: string,
  internetAccess: TruckMatesInternetAccess
): Promise<any> {
  const data: any = {}
  const queryLower = query.toLowerCase()
  
  // Extract locations from query (simplified - could use NLP)
  const locations = extractLocations(query)
  
  // Fetch relevant data based on query intent
  if (queryLower.includes('fuel') || queryLower.includes('diesel')) {
    if (locations.length > 0) {
      const fuel = await internetAccess.getFuelPrices(locations[0])
      data.fuel_prices = fuel.data
    }
  }
  
  if (queryLower.includes('weather')) {
    if (locations.length > 0) {
      const weather = await internetAccess.getWeather(locations[0])
      data.weather = weather.data
    }
  }
  
  if (queryLower.includes('traffic') || queryLower.includes('route')) {
    // Extract origin/destination from query
    const route = extractRoute(query)
    if (route.origin && route.destination) {
      const traffic = await internetAccess.getTrafficConditions(route.origin, route.destination)
      data.traffic = traffic.data
    }
  }
  
  if (queryLower.includes('news') || queryLower.includes('update')) {
    const news = await internetAccess.getLogisticsNews(undefined, 3)
    data.news = news.data
  }
  
  if (queryLower.includes('rate') || queryLower.includes('market')) {
    const route = extractRoute(query)
    if (route.origin && route.destination) {
      const rates = await internetAccess.getMarketRateFromWeb(route.origin, route.destination)
      data.market_rates = rates.data
    }
  }
  
  return data
}

/**
 * Extract locations from query (simplified - could use NLP)
 */
function extractLocations(query: string): string[] {
  const locations: string[] = []
  
  // Common city/state patterns
  const cityStatePattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})/g
  const matches = query.matchAll(cityStatePattern)
  
  for (const match of matches) {
    locations.push(match[0])
  }
  
  // Common city names (simplified list)
  const commonCities = [
    'Chicago', 'Dallas', 'Los Angeles', 'New York', 'Miami',
    'Atlanta', 'Denver', 'Phoenix', 'Seattle', 'Boston',
    'Houston', 'Philadelphia', 'San Francisco', 'Detroit'
  ]
  
  for (const city of commonCities) {
    if (query.includes(city) && !locations.includes(city)) {
      locations.push(city)
    }
  }
  
  return locations
}

/**
 * Extract route (origin/destination) from query
 */
function extractRoute(query: string): { origin?: string; destination?: string } {
  const locations = extractLocations(query)
  
  if (locations.length >= 2) {
    return {
      origin: locations[0],
      destination: locations[1]
    }
  }
  
  // Try to extract from common patterns
  const fromToPattern = /(?:from|pickup|origin)[:\s]+([^,\n]+)[,\s]+(?:to|destination|delivery)[:\s]+([^,\n]+)/i
  const match = query.match(fromToPattern)
  
  if (match) {
    return {
      origin: match[1].trim(),
      destination: match[2].trim()
    }
  }
  
  return {}
}










