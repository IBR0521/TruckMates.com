"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Plus, Eye, Download, FileText, Search, Send, FileDown, CheckCircle2, AlertTriangle, Layers } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { useMemo, useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getBOLs,
  getBOLStats,
  sendBOLEmail,
  updateBOLStatus,
  markBOLPODReceived,
} from "@/app/actions/bol"
import { generateBOLPDFFile } from "@/app/actions/bol-pdf"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { InlineStatusSelect } from "@/components/dashboard/inline-status-select"

export default function BOLsPage() {
  const [bolsList, setBolsList] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [stats, setStats] = useState({ total: 0, awaiting_signature: 0, sent: 0, completed_today: 0 })

  const loadBOLs = async () => {
    setIsLoading(true)
    const filters: any = {}
    if (statusFilter !== "all") filters.status = statusFilter
    if (searchTerm) filters.search = searchTerm

    const [listResult, statsResult] = await Promise.all([getBOLs(filters), getBOLStats()])

    if (listResult.error) {
      toast.error(listResult.error)
      setIsLoading(false)
      return
    }

    setBolsList(listResult.data || [])
    setStats(statsResult.data || { total: 0, awaiting_signature: 0, sent: 0, completed_today: 0 })
    setIsLoading(false)
  }

  useEffect(() => {
    loadBOLs()
  }, [statusFilter])

  useEffect(() => {
    const debounce = setTimeout(() => {
      loadBOLs()
    }, 300)
    return () => clearTimeout(debounce)
  }, [searchTerm])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/50">Draft</Badge>
      case "sent":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">Sent</Badge>
      case "signed":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/50">Signed</Badge>
      case "delivered":
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/50">Delivered</Badge>
      case "completed":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50">Completed</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)))
  }

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? bolsList.map((b) => b.id) : [])
  }

  const handleDownloadPDF = async (bol: any) => {
    try {
      setDownloadingId(bol.id)
      const result = await generateBOLPDFFile(bol.id)
      if (result.error || !result.pdf) {
        toast.error(result.error || "Failed to generate PDF")
        return
      }

      const blob = new Blob([new Uint8Array(result.pdf)], { type: "application/pdf" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${bol.bol_number || "BOL"}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success("BOL PDF downloaded")
    } finally {
      setDownloadingId(null)
    }
  }

  const handleSend = async (bolId: string) => {
    setSendingId(bolId)
    const result = await sendBOLEmail(bolId)
    setSendingId(null)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success("BOL emailed to consignee")
    await loadBOLs()
  }

  const handleStatusChange = async (bolId: string, newStatus: string) => {
    const result = await updateBOLStatus(bolId, newStatus as any)
    if (result.error) {
      toast.error(result.error)
      throw new Error(result.error)
    }
    await loadBOLs()
  }

  const handleMarkPOD = async (bolId: string) => {
    const receivedBy = window.prompt("POD received by (name)") || ""
    if (!receivedBy.trim()) return
    const condition = window.prompt("Delivery condition (e.g. good / damaged)") || "good"
    const notes = window.prompt("POD notes (optional)") || undefined

    const result = await markBOLPODReceived(bolId, receivedBy.trim(), condition.trim() || "good", notes)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success("POD marked received")
    const invoiceAutomation = result.data?._invoice_automation
    if (invoiceAutomation?.triggered) {
      if (invoiceAutomation.error) {
        toast.warning(`Invoice automation: ${invoiceAutomation.error}`)
      } else if (invoiceAutomation.alreadyExists) {
        toast.info("Invoice already exists for this load")
      } else if (invoiceAutomation.invoiceId) {
        toast.success("Invoice auto-created from POD")
      }
    }
    await loadBOLs()
  }

  const handleBulkDownload = async () => {
    const selected = bolsList.filter((b) => selectedSet.has(b.id))
    if (selected.length === 0) return toast.error("Select at least one BOL")

    for (const bol of selected) {
      await handleDownloadPDF(bol)
    }
  }

  const handleBulkExport = () => {
    const selected = bolsList.filter((b) => selectedSet.has(b.id))
    if (selected.length === 0) return toast.error("Select at least one BOL")

    const rows = selected.map((b) => ({
      bol_number: b.bol_number,
      status: b.status,
      shipper_name: b.shipper_name,
      consignee_name: b.consignee_name,
      shipment_number: b.loads?.shipment_number || "",
      freight_description: b.loads?.contents || "",
      pickup_date: b.pickup_date,
      delivery_date: b.delivery_date,
      freight_charges: b.freight_charges,
    }))

    const csvHeader = Object.keys(rows[0] || {}).join(",")
    const csvBody = rows
      .map((r) =>
        Object.values(r)
          .map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n")

    const blob = new Blob([`${csvHeader}\n${csvBody}`], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `bols-export-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Bill of Lading</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage digital BOLs and e-signatures</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Link href="/dashboard/bols/templates" className="flex-1 sm:flex-initial">
            <Button variant="outline" className="w-full sm:w-auto">
              <Layers className="w-4 h-4 mr-2" />
              Templates
            </Button>
          </Link>
          <Link href="/dashboard/bols/create" className="flex-1 sm:flex-initial">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition w-full sm:w-auto">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Create BOL</span>
              <span className="sm:hidden">Create</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="p-4 md:p-8 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="p-4 border-border/60"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold">{stats.total}</p></Card>
          <Card className="p-4 border-border/60"><p className="text-xs text-muted-foreground">Awaiting Signature</p><p className="text-2xl font-bold text-amber-400">{stats.awaiting_signature}</p></Card>
          <Card className="p-4 border-border/60"><p className="text-xs text-muted-foreground">Sent</p><p className="text-2xl font-bold text-blue-400">{stats.sent}</p></Card>
          <Card className="p-4 border-border/60"><p className="text-xs text-muted-foreground">Completed Today</p><p className="text-2xl font-bold text-emerald-400">{stats.completed_today}</p></Card>
        </div>

        <div className="flex flex-col sm:flex-row gap-4" suppressHydrationWarning>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search BOLs by number, shipper, or consignee..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background border-border"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px] bg-background border-border">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="signed">Signed</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selectedIds.length > 0 && (
          <Card className="p-3 border-border/60 flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">{selectedIds.length} selected</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleBulkDownload}><FileDown className="w-4 h-4 mr-1" />Bulk download</Button>
              <Button size="sm" variant="outline" onClick={handleBulkExport}>Bulk export CSV</Button>
            </div>
          </Card>
        )}

        {isLoading ? (
          <Card className="border border-border/50 p-8 text-center">
            <p className="text-muted-foreground">Loading BOLs...</p>
          </Card>
        ) : bolsList.length === 0 ? (
          <Card className="border border-border/50 p-8 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No BOLs found</p>
          </Card>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border bg-card/50">
                  <th className="p-4 w-10">
                    <Checkbox checked={selectedIds.length > 0 && selectedIds.length === bolsList.length} onCheckedChange={(v) => toggleSelectAll(!!v)} />
                  </th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">BOL Number</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">Shipper</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">Consignee</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">Freight</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">Pickup Date</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">Status</th>
                  <th className="text-left p-4 text-sm font-semibold text-foreground">Signatures</th>
                  <th className="text-right p-4 text-sm font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bolsList.map((bol) => {
                  const hasAllSignatures = !!(bol.shipper_signature && bol.driver_signature && bol.consignee_signature)
                  const needsSignature = (bol.status === "sent" || bol.status === "signed" || bol.status === "delivered") && !hasAllSignatures
                  return (
                    <tr key={bol.id} className="border-b border-border/50 hover:bg-secondary/20 transition">
                      <td className="p-4">
                        <Checkbox checked={selectedSet.has(bol.id)} onCheckedChange={(v) => toggleSelect(bol.id, !!v)} />
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-foreground flex items-center gap-2">
                          {bol.bol_number}
                          {needsSignature && (
                            <span title="Needs signature">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                            </span>
                          )}
                        </div>
                        {bol.load_id ? <Link href={`/dashboard/loads/${bol.load_id}`} className="text-xs text-muted-foreground hover:text-primary">Load #{bol.loads?.shipment_number || bol.load_id.slice(0, 8)}</Link> : null}
                      </td>
                      <td className="p-4"><div className="text-foreground">{bol.shipper_name}</div></td>
                      <td className="p-4"><div className="text-foreground">{bol.consignee_name}</div></td>
                      <td className="p-4"><div className="text-sm text-foreground max-w-[220px] truncate">{bol.loads?.contents || "—"}</div></td>
                      <td className="p-4">{bol.pickup_date ? new Date(bol.pickup_date).toLocaleDateString() : <span className="text-muted-foreground">—</span>}</td>
                      <td className="p-4">
                        <div className="space-y-1">
                          {getStatusBadge(bol.status)}
                          <InlineStatusSelect
                            currentStatus={bol.status || "draft"}
                            availableStatuses={["draft", "sent", "signed", "delivered", "completed"]}
                            onStatusChange={(newStatus) => handleStatusChange(bol.id, newStatus)}
                          />
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {bol.shipper_signature && <Badge variant="outline" className="text-xs">Shipper</Badge>}
                          {bol.driver_signature && <Badge variant="outline" className="text-xs">Driver</Badge>}
                          {bol.consignee_signature && <Badge variant="outline" className="text-xs">Consignee</Badge>}
                          {!hasAllSignatures && <Badge className="text-xs bg-amber-500/20 text-amber-300 border-amber-500/40">Needs signature</Badge>}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleDownloadPDF(bol)} disabled={downloadingId === bol.id} title="Download PDF">
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleSend(bol.id)} disabled={sendingId === bol.id} title="Send via email">
                            <Send className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleMarkPOD(bol.id)} title="Mark POD received">
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                          <Link href={`/dashboard/bols/${bol.id}`}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
