"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Wrench } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { FormPageLayout, FormSection, FormGrid } from "@/components/dashboard/form-page-layout"

export default function AddMaintenancePage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    truck: "",
    serviceType: "Oil Change",
    scheduledDate: "",
    currentMileage: "",
    priority: "Normal",
    estimatedCost: "",
    notes: "",
    vendor: "",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    toast.success("Maintenance scheduled successfully")
    setTimeout(() => {
      router.push("/dashboard/maintenance")
    }, 500)
  }

  return (
    <FormPageLayout
      title="Schedule Service"
      subtitle="Schedule a maintenance service"
      backUrl="/dashboard/maintenance"
      onSubmit={handleSubmit}
      isSubmitting={false}
      submitLabel="Schedule Service"
    >
      <FormSection title="Service Details" icon={<Wrench className="w-5 h-5" />}>
        <div className="space-y-6">
          <FormGrid cols={2}>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Truck *</label>
                <Input
                  required
                  value={formData.truck}
                  onChange={(e) => setFormData({ ...formData, truck: e.target.value })}
                  placeholder="Select truck"
                  className="bg-background border-border"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Service Type *</label>
                <select
                  required
                  value={formData.serviceType}
                  onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground"
                >
                  <option>Oil Change</option>
                  <option>Tire Replacement</option>
                  <option>Brake Inspection</option>
                  <option>Engine Service</option>
                  <option>Transmission Service</option>
                  <option>Annual Inspection</option>
                  <option>Other</option>
                </select>
              </div>
          </FormGrid>

          <FormGrid cols={2}>
            <div>
              <Label>Scheduled Date *</Label>
                <Input
                  required
                  type="date"
                  value={formData.scheduledDate}
                  onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                  className="bg-background border-border"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Current Mileage *</label>
                <Input
                  required
                  type="number"
                  value={formData.currentMileage}
                  onChange={(e) => setFormData({ ...formData, currentMileage: e.target.value })}
                  placeholder="0"
                  className="bg-background border-border"
                />
              </div>
          </FormGrid>

          <FormGrid cols={2}>
            <div>
              <Label>Priority *</Label>
                <select
                  required
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground"
                >
                  <option>Normal</option>
                  <option>High</option>
                  <option>Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Estimated Cost</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.estimatedCost}
                  onChange={(e) => setFormData({ ...formData, estimatedCost: e.target.value })}
                  placeholder="0.00"
                  className="bg-background border-border"
                />
              </div>
          </FormGrid>

          <div>
            <Label>Service Vendor</Label>
              <Input
                value={formData.vendor}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                placeholder="e.g. Quick Lube Service Center"
                className="bg-background border-border"
              />
            </div>

          <div>
            <Label>Notes</Label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
                placeholder="Additional service notes..."
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground"
              />
          </div>
        </div>
      </FormSection>
    </FormPageLayout>
  )
}
