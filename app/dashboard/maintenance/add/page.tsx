"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

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
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
        <Link href="/dashboard/maintenance">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Maintenance
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-foreground">Schedule Service</h1>
        <p className="text-muted-foreground text-sm mt-1">Schedule a maintenance service</p>
      </div>

      <div className="p-4 md:p-8">
        <Card className="max-w-3xl mx-auto border-border p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
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
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Scheduled Date *</label>
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
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Priority *</label>
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
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Service Vendor</label>
              <Input
                value={formData.vendor}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                placeholder="e.g. Quick Lube Service Center"
                className="bg-background border-border"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder="Additional service notes..."
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Schedule Service
              </Button>
              <Link href="/dashboard/maintenance">
                <Button type="button" variant="outline" className="border-border bg-transparent">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
