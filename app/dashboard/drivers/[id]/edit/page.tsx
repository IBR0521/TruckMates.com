"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
import { ArrowLeft, User, FileText, Briefcase, Phone } from "lucide-react"
import Link from "next/link"
import { use } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { getDriver, updateDriver } from "@/app/actions/drivers"
import { getTrucks } from "@/app/actions/trucks"
import { FormPageLayout, FormSection, FormGrid } from "@/components/dashboard/form-page-layout"

export default function EditDriverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [trucks, setTrucks] = useState<any[]>([])
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    driverId: "",
    employeeType: "employee",
    dateOfBirth: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    licenseNumber: "",
    licenseState: "",
    licenseType: "class_a",
    licenseEndorsements: [] as string[],
    licenseExpiry: "",
    status: "active",
    hireDate: "",
    assignedTruck: "",
    payRateType: "per_mile",
    payRate: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelationship: "",
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
          driverId: driver.driver_id || "",
          employeeType: driver.employee_type || "employee",
          dateOfBirth: driver.date_of_birth || "",
          address: driver.address || "",
          city: driver.city || "",
          state: driver.state || driver.license_state || "",
          zip: driver.zip || "",
          licenseNumber: driver.license_number || "",
          licenseState: driver.license_state || "",
          licenseType: driver.license_type || "class_a",
          licenseEndorsements: driver.license_endorsements ? driver.license_endorsements.split(",") : [],
          licenseExpiry: driver.license_expiry || "",
          status: driver.status || "active",
          hireDate: driver.hire_date || "",
          assignedTruck: driver.truck_id || "",
          payRateType: driver.pay_rate_type || "per_mile",
          payRate: driver.pay_rate ? String(driver.pay_rate) : "",
          emergencyContactName: driver.emergency_contact_name || "",
          emergencyContactPhone: driver.emergency_contact_phone || "",
          emergencyContactRelationship: driver.emergency_contact_relationship || "",
          notes: driver.notes || "",
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
      driver_id: formData.driverId || undefined,
      employee_type: formData.employeeType || undefined,
      date_of_birth: formData.dateOfBirth || undefined,
      address: formData.address || undefined,
      city: formData.city || undefined,
      state: formData.state || undefined,
      zip: formData.zip || undefined,
      license_number: formData.licenseNumber,
      license_state: formData.licenseState || undefined,
      license_type: formData.licenseType || undefined,
      license_endorsements: formData.licenseEndorsements.length > 0 ? formData.licenseEndorsements.join(",") : undefined,
      license_expiry: formData.licenseExpiry || null,
      status: formData.status,
      hire_date: formData.hireDate || undefined,
      truck_id: formData.assignedTruck || null,
      pay_rate_type: formData.payRateType || undefined,
      pay_rate: formData.payRate ? Number.parseFloat(formData.payRate) : null,
      emergency_contact_name: formData.emergencyContactName || undefined,
      emergency_contact_phone: formData.emergencyContactPhone || undefined,
      emergency_contact_relationship: formData.emergencyContactRelationship || undefined,
      notes: formData.notes || undefined,
    })

    setIsSubmitting(false)

    if (result.error) {
      toast.error(result.error)
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
      <FormPageLayout
        title="Edit Driver"
        subtitle="Loading driver information..."
        backUrl={`/dashboard/drivers/${id}`}
      >
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading driver information...</p>
        </div>
      </FormPageLayout>
    )
  }

  return (
    <FormPageLayout
      title="Edit Driver"
      subtitle="Update driver information"
      backUrl={`/dashboard/drivers/${id}`}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      submitLabel="Update Driver"
    >
            <Tabs defaultValue="personal" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="personal">Personal</TabsTrigger>
                <TabsTrigger value="license">License</TabsTrigger>
                <TabsTrigger value="employment">Employment</TabsTrigger>
                <TabsTrigger value="emergency">Emergency</TabsTrigger>
              </TabsList>

              {/* Personal Information Tab */}
              <TabsContent value="personal" className="space-y-6">
                <FormSection title="Personal Information" icon={<User className="w-5 h-5" />}>
                  <FormGrid cols={2}>
                    <div className="md:col-span-2">
                      <Label>Full Name *</Label>
                      <Input
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className="mt-1"
                        required
                        placeholder="John Smith"
                      />
                    </div>
                    <div>
                      <Label>Driver ID</Label>
                      <Input
                        name="driverId"
                        value={formData.driverId}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="DRV-001"
                      />
                    </div>
                    <div>
                      <Label>Employee Type</Label>
                      <Select value={formData.employeeType} onValueChange={(v) => handleSelectChange("employeeType", v)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="employee">Employee</SelectItem>
                          <SelectItem value="contractor">Contractor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Email Address *</Label>
                      <Input
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="mt-1"
                        required
                        placeholder="john@company.com"
                      />
                    </div>
                    <div>
                      <Label>Phone Number *</Label>
                      <Input
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleChange}
                        className="mt-1"
                        required
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                    <div>
                      <Label>Date of Birth</Label>
                      <Input
                        name="dateOfBirth"
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={handleChange}
                        className="mt-1"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Address</Label>
                      <Input
                        name="address"
                        value={formData.address}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="Street address"
                      />
                    </div>
                    <div>
                      <Label>City</Label>
                      <Input
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="City"
                      />
                    </div>
                    <div>
                      <Label>State</Label>
                      <Select value={formData.state} onValueChange={(v) => handleSelectChange("state", v)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent>
                          {usStates.map(state => (
                            <SelectItem key={state} value={state}>{state}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>ZIP Code</Label>
                      <Input
                        name="zip"
                        value={formData.zip}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="12345"
                      />
                    </div>
                  </FormGrid>
                </FormSection>
              </TabsContent>

              {/* License Details Tab */}
              <TabsContent value="license" className="space-y-6">
                <FormSection title="License Information" icon={<FileText className="w-5 h-5" />}>
                  <FormGrid cols={2}>
                    <div>
                      <Label>License Number *</Label>
                      <Input
                        name="licenseNumber"
                        value={formData.licenseNumber}
                        onChange={handleChange}
                        className="mt-1"
                        required
                        placeholder="DL12345678"
                      />
                    </div>
                    <div>
                      <Label>License State *</Label>
                      <Select value={formData.licenseState} onValueChange={(v) => handleSelectChange("licenseState", v)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent>
                          {usStates.map(state => (
                            <SelectItem key={state} value={state}>{state}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>CDL License Type *</Label>
                      <Select value={formData.licenseType} onValueChange={(v) => handleSelectChange("licenseType", v)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="class_a">Class A</SelectItem>
                          <SelectItem value="class_b">Class B</SelectItem>
                          <SelectItem value="class_c">Class C</SelectItem>
                          <SelectItem value="non_cdl">Non-CDL</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>License Expiry Date *</Label>
                      <Input
                        name="licenseExpiry"
                        type="date"
                        value={formData.licenseExpiry}
                        onChange={handleChange}
                        className="mt-1"
                        required
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>License Endorsements</Label>
                      <div className="grid grid-cols-3 md:grid-cols-4 gap-3 mt-2">
                        {["H", "N", "P", "S", "T", "X", "L", "E"].map(endorsement => (
                          <label key={endorsement} className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={formData.licenseEndorsements.includes(endorsement)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setFormData(prev => ({
                                    ...prev,
                                    licenseEndorsements: [...prev.licenseEndorsements, endorsement]
                                  }))
                                } else {
                                  setFormData(prev => ({
                                    ...prev,
                                    licenseEndorsements: prev.licenseEndorsements.filter(e => e !== endorsement)
                                  }))
                                }
                              }}
                            />
                            <span className="text-sm">{endorsement}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </FormGrid>
                </FormSection>
              </TabsContent>

              {/* Employment Information Tab */}
              <TabsContent value="employment" className="space-y-6">
                <FormSection title="Employment Information" icon={<Briefcase className="w-5 h-5" />}>
                  <FormGrid cols={2}>
                    <div>
                      <Label>Status *</Label>
                      <Select value={formData.status} onValueChange={(v) => handleSelectChange("status", v)}>
                        <SelectTrigger className="mt-1">
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
                      <Label>Hire Date</Label>
                      <Input
                        name="hireDate"
                        type="date"
                        value={formData.hireDate}
                        onChange={handleChange}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Assigned Truck</Label>
                      <Select value={formData.assignedTruck || "none"} onValueChange={(v) => handleSelectChange("assignedTruck", v === "none" ? "" : v)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select truck" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {trucks.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.truck_number} - {t.make} {t.model}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Pay Rate Type</Label>
                      <Select value={formData.payRateType} onValueChange={(v) => handleSelectChange("payRateType", v)}>
                        <SelectTrigger className="mt-1">
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
                      <Label>Pay Rate</Label>
                      <Input
                        name="payRate"
                        value={formData.payRate}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="0.50"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Notes</Label>
                      <Textarea
                        name="notes"
                        value={formData.notes}
                        onChange={handleChange}
                        className="mt-1"
                        rows={3}
                        placeholder="Additional notes..."
                      />
                    </div>
                  </FormGrid>
                </FormSection>
              </TabsContent>

              {/* Emergency Contact Tab */}
              <TabsContent value="emergency" className="space-y-6">
                <FormSection title="Emergency Contact" icon={<Phone className="w-5 h-5" />}>
                  <FormGrid cols={2}>
                    <div>
                      <Label>Contact Name</Label>
                      <Input
                        name="emergencyContactName"
                        value={formData.emergencyContactName}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="Jane Smith"
                      />
                    </div>
                    <div>
                      <Label>Contact Phone</Label>
                      <Input
                        name="emergencyContactPhone"
                        type="tel"
                        value={formData.emergencyContactPhone}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                    <div>
                      <Label>Relationship</Label>
                      <Input
                        name="emergencyContactRelationship"
                        value={formData.emergencyContactRelationship}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="Spouse, Parent, etc."
                      />
                    </div>
                  </FormGrid>
                </FormSection>
              </TabsContent>
            </Tabs>
    </FormPageLayout>
  )
}
