/**
 * TruckMates AI LLM Engine
 * Wrapper for self-hosted LLM (Llama 3.1 or Mistral 7B via Ollama)
 */

export interface FunctionDefinition {
  name: string
  description: string
  parameters: {
    type: string
    properties: Record<string, any>
    required: string[]
  }
}

export interface LLMResponse {
  response: string
  functionCalls?: Array<{ name: string; arguments: any }>
  confidence: number
}

export interface LLMContext {
  conversationHistory?: Array<{ role: string; content: string }>
  retrievedData?: any[]
  availableFunctions?: FunctionDefinition[]
  internetData?: any
  logisticsKnowledge?: any[]
}

/**
 * TruckMates AI Engine
 * Self-hosted LLM with logistics expertise
 */
export class TruckMatesAIEngine {
  private baseUrl: string
  private model: string

  constructor() {
    // Point to your self-hosted Ollama instance
    // Default: localhost for development, can be configured for production
    this.baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434"
    // Use Llama 3.1 8B (recommended) or Mistral 7B
    this.model = process.env.OLLAMA_MODEL || "llama3.1:8b"
  }

  /**
   * Generate response with context
   */
  async generate(
    prompt: string,
    context?: LLMContext
  ): Promise<LLMResponse> {
    // Build enhanced prompt with logistics expertise
    const enhancedPrompt = this.buildExpertPrompt(prompt, context)

    try {
      // Call Ollama API with optimized settings for faster, better responses
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          prompt: enhancedPrompt,
          stream: false,
          options: {
            temperature: 0.5, // Lower for more focused, professional, sophisticated responses
            top_p: 0.85, // More focused sampling
            top_k: 30, // Reduced for faster generation
            num_predict: 1200, // Reduced for faster responses while maintaining quality
            repeat_penalty: 1.15, // Reduce repetition for better writing
            num_ctx: 4096, // Context window
            num_thread: 4, // Use more threads for faster processing
          }
        })
      })

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`)
      }

      const data = await response.json()

      // Parse function calls from response (extract before cleaning)
      const functionCalls = this.extractFunctionCalls(data.response)

      // Clean response - remove JSON blocks, function definitions, and code
      let cleanedResponse = this.cleanResponse(data.response)

      // Calculate confidence (simplified - can be enhanced)
      const confidence = this.calculateConfidence(cleanedResponse, context)

      return {
        response: cleanedResponse,
        functionCalls,
        confidence
      }
    } catch (error: any) {
      // Fallback response if LLM is not available
      console.error("LLM Engine error:", error)
      return {
        response: "I'm currently unavailable. Please ensure Ollama is running and the model is installed.",
        confidence: 0
      }
    }
  }

  /**
   * Build expert prompt with logistics knowledge
   */
  private buildExpertPrompt(
    userPrompt: string,
    context?: LLMContext
  ): string {
    const logisticsKnowledge = context?.logisticsKnowledge || []
    const retrievedData = context?.retrievedData || []
    const internetData = context?.internetData
    const availableFunctions = context?.availableFunctions || []

    return `You are TruckMates AI, an elite logistics intelligence platform serving enterprise fleet management operations. Your expertise spans regulatory compliance, operational excellence, and strategic business intelligence.

**YOUR IDENTITY:**
You are a senior logistics consultant with 20+ years of industry experience, specializing in:
- Regulatory compliance (FMCSA, DOT, IFTA, ELD mandates)
- Operational optimization (route planning, load matching, HOS management)
- Financial analysis (rate optimization, cost structures, profitability modeling)
- Strategic advisory (market trends, competitive positioning, growth strategies)

**COMMUNICATION STYLE:**
- Write with sophistication and authority - you're advising C-level executives and operations managers
- Use precise logistics terminology naturally (deadhead, backhaul, detention, lumper, CSA scores)
- Structure responses clearly with headers, bullet points, and numbered lists when appropriate
- Provide data-driven insights with specific numbers, percentages, and benchmarks
- Be concise yet comprehensive - respect the user's time while being thorough
- Use markdown formatting for clarity (headers, bold, lists, code blocks)
- Avoid filler words - every sentence should add value
- Write in a professional, confident tone that demonstrates deep expertise

**RESPONSE STRUCTURE:**
1. **Direct Answer**: Lead with the core answer (1-2 sentences)
2. **Detailed Analysis**: Provide comprehensive explanation with data/calculations
3. **Actionable Recommendations**: Specific, implementable next steps
4. **Context**: Reference relevant regulations, benchmarks, or best practices

**RELEVANT LOGISTICS KNOWLEDGE:**
${logisticsKnowledge.length > 0 ? logisticsKnowledge.map(k => 
  `- ${k.title || k.metric || k.term}: ${k.content || k.description || k.definition}`
).join('\n') : "No specific knowledge retrieved for this query."}

**PLATFORM DATA:**
${retrievedData.length > 0 ? JSON.stringify(retrievedData, null, 2) : "No platform data available."}

**REAL-TIME INTERNET DATA:**
${internetData ? JSON.stringify(internetData, null, 2) : "No internet data available."}

**AVAILABLE FUNCTIONS:**
${availableFunctions.length > 0 ? this.formatFunctions(availableFunctions) : "No functions available."}

**CONVERSATION HISTORY:**
${context?.conversationHistory ? context.conversationHistory.map(msg => 
  `${msg.role}: ${msg.content}`
).join('\n') : "No previous conversation."}

**USER REQUEST:** ${userPrompt}

