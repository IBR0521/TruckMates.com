/**
 * Wrapper utilities for Supabase queries with timeout and retry logic
 */

import { retryWithBackoff, isConnectionError, handleConnectionError } from '../connection-handler'

/**
 * Execute a Supabase query with timeout and retry logic
 */
export async function executeQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  options: {
    timeout?: number
    maxRetries?: number
    retryable?: boolean
  } = {}
): Promise<{ data: T | null; error: any }> {
  const { timeout = 5000, maxRetries = 2, retryable = true } = options

  const executeWithTimeout = async (): Promise<{ data: T | null; error: any }> => {
    const queryPromise = queryFn()
    const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) => {
      setTimeout(() => resolve({ data: null, error: { message: 'Query timeout' } }), timeout)
    })

    return Promise.race([queryPromise, timeoutPromise]) as Promise<{ data: T | null; error: any }>
  }

  if (!retryable) {
    return executeWithTimeout()
  }

  try {
    return await retryWithBackoff(executeWithTimeout, maxRetries, 500)
  } catch (error: any) {
    const connectionError = handleConnectionError(error)
    
    return {
      data: null,
      error: {
        message: connectionError.message || 'Query failed',
        code: connectionError.code,
        isRetryable: connectionError.isRetryable,
      },
    }
  }
}

/**
 * Execute multiple queries in parallel with timeout protection
 */
export async function executeQueriesParallel<T>(
  queries: Array<() => Promise<{ data: T | null; error: any }>>,
  timeout: number = 5000
): Promise<Array<{ data: T | null; error: any }>> {
  const queryPromises = queries.map((queryFn) => {
    const queryPromise = queryFn()
    const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) => {
      setTimeout(() => resolve({ data: null, error: { message: 'Query timeout' } }), timeout)
    })

    return Promise.race([queryPromise, timeoutPromise]).catch((error) => ({
      data: null,
      error: {
        message: error?.message || 'Query failed',
        isRetryable: isConnectionError(error),
      },
    }))
  })

  return Promise.all(queryPromises)
}












