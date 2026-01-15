// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: process.env.NODE_ENV === "development",

  // Filter out non-critical errors
  beforeSend(event, hint) {
    // Don't send errors in development unless explicitly enabled
    if (process.env.NODE_ENV === "development" && !process.env.NEXT_PUBLIC_SENTRY_DEBUG) {
      return null
    }

    // Filter out known non-critical errors
    const error = hint.originalException
    if (error instanceof Error) {
      // Ignore connection errors that are expected
      if (
        error.message.includes("Connection timeout") ||
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("Failed to connect")
      ) {
        return null
      }
    }

    return event
  },
})

