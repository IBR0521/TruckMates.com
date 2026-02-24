"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { CheckCircle2, XCircle, AlertCircle, Loader2, ExternalLink } from "lucide-react"
import Link from "next/link"

interface DiagnosticResult {
  name: string
  status: "checking" | "pass" | "fail"
  message: string
  details?: string
  action?: {
    label: string
    href: string
  }
}

export default function DiagnosticsPage() {
  const [results, setResults] = useState<DiagnosticResult[]>([])
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    async function runDiagnostics() {
      const checks: DiagnosticResult[] = []

      // Check 1: Environment Variables
      const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL
      const hasKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      const urlValue = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
      const isPlaceholder = urlValue.includes("placeholder") || urlValue === ""

      checks.push({
        name: "Environment Variables",
        status: hasUrl && hasKey && !isPlaceholder ? "pass" : "fail",
        message: hasUrl && hasKey && !isPlaceholder
          ? "Supabase environment variables are configured"
          : "Supabase environment variables are missing or invalid",
        details: !hasUrl || !hasKey || isPlaceholder
          ? `URL: ${hasUrl ? "✓" : "✗"} | Key: ${hasKey ? "✓" : "✗"}${isPlaceholder ? " (Using placeholder)" : ""}`
          : undefined,
        action: !hasUrl || !hasKey || isPlaceholder
          ? {
              label: "Setup Guide",
              href: "https://vercel.com/docs/concepts/projects/environment-variables"
            }
          : undefined
      })

      // Check 2: Health Endpoint
      try {
        const healthResponse = await fetch("/api/health")
        const healthData = await healthResponse.json()
        
        checks.push({
          name: "Health Check",
          status: healthData.status === "ok" ? "pass" : "fail",
          message: healthData.status === "ok"
            ? "Health check passed"
            : healthData.message || "Health check failed",
          details: healthData.details ? JSON.stringify(healthData.details, null, 2) : undefined
        })
      } catch (error: any) {
        checks.push({
          name: "Health Check",
          status: "fail",
          message: "Failed to reach health endpoint",
          details: error.message
        })
      }

      // Check 3: Connection Test
      try {
        const testResponse = await fetch("/api/test-connection")
        const testData = await testResponse.json()
        
        checks.push({
          name: "Database Connection",
          status: testData.success ? "pass" : "fail",
          message: testData.success
            ? "Successfully connected to Supabase"
            : testData.error || "Connection failed",
          details: testData.error ? `Error: ${testData.error}` : undefined
        })
      } catch (error: any) {
        checks.push({
          name: "Database Connection",
          status: "fail",
          message: "Failed to test database connection",
          details: error.message
        })
      }

      // Check 4: Supabase URL Format
      if (hasUrl && !isPlaceholder) {
        try {
          const url = new URL(urlValue)
          const isValidFormat = url.hostname.endsWith(".supabase.co") && url.protocol === "https:"
          
          checks.push({
            name: "URL Format",
            status: isValidFormat ? "pass" : "fail",
            message: isValidFormat
              ? "Supabase URL format is valid"
              : "Supabase URL format is invalid",
            details: !isValidFormat ? `Expected: https://*.supabase.co | Got: ${urlValue}` : undefined
          })
        } catch {
          checks.push({
            name: "URL Format",
            status: "fail",
            message: "Supabase URL is not a valid URL",
            details: `Invalid URL: ${urlValue}`
          })
        }
      }

      setResults(checks)
      setIsChecking(false)
    }

    runDiagnostics()
  }, [])

  const passedCount = results.filter(r => r.status === "pass").length
  const failedCount = results.filter(r => r.status === "fail").length
  const allPassed = failedCount === 0 && results.length > 0

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">System Diagnostics</h1>
          <p className="text-muted-foreground">
            Check the status of your Supabase connection and configuration
          </p>
        </div>

        {isChecking ? (
          <Card className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Running diagnostics...</p>
          </Card>
        ) : (
          <>
            {/* Summary */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Summary</h2>
                {allPassed ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">All checks passed</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-destructive">
                    <XCircle className="h-5 w-5" />
                    <span className="font-medium">{failedCount} issue(s) found</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-secondary rounded-lg">
                  <div className="text-2xl font-bold text-foreground">{results.length}</div>
                  <div className="text-sm text-muted-foreground">Total Checks</div>
                </div>
                <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                  <div className="text-2xl font-bold text-green-600">{passedCount}</div>
                  <div className="text-sm text-muted-foreground">Passed</div>
                </div>
                <div className="text-center p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                  <div className="text-2xl font-bold text-destructive">{failedCount}</div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
              </div>
            </Card>

            {/* Results */}
            <div className="space-y-4">
              {results.map((result, index) => (
                <Card key={index} className="p-6">
                  <div className="flex items-start gap-4">
                    {result.status === "pass" ? (
                      <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : result.status === "fail" ? (
                      <XCircle className="h-6 w-6 text-destructive flex-shrink-0 mt-0.5" />
                    ) : (
                      <Loader2 className="h-6 w-6 text-muted-foreground animate-spin flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground mb-1">{result.name}</h3>
                      <p className="text-sm text-muted-foreground mb-2">{result.message}</p>
                      {result.details && (
                        <div className="mt-2 p-3 bg-secondary rounded-md">
                          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                            {result.details}
                          </pre>
                        </div>
                      )}
                      {result.action && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          asChild
                        >
                          <a href={result.action.href} target="_blank" rel="noopener noreferrer">
                            {result.action.label}
                            <ExternalLink className="ml-2 h-3 w-3" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Action Items */}
            {!allPassed && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Configuration Required</AlertTitle>
                <AlertDescription className="space-y-2 mt-2">
                  <p>
                    Your production environment is missing Supabase configuration. To fix this:
                  </p>
                  <ol className="list-decimal list-inside space-y-2 text-sm">
                    <li>
                      Go to your Vercel project dashboard
                    </li>
                    <li>
                      Navigate to <strong>Settings → Environment Variables</strong>
                    </li>
                    <li>
                      Add <code className="bg-secondary px-1 py-0.5 rounded">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="bg-secondary px-1 py-0.5 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
                    </li>
                    <li>
                      Make sure to select <strong>Production</strong> environment
                    </li>
                    <li>
                      Redeploy your application
                    </li>
                  </ol>
                  <div className="flex gap-2 mt-4">
                    <Button asChild variant="outline">
                      <Link href="/VERCEL_ENV_SETUP.md" target="_blank">
                        View Setup Guide
                      </Link>
                    </Button>
                    <Button onClick={() => window.location.reload()}>
                      Re-run Diagnostics
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </div>
    </div>
  )
}

