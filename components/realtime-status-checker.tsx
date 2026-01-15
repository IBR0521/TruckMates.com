"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react"
import { checkRealtimeStatus, testRealtimeSubscription } from "@/lib/realtime-status"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function RealtimeStatusChecker() {
  const [status, setStatus] = useState<{
    enabled: boolean
    connected: boolean
    error?: string
  } | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [tableTests, setTableTests] = useState<
    Record<string, { working: boolean; error?: string }>
  >({})

  const checkStatus = async () => {
    setIsChecking(true)
    const result = await checkRealtimeStatus()
    setStatus(result)
    setIsChecking(false)
  }

  const testTable = async (table: string) => {
    setIsChecking(true)
    const result = await testRealtimeSubscription(table)
    setTableTests((prev) => ({ ...prev, [table]: result }))
    setIsChecking(false)
  }

  useEffect(() => {
    checkStatus()
  }, [])

  const tablesToTest = ["loads", "routes", "drivers", "trucks", "notifications"]

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          {status?.connected ? (
            <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
          ) : status?.enabled === false ? (
            <XCircle className="h-3 w-3 mr-1 text-red-500" />
          ) : (
            <AlertCircle className="h-3 w-3 mr-1 text-yellow-500" />
          )}
          Realtime Status
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Supabase Realtime Status</DialogTitle>
          <DialogDescription>
            Check if real-time features are enabled and working
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Overall Status */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Connection Status</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={checkStatus}
                disabled={isChecking}
              >
                {isChecking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Refresh"
                )}
              </Button>
            </div>
            {status ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {status.connected ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Realtime is enabled and connected</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span className="text-sm">Realtime is not working</span>
                    </>
                  )}
                </div>
                {status.error && (
                  <p className="text-xs text-muted-foreground">{status.error}</p>
                )}
                {!status.connected && (
                  <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded">
                    <p className="text-sm font-medium mb-1">How to Enable:</p>
                    <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
                      <li>Go to Supabase Dashboard → Database → Replication</li>
                      <li>Enable replication for tables: loads, routes, drivers, trucks</li>
                      <li>Click "Refresh" above to verify</li>
                    </ol>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Click Refresh to check</p>
            )}
          </Card>

          {/* Table-Specific Tests */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Table Replication Status</h3>
            <div className="space-y-2">
              {tablesToTest.map((table) => {
                const test = tableTests[table]
                return (
                  <div
                    key={table}
                    className="flex items-center justify-between p-2 rounded border"
                  >
                    <div className="flex items-center gap-2">
                      {test ? (
                        test.working ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )
                      ) : (
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm font-mono">{table}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {test?.error && (
                        <span className="text-xs text-muted-foreground">
                          {test.error}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => testTable(table)}
                        disabled={isChecking}
                        className="h-7 text-xs"
                      >
                        Test
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                tablesToTest.forEach((table) => testTable(table))
              }}
              disabled={isChecking}
              className="w-full mt-3"
            >
              Test All Tables
            </Button>
          </Card>

          {/* Instructions */}
          <Card className="p-4 bg-muted/50">
            <h3 className="font-semibold mb-2 text-sm">Quick Setup Guide</h3>
            <ol className="text-xs space-y-1 list-decimal list-inside text-muted-foreground">
              <li>Open Supabase Dashboard</li>
              <li>Navigate to Database → Replication</li>
              <li>Enable replication for each table you want real-time updates</li>
              <li>Click "Refresh" to verify connection</li>
              <li>Real-time features will work automatically once enabled</li>
            </ol>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}

