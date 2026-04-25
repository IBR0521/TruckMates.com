"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createTrailer } from "@/app/actions/trailers"
import { FormPageLayout, FormSection, FormGrid } from "@/components/dashboard/form-page-layout"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function AddTrailerPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    trailer_number: "",
    vin: "",
    plate_number: "",
    plate_state: "",
    year: "",
    make: "",
    model: "",
    trailer_type: "dry_van",
    length_ft: "",
    capacity_lbs: "",
    door_type: "swing",
    status: "available",
    registration_expiry: "",
    next_dot_inspection_date: "",
    last_brake_inspection_date: "",
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    const result = await createTrailer({
      ...formData,
      year: formData.year ? Number(formData.year) : undefined,
      length_ft: formData.length_ft ? Number(formData.length_ft) : undefined,
      capacity_lbs: formData.capacity_lbs ? Number(formData.capacity_lbs) : undefined,
      registration_expiry: formData.registration_expiry || undefined,
      next_dot_inspection_date: formData.next_dot_inspection_date || undefined,
      last_brake_inspection_date: formData.last_brake_inspection_date || undefined,
    })
    setIsSubmitting(false)
    if (result.error) toast.error(result.error)
    else {
      toast.success("Trailer created")
      router.push("/dashboard/trailers")
    }
  }

  return (
    <FormPageLayout
      title="Add Trailer"
      subtitle="Create a trailer unit for dispatch, maintenance, and compliance tracking"
      backUrl="/dashboard/trailers"
      onSubmit={submit}
      isSubmitting={isSubmitting}
      submitLabel="Create Trailer"
    >
      <FormSection title="Trailer Identity">
        <FormGrid cols={2}>
          <div><Label>Trailer Number *</Label><Input value={formData.trailer_number} onChange={(e) => setFormData({ ...formData, trailer_number: e.target.value })} /></div>
          <div><Label>VIN *</Label><Input value={formData.vin} onChange={(e) => setFormData({ ...formData, vin: e.target.value })} /></div>
          <div><Label>Plate Number</Label><Input value={formData.plate_number} onChange={(e) => setFormData({ ...formData, plate_number: e.target.value })} /></div>
          <div><Label>Plate State</Label><Input value={formData.plate_state} onChange={(e) => setFormData({ ...formData, plate_state: e.target.value })} /></div>
          <div><Label>Year</Label><Input type="number" value={formData.year} onChange={(e) => setFormData({ ...formData, year: e.target.value })} /></div>
          <div><Label>Make</Label><Input value={formData.make} onChange={(e) => setFormData({ ...formData, make: e.target.value })} /></div>
          <div><Label>Model</Label><Input value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} /></div>
          <div>
            <Label>Type</Label>
            <Select value={formData.trailer_type} onValueChange={(v) => setFormData({ ...formData, trailer_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dry_van">Dry Van</SelectItem>
                <SelectItem value="reefer">Reefer</SelectItem>
                <SelectItem value="flatbed">Flatbed</SelectItem>
                <SelectItem value="step_deck">Step Deck</SelectItem>
                <SelectItem value="lowboy">Lowboy</SelectItem>
                <SelectItem value="tanker">Tanker</SelectItem>
                <SelectItem value="conestoga">Conestoga</SelectItem>
                <SelectItem value="auto_hauler">Auto Hauler</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Length (ft)</Label><Input type="number" value={formData.length_ft} onChange={(e) => setFormData({ ...formData, length_ft: e.target.value })} /></div>
          <div><Label>Capacity (lbs)</Label><Input type="number" value={formData.capacity_lbs} onChange={(e) => setFormData({ ...formData, capacity_lbs: e.target.value })} /></div>
          <div>
            <Label>Door Type</Label>
            <Select value={formData.door_type} onValueChange={(v) => setFormData({ ...formData, door_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="swing">Swing</SelectItem>
                <SelectItem value="roll">Roll</SelectItem>
                <SelectItem value="curtain">Curtain</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="in_use">In Use</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="out_of_service">Out of Service</SelectItem>
                <SelectItem value="retired">Retired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FormGrid>
      </FormSection>

      <FormSection title="Compliance & Maintenance">
        <FormGrid cols={2}>
          <div><Label>Registration Expiry</Label><Input type="date" value={formData.registration_expiry} onChange={(e) => setFormData({ ...formData, registration_expiry: e.target.value })} /></div>
          <div><Label>Next DOT Inspection</Label><Input type="date" value={formData.next_dot_inspection_date} onChange={(e) => setFormData({ ...formData, next_dot_inspection_date: e.target.value })} /></div>
          <div><Label>Last Brake Inspection</Label><Input type="date" value={formData.last_brake_inspection_date} onChange={(e) => setFormData({ ...formData, last_brake_inspection_date: e.target.value })} /></div>
        </FormGrid>
      </FormSection>
    </FormPageLayout>
  )
}
