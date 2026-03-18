"use client"

import type React from "react"
import { use, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Trash2, FileCheck } from "lucide-react"
import { toast } from "sonner"
import { FormPageLayout, FormSection, FormGrid } from "@/components/dashboard/form-page-layout"
import { getDVIR, updateDVIR } from "@/app/actions/dvir"

export default function EditDVIRPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)

  const [dvir, setDVIR] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    inspection_type: "pre_trip",
    inspection_date: new Date().toISOString().split("T")[0],
    inspection_time: new Date().toTimeString().slice(0, 5),
    location: "",
    mileage: "",
    odometer_reading: "",
    defects_found: false,
    safe_to_operate: true,
    defects: [] as Array<{
      component: string
      description: string
      severity: string
      corrected: boolean
    }>,
    notes: "",
    corrective_action: "",
    driver_signature: "",
    certified: false,
  })

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      try {
        const dvirRes = await getDVIR(id)

        if (dvirRes.error) {
          toast.error(dvirRes.error)
          router.push("/dashboard/dvir")
          return
        }

        if (dvirRes.data) setDVIR(dvirRes.data)

        const existing = dvirRes.data
        if (existing) {
          setFormData({
            inspection_type: existing.inspection_type || "pre_trip",
            inspection_date: existing.inspection_date ? existing.inspection_date : new Date().toISOString().split("T")[0],
            inspection_time: existing.inspection_time || new Date().toTimeString().slice(0, 5),
            location: existing.location || "",
            mileage: existing.mileage !== null && existing.mileage !== undefined ? String(existing.mileage) : "",
            odometer_reading:
              existing.odometer_reading !== null && existing.odometer_reading !== undefined ? String(existing.odometer_reading) : "",
            defects_found: !!existing.defects_found,
            safe_to_operate: existing.safe_to_operate !== undefined ? !!existing.safe_to_operate : true,
            defects: Array.isArray(existing.defects) ? existing.defects : [],
            notes: existing.notes || "",
            corrective_action: existing.corrective_action || "",
            driver_signature: existing.driver_signature || "",
            certified: !!existing.certified,
          })
        }
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [id, router])

  const certifiedLocked = !!dvir?.certified

  const handleAddDefect = () => {
    setFormData((prev) => ({
      ...prev,
      defects_found: true,
      defects: [
        ...prev.defects,
        { component: "", description: "", severity: "minor", corrected: false },
      ],
    }))
  }

  const handleRemoveDefect = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      defects: prev.defects.filter((_, i) => i !== index),
    }))
  }

  const handleDefectChange = (index: number, field: string, value: any) => {
    setFormData((prev) => {
      const next = [...prev.defects]
      next[index] = { ...next[index], [field]: value }
      return { ...prev, defects: next }
    })
  }

  const defectRequiresForm = useMemo(() => formData.defects_found, [formData.defects_found])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (!formData.inspection_type) {
        toast.error("Inspection type is required")
        return
      }
      if (!formData.inspection_date) {
        toast.error("Inspection date is required")
        return
      }

      if (defectRequiresForm) {
        if (!formData.defects || formData.defects.length === 0) {
          toast.error("If defects are found, you must add at least one defect.")
          return
        }
        for (const defect of formData.defects) {
          if (!defect.component || !defect.description) {
            toast.error("Please fill in all defect fields")
            return
          }
        }
      }

      if (!formData.driver_signature.trim()) {
        toast.error("Driver signature is required")
        return
      }

      const mileageNum = formData.mileage.trim() ? Number(formData.mileage) : undefined
      const odometerNum = formData.odometer_reading.trim() ? Number(formData.odometer_reading) : undefined

      const result = await updateDVIR(id, {
        inspection_type: formData.inspection_type,
        inspection_date: formData.inspection_date,
        inspection_time: formData.inspection_time,
        location: formData.location || undefined,
        mileage: Number.isFinite(mileageNum as number) ? mileageNum : undefined,
        odometer_reading: Number.isFinite(odometerNum as number) ? odometerNum : undefined,
        defects_found: formData.defects_found,
        safe_to_operate: formData.safe_to_operate,
        defects: formData.defects_found ? formData.defects : undefined,
        notes: formData.notes || undefined,
        corrective_action: formData.corrective_action || undefined,
        driver_signature: formData.driver_signature || undefined,
        certified: formData.certified,
      } as any)

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success("DVIR updated successfully")
      router.push(`/dashboard/dvir/${id}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="w-full p-8">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Loading DVIR...</p>
        </Card>
      </div>
    )
  }

  if (!dvir) {
    return (
      <div className="w-full p-8">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">DVIR not found</p>
        </Card>
      </div>
    )
  }

  return (
    <FormPageLayout
      title="Edit DVIR"
      subtitle={`DVIR #${dvir.id}`}
      backUrl="/dashboard/dvir"
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      submitLabel="Update DVIR"
    >
      <div className="space-y-6">
        {/* Basic Information */}
        <FormSection title="Inspection Information" icon={<FileCheck className="w-5 h-5" />}>
          <FormGrid cols={2}>
            <div>
              <Label>Inspection Type *</Label>
              <Select
                value={formData.inspection_type}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, inspection_type: value }))}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pre_trip">Pre-Trip Inspection</SelectItem>
                  <SelectItem value="post_trip">Post-Trip Inspection</SelectItem>
                  <SelectItem value="on_road">On-Road Inspection</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Inspection Date *</Label>
              <Input
                type="date"
                value={formData.inspection_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, inspection_date: e.target.value }))}
                className="mt-2"
                required
              />
            </div>

            <div>
              <Label>Inspection Time</Label>
              <Input
                type="time"
                value={formData.inspection_time}
                onChange={(e) => setFormData((prev) => ({ ...prev, inspection_time: e.target.value }))}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Location</Label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                placeholder="Inspection location"
                className="mt-2"
              />
            </div>

            <div>
              <Label>Mileage</Label>
              <Input
                type="number"
                value={formData.mileage}
                onChange={(e) => setFormData((prev) => ({ ...prev, mileage: e.target.value }))}
                placeholder="0"
                className="mt-2"
              />
            </div>

            <div>
              <Label>Odometer Reading</Label>
              <Input
                type="number"
                value={formData.odometer_reading}
                onChange={(e) => setFormData((prev) => ({ ...prev, odometer_reading: e.target.value }))}
                placeholder="0"
                className="mt-2"
              />
            </div>
          </FormGrid>
        </FormSection>

        {/* Safety Assessment */}
        <FormSection title="Safety Assessment" icon={<FileCheck className="w-5 h-5" />}>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="safe_to_operate"
                checked={formData.safe_to_operate}
                onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, safe_to_operate: checked as boolean }))}
              />
              <Label htmlFor="safe_to_operate" className="cursor-pointer">
                Vehicle is safe to operate
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="defects_found"
                checked={formData.defects_found}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    defects_found: !!checked,
                    defects: checked ? prev.defects : [],
                  }))
                }
              />
              <Label htmlFor="defects_found" className="cursor-pointer">
                Defects found during inspection
              </Label>
            </div>
          </div>
        </FormSection>

        {/* Defects */}
        {formData.defects_found && (
          <FormSection title="Defects Found" icon={<FileCheck className="w-5 h-5" />}>
            <div className="space-y-4">
              {formData.defects.map((defect, index) => (
                <Card key={index} className="p-4 border border-border/50">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-foreground">Defect #{index + 1}</h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveDefect(index)}
                        className="text-red-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <FormGrid cols={2}>
                      <div>
                        <Label>Component *</Label>
                        <Input
                          value={defect.component}
                          onChange={(e) => handleDefectChange(index, "component", e.target.value)}
                          placeholder="e.g., Brakes, Tires, Lights"
                          className="mt-2"
                          required
                        />
                      </div>
                      <div>
                        <Label>Severity *</Label>
                        <Select
                          value={defect.severity}
                          onValueChange={(value) => handleDefectChange(index, "severity", value)}
                        >
                          <SelectTrigger className="mt-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="minor">Minor</SelectItem>
                            <SelectItem value="major">Major</SelectItem>
                            <SelectItem value="critical">Critical</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </FormGrid>

                    <div>
                      <Label>Description *</Label>
                      <Textarea
                        value={defect.description}
                        onChange={(e) => handleDefectChange(index, "description", e.target.value)}
                        placeholder="Describe the defect in detail"
                        className="mt-2"
                        rows={3}
                        required
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={!!defect.corrected}
                        onCheckedChange={(checked) => handleDefectChange(index, "corrected", checked)}
                        id={`defect_corrected_${index}`}
                      />
                      <Label htmlFor={`defect_corrected_${index}`} className="cursor-pointer">
                        Defect has been corrected
                      </Label>
                    </div>
                  </div>
                </Card>
              ))}

              <Button type="button" variant="outline" onClick={handleAddDefect} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Defect
              </Button>
            </div>
          </FormSection>
        )}

        {/* Notes */}
        <FormSection title="Additional Information" icon={<FileCheck className="w-5 h-5" />}>
          <div className="space-y-4">
            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes about the inspection"
                className="mt-2"
                rows={4}
              />
            </div>

            {formData.defects_found && (
              <div>
                <Label>Corrective Action</Label>
                <Textarea
                  value={formData.corrective_action}
                  onChange={(e) => setFormData((prev) => ({ ...prev, corrective_action: e.target.value }))}
                  placeholder="Describe corrective actions taken"
                  className="mt-2"
                  rows={4}
                />
              </div>
            )}
          </div>
        </FormSection>

        {/* Driver signature / cert */}
        <FormSection title="Compliance" icon={<FileCheck className="w-5 h-5" />}>
          <div className="space-y-4">
            <div>
              <Label>Driver Signature *</Label>
              <Input
                value={formData.driver_signature}
                onChange={(e) => setFormData((prev) => ({ ...prev, driver_signature: e.target.value }))}
                placeholder="Type your name (signature)"
                className="mt-2"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">For now, type your name as a signature.</p>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="certified"
                checked={formData.certified}
                disabled={certifiedLocked}
                onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, certified: !!checked }))}
              />
              <Label htmlFor="certified" className="cursor-pointer">
                Certified
              </Label>
              {certifiedLocked && <Badge className="ml-2">Locked</Badge>}
            </div>
          </div>
        </FormSection>
      </div>
    </FormPageLayout>
  )
}

