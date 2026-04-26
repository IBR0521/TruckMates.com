"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  autoMatchBankTransactions,
  getBankReconciliationData,
  getManualMatchCandidates,
  importBankStatementCsv,
  manuallyMatchBankTransaction,
  setBankTransactionStatus,
} from "@/app/actions/bank-reconciliation"

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount || 0)
}

export default function BankReconciliationPage() {
  const [loading, setLoading] = useState(true)
  const [imports, setImports] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [summary, setSummary] = useState({ total: 0, matched: 0, unmatched: 0, ignored: 0 })
  const [latestImportId, setLatestImportId] = useState<string | null>(null)

  const [fileName, setFileName] = useState("")
  const [accountName, setAccountName] = useState("")
  const [statementMonth, setStatementMonth] = useState(new Date().toISOString().slice(0, 10))
  const [csvText, setCsvText] = useState("")
  const [submittingImport, setSubmittingImport] = useState(false)

  const [manualTxnId, setManualTxnId] = useState<string | null>(null)
  const [manualOptions, setManualOptions] = useState<{ expenses: any[]; invoices: any[] }>({ expenses: [], invoices: [] })
  const [manualValue, setManualValue] = useState("")
  const [manualSubmitting, setManualSubmitting] = useState(false)

  const unmatchedRows = useMemo(
    () => transactions.filter((t) => String(t.status || "").toLowerCase() === "unmatched"),
    [transactions]
  )

  async function loadData() {
    setLoading(true)
    try {
      const result = await getBankReconciliationData()
      if (result.error || !result.data) {
        toast.error(result.error || "Failed to load reconciliation data")
        return
      }
      setImports(result.data.imports || [])
      setTransactions(result.data.transactions || [])
      setSummary(result.data.summary || { total: 0, matched: 0, unmatched: 0, ignored: 0 })
      setLatestImportId(result.data.latest_import_id || null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  async function handleImport() {
    if (!csvText.trim()) {
      toast.error("Paste CSV data first")
      return
    }
    setSubmittingImport(true)
    try {
      const result = await importBankStatementCsv({ csvText, fileName, accountName, statementMonth })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(`Imported ${result.data?.imported_count || 0} transactions`)
      setCsvText("")
      await loadData()
    } finally {
      setSubmittingImport(false)
    }
  }

  async function handleAutoMatch() {
    if (!latestImportId) {
      toast.error("Import a statement first")
      return
    }
    const result = await autoMatchBankTransactions(latestImportId)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success(`Auto-matched ${result.data?.matched_count || 0} transactions`)
    await loadData()
  }

  async function handleIgnore(transactionId: string) {
    const result = await setBankTransactionStatus({ transactionId, status: "ignored" })
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success("Transaction marked as ignored")
    await loadData()
  }

  async function openManualMatch(transactionId: string) {
    setManualTxnId(transactionId)
    setManualValue("")
    const result = await getManualMatchCandidates(transactionId)
    if (result.error || !result.data) {
      toast.error(result.error || "Failed to load candidates")
      setManualOptions({ expenses: [], invoices: [] })
      return
    }
    setManualOptions(result.data)
  }

  async function handleManualMatch() {
    if (!manualTxnId || !manualValue) {
      toast.error("Pick a record to match")
      return
    }
    const [entityType, entityId] = manualValue.split(":")
    if (!entityType || !entityId) {
      toast.error("Invalid selection")
      return
    }
    setManualSubmitting(true)
    try {
      const result = await manuallyMatchBankTransaction({
        transactionId: manualTxnId,
        entityType: entityType as "expense" | "vendor_invoice_payment",
        entityId,
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Transaction matched")
      setManualTxnId(null)
      await loadData()
    } finally {
      setManualSubmitting(false)
    }
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Bank Reconciliation</h1>
            <p className="text-muted-foreground text-sm mt-1">Import bank statements, auto-match AP payments, and review unmatched transactions.</p>
          </div>
          <Button variant="outline" onClick={() => void handleAutoMatch()} disabled={!latestImportId}>
            Re-run Auto Match
          </Button>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="grid md:grid-cols-4 gap-4">
            <Card className="p-4"><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold">{summary.total}</p></Card>
            <Card className="p-4"><p className="text-sm text-muted-foreground">Matched</p><p className="text-2xl font-bold text-green-500">{summary.matched}</p></Card>
            <Card className="p-4"><p className="text-sm text-muted-foreground">Unmatched</p><p className="text-2xl font-bold text-amber-500">{summary.unmatched}</p></Card>
            <Card className="p-4"><p className="text-sm text-muted-foreground">Ignored</p><p className="text-2xl font-bold text-slate-400">{summary.ignored}</p></Card>
          </div>

          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">Import Bank Statement CSV</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <div><Label>File Name</Label><Input value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="statement-apr.csv" /></div>
              <div><Label>Account Name</Label><Input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Main Operating" /></div>
              <div><Label>Statement Month</Label><Input type="date" value={statementMonth} onChange={(e) => setStatementMonth(e.target.value)} /></div>
            </div>
            <div>
              <Label>CSV Content</Label>
              <textarea
                className="mt-1 min-h-[160px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="date,description,amount"
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
              />
            </div>
            <Button onClick={() => void handleImport()} disabled={submittingImport}>
              {submittingImport ? "Importing..." : "Import and Auto Match"}
            </Button>
          </Card>

          <Card className="overflow-hidden">
            <div className="p-4 border-b border-border">
              <h2 className="text-lg font-semibold">Manual Review - Unmatched</h2>
            </div>
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Loading reconciliation data...</div>
            ) : unmatchedRows.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No unmatched transactions in latest statement.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Description</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Amount</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unmatchedRows.map((row) => (
                      <tr key={row.id} className="border-b border-border hover:bg-secondary/10">
                        <td className="px-4 py-3 text-sm">{row.txn_date}</td>
                        <td className="px-4 py-3 text-sm">{row.description || "-"}</td>
                        <td className="px-4 py-3 text-sm font-semibold">{formatCurrency(Number(row.amount || 0))}</td>
                        <td className="px-4 py-3"><Badge variant="outline">UNMATCHED</Badge></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => void openManualMatch(row.id)}>Match</Button>
                            <Button size="sm" variant="ghost" onClick={() => void handleIgnore(row.id)}>Ignore</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-2">Recent Imports</h3>
            {imports.length === 0 ? (
              <p className="text-sm text-muted-foreground">No statements imported yet.</p>
            ) : (
              <div className="space-y-2">
                {imports.map((row) => (
                  <div key={row.id} className="text-sm text-muted-foreground">
                    {row.imported_at} - {row.file_name || "statement.csv"} ({row.account_name || "Unspecified account"})
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <Dialog open={!!manualTxnId} onOpenChange={(open) => !open && setManualTxnId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual Match Transaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Matching Record</Label>
              <Select value={manualValue} onValueChange={setManualValue}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose expense or vendor payment" />
                </SelectTrigger>
                <SelectContent>
                  {manualOptions.expenses.map((expense) => (
                    <SelectItem key={`expense:${expense.id}`} value={`expense:${expense.id}`}>
                      {`Expense - ${expense.date} - ${formatCurrency(Number(expense.amount || 0))} - ${expense.category || "Uncategorized"}`}
                    </SelectItem>
                  ))}
                  {manualOptions.invoices.map((invoice) => (
                    <SelectItem key={`vendor_invoice_payment:${invoice.id}`} value={`vendor_invoice_payment:${invoice.id}`}>
                      {`Vendor Invoice - ${invoice.invoice_number} - ${formatCurrency(Number(invoice.amount || 0))}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => void handleManualMatch()} disabled={manualSubmitting || !manualValue}>
                {manualSubmitting ? "Saving..." : "Confirm Match"}
              </Button>
              <Button variant="outline" onClick={() => setManualTxnId(null)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
