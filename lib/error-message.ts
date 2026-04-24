/**
 * Safe message extraction for `catch (error: unknown)` blocks.
 * Prefer this over `(error as Error).message`.
 */
export function errorMessage(error: unknown, fallback = "An unexpected error occurred"): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  if (
    error !== null &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message
  }
  return fallback
}

/**
 * Convert low-level database/provider errors into safe, user-facing messages.
 * Prevents leaking table/column/constraint names to clients.
 */
export function databaseErrorMessage(error: unknown, fallback = "Database operation failed"): string {
  const message = errorMessage(error, fallback)
  const lower = message.toLowerCase()

  if (lower.includes("duplicate key") || lower.includes("unique constraint")) {
    return "This record already exists."
  }
  if (lower.includes("foreign key")) {
    return "Invalid related record reference."
  }
  if (lower.includes("not-null") || lower.includes("null value")) {
    return "A required field is missing."
  }
  if (lower.includes("violates check constraint") || lower.includes("invalid input syntax")) {
    return "One or more fields have invalid values."
  }
  if (lower.includes("permission denied") || lower.includes("row-level security")) {
    return "You do not have permission to perform this action."
  }
  if (lower.includes("does not exist")) {
    return "Requested resource was not found."
  }

  return fallback
}
