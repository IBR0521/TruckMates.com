"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Shield, Calendar, FileWarning } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import {
  createComplianceRegistration,
  deleteComplianceRegistration,
  getComplianceRegistrations,
  updateComplianceRegistration,
  type ComplianceRegistrationStatus,
  type ComplianceRegistrationType,
} from "@/app/actions/compliance-registrations"
import {
  createRoadsideInspection,
  deleteRoadsideInspection,
  getRoadsideInspections,
  updateRoadsideInspection,
} from "@/app/actions/roadside-inspections"
import {
  createIncident,
  deleteIncident,
  exportAccidentRegisterPdfBase64,
  getIncidents,
  updateIncident,
} from "@/app/actions/incidents"
import { getDrivers } from "@/app/actions/drivers"
import { getTrucks } from "@/app/actions/trucks"
import { Download } from "lucide-react"

const VALID_TABS = ["registrations", "roadside", "incidents", "ifta", "eld"] as const
type ComplianceTab = (typeof VALID_TABS)[number]

type ComplianceRegistration = {
  id: string
  type: ComplianceRegistrationType
  status: ComplianceRegistrationStatus
  filed_date?: string | null
  expiry_date: string
  state?: string | null
  notes?: string | null
  company_id: string
}

function daysUntil(date: string) {
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function prettyType(type: ComplianceRegistrationType) {
  if (type === "mcs150") return "MCS-150"
  if (type === "operating_authority") return "Operating Authority"
  return type.toUpperCase()
}

export default function CompliancePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = (searchParams.get("tab") || "registrations").toLowerCase()
  const activeTab = (VALID_TABS as readonly string[]).includes(tabParam) ? (tabParam as ComplianceTab) : "registrations"

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<ComplianceRegistration[]>([])
  const [editItem, setEditItem] = useState<ComplianceRegistration | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({
    type: "ucr" as ComplianceRegistrationType,
    status: "active" as ComplianceRegistrationStatus,
    filed_date: "",
    expiry_date: "",
    state: "",
    notes: "",
  })
  const [roadsideLoading, setRoadsideLoading] = useState(true)
  const [roadsideSaving, setRoadsideSaving] = useState(false)
  const [roadsideItems, setRoadsideItems] = useState<any[]>([])
  const [roadsideEditItem, setRoadsideEditItem] = useState<any | null>(null)
  const [roadsideDeleteId, setRoadsideDeleteId] = useState<string | null>(null)
  const [roadsideDialogOpen, setRoadsideDialogOpen] = useState(false)
  const [drivers, setDrivers] = useState<any[]>([])
  const [trucks, setTrucks] = useState<any[]>([])
  const [incidentLoading, setIncidentLoading] = useState(true)
  const [incidentSaving, setIncidentSaving] = useState(false)
  const [incidentItems, setIncidentItems] = useState<any[]>([])
  const [incidentEditItem, setIncidentEditItem] = useState<any | null>(null)
  const [incidentDeleteId, setIncidentDeleteId] = useState<string | null>(null)
  const [incidentDialogOpen, setIncidentDialogOpen] = useState(false)
  const [exportingRegister, setExportingRegister] = useState(false)
  const [incidentForm, setIncidentForm] = useState({
    incident_date: "",
    location: "",
    type: "accident",
    dot_reportable: false,
    injuries: false,
    fatalities: false,
    hazardous_material_released: false,
    vehicles_involved: "",
    description: "",
    driver_id: "",
    truck_id: "",
    police_report_url: "",
    photos_text: "",
    claim_status: "open",
    insurer_notified_date: "",
  })
  const [roadsideForm, setRoadsideForm] = useState({
    inspection_date: "",
    location: "",
    inspector_name: "",
    level: "I",
    violations_text: "",
    out_of_service: false,
    out_of_service_cleared_date: "",
    driver_id: "",
    truck_id: "",
  })

  async function loadItems() {
    setLoading(true)
    const result = await getComplianceRegistrations()
    if (result.error) {
      toast.error(result.error)
      setItems([])
    } else {
      setItems((result.data as ComplianceRegistration[]) || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    void loadItems()
    void loadRoadsideInspections()
    void loadIncidents()
    void loadDriverTruckOptions()
  }, [])

  async function loadDriverTruckOptions() {
    const [driversResult, trucksResult] = await Promise.all([getDrivers({ limit: 200 }), getTrucks({ limit: 200 })])
    if (driversResult.data) setDrivers(driversResult.data)
    if (trucksResult.data) setTrucks(trucksResult.data)
  }

  async function loadRoadsideInspections() {
    setRoadsideLoading(true)
    const result = await getRoadsideInspections()
    if (result.error) {
      toast.error(result.error)
      setRoadsideItems([])
    } else {
      setRoadsideItems(result.data || [])
    }
    setRoadsideLoading(false)
  }

  async function loadIncidents() {
    setIncidentLoading(true)
    const result = await getIncidents()
    if (result.error) {
      toast.error(result.error)
      setIncidentItems([])
    } else {
      setIncidentItems(result.data || [])
    }
    setIncidentLoading(false)
  }

  function openRoadsideCreate() {
    setRoadsideEditItem(null)
    setRoadsideForm({
      inspection_date: "",
      location: "",
      inspector_name: "",
      level: "I",
      violations_text: "",
      out_of_service: false,
      out_of_service_cleared_date: "",
      driver_id: "",
      truck_id: "",
    })
    setRoadsideDialogOpen(true)
  }

  function openRoadsideEdit(item: any) {
    setRoadsideEditItem(item)
    setRoadsideForm({
      inspection_date: item.inspection_date || "",
      location: item.location || "",
      inspector_name: item.inspector_name || "",
      level: item.level || "I",
      violations_text: Array.isArray(item.violations) ? item.violations.join("\n") : "",
      out_of_service: Boolean(item.out_of_service),
      out_of_service_cleared_date: item.out_of_service_cleared_date || "",
      driver_id: item.driver_id || "",
      truck_id: item.truck_id || "",
    })
    setRoadsideDialogOpen(true)
  }

  async function handleRoadsideSave() {
    if (!roadsideForm.inspection_date) {
      toast.error("Inspection date is required")
      return
    }

    setRoadsideSaving(true)
    const violations = roadsideForm.violations_text
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean)

    const payload = {
      inspection_date: roadsideForm.inspection_date,
      location: roadsideForm.location || undefined,
      inspector_name: roadsideForm.inspector_name || undefined,
      level: roadsideForm.level as "I" | "II" | "III" | "IV" | "V" | "VI",
      violations,
      out_of_service: roadsideForm.out_of_service,
      out_of_service_cleared_date: roadsideForm.out_of_service_cleared_date || undefined,
      driver_id: roadsideForm.driver_id || undefined,
      truck_id: roadsideForm.truck_id || undefined,
    }

    const result = roadsideEditItem
      ? await updateRoadsideInspection(roadsideEditItem.id, payload)
      : await createRoadsideInspection(payload)

    if (result.error) toast.error(result.error)
    else {
      toast.success(roadsideEditItem ? "Inspection updated" : "Inspection added")
      setRoadsideDialogOpen(false)
      await loadRoadsideInspections()
    }
    setRoadsideSaving(false)
  }

  async function handleRoadsideDelete() {
    if (!roadsideDeleteId) return
    const result = await deleteRoadsideInspection(roadsideDeleteId)
    if (result.error) toast.error(result.error)
    else {
      toast.success("Inspection deleted")
      await loadRoadsideInspections()
    }
    setRoadsideDeleteId(null)
  }

  function openIncidentCreate() {
    setIncidentEditItem(null)
    setIncidentForm({
      incident_date: "",
      location: "",
      type: "accident",
      dot_reportable: false,
      injuries: false,
      fatalities: false,
      hazardous_material_released: false,
      vehicles_involved: "",
      description: "",
      driver_id: "",
      truck_id: "",
      police_report_url: "",
      photos_text: "",
      claim_status: "open",
      insurer_notified_date: "",
    })
    setIncidentDialogOpen(true)
  }

  function openIncidentEdit(item: any) {
    setIncidentEditItem(item)
    setIncidentForm({
      incident_date: item.incident_date || "",
      location: item.location || "",
      type: item.type || "accident",
      dot_reportable: Boolean(item.dot_reportable),
      injuries: Boolean(item.injuries),
      fatalities: Boolean(item.fatalities),
      hazardous_material_released: Boolean(item.hazardous_material_released),
      vehicles_involved: item.vehicles_involved != null ? String(item.vehicles_involved) : "",
      description: item.description || "",
      driver_id: item.driver_id || "",
      truck_id: item.truck_id || "",
      police_report_url: item.police_report_url || "",
      photos_text: Array.isArray(item.photos) ? item.photos.join("\n") : "",
      claim_status: item.claim_status || "open",
      insurer_notified_date: item.insurer_notified_date || "",
    })
    setIncidentDialogOpen(true)
  }

  async function handleIncidentSave() {
    if (!incidentForm.incident_date) {
      toast.error("Incident date is required")
      return
    }

    setIncidentSaving(true)
    const photos = incidentForm.photos_text
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean)

    const payload = {
      incident_date: incidentForm.incident_date,
      location: incidentForm.location || undefined,
      type: incidentForm.type as "accident" | "citation" | "cargo_damage" | "near_miss",
      dot_reportable: incidentForm.dot_reportable,
      injuries: incidentForm.injuries,
      fatalities: incidentForm.fatalities,
      hazardous_material_released: incidentForm.hazardous_material_released,
      vehicles_involved: incidentForm.vehicles_involved ? Number(incidentForm.vehicles_involved) : undefined,
      description: incidentForm.description || undefined,
      driver_id: incidentForm.driver_id || undefined,
      truck_id: incidentForm.truck_id || undefined,
      police_report_url: incidentForm.police_report_url || undefined,
      photos,
      claim_status: incidentForm.claim_status || undefined,
      insurer_notified_date: incidentForm.insurer_notified_date || undefined,
    }

    const result = incidentEditItem ? await updateIncident(incidentEditItem.id, payload) : await createIncident(payload)
    if (result.error) toast.error(result.error)
    else {
      toast.success(incidentEditItem ? "Incident updated" : "Incident added")
      setIncidentDialogOpen(false)
      await loadIncidents()
    }
    setIncidentSaving(false)
  }

  async function handleIncidentDelete() {
    if (!incidentDeleteId) return
    const result = await deleteIncident(incidentDeleteId)
    if (result.error) toast.error(result.error)
    else {
      toast.success("Incident deleted")
      await loadIncidents()
    }
    setIncidentDeleteId(null)
  }

  async function handleExportAccidentRegister() {
    setExportingRegister(true)
    const result = await exportAccidentRegisterPdfBase64()
    if (result.error || !result.data?.base64) {
      toast.error(result.error || "Failed to export accident register")
      setExportingRegister(false)
      return
    }
    const bytes = atob(result.data.base64)
    const arr = new Uint8Array(bytes.length)
    for (let i = 0; i < bytes.length; i += 1) arr[i] = bytes.charCodeAt(i)
    const blob = new Blob([arr], { type: "application/pdf" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = result.data.filename || "fmcsa-accident-register.pdf"
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    toast.success("Accident register exported")
    setExportingRegister(false)
  }

  const totals = useMemo(() => {
    const active = items.filter((i) => i.status === "active").length
    const expiringSoon = items.filter((i) => {
      const d = daysUntil(i.expiry_date)
      return d >= 0 && d <= 60
    }).length
    const expired = items.filter((i) => daysUntil(i.expiry_date) < 0 || i.status === "expired").length
    return { total: items.length, active, expiringSoon, expired }
  }, [items])

  function openCreate() {
    setEditItem(null)
    setForm({ type: "ucr", status: "active", filed_date: "", expiry_date: "", state: "", notes: "" })
    setDialogOpen(true)
  }

  function openEdit(item: ComplianceRegistration) {
    setEditItem(item)
    setForm({
      type: item.type,
      status: item.status,
      filed_date: item.filed_date || "",
      expiry_date: item.expiry_date || "",
      state: item.state || "",
      notes: item.notes || "",
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.expiry_date) {
      toast.error("Expiry date is required")
      return
    }

    setSaving(true)
    const payload = {
      type: form.type,
      status: form.status,
      filed_date: form.filed_date || undefined,
      expiry_date: form.expiry_date,
      state: form.state || undefined,
      notes: form.notes || undefined,
    }

    const result = editItem
      ? await updateComplianceRegistration(editItem.id, payload)
      : await createComplianceRegistration(payload)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(editItem ? "Registration updated" : "Registration added")
      setDialogOpen(false)
      await loadItems()
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!deleteId) return
    const result = await deleteComplianceRegistration(deleteId)
    if (result.error) toast.error(result.error)
    else {
      toast.success("Registration deleted")
      await loadItems()
    }
    setDeleteId(null)
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
        <h1 className="text-3xl font-bold text-foreground">Compliance</h1>
        <p className="text-muted-foreground text-sm mt-1">IFTA, ELD, and registration renewals in one place.</p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => router.push(`/dashboard/compliance?tab=${encodeURIComponent(value)}`)}
        className="w-full"
      >
        <TabsList className="mx-4 md:mx-8 mt-4 grid w-fit grid-cols-5">
          <TabsTrigger value="registrations">Registrations</TabsTrigger>
          <TabsTrigger value="roadside">Roadside</TabsTrigger>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="ifta">IFTA</TabsTrigger>
          <TabsTrigger value="eld">ELD</TabsTrigger>
        </TabsList>

        <TabsContent value="registrations">
          <div className="p-4 md:p-8 space-y-6">
            <div className="grid md:grid-cols-4 gap-4">
              <Card className="p-4"><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold">{totals.total}</p></Card>
              <Card className="p-4"><p className="text-sm text-muted-foreground">Active</p><p className="text-2xl font-bold text-green-500">{totals.active}</p></Card>
              <Card className="p-4"><p className="text-sm text-muted-foreground">Expiring (<=60d)</p><p className="text-2xl font-bold text-amber-500">{totals.expiringSoon}</p></Card>
              <Card className="p-4"><p className="text-sm text-muted-foreground">Expired</p><p className="text-2xl font-bold text-red-500">{totals.expired}</p></Card>
            </div>

            <div className="flex justify-end">
              <Button onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Add Registration
              </Button>
            </div>

            <Card className="p-0 overflow-hidden">
              {loading ? (
                <div className="p-8 text-center text-muted-foreground">Loading registrations...</div>
              ) : items.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No registrations yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="px-4 py-3 text-left">Type</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-left">Filed</th>
                        <th className="px-4 py-3 text-left">Expiry</th>
                        <th className="px-4 py-3 text-left">State</th>
                        <th className="px-4 py-3 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        const d = daysUntil(item.expiry_date)
                        const nearing = d >= 0 && d <= 60
                        const expired = d < 0 || item.status === "expired"
                        return (
                          <tr key={item.id} className="border-b border-border">
                            <td className="px-4 py-3 font-medium">{prettyType(item.type)}</td>
                            <td className="px-4 py-3">
                              <Badge variant={expired ? "destructive" : nearing ? "secondary" : "outline"}>{item.status}</Badge>
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">{item.filed_date || "-"}</td>
                            <td className="px-4 py-3">
                              <div className="text-sm">{item.expiry_date}</div>
                              <div className={`text-xs ${expired ? "text-red-500" : nearing ? "text-amber-500" : "text-muted-foreground"}`}>
                                {expired ? `${Math.abs(d)} days overdue` : `${d} days remaining`}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">{item.state || "-"}</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => openEdit(item)}>Edit</Button>
                                <Button size="sm" variant="outline" onClick={() => setDeleteId(item.id)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="roadside">
          <div className="p-4 md:p-8 space-y-6">
            <div className="flex justify-end">
              <Button onClick={openRoadsideCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Add Inspection
              </Button>
            </div>
            <Card className="p-0 overflow-hidden">
              {roadsideLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading roadside inspections...</div>
              ) : roadsideItems.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No roadside inspections logged.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-left">Location</th>
                        <th className="px-4 py-3 text-left">Level</th>
                        <th className="px-4 py-3 text-left">Violations</th>
                        <th className="px-4 py-3 text-left">OOS</th>
                        <th className="px-4 py-3 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roadsideItems.map((item) => (
                        <tr key={item.id} className="border-b border-border">
                          <td className="px-4 py-3">{item.inspection_date}</td>
                          <td className="px-4 py-3">{item.location || "-"}</td>
                          <td className="px-4 py-3">{item.level}</td>
                          <td className="px-4 py-3">{Array.isArray(item.violations) ? item.violations.length : 0}</td>
                          <td className="px-4 py-3">
                            <Badge variant={item.out_of_service ? "destructive" : "outline"}>
                              {item.out_of_service ? "Yes" : "No"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => openRoadsideEdit(item)}>Edit</Button>
                              <Button size="sm" variant="outline" onClick={() => setRoadsideDeleteId(item.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="incidents">
          <div className="p-4 md:p-8 space-y-6">
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleExportAccidentRegister} disabled={exportingRegister}>
                <Download className="w-4 h-4 mr-2" />
                {exportingRegister ? "Exporting..." : "Export Accident Register"}
              </Button>
              <Button onClick={openIncidentCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Add Incident
              </Button>
            </div>
            <Card className="p-0 overflow-hidden">
              {incidentLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading incidents...</div>
              ) : incidentItems.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No incidents logged.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-left">Type</th>
                        <th className="px-4 py-3 text-left">Location</th>
                        <th className="px-4 py-3 text-left">DOT Reportable</th>
                        <th className="px-4 py-3 text-left">Claim</th>
                        <th className="px-4 py-3 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {incidentItems.map((item) => (
                        <tr key={item.id} className="border-b border-border">
                          <td className="px-4 py-3">{item.incident_date}</td>
                          <td className="px-4 py-3">{String(item.type).replace("_", " ")}</td>
                          <td className="px-4 py-3">{item.location || "-"}</td>
                          <td className="px-4 py-3">
                            <Badge variant={item.dot_reportable ? "destructive" : "outline"}>
                              {item.dot_reportable ? "Yes" : "No"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">{item.claim_status || "-"}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => openIncidentEdit(item)}>Edit</Button>
                              <Button size="sm" variant="outline" onClick={() => setIncidentDeleteId(item.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ifta">
          <div className="p-8">
            <Card className="p-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">IFTA</h3>
                <p className="text-sm text-muted-foreground">Manage quarterly IFTA reports and trip sheets.</p>
              </div>
              <Link href="/dashboard/ifta"><Button><Calendar className="w-4 h-4 mr-2" />Open IFTA</Button></Link>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="eld">
          <div className="p-8">
            <Card className="p-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">ELD</h3>
                <p className="text-sm text-muted-foreground">Review logs, violations, and compliance health.</p>
              </div>
              <Link href="/dashboard/eld"><Button><Shield className="w-4 h-4 mr-2" />Open ELD</Button></Link>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit registration" : "Add registration"}</DialogTitle>
            <DialogDescription>Track UCR / IRP / MCS-150 / Operating Authority expiry and status.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v: ComplianceRegistrationType) => setForm((p) => ({ ...p, type: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ucr">UCR</SelectItem>
                  <SelectItem value="irp">IRP</SelectItem>
                  <SelectItem value="mcs150">MCS-150</SelectItem>
                  <SelectItem value="operating_authority">Operating Authority</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v: ComplianceRegistrationStatus) => setForm((p) => ({ ...p, status: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending_renewal">Pending Renewal</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Filed Date</Label>
                <Input type="date" className="mt-1" value={form.filed_date} onChange={(e) => setForm((p) => ({ ...p, filed_date: e.target.value }))} />
              </div>
              <div>
                <Label>Expiry Date</Label>
                <Input type="date" className="mt-1" value={form.expiry_date} onChange={(e) => setForm((p) => ({ ...p, expiry_date: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>State</Label>
              <Input className="mt-1" placeholder="TX" value={form.state} onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))} />
            </div>
            <div>
              <Label>Notes</Label>
              <Input className="mt-1" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editItem ? "Update Registration" : "Create Registration"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete registration?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              <FileWarning className="w-4 h-4 mr-2" />
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={roadsideDialogOpen} onOpenChange={setRoadsideDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{roadsideEditItem ? "Edit roadside inspection" : "Add roadside inspection"}</DialogTitle>
            <DialogDescription>Log DOT roadside inspections for CSA awareness and follow-up.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Inspection Date</Label>
                <Input type="date" className="mt-1" value={roadsideForm.inspection_date} onChange={(e) => setRoadsideForm((p) => ({ ...p, inspection_date: e.target.value }))} />
              </div>
              <div>
                <Label>Level</Label>
                <Select value={roadsideForm.level} onValueChange={(v) => setRoadsideForm((p) => ({ ...p, level: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="I">Level I</SelectItem>
                    <SelectItem value="II">Level II</SelectItem>
                    <SelectItem value="III">Level III</SelectItem>
                    <SelectItem value="IV">Level IV</SelectItem>
                    <SelectItem value="V">Level V</SelectItem>
                    <SelectItem value="VI">Level VI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Location</Label>
              <Input className="mt-1" value={roadsideForm.location} onChange={(e) => setRoadsideForm((p) => ({ ...p, location: e.target.value }))} />
            </div>
            <div>
              <Label>Inspector Name</Label>
              <Input className="mt-1" value={roadsideForm.inspector_name} onChange={(e) => setRoadsideForm((p) => ({ ...p, inspector_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Driver</Label>
                <Select value={roadsideForm.driver_id || "none"} onValueChange={(v) => setRoadsideForm((p) => ({ ...p, driver_id: v === "none" ? "" : v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {drivers.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Truck</Label>
                <Select value={roadsideForm.truck_id || "none"} onValueChange={(v) => setRoadsideForm((p) => ({ ...p, truck_id: v === "none" ? "" : v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {trucks.map((t) => <SelectItem key={t.id} value={t.id}>{t.truck_number || t.id}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Violations (one per line)</Label>
              <Textarea className="mt-1" rows={4} value={roadsideForm.violations_text} onChange={(e) => setRoadsideForm((p) => ({ ...p, violations_text: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Out of Service</Label>
                <Select value={roadsideForm.out_of_service ? "yes" : "no"} onValueChange={(v) => setRoadsideForm((p) => ({ ...p, out_of_service: v === "yes" }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>OOS Cleared Date</Label>
                <Input type="date" className="mt-1" value={roadsideForm.out_of_service_cleared_date} onChange={(e) => setRoadsideForm((p) => ({ ...p, out_of_service_cleared_date: e.target.value }))} />
              </div>
            </div>
            <Button className="w-full" onClick={handleRoadsideSave} disabled={roadsideSaving}>
              {roadsideSaving ? "Saving..." : roadsideEditItem ? "Update Inspection" : "Create Inspection"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!roadsideDeleteId} onOpenChange={(open) => !open && setRoadsideDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete roadside inspection?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRoadsideDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={incidentDialogOpen} onOpenChange={setIncidentDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{incidentEditItem ? "Edit incident" : "Add incident"}</DialogTitle>
            <DialogDescription>Track accidents, citations, cargo damage, and near-miss events.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Incident Date</Label>
                <Input type="date" className="mt-1" value={incidentForm.incident_date} onChange={(e) => setIncidentForm((p) => ({ ...p, incident_date: e.target.value }))} />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={incidentForm.type} onValueChange={(v) => setIncidentForm((p) => ({ ...p, type: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="accident">Accident</SelectItem>
                    <SelectItem value="citation">Citation</SelectItem>
                    <SelectItem value="cargo_damage">Cargo Damage</SelectItem>
                    <SelectItem value="near_miss">Near Miss</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Location</Label>
              <Input className="mt-1" value={incidentForm.location} onChange={(e) => setIncidentForm((p) => ({ ...p, location: e.target.value }))} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea className="mt-1" rows={4} value={incidentForm.description} onChange={(e) => setIncidentForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Driver</Label>
                <Select value={incidentForm.driver_id || "none"} onValueChange={(v) => setIncidentForm((p) => ({ ...p, driver_id: v === "none" ? "" : v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {drivers.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Truck</Label>
                <Select value={incidentForm.truck_id || "none"} onValueChange={(v) => setIncidentForm((p) => ({ ...p, truck_id: v === "none" ? "" : v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {trucks.map((t) => <SelectItem key={t.id} value={t.id}>{t.truck_number || t.id}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Vehicles Involved</Label>
                <Input type="number" min="1" className="mt-1" value={incidentForm.vehicles_involved} onChange={(e) => setIncidentForm((p) => ({ ...p, vehicles_involved: e.target.value }))} />
              </div>
              <div>
                <Label>Claim Status</Label>
                <Select value={incidentForm.claim_status} onValueChange={(v) => setIncidentForm((p) => ({ ...p, claim_status: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                    <SelectItem value="settled">Settled</SelectItem>
                    <SelectItem value="denied">Denied</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Police Report URL</Label>
              <Input className="mt-1" value={incidentForm.police_report_url} onChange={(e) => setIncidentForm((p) => ({ ...p, police_report_url: e.target.value }))} />
            </div>
            <div>
              <Label>Photo URLs (one per line)</Label>
              <Textarea className="mt-1" rows={3} value={incidentForm.photos_text} onChange={(e) => setIncidentForm((p) => ({ ...p, photos_text: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Insurer Notified Date</Label>
                <Input type="date" className="mt-1" value={incidentForm.insurer_notified_date} onChange={(e) => setIncidentForm((p) => ({ ...p, insurer_notified_date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Flags</Label>
                <Select value={incidentForm.dot_reportable ? "yes" : "no"} onValueChange={(v) => setIncidentForm((p) => ({ ...p, dot_reportable: v === "yes" }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="DOT reportable" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">DOT Reportable: No</SelectItem>
                    <SelectItem value="yes">DOT Reportable: Yes</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={incidentForm.injuries ? "yes" : "no"} onValueChange={(v) => setIncidentForm((p) => ({ ...p, injuries: v === "yes" }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Injuries" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">Injuries: No</SelectItem>
                    <SelectItem value="yes">Injuries: Yes</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={incidentForm.fatalities ? "yes" : "no"} onValueChange={(v) => setIncidentForm((p) => ({ ...p, fatalities: v === "yes" }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Fatalities" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">Fatalities: No</SelectItem>
                    <SelectItem value="yes">Fatalities: Yes</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={incidentForm.hazardous_material_released ? "yes" : "no"} onValueChange={(v) => setIncidentForm((p) => ({ ...p, hazardous_material_released: v === "yes" }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Hazmat released" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">Hazmat Released: No</SelectItem>
                    <SelectItem value="yes">Hazmat Released: Yes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full" onClick={handleIncidentSave} disabled={incidentSaving}>
              {incidentSaving ? "Saving..." : incidentEditItem ? "Update Incident" : "Create Incident"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!incidentDeleteId} onOpenChange={(open) => !open && setIncidentDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete incident?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleIncidentDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

