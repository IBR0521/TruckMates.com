"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Upload, FileText, CheckCircle, XCircle, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { importFuelCardData } from "@/app/actions/fuel-card-import"
import type { FuelCardImportResult } from "@/app/actions/fuel-card-import"

export default function FuelCardImportPage() {
  const [selectedProvider, setSelectedProvider] = useState<"comdata" | "wex" | "pfleet" | "auto">("auto")
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [importResult, setImportResult] = useState<FuelCardImportResult | null>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.type === "text/csv" || selectedFile.name.endsWith(".csv")) {
        setFile(selectedFile)
      } else {
        toast.error("Please select a CSV file")
      }
    }
  }

  const handleImport = async () => {
    if (!file) {
      toast.error("Please select a file to import")
      return
    }

    setIsUploading(true)
    setImportResult(null)

    try {
      const fileContent = await file.text()
      const result = await importFuelCardData(fileContent, file.name, selectedProvider)

      if (result.error) {
        toast.error(result.error)
      } else if (result.data) {
        setImportResult(result.data)
        if (result.data.success > 0) {
          toast.success(
            `Successfully imported ${result.data.success} fuel purchase${result.data.success !== 1 ? "s" : ""}`
          )
        }
        if (result.data.failed > 0) {
          toast.warning(`${result.data.failed} row${result.data.failed !== 1 ? "s" : ""} failed to import`)
        }
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to import fuel card data")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
        <Link href="/dashboard/accounting/tax-fuel">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Fuel Purchases
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Import Fuel Card Data</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Import fuel purchases from Comdata, Wex, P-Fleet, or other fuel card providers
          </p>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Instructions */}
          <Card className="border border-border/50 p-6">
            <h2 className="text-lg font-semibold mb-4">Import Instructions</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong>Supported Formats:</strong> CSV files from Comdata, Wex, P-Fleet, or similar providers
              </p>
              <p>
                <strong>Required Columns:</strong> Date, Gallons, Total Amount
              </p>
              <p>
                <strong>Optional Columns:</strong> Truck Number, Location, State, Price per Gallon
              </p>
              <p>
                <strong>Note:</strong> The system will automatically match truck numbers to your fleet. 
                If a truck number is not found, the purchase will still be imported but not linked to a specific truck.
              </p>
            </div>
          </Card>

          {/* Import Form */}
          <Card className="border border-border/50 p-6">
            <div className="space-y-6">
              <div>
                <Label htmlFor="provider">Fuel Card Provider</Label>
                <Select
                  value={selectedProvider}
                  onValueChange={(value) =>
                    setSelectedProvider(value as "comdata" | "wex" | "pfleet" | "auto")
                  }
                >
                  <SelectTrigger id="provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-Detect</SelectItem>
                    <SelectItem value="comdata">Comdata</SelectItem>
                    <SelectItem value="wex">Wex</SelectItem>
                    <SelectItem value="pfleet">P-Fleet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="file">CSV File</Label>
                <div className="mt-2">
                  <input
                    id="file"
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <label htmlFor="file">
                    <Button variant="outline" asChild>
                      <span>
                        <Upload className="w-4 h-4 mr-2" />
                        {file ? file.name : "Select CSV File"}
                      </span>
                    </Button>
                  </label>
                  {file && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                    </p>
                  )}
                </div>
              </div>

              <Button
                onClick={handleImport}
                disabled={!file || isUploading}
                className="w-full"
              >
                {isUploading ? "Importing..." : "Import Fuel Data"}
              </Button>
            </div>
          </Card>

          {/* Import Results */}
          {importResult && (
            <Card className="border border-border/50 p-6">
              <h2 className="text-lg font-semibold mb-4">Import Results</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-green-500/10 rounded-lg">
                    <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-green-500">{importResult.success}</p>
                    <p className="text-sm text-muted-foreground">Successfully Imported</p>
                  </div>
                  <div className="text-center p-4 bg-red-500/10 rounded-lg">
                    <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-red-500">{importResult.failed}</p>
                    <p className="text-sm text-muted-foreground">Failed</p>
                  </div>
                  <div className="text-center p-4 bg-blue-500/10 rounded-lg">
                    <FileText className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-blue-500">
                      {importResult.success + importResult.failed}
                    </p>
                    <p className="text-sm text-muted-foreground">Total Rows</p>
                  </div>
                </div>

                {importResult.errors.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Errors:</h3>
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {importResult.errors.map((error, i) => (
                        <div key={i} className="text-sm text-red-500 p-2 bg-red-500/10 rounded">
                          Row {error.row}: {error.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {importResult.imported.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Imported Purchases:</h3>
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {importResult.imported.slice(0, 10).map((purchase, i) => (
                        <div key={i} className="text-sm p-2 bg-green-500/10 rounded">
                          {purchase.purchase_date} - {purchase.state} - {purchase.gallons.toFixed(2)} gal - $
                          {purchase.total_cost.toFixed(2)}
                          {purchase.truck_number && ` - Truck: ${purchase.truck_number}`}
                        </div>
                      ))}
                      {importResult.imported.length > 10 && (
                        <p className="text-sm text-muted-foreground mt-2">
                          ... and {importResult.imported.length - 10} more
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}



