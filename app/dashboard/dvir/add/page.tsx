"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Card } from "@/components/ui/card"
import { Plus, Trash2, FileCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { FormPageLayout, FormSection, FormGrid } from "@/components/dashboard/form-page-layout"
import { getDrivers } from "@/app/actions/drivers"
import { getTrucks } from "@/app/actions/trucks"
import { createDVIR } from "@/app/actions/dvir"

export default function AddDVIRPage() {
  const router = useRouter()
  const [drivers, setDrivers] = useState<any[]>([])
  const [trucks, setTrucks] = useState<any[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    driver_id: "",
    truck_id: "",
    inspection_type: "pre_trip",
    inspection_date: new Date().toISOString().split("T")[0],
    inspection_time: new Date().toTimeString().slice(0, 5),
    location: "",
    mileage: "",
    odometer_reading: "",
    defects_found: false,
    safe_to_operate: true,
    defects: [] as Array<{ component: string; description: string; severity: string; corrected: boolean }>,
    notes: "",
    corrective_action: "",
  })

  useEffect(() => {
    async function loadData() {
      const [driversResult, trucksResult] = await Promise.all([getDrivers(), getTrucks()])
      if (driversResult.data) setDrivers(driversResult.data)
      if (trucksResult.data) setTrucks(trucksResult.data)
    }
    loadData()
  }, [])

  const handleAddDefect = () => {
    setFormData({
      ...formData,
      defects: [
        ...formData.defects,
        { component: "", description: "", severity: "minor", corrected: false },
      ],
    })
  }

  const handleRemoveDefect = (index: number) => {
    setFormData({
      ...formData,
      defects: formData.defects.filter((_, i) => i !== index),
    })
  }

  const handleDefectChange = (index: number, field: string, value: any) => {
    const updatedDefects = [...formData.defects]
    updatedDefects[index] = { ...updatedDefects[index], [field]: value }
    setFormData({ ...formData, defects: updatedDefects })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Validation
    if (!formData.driver_id) {
      toast.error("Please select a driver")
      setIsSubmitting(false)
      return
    }

    if (!formData.truck_id) {
      toast.error("Please select a truck")
      setIsSubmitting(false)
      return
    }

    // Validate defects if defects_found is true
    if (formData.defects_found && formData.defects.length === 0) {
      toast.error("Please add at least one defect or mark as no defects found")
      setIsSubmitting(false)
      return
    }

    // Validate defect fields
    if (formData.defects_found) {
      for (const defect of formData.defects) {
        if (!defect.component || !defect.description) {
          toast.error("Please fill in all defect fields")
          setIsSubmitting(false)
          return
        }
      }
    }

    const result = await createDVIR({
      driver_id: formData.driver_id,
      truck_id: formData.truck_id,
      inspection_type: formData.inspection_type,
      inspection_date: formData.inspection_date,
      inspection_time: formData.inspection_time,
      location: formData.location || undefined,
      mileage: formData.mileage ? parseInt(formData.mileage) : undefined,
      odometer_reading: formData.odometer_reading ? parseInt(formData.odometer_reading) : undefined,
      defects_found: formData.defects_found,
      safe_to_operate: formData.safe_to_operate,
      defects: formData.defects_found && formData.defects.length > 0 ? formData.defects : undefined,
      notes: formData.notes || undefined,
      corrective_action: formData.corrective_action || undefined,
    })

    if (result.error) {
      toast.error(result.error)
      setIsSubmitting(false)
    } else {
      toast.success("DVIR created successfully")
      setTimeout(() => {
        router.push("/dashboard/dvir")
      }, 500)
    }
  }

  return (
    <FormPageLayout
      title="Create DVIR"
      subtitle="Driver Vehicle Inspection Report"
      backUrl="/dashboard/dvir"
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      submitLabel="Create DVIR"
    >
      <div className="space-y-6">
        {/* Basic Information */}
        <FormSection title="Inspection Information" icon={<FileCheck className="w-5 h-5" />}>
          <FormGrid cols={2}>
            <div>
              <Label>Driver *</Label>
              <Select
                value={formData.driver_id}
                onValueChange={(value) => setFormData({ ...formData, driver_id: value })}
                required
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select driver" />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Truck *</Label>
              <Select
                value={formData.truck_id}
                onValueChange={(value) => setFormData({ ...formData, truck_id: value })}
                required
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select truck" />
                </SelectTrigger>
                <SelectContent>
                  {trucks.map((truck) => (
                    <SelectItem key={truck.id} value={truck.id}>
                      {truck.truck_number} {truck.make && truck.model ? `(${truck.make} ${truck.model})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Inspection Type *</Label>
              <Select
                value={formData.inspection_type}
                onValueChange={(value) => setFormData({ ...formData, inspection_type: value })}
                required
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
                onChange={(e) => setFormData({ ...formData, inspection_date: e.target.value })}
                className="mt-2"
                required
              />
            </div>
            <div>
              <Label>Inspection Time</Label>
              <Input
                type="time"
                value={formData.inspection_time}
                onChange={(e) => setFormData({ ...formData, inspection_time: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Location</Label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Inspection location"
                className="mt-2"
              />
            </div>
            <div>
              <Label>Mileage</Label>
              <Input
                type="number"
                value={formData.mileage}
                onChange={(e) => setFormData({ ...formData, mileage: e.target.value })}
                placeholder="0"
                className="mt-2"
              />
            </div>
            <div>
              <Label>Odometer Reading</Label>
              <Input
                type="number"
                value={formData.odometer_reading}
                onChange={(e) => setFormData({ ...formData, odometer_reading: e.target.value })}
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
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, safe_to_operate: checked as boolean })
                }
              />
              <Label htmlFor="safe_to_operate" className="cursor-pointer">
                Vehicle is safe to operate
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="defects_found"
                checked={formData.defects_found}
                onCheckedChange={(checked) => {
                  setFormData({ ...formData, defects_found: checked as boolean })
                  if (!checked) {
                    setFormData({ ...formData, defects_found: false, defects: [] })
                  }
                }}
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
                        required
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`corrected-${index}`}
                        checked={defect.corrected}
                        onCheckedChange={(checked) => handleDefectChange(index, "corrected", checked)}
                      />
                      <Label htmlFor={`corrected-${index}`} className="cursor-pointer">
                        Defect has been corrected
                      </Label>
                    </div>
                  </div>
                </Card>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={handleAddDefect}
                className="w-full"
              >
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
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, corrective_action: e.target.value })}
                  placeholder="Describe corrective actions taken"
                  className="mt-2"
                  rows={4}
                />
              </div>
            )}
          </div>
        </FormSection>
      </div>
    </FormPageLayout>
  )
}