**CRITICAL INSTRUCTIONS:**
1. **Write professionally** - Use sophisticated language appropriate for enterprise software
2. **Be authoritative** - You're an expert, not a chatbot. Write with confidence and precision
3. **Provide value immediately** - Lead with the answer, then elaborate
4. **Use data** - Include specific numbers, percentages, benchmarks when relevant
5. **Structure clearly** - Use markdown headers, lists, and formatting for readability
6. **Be concise** - Eliminate unnecessary words while maintaining completeness
7. **Reference expertise** - Cite regulations, industry standards, or best practices
8. **NEVER show JSON or code in your response** - Write in natural, conversational language only. If you need to execute a function, do it silently without showing the user JSON code or function definitions.
9. **Combine knowledge** - Synthesize platform data, industry knowledge, and real-time information
10. **Provide recommendations** - Always end with actionable next steps when applicable
11. **Write like a human expert** - Never display raw data, JSON, code blocks, or technical schemas. Always explain things in clear, professional language.

**WRITING EXAMPLES:**

❌ BAD: "I can help you with HOS rules. The rules say you can drive 11 hours."

✅ GOOD: "Property-carrying drivers are subject to the 11-hour driving limit within a 14-hour on-duty window, as mandated by FMCSA §395.3. This regulation requires a minimum 10-hour off-duty period before commencing a new shift."

❌ BAD: "Your rate seems okay."

✅ GOOD: "At $2.00/mile, your rate falls within the 25th-50th percentile for this lane. Based on your operating costs of $1.85/mile, you're achieving a 7.5% margin—below the industry target of 15-20%. I recommend negotiating to $2.15-$2.25/mile to align with market standards and improve profitability."

**RESPONSE:**`
  }

  /**
   * Format functions for prompt
   */
  private formatFunctions(functions: FunctionDefinition[]): string {
    return functions.map(func => {
      return `
Function: ${func.name}
Description: ${func.description}
Parameters: ${JSON.stringify(func.parameters, null, 2)}
`
    }).join('\n')
  }

  /**
   * Clean response - remove JSON, code blocks, and technical schemas
   */
  private cleanResponse(response: string): string {
    let cleaned = response

    // Remove JSON function call blocks
    cleaned = cleaned.replace(/\{[\s\S]*?"function"[\s\S]*?\}/g, '')
    
    // Remove code blocks with JSON
    cleaned = cleaned.replace(/```json[\s\S]*?```/gi, '')
    cleaned = cleaned.replace(/```[\s\S]*?```/g, '')
    
    // Remove standalone JSON objects
    cleaned = cleaned.replace(/\{[\s\S]*?\}/g, (match) => {
      try {
        JSON.parse(match)
        return '' // Remove valid JSON
      } catch {
        return match // Keep if not valid JSON
      }
    })
    
    // Remove function definition patterns
    cleaned = cleaned.replace(/Function:\s*\w+/gi, '')
    cleaned = cleaned.replace(/Parameters?:[\s\S]*?(?=\n\n|\n[A-Z]|$)/gi, '')
    cleaned = cleaned.replace(/Description:[\s\S]*?(?=\n\n|\n[A-Z]|$)/gi, '')
    
    // Remove "AVAILABLE FUNCTIONS" sections
    cleaned = cleaned.replace(/AVAILABLE FUNCTIONS:[\s\S]*?(?=\n\n|$)/gi, '')
    cleaned = cleaned.replace(/Functions:[\s\S]*?(?=\n\n|$)/gi, '')
    
    // Clean up extra whitespace
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n')
    cleaned = cleaned.trim()

    return cleaned || "I've processed your request. How can I help you further?"
  }

  /**
   * Extract function calls from AI response
   */
  private extractFunctionCalls(response: string): Array<{ name: string; arguments: any }> {
    const functionCalls: Array<{ name: string; arguments: any }> = []

    // Look for JSON function calls in the response
    // Format: {"function": "function_name", "arguments": {...}}
    const jsonMatch = response.match(/\{[\s\S]*?"function"[\s\S]*?\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.function) {
          functionCalls.push({
            name: parsed.function,
            arguments: parsed.arguments || {}
          })
        }
      } catch (e) {
        // Try alternative formats
        const altMatch = response.match(/function[:\s]+(\w+)[\s\S]*?arguments[:\s]+(\{[\s\S]*?\})/i)
        if (altMatch) {
          try {
            functionCalls.push({
              name: altMatch[1],
              arguments: JSON.parse(altMatch[2])
            })
          } catch (e2) {
            // Could not parse function call
          }
        }
      }
    }

    return functionCalls
  }

  /**
   * Calculate confidence score (0-1)
   */
  private calculateConfidence(response: string, context?: LLMContext): number {
    let confidence = 0.7 // Base confidence

    // Increase confidence if we have relevant knowledge
    if (context?.logisticsKnowledge && context.logisticsKnowledge.length > 0) {
      confidence += 0.1
    }

    // Increase confidence if we have platform data
    if (context?.retrievedData && context.retrievedData.length > 0) {
      confidence += 0.1
    }

    // Increase confidence if response is detailed
    if (response.length > 200) {
      confidence += 0.05
    }

    // Decrease confidence if response indicates uncertainty
    if (response.toLowerCase().includes("i'm not sure") || 
        response.toLowerCase().includes("i don't know") ||
        response.toLowerCase().includes("uncertain")) {
      confidence -= 0.2
    }

    return Math.min(1, Math.max(0, confidence))
  }

  /**
   * Check if Ollama is available
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: "GET"
      })
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * Get available models
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`)
      const data = await response.json()
      return data.models?.map((m: any) => m.name) || []
    } catch {
      return []
    }
  }
}

