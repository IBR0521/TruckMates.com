import * as Sentry from "@sentry/nextjs"
import { databaseErrorMessage } from "@/lib/error-message"

export function safeDbError(error: unknown, fallback = "Database operation failed"): string {
  Sentry.captureException(error)
  return databaseErrorMessage(error, fallback || "Database operation failed")
}
