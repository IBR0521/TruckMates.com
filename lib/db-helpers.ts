/**
 * Helper function to check if a database error is due to a missing table
 */
export function isTableMissingError(error: any): boolean {
  if (!error) return false
  return (
    error.code === "42P01" ||
    error.message?.includes("does not exist") ||
    (error.message?.includes("relation") && error.message?.includes("does not exist"))
  )
}

/**
 * Helper function to handle database errors gracefully
 * Returns empty data if table is missing, otherwise returns the error
 */
export function handleDbError<T>(error: any, defaultValue: T): { data: T; error: null } | { data: null; error: string } {
  if (isTableMissingError(error)) {
    console.warn(`[DB] Table missing: ${error.message}. Please run the SQL schema.`)
    return { data: defaultValue, error: null }
  }
  return { data: null, error: error.message || "Database error" }
}











