/**
 * User-friendly error messages
 * Maps technical errors to user-friendly messages
 */

interface ErrorMapping {
  pattern: RegExp | string
  message: string
  action?: string
}

const errorMappings: ErrorMapping[] = [
  // Authentication errors
  {
    pattern: /invalid.*login|authentication.*failed|not.*authenticated/i,
    message: "Your session has expired. Please log in again.",
    action: "Go to Login",
  },
  {
    pattern: /user.*not.*found|email.*not.*found/i,
    message: "We couldn't find an account with that email address.",
    action: "Create Account",
  },
  {
    pattern: /wrong.*password|incorrect.*password/i,
    message: "The password you entered is incorrect. Please try again.",
  },
  
  // Network errors
  {
    pattern: /failed.*fetch|network.*error|connection.*failed/i,
    message: "We're having trouble connecting to our servers. Please check your internet connection and try again.",
    action: "Retry",
  },
  {
    pattern: /timeout|request.*timeout/i,
    message: "The request took too long. Please try again.",
    action: "Retry",
  },
  {
    pattern: /ECONNREFUSED|connection.*refused/i,
    message: "Unable to connect to the server. Please try again in a moment.",
    action: "Retry",
  },
  
  // Database errors
  {
    pattern: /database.*error|sql.*error|query.*failed/i,
    message: "We encountered a database error. Our team has been notified.",
    action: "Contact Support",
  },
  {
    pattern: /missing.*supabase|supabase.*not.*configured/i,
    message: "Database configuration is missing. Please contact support.",
    action: "Contact Support",
  },
  
  // Validation errors
  {
    pattern: /required|missing.*field|invalid.*input/i,
    message: "Please fill in all required fields correctly.",
  },
  {
    pattern: /invalid.*email/i,
    message: "Please enter a valid email address.",
  },
  {
    pattern: /password.*too.*short|password.*weak/i,
    message: "Password must be at least 8 characters long.",
  },
  
  // Permission errors
  {
    pattern: /permission.*denied|access.*denied|unauthorized/i,
    message: "You don't have permission to perform this action.",
    action: "Contact Administrator",
  },
  {
    pattern: /only.*manager|manager.*only/i,
    message: "This action can only be performed by a manager.",
  },
  
  // Resource errors
  {
    pattern: /not.*found|404|does.*not.*exist/i,
    message: "The resource you're looking for doesn't exist or has been removed.",
  },
  {
    pattern: /already.*exists|duplicate/i,
    message: "This item already exists. Please use a different value.",
  },
  
  // Rate limiting
  {
    pattern: /rate.*limit|too.*many.*requests/i,
    message: "You're making requests too quickly. Please wait a moment and try again.",
    action: "Wait and Retry",
  },
  
  // Generic fallback
  {
    pattern: /.*/,
    message: "Something went wrong. Please try again or contact support if the problem persists.",
    action: "Contact Support",
  },
]

/**
 * Get user-friendly error message from technical error
 */
export function getUserFriendlyError(error: string | Error | null | undefined): {
  message: string
  action?: string
} {
  if (!error) {
    return {
      message: "An unexpected error occurred. Please try again.",
    }
  }

  const errorString = typeof error === "string" ? error : error.message || String(error)

  // Find matching error mapping
  for (const mapping of errorMappings) {
    const pattern = typeof mapping.pattern === "string" 
      ? new RegExp(mapping.pattern, "i")
      : mapping.pattern
    
    if (pattern.test(errorString)) {
      return {
        message: mapping.message,
        action: mapping.action,
      }
    }
  }

  // Fallback
  return {
    message: "Something went wrong. Please try again or contact support if the problem persists.",
    action: "Contact Support",
  }
}

/**
 * Format error for display
 */
export function formatError(error: string | Error | null | undefined): string {
  const { message } = getUserFriendlyError(error)
  return message
}

