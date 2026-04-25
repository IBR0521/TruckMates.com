"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, RefreshCw, Search } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getAuditLogFilterOptions, getAuditLogs, type AuditLogRow } from "@/app/actions/audit-logs"

export default function AuditLogsPage() {
  const [rows, setRows] = useState<AuditLogRow[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [options, setOptions] = useState<{ actions: string[]; resourceTypes: string[]; users: Array<{ id: string; label: string }> }>({
    actions: [],
    resourceTypes: [],
    users: [],
  })
  const [filters, setFilters] = useState({
    search: "",
    action: "all",
    resource_type: "all",
    user_id: "all",
    date_from: "",
    date_to: "",
  })

  const pageSize = 50

  const load = async (nextPage = page) => {
    setLoading(true)
    const result = await getAuditLogs({
      search: filters.search || undefined,
      action: filters.action !== "all" ? filters.action : undefined,
      resource_type: filters.resource_type !== "all" ? filters.resource_type : undefined,
      user_id: filters.user_id !== "all" ? filters.user_id : undefined,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
      limit: pageSize,
      offset: nextPage * pageSize,
    })
    setLoading(false)
    if (result.error || !result.data) {
      toast.error(result.error || "Failed to load audit logs")
      setRows([])
      setTotal(0)
      return
    }
    setRows(result.data)
    setTotal(result.count)
  }

  useEffect(() => {
    const loadFilters = async () => {
      const result = await getAuditLogFilterOptions()
      if (!result.error && result.data) setOptions(result.data)
    }
    void loadFilters()
  }, [])

  useEffect(() => {
    void load(page)
  }, [page])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total])

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
        <Link href="/dashboard/settings">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Settings
          </Button>
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Audit Logs</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Track who changed what, when, and from where.
        </p>
      </div>

      <div className="p-4 md:p-8 space-y-6">
        <Card className="border-border p-4 md:p-6 space-y-4">
          <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="lg:col-span-2">
              <Label className="mb-2 block">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={filters.search}
                  onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                  placeholder="action, resource, id"
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Action</Label>
              <Select value={filters.action} onValueChange={(value) => setFilters((f) => ({ ...f, action: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {options.actions.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-2 block">Resource</Label>
              <Select value={filters.resource_type} onValueChange={(value) => setFilters((f) => ({ ...f, resource_type: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {options.resourceTypes.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-2 block">User</Label>
              <Select value={filters.user_id} onValueChange={(value) => setFilters((f) => ({ ...f, user_id: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {options.users.map((u) => <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-2 block">From</Label>
              <Input type="date" value={filters.date_from} onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-2 block">To</Label>
              <Input type="date" value={filters.date_to} onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setPage(0)
                void load(0)
              }}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Apply Filters
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setFilters({ search: "", action: "all", resource_type: "all", user_id: "all", date_from: "", date_to: "" })
                setPage(0)
                setTimeout(() => void load(0), 0)
              }}
            >
              Reset
            </Button>
          </div>
        </Card>

        <Card className="border-border p-4 md:p-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-sm font-semibold">Timestamp</th>
                  <th className="text-left py-2 text-sm font-semibold">User</th>
                  <th className="text-left py-2 text-sm font-semibold">Action</th>
                  <th className="text-left py-2 text-sm font-semibold">Resource</th>
                  <th className="text-left py-2 text-sm font-semibold">Resource ID</th>
                  <th className="text-left py-2 text-sm font-semibold">Details</th>
                  <th className="text-left py-2 text-sm font-semibold">IP</th>
                </tr>
              </thead>
              <tbody>
                {!loading && rows.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No audit records found.</td></tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-b border-border/50 align-top">
                      <td className="py-3 text-sm text-foreground whitespace-nowrap">{new Date(row.created_at).toLocaleString()}</td>
                      <td className="py-3 text-sm text-foreground">{row.user_name}</td>
                      <td className="py-3 text-sm text-foreground">{row.action}</td>
                      <td className="py-3 text-sm text-foreground">{row.resource_type}</td>
                      <td className="py-3 text-xs text-muted-foreground">{row.resource_id || "—"}</td>
                      <td className="py-3 text-xs text-muted-foreground max-w-[360px]">
                        <pre className="whitespace-pre-wrap break-words">{JSON.stringify(row.details || {}, null, 2)}</pre>
                      </td>
                      <td className="py-3 text-xs text-muted-foreground">{row.ip_address || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {rows.length} of {total} records
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 0 || loading} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {page + 1} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page + 1 >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

