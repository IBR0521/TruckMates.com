"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { ArrowLeft, Wrench, DollarSign, Calendar } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { FormPageLayout, FormSection, FormGrid } from "@/components/dashboard/form-page-layout"
import { getTrucks } from "@/app/actions/trucks"
import { getTrailers } from "@/app/actions/trailers"
import { getVendors } from "@/app/actions/vendors"
import { createMaintenance } from "@/app/actions/maintenance"

export default function AddMaintenancePage() {
  const router = useRouter()
  const [trucks, setTrucks] = useState<any[]>([])
  const [trailers, setTrailers] = useState<any[]>([])
  const [vendors, setVendors] = useState<any[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    asset_type: "truck",
    truck_id: "",
    trailer_id: "",
    service_type: "Oil Change",
    scheduled_date: "",
    current_mileage: "",
    priority: "normal",
    estimated_cost: "",
    notes: "",
    vendor_id: "",
  })

  useEffect(() => {
    async function loadData() {
      const [trucksResult, trailersResult, vendorsResult] = await Promise.all([
        getTrucks(),
        getTrailers(),
        getVendors(),
      ])
      if (trucksResult.data) setTrucks(trucksResult.data)
      if (trailersResult.data) setTrailers(trailersResult.data)
      if (vendorsResult.data) setVendors(vendorsResult.data)
    }
    loadData()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    const selectedAssetId = formData.asset_type === "trailer" ? formData.trailer_id : formData.truck_id
    if (!selectedAssetId || !formData.service_type || !formData.scheduled_date) {
      toast.error("Please fill in all required fields")
      setIsSubmitting(false)
      return
    }

    const result = await createMaintenance({
      truck_id: formData.asset_type === "truck" ? formData.truck_id : undefined,
      trailer_id: formData.asset_type === "trailer" ? formData.trailer_id : undefined,
      service_type: formData.service_type,
      scheduled_date: formData.scheduled_date,
      current_mileage: formData.current_mileage ? Number(formData.current_mileage) : undefined,
      priority: formData.priority,
      estimated_cost: formData.estimated_cost ? Number(formData.estimated_cost) : undefined,
      notes: formData.notes || undefined,
      vendor: formData.vendor_id ? vendors.find((v) => v.id === formData.vendor_id)?.name || undefined : undefined,
    })

    setIsSubmitting(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Maintenance scheduled successfully")
      router.push("/dashboard/maintenance")
    }
  }

  return (
    <FormPageLayout
      title="Schedule Service"
      subtitle="Schedule a maintenance service"
      backUrl="/dashboard/maintenance"
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      submitLabel="Schedule Service"
    >
      <Tabs defaultValue="service" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="service">Service Details</TabsTrigger>
          <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
          <TabsTrigger value="vendor">Vendor & Notes</TabsTrigger>
        </TabsList>

        {/* Service Details Tab */}
        <TabsContent value="service" className="space-y-6">
          <FormSection title="Service Details" icon={<Wrench className="w-5 h-5" />}>
            <FormGrid cols={2}>
              <div>
                <Label htmlFor="asset_type">Asset Type *</Label>
                <Select
                  value={formData.asset_type}
                  onValueChange={(value) => setFormData({ ...formData, asset_type: value, truck_id: "", trailer_id: "" })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="truck">Truck</SelectItem>
                    <SelectItem value="trailer">Trailer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="asset_id">{formData.asset_type === "trailer" ? "Trailer" : "Truck"} *</Label>
                <Select
                  value={formData.asset_type === "trailer" ? formData.trailer_id : formData.truck_id}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      truck_id: formData.asset_type === "truck" ? value : "",
                      trailer_id: formData.asset_type === "trailer" ? value : "",
                    })
                  }
                  required
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder={`Select ${formData.asset_type}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {formData.asset_type === "truck"
                      ? trucks.map((truck) => (
                          <SelectItem key={truck.id} value={truck.id}>
                            {truck.truck_number} {truck.make && truck.model ? `(${truck.make} ${truck.model})` : ""}
                          </SelectItem>
                        ))
                      : trailers.map((trailer) => (
                          <SelectItem key={trailer.id} value={trailer.id}>
                            {trailer.trailer_number} {trailer.trailer_type ? `(${trailer.trailer_type})` : ""}
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="service_type">Service Type *</Label>
                <Select
                  value={formData.service_type}
                  onValueChange={(value) => setFormData({ ...formData, service_type: value })}
                  required
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {formData.asset_type === "truck" ? (
                      <>
                        <SelectItem value="Oil Change">Oil Change</SelectItem>
                        <SelectItem value="Tire Replacement">Tire Replacement</SelectItem>
                        <SelectItem value="Brake Inspection">Brake Inspection</SelectItem>
                        <SelectItem value="Engine Service">Engine Service</SelectItem>
                        <SelectItem value="Transmission Service">Transmission Service</SelectItem>
                        <SelectItem value="Annual Inspection">Annual Inspection</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="DOT Inspection">DOT Inspection</SelectItem>
                        <SelectItem value="Brake Adjustment">Brake Adjustment</SelectItem>
                        <SelectItem value="Tire Rotation">Tire Rotation</SelectItem>
                        <SelectItem value="Landing Gear Lubrication">Landing Gear Lubrication</SelectItem>
                        <SelectItem value="Kingpin Inspection">Kingpin Inspection</SelectItem>
                        <SelectItem value="Lighting Inspection">Lighting Inspection</SelectItem>
                        <SelectItem value="Roof Door Seal Check">Roof/Door Seal Check</SelectItem>
                        <SelectItem value="Reefer Unit Service">Reefer Unit Service</SelectItem>
                      </>
                    )}
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </FormGrid>

            <FormGrid cols={2}>
              <div>
                <Label htmlFor="current_mileage">
                  {formData.asset_type === "trailer" ? "Optional Mileage (from hooked truck)" : "Current Mileage *"}
                </Label>
                <Input
                  id="current_mileage"
                  type="number"
                  value={formData.current_mileage}
                  onChange={(e) => setFormData({ ...formData, current_mileage: e.target.value })}
                  placeholder="0"
                  className="mt-2"
                  required={formData.asset_type === "truck"}
                />
              </div>
              <div>
                <Label htmlFor="priority">Priority *</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value })}
                  required
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </FormGrid>
          </FormSection>
        </TabsContent>

        {/* Scheduling Tab */}
        <TabsContent value="scheduling" className="space-y-6">
          <FormSection title="Scheduling" icon={<Calendar className="w-5 h-5" />}>
            <FormGrid cols={2}>
              <div>
                <Label htmlFor="scheduled_date">Scheduled Date *</Label>
                <Input
                  id="scheduled_date"
                  type="date"
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                  className="mt-2"
                  required
                />
              </div>
              <div>
                <Label htmlFor="estimated_cost">Estimated Cost</Label>
                <Input
                  id="estimated_cost"
                  type="number"
                  step="0.01"
                  value={formData.estimated_cost}
                  onChange={(e) => setFormData({ ...formData, estimated_cost: e.target.value })}
                  placeholder="0.00"
                  className="mt-2"
                />
              </div>
            </FormGrid>
          </FormSection>
        </TabsContent>

        {/* Vendor & Notes Tab */}
        <TabsContent value="vendor" className="space-y-6">
          <FormSection title="Vendor & Additional Information" icon={<DollarSign className="w-5 h-5" />}>
            <div>
              <Label htmlFor="vendor_id">Service Vendor</Label>
              <Select
                value={formData.vendor_id}
                onValueChange={(value) => setFormData({ ...formData, vendor_id: value })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select vendor (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional service notes..."
                className="mt-2"
                rows={4}
              />
            </div>
          </FormSection>
        </TabsContent>
      </Tabs>
    </FormPageLayout>
  )
}
