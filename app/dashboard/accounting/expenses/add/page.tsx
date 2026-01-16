"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ArrowLeft, DollarSign, Calendar, Truck, User, CreditCard } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createExpense } from "@/app/actions/accounting"
import { getDrivers } from "@/app/actions/drivers"
import { getTrucks } from "@/app/actions/trucks"
import { FormPageLayout, FormSection, FormGrid } from "@/components/dashboard/form-page-layout"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
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

export default function AddExpensePage() {
  const router = useRouter()
  const [drivers, setDrivers] = useState<any[]>([])
  const [trucks, setTrucks] = useState<any[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    category: "fuel",
    description: "",
    amount: "",
    vendor: "",
    driver_id: "",
    truck_id: "",
    mileage: "",
    payment_method: "",
    has_receipt: false,
    fuel_level_after: "", // New field for fuel level after fill
  })

  useEffect(() => {
    async function loadData() {
      const [driversResult, trucksResult] = await Promise.all([
        getDrivers(),
        getTrucks(),
      ])
      if (driversResult.data) {
        setDrivers(driversResult.data)
      }
      if (trucksResult.data) {
        setTrucks(trucksResult.data)
      }
    }
    loadData()
  }, [])

  // Auto-set fuel level to 100% when truck is selected for fuel expense
  useEffect(() => {
    if (formData.category === "fuel" && formData.truck_id && !formData.fuel_level_after) {
      setFormData((prev) => ({ ...prev, fuel_level_after: "100" }))
    } else if ((formData.category !== "fuel" || !formData.truck_id) && formData.fuel_level_after) {
      setFormData((prev) => ({ ...prev, fuel_level_after: "" }))
    }
  }, [formData.category, formData.truck_id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const result = await createExpense({
      category: formData.category,
      description: formData.description,
      amount: Number.parseFloat(formData.amount),
      date: formData.date,
      vendor: formData.vendor || undefined,
      driver_id: formData.driver_id || undefined,
      truck_id: formData.truck_id || undefined,
      mileage: formData.mileage ? Number.parseInt(formData.mileage) : undefined,
      payment_method: formData.payment_method || undefined,
      has_receipt: formData.has_receipt,
      fuel_level_after: formData.fuel_level_after ? Number.parseInt(formData.fuel_level_after) : undefined,
    })

    setIsSubmitting(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Expense added successfully")
      setTimeout(() => {
        router.push("/dashboard/accounting/expenses")
      }, 500)
    }
  }

  return (
    <FormPageLayout
      title="Add Expense"
      subtitle="Record a new fleet expense"
      backUrl="/dashboard/accounting/expenses"
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      submitLabel="Add Expense"
    >
      <Tabs defaultValue="details" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="details">Expense Details</TabsTrigger>
          <TabsTrigger value="assignment">Assignment</TabsTrigger>
          <TabsTrigger value="payment">Payment</TabsTrigger>
          <TabsTrigger value="additional">Additional</TabsTrigger>
        </TabsList>

        {/* Expense Details Tab */}
        <TabsContent value="details" className="space-y-6">
          <FormSection title="Expense Details" icon={<DollarSign className="w-5 h-5" />}>
        <FormGrid cols={2}>
          <div>
            <Label>Date *</Label>
                <Input
                  required
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="bg-background border-border"
                />
              </div>
          <div>
            <Label>Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fuel">Fuel</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="tolls">Tolls</SelectItem>
                    <SelectItem value="food">Food</SelectItem>
                    <SelectItem value="lodging">Lodging</SelectItem>
                    <SelectItem value="insurance">Insurance</SelectItem>
                    <SelectItem value="repairs">Repairs</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
          </FormGrid>

          <div>
            <Label>Description *</Label>
              <Input
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g. Diesel - Route TX-CA"
                className="bg-background border-border"
              />
          </div>

          <FormGrid cols={2}>
            <div>
              <Label>Amount *</Label>
                <Input
                  required
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                  className="bg-background border-border"
                />
            </div>
            <div>
              <Label>Vendor</Label>
                <Input
                  value={formData.vendor}
                  onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                  placeholder="e.g. Shell Gas Station"
                  className="bg-background border-border"
                />
              </div>
          </FormGrid>
        </FormSection>
        </TabsContent>

        {/* Assignment Tab */}
        <TabsContent value="assignment" className="space-y-6">
          <FormSection title="Assignment" icon={<Truck className="w-5 h-5" />}>
            <FormGrid cols={2}>
              <div>
                <Label>Driver</Label>
                <Select
                  value={formData.driver_id || "none"}
                  onValueChange={(value) => setFormData({ ...formData, driver_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Select driver (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {drivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Expense will auto-link to routes/loads for this driver and date
                </p>
              </div>
              <div>
                <Label>Truck</Label>
                <Select
                  value={formData.truck_id || "none"}
                  onValueChange={(value) => setFormData({ ...formData, truck_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Select truck (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {trucks.map((truck) => (
                      <SelectItem key={truck.id} value={truck.id}>
                        {truck.truck_number} {truck.make && truck.model ? `(${truck.make} ${truck.model})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Expense will auto-link to routes/loads for this truck and date
                </p>
              </div>
            </FormGrid>

            <div>
              <Label>Mileage</Label>
              <Input
                type="number"
                value={formData.mileage}
                onChange={(e) => setFormData({ ...formData, mileage: e.target.value })}
                placeholder="0"
                className="bg-background border-border"
              />
            </div>
          </FormSection>
        </TabsContent>

        {/* Payment Tab */}
        <TabsContent value="payment" className="space-y-6">
          <FormSection title="Payment Information" icon={<CreditCard className="w-5 h-5" />}>
            <FormGrid cols={2}>
              <div>
                <Label>Payment Method</Label>
                <Select
                  value={formData.payment_method || "none"}
                  onValueChange={(value) => setFormData({ ...formData, payment_method: value === "none" ? "" : value })}
                >
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="debit_card">Debit Card</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="company_account">Company Account</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2 pt-8">
                <Checkbox
                  id="has_receipt"
                  checked={formData.has_receipt}
                  onCheckedChange={(checked) => setFormData({ ...formData, has_receipt: checked as boolean })}
                />
                <Label htmlFor="has_receipt" className="cursor-pointer">Has Receipt</Label>
              </div>
            </FormGrid>
          </FormSection>
        </TabsContent>

        {/* Additional Tab */}
        <TabsContent value="additional" className="space-y-6">
          <FormSection title="Additional Information" icon={<Calendar className="w-5 h-5" />}>
            {/* Fuel Level After Fill - Only show for fuel expenses with truck selected */}
            {formData.category === "fuel" && formData.truck_id && (
              <div>
                <Label>Fuel Level After Fill (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.fuel_level_after}
                  onChange={(e) => setFormData({ ...formData, fuel_level_after: e.target.value })}
                  placeholder="100"
                  className="bg-background border-border"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty to auto-set to 100% (full tank). Vehicle fuel level will be automatically updated.
                </p>
              </div>
            )}
          </FormSection>
        </TabsContent>
      </Tabs>
    </FormPageLayout>
  )
}
