"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, ShieldAlert } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  getCompanyDataSubjectRequests,
  updateDataSubjectRequest,
  type DataSubjectRequestRow,
} from "@/app/actions/data-subject-requests"

type FilterStatus = "all" | DataSubjectRequestRow["status"]

export default function PrivacyRequestsPage() {
  const [rows, setRows] = useState<DataSubjectRequestRow[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all")
  const [responseById, setResponseById] = useState<Record<string, string>>({})

  const loadRows = async () => {
    setLoading(true)
    const result = await getCompanyDataSubjectRequests()
    setLoading(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    setRows(result.data)
  }

  useEffect(() => {
    void loadRows()
  }, [])

  const filteredRows = useMemo(
    () => (statusFilter === "all" ? rows : rows.filter((row) => row.status === statusFilter)),
    [rows, statusFilter],
  )

  const mutate = async (
    id: string,
    status: "in_review" | "completed" | "rejected" | "cancelled",
    attachExport = false,
  ) => {
    const response = responseById[id] || ""
    const result = await updateDataSubjectRequest({
      id,
      status,
      response_notes: response,
      attach_export_payload: attachExport,
    })
    if (!result.success || result.error) {
      toast.error(result.error || "Update failed")
      return
    }
    toast.success(`Request marked ${status}`)
    await loadRows()
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
        <Link href="/dashboard/settings">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Settings
          </Button>
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
          <ShieldAlert className="w-6 h-6" />
          Privacy Requests (GDPR / CCPA)
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Track and process formal data subject requests with response deadlines.
        </p>
      </div>

      <div className="p-4 md:p-8 space-y-6">
        <Card className="border-border p-4 md:p-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Status filter</Label>
              <Input
                value={statusFilter}
                onChange={(e) => setStatusFilter((e.target.value || "all") as FilterStatus)}
                placeholder="all / pending / in_review / completed / overdue..."
                className="mt-2"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={() => void loadRows()} disabled={loading}>
                {loading ? "Refreshing..." : "Refresh queue"}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="border-border p-4 md:p-6">
          <div className="space-y-4">
            {filteredRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matching requests found.</p>
            ) : (
              filteredRows.map((row) => (
                <div key={row.id} className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">
                      {row.request_type.replaceAll("_", " ")} · {row.jurisdiction.toUpperCase()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Status: <span className="text-foreground font-medium">{row.status}</span>
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Requester: {row.requester_name || "Unknown"} ({row.requester_email || "no-email"}) · Submitted{" "}
                    {new Date(row.requested_at).toLocaleString()} · Due {new Date(row.due_at).toLocaleString()}
                  </p>
                  {row.description ? <p className="text-sm">{row.description}</p> : null}
                  <div>
                    <Label className="mb-2 block text-xs">Response notes</Label>
                    <Textarea
                      value={responseById[row.id] ?? row.response_notes ?? ""}
                      onChange={(e) => setResponseById((prev) => ({ ...prev, [row.id]: e.target.value }))}
                      rows={2}
                      placeholder="Internal/legal response notes"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => void mutate(row.id, "in_review")}>
                      Mark in review
                    </Button>
                    <Button size="sm" onClick={() => void mutate(row.id, "completed", row.request_type === "access_export")}>
                      Complete {row.request_type === "access_export" ? "+ attach export" : ""}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => void mutate(row.id, "rejected")}>
                      Reject
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void mutate(row.id, "cancelled")}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
