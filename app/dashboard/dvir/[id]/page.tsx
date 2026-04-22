"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  FileCheck,
  AlertTriangle,
  CheckCircle,
  Wrench,
  ExternalLink,
  MoreHorizontal,
  Printer,
  FileText,
  ArrowLeft,
  ArrowRight,
  Lightbulb,
  Settings,
  ShieldAlert,
} from "lucide-react"
import Link from "next/link"
import { use } from "react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { errorMessage } from "@/lib/error-message"
import { DetailPageLayout, DetailSection, InfoGrid, InfoField } from "@/components/dashboard/detail-page-layout"
import { getDVIR, getDVIRs } from "@/app/actions/dvir"
import { createWorkOrdersFromDVIRDefects, getDVIRWorkOrders } from "@/app/actions/dvir-enhanced"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function DVIRDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const aliveRef = useRef(true)
  const [dvir, setDvir] = useState<any>(null)
  const [workOrders, setWorkOrders] = useState<any[]>([])
  const [adjacentReports, setAdjacentReports] = useState<{ previous: string | null; next: string | null }>({
    previous: null,
    next: null,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [creatingWorkOrders, setCreatingWorkOrders] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)

  useEffect(() => {
    return () => {
      aliveRef.current = false
    }
  }, [])

  useEffect(() => {
    if (id === "add") {
      router.replace("/dashboard/dvir/add")
      return
    }

    async function loadDVIR() {
      const result = await getDVIR(id)
      if (result.error) {
        toast.error(result.error)
        if (aliveRef.current) router.push("/dashboard/dvir")
      } else if (result.data) {
        setDvir(result.data)
        const wo = await getDVIRWorkOrders(id)
        if (!wo.error && wo.data) {
          setWorkOrders(wo.data)
        }
        const list = await getDVIRs({ limit: 200, offset: 0 })
        if (!list.error && list.data?.length) {
          const index = list.data.findIndex((item: any) => item.id === id)
          if (index !== -1) {
            setAdjacentReports({
              previous: list.data[index + 1]?.id || null,
              next: list.data[index - 1]?.id || null,
            })
          }
        }
      }
      setIsLoading(false)
    }

    loadDVIR()
  }, [id, router])

  const handleCreateWorkOrders = async () => {
    setCreatingWorkOrders(true)
    try {
      const result = await createWorkOrdersFromDVIRDefects(id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(
        result.data?.length
          ? `Created ${result.data.length} maintenance work order(s)`
          : "Work order request completed",
      )
      const refreshed = await getDVIR(id)
      if (refreshed.data) setDvir(refreshed.data)
      const wo = await getDVIRWorkOrders(id)
      if (!wo.error && wo.data) setWorkOrders(wo.data)
    } finally {
      setCreatingWorkOrders(false)
    }
  }

  if (id === "add") {
    return null
  }

  if (isLoading) {
    return (
      <div className="w-full p-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading DVIR...</p>
        </div>
      </div>
    )
  }

  if (!dvir) {
    return null
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "passed":
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/50">Passed</Badge>
      case "failed":
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/50">Failed</Badge>
      case "defects_corrected":
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/50">Defects Corrected</Badge>
      default:
        return <Badge className="bg-gray-500/20 text-gray-500 border-gray-500/50">Pending</Badge>
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "pre_trip":
        return "Pre-Trip Inspection"
      case "post_trip":
        return "Post-Trip Inspection"
      case "on_road":
        return "On-Road Inspection"
      default:
        return type
    }
  }

  const getTypeClasses = (type: string) => {
    if (type === "post_trip") return "bg-blue-500/15 text-blue-300 border-blue-500/40"
    if (type === "on_road") return "bg-purple-500/15 text-purple-300 border-purple-500/40"
    return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
  }

  const notRecorded = <span className="text-sm text-muted-foreground">— Not recorded</span>

  const isMissingCriticalField = (value: unknown) =>
    value === null || value === undefined || value === "" || (typeof value === "number" && Number.isNaN(value))

  const missingComplianceFields = [
    isMissingCriticalField(dvir.inspection_time) ? "inspection time" : null,
    isMissingCriticalField(dvir.location) ? "location" : null,
    isMissingCriticalField(dvir.mileage) ? "mileage" : null,
    isMissingCriticalField(dvir.odometer_reading) ? "odometer reading" : null,
  ].filter(Boolean) as string[]

  const hasIncompleteComplianceRecord = missingComplianceFields.length > 0

  const getDefectIcon = (component: string) => {
    const normalized = String(component || "").toLowerCase()
    if (normalized.includes("light")) return <Lightbulb className="w-4 h-4 text-amber-300" />
    return <Settings className="w-4 h-4 text-muted-foreground" />
  }

  const formatTimestamp = (value?: string) => {
    if (!value) return notRecorded
    return new Date(value).toLocaleString()
  }

  const handleExportSinglePDF = async () => {
    setExportingPdf(true)
    try {
      const response = await fetch(`/api/dvir/${encodeURIComponent(id)}/pdf`)
      if (!response.ok) {
        let message = "Failed to export DVIR PDF"
        try {
          const body = await response.json()
          if (body?.error) message = body.error
        } catch {}
        toast.error(message)
        return
      }

      const contentType = response.headers.get("content-type")
      if (contentType === "application/pdf") {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `dvir-${String(id).slice(0, 8)}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success("DVIR PDF downloaded")
        return
      }

      const html = await response.text()
      const printWindow = window.open("", "_blank")
      if (!printWindow) {
        toast.error("Please allow popups to view the report")
        return
      }
      printWindow.document.write(html)
      printWindow.document.close()
      setTimeout(() => printWindow.print(), 300)
      toast.success("DVIR report opened for printing")
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Failed to export DVIR PDF"))
    } finally {
      setExportingPdf(false)
    }
  }

  const defects = Array.isArray(dvir.defects) ? dvir.defects : []
  const showCreateWorkOrderCta =
    !!dvir.defects_found && dvir.status !== "defects_corrected"
  const correctedDefects = defects.filter((defect: any) => defect.corrected).length
  const outstandingDefects = Math.max(0, defects.length - correctedDefects)

  return (
    <DetailPageLayout
      title={`DVIR Report - ${getTypeLabel(dvir.inspection_type)}`}
      subtitle={
        <span className="inline-flex items-center gap-2">
          <span>{dvir.drivers?.name || "Unknown Driver"} • {dvir.trucks?.truck_number || "N/A"}</span>
          {getStatusBadge(dvir.status)}
          {dvir.safe_to_operate ? (
            <Badge className="bg-green-500/20 text-green-500 border-green-500/50">
              <CheckCircle className="w-3 h-3 mr-1" />
              Safe to Operate
            </Badge>
          ) : (
            <Badge className="bg-red-500/20 text-red-500 border-red-500/50">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Unsafe
            </Badge>
          )}
        </span>
      }
      backUrl="/dashboard/dvir"
      editUrl={`/dashboard/dvir/${encodeURIComponent(dvir.id)}/edit`}
      actions={
        <>
          {adjacentReports.previous && (
            <Link href={`/dashboard/dvir/${adjacentReports.previous}`}>
              <Button variant="outline" size="sm" className="h-9 border-border/70 bg-transparent">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Previous Report
              </Button>
            </Link>
          )}
          {adjacentReports.next && (
            <Link href={`/dashboard/dvir/${adjacentReports.next}`}>
              <Button variant="outline" size="sm" className="h-9 border-border/70 bg-transparent">
                Next Report
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          )}
          {showCreateWorkOrderCta ? (
            <Button
              size="sm"
              className="h-9"
              onClick={handleCreateWorkOrders}
              disabled={creatingWorkOrders}
            >
              <Wrench className="w-4 h-4 mr-2" />
              {creatingWorkOrders ? "Creating…" : "Create Maintenance Work Order"}
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9 border-border/70 bg-transparent">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => window.print()}>
                <Printer className="w-4 h-4 mr-2" />
                Print Report
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportSinglePDF} disabled={exportingPdf}>
                <FileText className="w-4 h-4 mr-2" />
                {exportingPdf ? "Exporting PDF..." : "Export PDF"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
      headerActions={
        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${getTypeClasses(dvir.inspection_type)}`}>
          {getTypeLabel(dvir.inspection_type)}
        </span>
      }
    >
      <div className="space-y-6">
        {hasIncompleteComplianceRecord && (
          <Card className="border border-amber-500/50 bg-amber-500/10 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 mt-0.5 text-amber-300" />
                <div>
                  <p className="text-sm font-semibold text-amber-200">Incomplete record</p>
                  <p className="text-xs text-amber-100/90 mt-1">
                    Missing {missingComplianceFields.join(", ")}. DVIR records should include these fields for DOT audit readiness.
                  </p>
                </div>
              </div>
              <Link href={`/dashboard/dvir/${encodeURIComponent(dvir.id)}/edit`}>
                <Button size="sm" className="h-8">Complete Record</Button>
              </Link>
            </div>
          </Card>
        )}

        {/* Linked maintenance work orders */}
        {(workOrders.length > 0 || showCreateWorkOrderCta) && (
          <Card className="border border-border/50 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Wrench className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Maintenance work orders</h3>
            </div>
            {workOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No work orders linked yet. Use &quot;Create Maintenance Work Order&quot; above to generate them from
                defects.
              </p>
            ) : (
              <ul className="space-y-2">
                {workOrders.map((wo: any) => (
                  <li key={wo.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 bg-secondary/20 px-3 py-2">
                    <span className="font-medium text-foreground">
                      {wo.work_order_number || wo.id}
                      {wo.title ? ` — ${wo.title}` : ""}
                    </span>
                    <Link href={`/dashboard/maintenance/work-orders/${wo.id}`}>
                      <Button variant="outline" size="sm" className="h-8">
                        Open
                        <ExternalLink className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {/* Inspection Details */}
        <DetailSection title="Inspection Details" icon={<FileCheck className="w-5 h-5" />}>
          <InfoGrid cols={2}>
            <InfoField label="Inspection Type" value={getTypeLabel(dvir.inspection_type)} />
            <InfoField
              label="Inspection Date"
              value={dvir.inspection_date ? new Date(dvir.inspection_date).toLocaleDateString() : notRecorded}
            />
            <InfoField
              label="Inspection Time"
              value={dvir.inspection_time || notRecorded}
            />
            <InfoField label="Location" value={dvir.location || notRecorded} />
            <InfoField
              label="Mileage"
              value={dvir.mileage ? `${dvir.mileage.toLocaleString()} miles` : notRecorded}
            />
            <InfoField
              label="Odometer Reading"
              value={dvir.odometer_reading ? dvir.odometer_reading.toLocaleString() : notRecorded}
            />
            <InfoField
              label="Certified By"
              value={dvir.certified_by_user?.full_name || notRecorded}
            />
            <InfoField
              label="Certified Date"
              value={dvir.certified_date ? new Date(dvir.certified_date).toLocaleString() : notRecorded}
            />
            <InfoField
              label="Driver"
              value={dvir.drivers?.id ? (
                <Link href={`/dashboard/drivers/${dvir.drivers.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                  {dvir.drivers?.name || "Unknown Driver"}
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              ) : (
                notRecorded
              )}
            />
            <InfoField
              label="Truck"
              value={dvir.trucks?.id ? (
                <Link href={`/dashboard/trucks/${dvir.trucks.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                  {`${dvir.trucks.truck_number}${dvir.trucks.make && dvir.trucks.model ? ` (${dvir.trucks.make} ${dvir.trucks.model})` : ""}`}
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              ) : (
                notRecorded
              )}
            />
          </InfoGrid>
        </DetailSection>

        {/* Defects */}
        {dvir.defects_found && defects.length === 0 && (
          <DetailSection title="Defects" icon={<AlertTriangle className="w-5 h-5" />}>
            <p className="text-sm text-muted-foreground">
              Defects were recorded on this inspection, but no line items are stored in the defect list. Check notes and
              certification below, or edit the DVIR to add defect details.
            </p>
          </DetailSection>
        )}

        {dvir.defects_found && defects.length > 0 && (
          <DetailSection title="Defects Found" icon={<AlertTriangle className="w-5 h-5" />}>
            <div className="space-y-4">
              <div className="rounded-md border border-border/60 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                {defects.length} defects found · {correctedDefects} corrected · {outstandingDefects} outstanding
              </div>
              {defects.map((defect: any, index: number) => (
                <Card
                  key={index}
                  className={`p-4 border ${
                    defect.severity === "critical"
                      ? "border-red-500/50 bg-red-500/5"
                      : defect.severity === "major"
                      ? "border-orange-500/50 bg-orange-500/5"
                      : "border-yellow-500/50 bg-yellow-500/5"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-foreground inline-flex items-center gap-2">
                        {getDefectIcon(defect.component)}
                        {defect.component || "Unknown Component"}
                      </h4>
                      <Badge
                        className={
                          defect.severity === "critical"
                            ? "bg-red-500/20 text-red-500 border-red-500/50 mt-1"
                            : defect.severity === "major"
                            ? "bg-orange-500/20 text-orange-500 border-orange-500/50 mt-1"
                            : "bg-yellow-500/20 text-yellow-500 border-yellow-500/50 mt-1"
                        }
                      >
                        {defect.severity?.charAt(0).toUpperCase() + defect.severity?.slice(1) || "Minor"}
                      </Badge>
                    </div>
                    {defect.corrected && (
                      <Badge className="bg-green-500/20 text-green-500 border-green-500/50">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Corrected
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-foreground mt-2">{defect.description || "No description"}</p>
                  <div className="grid gap-3 mt-3 md:grid-cols-2">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Corrected by</p>
                      <p className="text-sm text-foreground">{defect.corrected_by || dvir.certified_by_user?.full_name || notRecorded}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Corrected at</p>
                      <p className="text-sm text-foreground">{formatTimestamp(defect.corrected_at || dvir.certified_date)}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </DetailSection>
        )}

        {/* Notes */}
        {(dvir.notes || dvir.corrective_action) && (
          <DetailSection title="Additional Information" icon={<FileCheck className="w-5 h-5" />}>
            <div className="space-y-4">
              {dvir.notes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Notes</p>
                  <p className="text-foreground">{dvir.notes}</p>
                </div>
              )}
              {dvir.corrective_action && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Corrective Action</p>
                  <p className="text-foreground">{dvir.corrective_action}</p>
                </div>
              )}
            </div>
          </DetailSection>
        )}

        {/* Signatures & Certification */}
        <DetailSection title="Signatures & Certification" icon={<FileCheck className="w-5 h-5" />}>
          <div className="space-y-4">
            <InfoGrid cols={2}>
              <InfoField
                label="Driver signed at"
                value={dvir.driver_signature_date ? new Date(dvir.driver_signature_date).toLocaleString() : notRecorded}
              />
              <InfoField
                label="Mechanic/Certifier signed at"
                value={dvir.certified_date ? new Date(dvir.certified_date).toLocaleString() : notRecorded}
              />
            </InfoGrid>
            {dvir.driver_signature ? (
              <div className="border border-border/50 rounded-lg p-4 bg-secondary/30">
                <img
                  src={dvir.driver_signature}
                  alt="Driver signature"
                  className="max-w-xs h-auto"
                  onError={(e) => {
                    e.currentTarget.style.display = "none"
                    const fallback = document.createElement("div")
                    fallback.className = "text-sm text-muted-foreground"
                    fallback.textContent = "Signature on file (image unavailable - may be expired or private)"
                    e.currentTarget.parentElement?.appendChild(fallback)
                  }}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {dvir.driver_signature.startsWith("data:image")
                    ? "Driver signature stored as image data"
                    : "Driver signature stored in file storage"}
                </p>
              </div>
            ) : (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
                Driver signature is not recorded on this report.
              </div>
            )}
            {!dvir.defects_found ? (
              <p className="text-sm text-muted-foreground">
                Driver certifies that no defects or deficiencies were found that would affect safe operation.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Defects were reported. Certification should include who reviewed and confirmed corrections before operation.
              </p>
            )}
          </div>
        </DetailSection>
      </div>
    </DetailPageLayout>
  )
}






