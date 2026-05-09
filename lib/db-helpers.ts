import { databaseErrorMessage } from "@/lib/error-message"

/**
 * Helper function to check if a database error is due to a missing table
 */
export function isTableMissingError(error: unknown): boolean {
  if (!error) return false
  const candidate = error as { code?: string; message?: string }
  return Boolean(
    candidate.code === "42P01" ||
    candidate.message?.includes("does not exist") ||
    (candidate.message?.includes("relation") && candidate.message?.includes("does not exist"))
  )
}

/**
 * Helper function to handle database errors gracefully
 * Returns empty data if table is missing, otherwise returns the error
 */
export function handleDbError<T>(error: unknown, defaultValue: T): { data: T; error: null } | { data: null; error: string } {
  const candidate = error as { message?: string }
  if (isTableMissingError(error)) {
    console.warn(`[DB] Table missing: ${candidate.message}. Please run the SQL schema.`)
    return { data: defaultValue, error: null }
  }
  return { data: null, error: databaseErrorMessage(error, "Database operation failed") }
}















