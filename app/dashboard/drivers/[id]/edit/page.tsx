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
import { ArrowLeft, User, FileText, Briefcase, Phone } from "lucide-react"
import Link from "next/link"
import { use } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { getDriver, updateDriver } from "@/app/actions/drivers"
import { getTrucks } from "@/app/actions/trucks"

export default function EditDriverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [trucks, setTrucks] = useState<any[]>([])
  const [formData, setFormData] = useState({
    // Personal Information
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    dateOfBirth: "",
    
    // License Details
    licenseNumber: "",
    licenseState: "",
    licenseExpiry: "",
    licenseClass: "",
    
    // Employment Information
    hireDate: "",
    employmentType: "full-time",
    status: "active",
    payRate: "",
    assignedTruck: "",
    
    // Emergency Contact
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: "",
    
    // Additional Information
    notes: "",
  })

  useEffect(() => {
    async function loadData() {
      const [driverResult, trucksResult] = await Promise.all([
        getDriver(id),
        getTrucks(),
      ])
      
      if (trucksResult.data) {
        setTrucks(trucksResult.data)
      }
      
      if (driverResult.data) {
        const driver = driverResult.data
        setFormData({
          name: driver.name || "",
          email: driver.email || "",
          phone: driver.phone || "",
          address: "",
          city: "",
          state: "",
          zipCode: "",
          dateOfBirth: "",
          licenseNumber: driver.license_number || "",
          licenseState: "",
          licenseExpiry: driver.license_expiry || "",
          licenseClass: "",
          hireDate: "",
          employmentType: "full-time",
          status: driver.status || "active",
          payRate: driver.pay_rate ? String(driver.pay_rate) : "",
          assignedTruck: driver.truck_id || "",
          emergencyContactName: "",
          emergencyContactPhone: "",
          emergencyContactRelation: "",
          notes: "",
        })
      }
      setIsLoading(false)
    }
    loadData()
  }, [id])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const result = await updateDriver(id, {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      license_number: formData.licenseNumber,
      license_expiry: formData.licenseExpiry || null,
      status: formData.status,
      truck_id: formData.assignedTruck || null,
      pay_rate: formData.payRate ? Number.parseFloat(formData.payRate) : null,
    })

    setIsSubmitting(false)

    if (result.error) {
      toast.error(result.error || "Failed to update driver")
    } else {
      toast.success("Driver updated successfully")
      router.push(`/dashboard/drivers/${id}`)
    }
  }

  const usStates = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
  ]

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4">
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Edit Driver</h1>
        </div>
        <main className="flex-1 overflow-auto p-8">
          <div className="max-w-4xl mx-auto">
            <Card className="border-border p-8">
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading driver information...</p>
              </div>
            </Card>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-8 py-4 flex items-center gap-4">
        <Link href={`/dashboard/drivers/${id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Edit Driver</h1>
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
                <div>
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <Input
                    id="dateOfBirth"
                    name="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="address">Street Address</Label>
                  <Input
                    id="address"
                    name="address"
                    type="text"
                    placeholder="123 Main Street"
                    value={formData.address}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    name="city"
                    type="text"
                    placeholder="New York"
                    value={formData.city}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Select value={formData.state} onValueChange={(value) => handleSelectChange("state", value)}>
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
                  <Label htmlFor="zipCode">ZIP Code</Label>
                  <Input
                    id="zipCode"
                    name="zipCode"
                    type="text"
                    placeholder="10001"
                    value={formData.zipCode}
                    onChange={handleChange}
                    className="mt-2"
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
                <div>
                  <Label htmlFor="licenseClass">License Class</Label>
                  <Select value={formData.licenseClass} onValueChange={(value) => handleSelectChange("licenseClass", value)}>
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Class A">Class A - Combination Vehicle</SelectItem>
                      <SelectItem value="Class B">Class B - Heavy Straight Vehicle</SelectItem>
                      <SelectItem value="Class C">Class C - Small Vehicle</SelectItem>
                      <SelectItem value="CDL">CDL - Commercial Driver's License</SelectItem>
                    </SelectContent>
                  </Select>
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
                  <Label htmlFor="employmentType">Employment Type</Label>
                  <Select value={formData.employmentType} onValueChange={(value) => handleSelectChange("employmentType", value)}>
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full-time">Full-Time</SelectItem>
                      <SelectItem value="part-time">Part-Time</SelectItem>
                      <SelectItem value="contractor">Contractor</SelectItem>
                      <SelectItem value="temporary">Temporary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                  <Label htmlFor="payRate">Pay Rate (per mile/hour)</Label>
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
              </div>
            </Card>

            {/* Emergency Contact Section */}
            <Card className="border-border p-4 md:p-6">
              <div className="flex items-center gap-2 mb-6">
                <Phone className="w-5 h-5 text-primary" />
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
                    placeholder="+1 (555) 987-6543"
                    value={formData.emergencyContactPhone}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="emergencyContactRelation">Relationship</Label>
                  <Select value={formData.emergencyContactRelation} onValueChange={(value) => handleSelectChange("emergencyContactRelation", value)}>
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spouse">Spouse</SelectItem>
                      <SelectItem value="parent">Parent</SelectItem>
                      <SelectItem value="sibling">Sibling</SelectItem>
                      <SelectItem value="child">Child</SelectItem>
                      <SelectItem value="friend">Friend</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            {/* Additional Notes Section */}
            <Card className="border-border p-4 md:p-6">
              <div className="flex items-center gap-2 mb-6">
                <FileText className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Additional Information</h2>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder="Any additional information about the driver..."
                  value={formData.notes}
                  onChange={handleChange}
                  className="mt-2 min-h-24"
                  rows={4}
                />
              </div>
            </Card>

            {/* Submit Buttons */}
            <div className="flex gap-4 justify-end">
              <Link href={`/dashboard/drivers/${id}`}>
                  <Button type="button" variant="outline" className="border-border bg-transparent">
                    Cancel
                  </Button>
                </Link>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isSubmitting ? "Saving Changes..." : "Save Changes"}
              </Button>
              </div>
            </form>
        </div>
      </main>
    </div>
  )
}
