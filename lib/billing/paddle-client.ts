"use client"

import { initializePaddle, type Paddle } from "@paddle/paddle-js"

let paddleInstance: Paddle | undefined

export async function getPaddleClient(): Promise<Paddle | null> {
  if (paddleInstance) return paddleInstance

  const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
  if (!clientToken) {
    console.error("[Paddle.js] NEXT_PUBLIC_PADDLE_CLIENT_TOKEN not configured")
    return null
  }

  const environment =
    process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === "production" ? "production" : "sandbox"

  try {
    paddleInstance = await initializePaddle({
      token: clientToken,
      environment,
      eventCallback: (event) => {
        console.log("[Paddle.js event]", event.name, event.data)
      },
    })
    return paddleInstance ?? null
  } catch (err) {
    console.error("[Paddle.js] Failed to initialize", err)
    return null
  }
}
