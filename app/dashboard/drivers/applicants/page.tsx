"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { FileText, Plus, RefreshCw, UserPlus, Trash2 } from "lucide-react"
import {
  createDriverApplication,
  deleteDriverApplication,
  generateDriverApplicationPdf,
  getDriverApplications,
  updateDriverApplication,
  convertApplicantToDriver,
  type DriverApplicationStage,
} from "@/app/actions/driver-applications"

type Applicant = {
  id: string
  applicant_name: string
  email?: string | null
  phone?: string | null
  cdl_number?: string | null
  cdl_state?: string | null
  cdl_class?: string | null
  endorsements?: string[] | null
  years_experience?: number | null
  stage: DriverApplicationStage
  applied_date: string
  notes?: string | null
  converted_driver_id?: string | null
}

const stages: DriverApplicationStage[] = ["applied", "screening", "interview", "offer", "hired", "rejected"]

export default function DriverApplicantsPage() {
  const [rows, setRows] = useState<Applicant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [stageFilter, setStageFilter] = useState<string>("all")
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    applicant_name: "",
    email: "",
    phone: "",
    cdl_number: "",
    cdl_state: "",
    cdl_class: "A",
    endorsements: "",
    years_experience: "",
    notes: "",
  })

  async function load() {
    setLoading(true)
    const res = await getDriverApplications({
      stage: stageFilter !== "all" ? stageFilter : undefined,
      search: search || undefined,
    })
    if (res.error) {
      toast.error(res.error)
      setRows([])
    } else {
      setRows((res.data || []) as Applicant[])
    }
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [stageFilter])

  async function onCreate() {
    setSaving(true)
    const payload = {
      applicant_name: form.applicant_name,
      email: form.email || undefined,
      phone: form.phone || undefined,
      cdl_number: form.cdl_number || undefined,
      cdl_state: form.cdl_state || undefined,
      cdl_class: form.cdl_class || undefined,
      endorsements: form.endorsements
        .split(",")
        .map((v) => v.trim().toUpperCase())
        .filter(Boolean),
      years_experience: form.years_experience ? Number(form.years_experience) : undefined,
      notes: form.notes || undefined,
    }
    const res = await createDriverApplication(payload)
    setSaving(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success("Applicant created")
    setShowCreate(false)
    setForm({
      applicant_name: "",
      email: "",
      phone: "",
      cdl_number: "",
      cdl_state: "",
      cdl_class: "A",
      endorsements: "",
      years_experience: "",
      notes: "",
    })
    await load()
  }

  return (
    <div className="p-4 md:p-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold">Driver Applicants</h2>
          <p className="text-sm text-muted-foreground">Track hiring pipeline and convert qualified applicants into drivers.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Applicant
          </Button>
        </div>
      </div>

      <Card className="p-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Input placeholder="Search applicant, email, phone, CDL..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger><SelectValue placeholder="Stage" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              {stages.map((stage) => <SelectItem key={stage} value={stage}>{stage}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="secondary" onClick={() => void load()}>Apply Filters</Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="px-3 py-2">Applicant</th>
                <th className="px-3 py-2">CDL</th>
                <th className="px-3 py-2">Experience</th>
                <th className="px-3 py-2">Stage</th>
                <th className="px-3 py-2">Applied</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-medium">{row.applicant_name}</div>
                    <div className="text-muted-foreground">{row.email || "no-email"} {row.phone ? `• ${row.phone}` : ""}</div>
                  </td>
                  <td className="px-3 py-2">{row.cdl_class || "-"} {row.cdl_state || ""} {row.cdl_number || ""}</td>
                  <td className="px-3 py-2">{row.years_experience ?? "-"}</td>
                  <td className="px-3 py-2">
                    <Select
                      value={row.stage}
                      onValueChange={async (value) => {
                        const result = await updateDriverApplication(row.id, { stage: value as DriverApplicationStage })
                        if (result.error) toast.error(result.error)
                        else {
                          toast.success("Stage updated")
                          await load()
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {stages.map((stage) => <SelectItem key={stage} value={stage}>{stage}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2">{row.applied_date || "-"}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const res = await generateDriverApplicationPdf(row.id)
                          if (res.error) toast.error(res.error)
                          else toast.success("DOT application PDF generated")
                        }}
                      >
                        <FileText className="h-3.5 w-3.5 mr-1" /> DOT PDF
                      </Button>
                      <Button
                        size="sm"
                        onClick={async () => {
                          const res = await convertApplicantToDriver(row.id)
                          if (res.error) toast.error(res.error)
                          else {
                            toast.success("Applicant converted to driver")
                            await load()
                          }
                        }}
                        disabled={!!row.converted_driver_id}
                      >
                        <UserPlus className="h-3.5 w-3.5 mr-1" /> Convert
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          const res = await deleteDriverApplication(row.id)
                          if (res.error) toast.error(res.error)
                          else {
                            toast.success("Applicant removed")
                            await load()
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      {row.converted_driver_id && <Badge variant="secondary">Converted</Badge>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && rows.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">No applicants found.</div>
        )}
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Driver Applicant</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Applicant Name *</Label>
              <Input value={form.applicant_name} onChange={(e) => setForm((p) => ({ ...p, applicant_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>CDL Number</Label><Input value={form.cdl_number} onChange={(e) => setForm((p) => ({ ...p, cdl_number: e.target.value }))} /></div>
              <div><Label>State</Label><Input value={form.cdl_state} onChange={(e) => setForm((p) => ({ ...p, cdl_state: e.target.value }))} /></div>
              <div><Label>Class</Label><Input value={form.cdl_class} onChange={(e) => setForm((p) => ({ ...p, cdl_class: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Endorsements (comma)</Label><Input value={form.endorsements} onChange={(e) => setForm((p) => ({ ...p, endorsements: e.target.value }))} /></div>
              <div><Label>Years Experience</Label><Input value={form.years_experience} onChange={(e) => setForm((p) => ({ ...p, years_experience: e.target.value }))} /></div>
            </div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => void onCreate()} disabled={saving}>{saving ? "Saving..." : "Create Applicant"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
