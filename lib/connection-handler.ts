/**
 * Connection error handling and retry logic
 */

export interface ConnectionError {
  message: string
  code?: string
  isRetryable: boolean
}

/**
 * Check if error is a connection error
 */
export function isConnectionError(error: any): boolean {
  if (!error) return false
  
  const errorMessage = error.message?.toLowerCase() || ''
  const errorCode = error.code?.toLowerCase() || ''
  
  // Common connection error patterns
  const connectionErrorPatterns = [
    'connection',
    'network',
    'timeout',
    'econnrefused',
    'enotfound',
    'econnreset',
    'fetch failed',
    'network request failed',
    'failed to fetch',
  ]
  
  return connectionErrorPatterns.some(pattern => 
    errorMessage.includes(pattern) || errorCode.includes(pattern)
  )
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: any): boolean {
  if (!error) return false
  
  // Network errors are usually retryable
  if (isConnectionError(error)) return true
  
  // 5xx errors are retryable
  if (error.status >= 500 && error.status < 600) return true
  
  // Rate limit errors are retryable
  if (error.status === 429) return true
  
  return false
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: any
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error
      
      // Don't retry if it's not a retryable error
      if (!isRetryableError(error)) {
        throw error
      }
      
      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break
      }
      
      // Calculate delay with exponential backoff
      const delay = initialDelay * Math.pow(2, attempt)
      
      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.3 * delay
      const totalDelay = delay + jitter
      
      console.warn(`[Connection Retry] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${Math.round(totalDelay)}ms...`, error.message)
      
      await new Promise(resolve => setTimeout(resolve, totalDelay))
    }
  }
  
  throw lastError
}

/**
 * Handle connection errors gracefully
 */
export function handleConnectionError(error: any): ConnectionError {
  const isConnection = isConnectionError(error)
  
  return {
    message: error.message || 'Connection failed',
    code: error.code || error.status?.toString(),
    isRetryable: isConnection && isRetryableError(error),
  }
}




