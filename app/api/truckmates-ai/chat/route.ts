import { NextRequest, NextResponse } from "next/server"
import { errorMessage } from "@/lib/error-message"
import { processAIRequest } from "@/app/actions/truckmates-ai/orchestrator"
import { createClient } from "@/lib/supabase/server"
import { rateLimit } from "@/lib/rate-limit"

/**
 * TruckMates AI Chat API
 * POST /api/truckmates-ai/chat
 * Supports streaming for faster perceived response time
 * SECURITY: Requires authentication and rate limiting
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      )
    }

    // SECURITY: Rate limit (10 requests per minute per user)
    // EXT-006 FIX: Correct function signature - rateLimit(identifierString, options)
    const rateLimitResult = await rateLimit(
      `ai-chat-${user.id}`, // identifier as first parameter (string)
      {
        limit: 10,
        window: 60,
      }
    )

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      )
    }

    const body = await request.json()
    let { message, conversationHistory, threadId, stream } = body

    // BUG-049 FIX: Validate and sanitize conversationHistory to prevent prompt injection
    // BUG-058 FIX: Enforce message length limit to prevent DoS
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      )
    }

    // BUG-058 FIX: Enforce strict message length limit (4000 characters)
    if (message.length > 4000) {
      return NextResponse.json(
        { error: "Message exceeds maximum length of 4000 characters" },
        { status: 400 }
      )
    }

    // BUG-049 FIX: Validate conversationHistory - only allow "user" or "assistant" roles
    // Cap history to 20 messages and enforce per-message length limit (2000 chars)
    if (conversationHistory && Array.isArray(conversationHistory)) {
      const sanitizedHistory = conversationHistory
        .slice(0, 20) // Cap to 20 messages
        .filter((msg: any) => {
          // Only allow "user" or "assistant" roles
          if (!msg.role || (msg.role !== "user" && msg.role !== "assistant")) {
            return false
          }
          // Enforce content length limit
          if (msg.content && typeof msg.content === 'string' && msg.content.length > 2000) {
            return false
          }
          return true
        })
        .map((msg: any) => ({
          role: msg.role, // Only "user" or "assistant"
          content: typeof msg.content === 'string' ? msg.content.substring(0, 2000) : String(msg.content || '')
        }))
      
      conversationHistory = sanitizedHistory
    } else {
      conversationHistory = []
    }

    // If streaming requested, use streaming response
    if (stream) {
      return streamAIResponse(message, conversationHistory, threadId, user.id)
    }

    // Process AI request (non-streaming)
    const result = await processAIRequest({
      message,
      conversationHistory: conversationHistory || [],
      context: {
        // Context will be extracted from auth in orchestrator
      }
    })

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      response: result.response,
      actions: result.actions,
      internetData: result.internetData,
      confidence: result.confidence
    })
  } catch (error: unknown) {
    console.error("AI Chat API error:", error)
    return NextResponse.json(
      { error: errorMessage(error, "Internal server error") },
      { status: 500 }
    )
  }
}

/**
 * Stream AI response for faster perceived performance
 */
async function streamAIResponse(
  message: string,
  conversationHistory: any[],
  threadId: string,
  userId: string
) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Process request (orchestrator will handle auth internally)
        const result = await processAIRequest({
          message,
          conversationHistory: conversationHistory || [],
          context: { userId } // Pass userId for auth context
        })

        if (result.error) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: result.error })}\n\n`)
          )
          controller.close()
          return
        }

        // BUG-053 FIX: Remove artificial delay - return full response immediately
        // The 20ms delay per word causes long responses to exceed serverless function limits
        // Return the full response in one chunk instead of word-by-word
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ content: result.response })}\n\n`)
        )

        // Send actions if any
        if (result.actions && result.actions.length > 0) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ actions: result.actions })}\n\n`)
          )
        }

        // Send completion
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
        )
        controller.close()
      } catch (error: unknown) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: errorMessage(error) })}\n\n`)
        )
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

