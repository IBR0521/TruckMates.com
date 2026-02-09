import { NextRequest, NextResponse } from "next/server"
import { processAIRequest } from "@/app/actions/truckmates-ai/orchestrator"

/**
 * TruckMates AI Chat API
 * POST /api/truckmates-ai/chat
 * Supports streaming for faster perceived response time
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, conversationHistory, threadId, stream } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      )
    }

    // If streaming requested, use streaming response
    if (stream) {
      return streamAIResponse(message, conversationHistory, threadId)
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
  } catch (error: any) {
    console.error("AI Chat API error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
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
  threadId: string
) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Process request
        const result = await processAIRequest({
          message,
          conversationHistory: conversationHistory || [],
          context: {}
        })

        if (result.error) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: result.error })}\n\n`)
          )
          controller.close()
          return
        }

        // Stream response word by word for better UX
        const words = result.response.split(' ')
        for (let i = 0; i < words.length; i++) {
          const word = words[i] + (i < words.length - 1 ? ' ' : '')
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ content: word })}\n\n`)
          )
          // Small delay for smooth streaming
          await new Promise(resolve => setTimeout(resolve, 20))
        }

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
      } catch (error: any) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`)
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

