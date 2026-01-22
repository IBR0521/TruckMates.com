"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Edit2, FileCheck, AlertTriangle, CheckCircle } from "lucide-react"
import Link from "next/link"
import { use } from "react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { DetailPageLayout, DetailSection, InfoGrid, InfoField } from "@/components/dashboard/detail-page-layout"
import { getDVIR } from "@/app/actions/dvir"

export default function DVIRDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [dvir, setDvir] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (id === "add") {
      router.replace("/dashboard/dvir/add")
      return
    }

    async function loadDVIR() {
      const result = await getDVIR(id)
      if (result.error) {
        toast.error(result.error)
        router.push("/dashboard/dvir")
      } else if (result.data) {
        setDvir(result.data)
      }
      setIsLoading(false)
    }

    loadDVIR()
  }, [id, router])

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

  const defects = Array.isArray(dvir.defects) ? dvir.defects : []

  return (
    <DetailPageLayout
      title={`DVIR Report - ${getTypeLabel(dvir.inspection_type)}`}
      subtitle={`${dvir.drivers?.name || "Unknown Driver"} • ${dvir.trucks?.truck_number || "N/A"}`}
      backUrl="/dashboard/dvir"
      editUrl={`/dashboard/dvir/${id}/edit`}
    >
      <div className="space-y-6">
        {/* Status Card */}
        <Card className="border border-border/50 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <FileCheck className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Inspection Status</h3>
                <div className="flex items-center gap-2 mt-2">
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
                </div>
              </div>
            </div>
            {dvir.certified && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Certified by</p>
                <p className="text-sm font-medium text-foreground">
                  {dvir.certified_by_user?.full_name || "Unknown"}
                </p>
                {dvir.certified_date && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(dvir.certified_date).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Inspection Details */}
        <DetailSection title="Inspection Details" icon={<FileCheck className="w-5 h-5" />}>
          <InfoGrid cols={2}>
            <InfoField label="Inspection Type" value={getTypeLabel(dvir.inspection_type)} />
            <InfoField
              label="Inspection Date"
              value={dvir.inspection_date ? new Date(dvir.inspection_date).toLocaleDateString() : "N/A"}
            />
            <InfoField
              label="Inspection Time"
              value={dvir.inspection_time || "N/A"}
            />
            <InfoField label="Location" value={dvir.location || "N/A"} />
            <InfoField
              label="Mileage"
              value={dvir.mileage ? dvir.mileage.toLocaleString() + " miles" : "N/A"}
            />
            <InfoField
              label="Odometer Reading"
              value={dvir.odometer_reading ? dvir.odometer_reading.toLocaleString() : "N/A"}
            />
            <InfoField label="Driver" value={dvir.drivers?.name || "N/A"} />
            <InfoField
              label="Truck"
              value={
                dvir.trucks
                  ? `${dvir.trucks.truck_number}${dvir.trucks.make && dvir.trucks.model ? ` (${dvir.trucks.make} ${dvir.trucks.model})` : ""}`
                  : "N/A"
              }
            />
          </InfoGrid>
        </DetailSection>

        {/* Defects */}
        {dvir.defects_found && defects.length > 0 && (
          <DetailSection title="Defects Found" icon={<AlertTriangle className="w-5 h-5" />}>
            <div className="space-y-4">
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
                      <h4 className="font-semibold text-foreground">{defect.component || "Unknown Component"}</h4>
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

        {/* Driver Signature */}
        {dvir.driver_signature && (
          <DetailSection title="Driver Signature" icon={<FileCheck className="w-5 h-5" />}>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Signed on: {dvir.driver_signature_date ? new Date(dvir.driver_signature_date).toLocaleString() : "N/A"}
              </p>
              {dvir.driver_signature && (
                <div className="border border-border/50 rounded-lg p-4 bg-secondary/30">
                  <img
                    src={dvir.driver_signature}
                    alt="Driver signature"
                    className="max-w-xs h-auto"
                    onError={(e) => {
                      e.currentTarget.style.display = "none"
                    }}
                  />
                </div>
              )}
            </div>
          </DetailSection>
        )}
      </div>
    </DetailPageLayout>
  )
}

