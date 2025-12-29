"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, FileText, Loader2 } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { autoGenerateInvoicesFromLoads } from "@/app/actions/invoices-auto"
import { useRouter } from "next/navigation"

export default function AutoGenerateInvoicesPage() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<any>(null)
  const router = useRouter()

  const handleGenerate = async () => {
    setIsGenerating(true)
    setResult(null)

    try {
      const response = await autoGenerateInvoicesFromLoads()
      
      if (response.error) {
        toast.error(response.error)
      } else {
        setResult(response.data)
        toast.success(`Successfully generated ${response.data?.generated || 0} invoice(s)`)
      }
    } catch (error) {
      toast.error("Failed to generate invoices")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/accounting/invoices">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Auto-Generate Invoices</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Automatically generate invoices from delivered loads
            </p>
          </div>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card className="p-6 border border-border/50">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-6 h-6 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Generate Invoices</h2>
            </div>
            <p className="text-muted-foreground mb-6">
              This will automatically create invoices for all delivered loads that don't have an invoice yet.
            </p>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Invoices"
              )}
            </Button>
          </Card>

          {result && (
            <Card className="p-6 border border-border/50">
              <h3 className="text-lg font-semibold text-foreground mb-4">Results</h3>
              <div className="space-y-2">
                <p className="text-foreground">
                  <span className="font-semibold">Generated:</span> {result.generated} invoice(s)
                </p>
                {result.message && (
                  <p className="text-muted-foreground">{result.message}</p>
                )}
                {result.errors && result.errors.length > 0 && (
                  <div className="mt-4">
                    <p className="font-semibold text-red-400 mb-2">Errors:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      {result.errors.map((error: any, index: number) => (
                        <li key={index}>
                          Load {error.load_id}: {error.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.generated > 0 && (
                  <Button
                    onClick={() => router.push("/dashboard/accounting/invoices")}
                    className="mt-4"
                    variant="outline"
                  >
                    View Invoices
                  </Button>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}


