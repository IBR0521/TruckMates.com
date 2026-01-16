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
import { getVendors } from "@/app/actions/vendors"

export default function AddMaintenancePage() {
  const router = useRouter()
  const [trucks, setTrucks] = useState<any[]>([])
  const [vendors, setVendors] = useState<any[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    truck_id: "",
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
      const [trucksResult, vendorsResult] = await Promise.all([
        getTrucks(),
        getVendors(),
      ])
      if (trucksResult.data) setTrucks(trucksResult.data)
      if (vendorsResult.data) setVendors(vendorsResult.data)
    }
    loadData()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    // TODO: Call createMaintenance action
    toast.success("Maintenance scheduled successfully")
    setTimeout(() => {
      router.push("/dashboard/maintenance")
    }, 500)
    setIsSubmitting(false)
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
                <Label htmlFor="truck_id">Truck *</Label>
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
                    <SelectItem value="Oil Change">Oil Change</SelectItem>
                    <SelectItem value="Tire Replacement">Tire Replacement</SelectItem>
                    <SelectItem value="Brake Inspection">Brake Inspection</SelectItem>
                    <SelectItem value="Engine Service">Engine Service</SelectItem>
                    <SelectItem value="Transmission Service">Transmission Service</SelectItem>
                    <SelectItem value="Annual Inspection">Annual Inspection</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </FormGrid>

            <FormGrid cols={2}>
              <div>
                <Label htmlFor="current_mileage">Current Mileage *</Label>
                <Input
                  id="current_mileage"
                  type="number"
                  value={formData.current_mileage}
                  onChange={(e) => setFormData({ ...formData, current_mileage: e.target.value })}
                  placeholder="0"
                  className="mt-2"
                  required
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
