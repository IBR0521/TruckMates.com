"use client"

import type React from "react"
import { useState, useEffect } from "react"
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
import { ArrowLeft, User, FileText, Briefcase } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { createDriver } from "@/app/actions/drivers"
import { useRouter } from "next/navigation"
import { getTrucks } from "@/app/actions/trucks"

export default function AddDriverPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [trucks, setTrucks] = useState<any[]>([])
  const [formData, setFormData] = useState({
    // Personal Information
    name: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    
    // Address
    address: "",
    city: "",
    state: "",
    zip: "",
    
    // License Details
    licenseNumber: "",
    licenseState: "",
    licenseExpiry: "",
    
    // Emergency Contact
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelationship: "",
    
    // Employment Information
    status: "active",
    hireDate: "",
    payRateType: "per_mile",
    payRate: "",
    assignedTruck: "",
    notes: "",
  })

  useEffect(() => {
    async function loadTrucks() {
      const result = await getTrucks()
      if (result.data) {
        setTrucks(result.data)
      }
    }
    loadTrucks()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Call the server action to create driver in database
    const result = await createDriver({
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      license_number: formData.licenseNumber,
      license_expiry: formData.licenseExpiry || null,
      status: formData.status,
      truck_id: formData.assignedTruck || null,
      pay_rate: formData.payRate ? Number.parseFloat(formData.payRate) : null,
      // Additional fields will be stored in a JSONB field or separate columns
      // For now, we'll store the essential ones
    })

    setIsSubmitting(false)

    if (result.error) {
      toast.error(result.error || "Failed to add driver. Make sure you have a company set up.")
    } else {
      toast.success("Driver added successfully")
      router.push("/dashboard/drivers")
    }
  }

  const usStates = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
  ]

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 flex items-center gap-4">
        <Link href="/dashboard/drivers">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Add New Driver</h1>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information Section */}
            <Card className="border-border p-4 md:p-6">
              <div className="flex items-center gap-2 mb-6">
                <User className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Personal Information</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="John Smith"
                    value={formData.name}
                    onChange={handleChange}
                    className="mt-2"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="john@company.com"
                    value={formData.email}
                    onChange={handleChange}
                    className="mt-2"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={formData.phone}
                    onChange={handleChange}
                    className="mt-2"
                    required
                  />
                </div>
              </div>
            </Card>

            {/* License Details Section */}
            <Card className="border-border p-4 md:p-6">
              <div className="flex items-center gap-2 mb-6">
                <FileText className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">License Details</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="licenseNumber">License Number *</Label>
                  <Input
                    id="licenseNumber"
                    name="licenseNumber"
                    type="text"
                    placeholder="DL12345678"
                    value={formData.licenseNumber}
                    onChange={handleChange}
                    className="mt-2"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="licenseState">License State *</Label>
                  <Select value={formData.licenseState} onValueChange={(value) => handleSelectChange("licenseState", value)}>
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {usStates.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="licenseExpiry">License Expiry Date *</Label>
                  <Input
                    id="licenseExpiry"
                    name="licenseExpiry"
                    type="date"
                    value={formData.licenseExpiry}
                    onChange={handleChange}
                    className="mt-2"
                    required
                  />
                </div>
              </div>
            </Card>

            {/* Emergency Contact */}
            <Card className="border-border p-4 md:p-6">
              <div className="flex items-center gap-2 mb-6">
                <User className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Emergency Contact</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="emergencyContactName">Contact Name</Label>
                  <Input
                    id="emergencyContactName"
                    name="emergencyContactName"
                    type="text"
                    placeholder="Jane Smith"
                    value={formData.emergencyContactName}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="emergencyContactPhone">Contact Phone</Label>
                  <Input
                    id="emergencyContactPhone"
                    name="emergencyContactPhone"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={formData.emergencyContactPhone}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="emergencyContactRelationship">Relationship</Label>
                  <Input
                    id="emergencyContactRelationship"
                    name="emergencyContactRelationship"
                    type="text"
                    placeholder="Spouse, Parent, etc."
                    value={formData.emergencyContactRelationship}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
              </div>
            </Card>

            {/* Employment Information Section */}
            <Card className="border-border p-4 md:p-6">
              <div className="flex items-center gap-2 mb-6">
                <Briefcase className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Employment Information</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="status">Status *</Label>
                  <Select value={formData.status} onValueChange={(value) => handleSelectChange("status", value)}>
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="on_route">On Route</SelectItem>
                      <SelectItem value="off_duty">Off Duty</SelectItem>
                      <SelectItem value="on_leave">On Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="hireDate">Hire Date</Label>
                  <Input
                    id="hireDate"
                    name="hireDate"
                    type="date"
                    value={formData.hireDate}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="payRateType">Pay Rate Type</Label>
                  <Select value={formData.payRateType} onValueChange={(value) => handleSelectChange("payRateType", value)}>
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="per_mile">Per Mile</SelectItem>
                      <SelectItem value="per_hour">Per Hour</SelectItem>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="flat">Flat Rate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="payRate">Pay Rate</Label>
                  <Input
                    id="payRate"
                    name="payRate"
                    type="text"
                    placeholder="0.50"
                    value={formData.payRate}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="assignedTruck">Assigned Truck</Label>
                  <Select value={formData.assignedTruck || undefined} onValueChange={(value) => handleSelectChange("assignedTruck", value)}>
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue placeholder="Select a truck (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {trucks.map((truck) => (
                        <SelectItem key={truck.id} value={truck.id}>
                          {truck.truck_number} - {truck.make} {truck.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    placeholder="Additional notes about this driver..."
                    value={formData.notes}
                    onChange={handleChange}
                    className="mt-2"
                    rows={4}
                  />
                </div>
              </div>
            </Card>

            {/* Submit Buttons */}
            <div className="flex gap-4 justify-end">
                <Link href="/dashboard/drivers">
                  <Button type="button" variant="outline" className="border-border bg-transparent">
                    Cancel
                  </Button>
                </Link>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isSubmitting ? "Adding Driver..." : "Add Driver"}
              </Button>
              </div>
            </form>
        </div>
      </main>
    </div>
  )
}
