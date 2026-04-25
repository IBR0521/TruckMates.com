"use client"

import { useEffect, useState } from "react"
import { use, useRouter } from "next/navigation"
import { toast } from "sonner"
import { getTrailer, updateTrailer } from "@/app/actions/trailers"
import { uploadDocument } from "@/app/actions/documents"
import { FormPageLayout, FormSection, FormGrid } from "@/components/dashboard/form-page-layout"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function EditTrailerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [docType, setDocType] = useState("registration")
  const [docFile, setDocFile] = useState<File | null>(null)
  const [formData, setFormData] = useState<any>({
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

  useEffect(() => {
    async function load() {
      const result = await getTrailer(id)
      if (result.error || !result.data) {
        toast.error(result.error || "Trailer not found")
        router.push("/dashboard/trailers")
        return
      }
      setFormData({
        trailer_number: result.data.trailer_number || "",
        vin: result.data.vin || "",
        plate_number: result.data.plate_number || "",
        plate_state: result.data.plate_state || "",
        year: result.data.year ? String(result.data.year) : "",
        make: result.data.make || "",
        model: result.data.model || "",
        trailer_type: result.data.trailer_type || "dry_van",
        length_ft: result.data.length_ft ? String(result.data.length_ft) : "",
        capacity_lbs: result.data.capacity_lbs ? String(result.data.capacity_lbs) : "",
        door_type: result.data.door_type || "swing",
        status: result.data.status || "available",
        registration_expiry: result.data.registration_expiry || "",
        next_dot_inspection_date: result.data.next_dot_inspection_date || "",
        last_brake_inspection_date: result.data.last_brake_inspection_date || "",
      })
      setIsLoading(false)
    }
    void load()
  }, [id, router])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    const result = await updateTrailer(id, {
      ...formData,
      year: formData.year ? Number(formData.year) : null,
      length_ft: formData.length_ft ? Number(formData.length_ft) : null,
      capacity_lbs: formData.capacity_lbs ? Number(formData.capacity_lbs) : null,
      registration_expiry: formData.registration_expiry || null,
      next_dot_inspection_date: formData.next_dot_inspection_date || null,
      last_brake_inspection_date: formData.last_brake_inspection_date || null,
    })
    setIsSubmitting(false)
    if (result.error) toast.error(result.error)
    else {
      toast.success("Trailer updated")
      router.push("/dashboard/trailers")
    }
  }

  const uploadTrailerDoc = async () => {
    if (!docFile) {
      toast.error("Select a file first")
      return
    }
    setUploadingDoc(true)
    const result = await uploadDocument(docFile, {
      name: docFile.name,
      type: docType,
      trailer_id: id,
    })
    setUploadingDoc(false)
    if (result.error) toast.error(result.error)
    else {
      toast.success("Trailer document uploaded")
      setDocFile(null)
    }
  }

  return (
    <FormPageLayout
      title="Edit Trailer"
      subtitle="Update trailer profile and compliance data"
      backUrl="/dashboard/trailers"
      onSubmit={submit}
      isSubmitting={isSubmitting}
      submitLabel={isLoading ? "Loading..." : "Save Changes"}
    >
      <FormSection title="Trailer Identity">
        <FormGrid cols={2}>
          <div><Label>Trailer Number</Label><Input value={formData.trailer_number} onChange={(e) => setFormData({ ...formData, trailer_number: e.target.value })} /></div>
          <div><Label>VIN</Label><Input value={formData.vin} onChange={(e) => setFormData({ ...formData, vin: e.target.value })} /></div>
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

      <FormSection title="Compliance">
        <FormGrid cols={2}>
          <div><Label>Registration Expiry</Label><Input type="date" value={formData.registration_expiry} onChange={(e) => setFormData({ ...formData, registration_expiry: e.target.value })} /></div>
          <div><Label>Next DOT Inspection</Label><Input type="date" value={formData.next_dot_inspection_date} onChange={(e) => setFormData({ ...formData, next_dot_inspection_date: e.target.value })} /></div>
          <div><Label>Last Brake Inspection</Label><Input type="date" value={formData.last_brake_inspection_date} onChange={(e) => setFormData({ ...formData, last_brake_inspection_date: e.target.value })} /></div>
        </FormGrid>
      </FormSection>

      <FormSection title="Trailer Documents">
        <FormGrid cols={2}>
          <div>
            <Label>Document Type</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="registration">Registration</SelectItem>
                <SelectItem value="inspection">Inspection</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>File</Label>
            <Input type="file" accept=".pdf,image/*" onChange={(e) => setDocFile(e.target.files?.[0] || null)} />
          </div>
        </FormGrid>
        <div className="mt-3">
          <button
            type="button"
            onClick={() => void uploadTrailerDoc()}
            disabled={uploadingDoc || !docFile}
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          >
            {uploadingDoc ? "Uploading..." : "Upload Document"}
          </button>
        </div>
      </FormSection>
    </FormPageLayout>
  )
}
