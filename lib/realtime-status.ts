"use client"

import { createClient } from "@/lib/supabase/client"

/**
 * Check if Supabase Realtime is enabled and working
 */
export async function checkRealtimeStatus(): Promise<{
  enabled: boolean
  connected: boolean
  error?: string
  details?: {
    tablesWithReplication: string[]
    connectionStatus: string
  }
}> {
  const supabase = createClient()

  try {
    // Try to create a test channel
    const testChannel = supabase.channel("realtime-test")
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        testChannel.unsubscribe()
        resolve({
          enabled: false,
          connected: false,
          error: "Connection timeout - Realtime may not be enabled",
        })
      }, 3000)

      testChannel
        .subscribe((status) => {
          clearTimeout(timeout)
          
          if (status === "SUBSCRIBED") {
            testChannel.unsubscribe()
            resolve({
              enabled: true,
              connected: true,
              details: {
                tablesWithReplication: [], // Would need to query Supabase API
                connectionStatus: "Connected",
              },
            })
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            testChannel.unsubscribe()
            resolve({
              enabled: false,
              connected: false,
              error: "Realtime connection failed. Check Supabase Replication settings.",
            })
          }
        })
    })
  } catch (error: any) {
    return {
      enabled: false,
      connected: false,
      error: error?.message || "Failed to check realtime status",
    }
  }
}

/**
 * Test real-time subscription for a specific table
 */
export async function testRealtimeSubscription(
  table: string
): Promise<{
  working: boolean
  error?: string
}> {
  const supabase = createClient()

  try {
    return new Promise((resolve) => {
      const testChannel = supabase
        .channel(`test-${table}-${Date.now()}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
          },
          () => {
            // If we receive any event, realtime is working
            testChannel.unsubscribe()
            resolve({ working: true })
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            // Subscription successful - realtime is enabled for this table
            setTimeout(() => {
              testChannel.unsubscribe()
              resolve({ working: true })
            }, 1000)
          } else if (status === "CHANNEL_ERROR") {
            testChannel.unsubscribe()
            resolve({
              working: false,
              error: `Realtime not enabled for table: ${table}. Enable it in Supabase Dashboard → Database → Replication`,
            })
          }
        })

      // Timeout after 3 seconds
      setTimeout(() => {
        testChannel.unsubscribe()
        resolve({
          working: false,
          error: `Timeout checking ${table}. Realtime may not be enabled.`,
        })
      }, 3000)
    })
  } catch (error: any) {
    return {
      working: false,
      error: error?.message || "Failed to test subscription",
    }
  }
}

