"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { ArrowLeft, Truck, FileText, Settings, User } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { createTruck } from "@/app/actions/trucks"
import { useRouter } from "next/navigation"
import { getDrivers } from "@/app/actions/drivers"
import { FormPageLayout, FormSection, FormGrid } from "@/components/dashboard/form-page-layout"

export default function AddVehiclePage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [drivers, setDrivers] = useState<any[]>([])
  const [formData, setFormData] = useState({
    truckNumber: "",
    make: "",
    model: "",
    year: "",
    vin: "",
    licensePlate: "",
    serialNumber: "",
    height: "",
    grossVehicleWeight: "",
    color: "",
    ownerName: "",
    cost: "",
    fuelType: "diesel",
    lastKnownAddress: "",
    status: "available",
    currentDriver: "",
    currentLocation: "",
    fuelLevel: "",
    odometerReading: "",
    licenseExpiryDate: "",
    inspectionDate: "",
    insuranceProvider: "",
    insurancePolicyNumber: "",
    insuranceExpiryDate: "",
  })

  useEffect(() => {
    async function loadDrivers() {
      const result = await getDrivers()
      if (result.data) setDrivers(result.data)
    }
    loadDrivers()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const result = await createTruck({
      truck_number: formData.truckNumber,
      make: formData.make,
      model: formData.model,
      year: formData.year ? parseInt(formData.year) : undefined,
      vin: formData.vin,
      license_plate: formData.licensePlate,
      serial_number: formData.serialNumber || undefined,
      height: formData.height || undefined,
      gross_vehicle_weight: formData.grossVehicleWeight ? parseInt(formData.grossVehicleWeight) : undefined,
      color: formData.color || undefined,
      owner_name: formData.ownerName || undefined,
      cost: formData.cost ? parseFloat(formData.cost) : undefined,
      fuel_type: formData.fuelType || undefined,
      last_known_address: formData.lastKnownAddress || undefined,
      status: formData.status,
      current_driver_id: formData.currentDriver || null,
      current_location: formData.currentLocation || null,
      fuel_level: formData.fuelLevel ? parseInt(formData.fuelLevel) : null,
      mileage: formData.odometerReading ? parseInt(formData.odometerReading) : null,
      license_expiry_date: formData.licenseExpiryDate || undefined,
      inspection_date: formData.inspectionDate || undefined,
      insurance_provider: formData.insuranceProvider || undefined,
      insurance_policy_number: formData.insurancePolicyNumber || undefined,
      insurance_expiry_date: formData.insuranceExpiryDate || undefined,
    })

    setIsSubmitting(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Vehicle added successfully")
      router.push("/dashboard/trucks")
    }
  }

  return (
    <FormPageLayout
      title="Add Vehicle"
      subtitle="Add a new vehicle to your fleet"
      backUrl="/dashboard/trucks"
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      submitLabel="Add Vehicle"
    >
            <Tabs defaultValue="basic" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="specs">Specifications</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="assignment">Assignment</TabsTrigger>
              </TabsList>

              {/* Basic Information Tab */}
              <TabsContent value="basic" className="space-y-6">
                <FormSection title="Basic Information" icon={<Truck className="w-5 h-5" />}>
                  <FormGrid cols={2}>
                    <div>
                      <Label>Truck Number *</Label>
                      <Input
                        name="truckNumber"
                        value={formData.truckNumber}
                        onChange={handleChange}
                        className="mt-1"
                        required
                        placeholder="TR-001"
                      />
                    </div>
                    <div>
                      <Label>VIN Number</Label>
                      <Input
                        name="vin"
                        value={formData.vin}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="1HGBH41JXMN109186"
                      />
                    </div>
                    <div>
                      <Label>Make *</Label>
                      <Input
                        name="make"
                        value={formData.make}
                        onChange={handleChange}
                        className="mt-1"
                        required
                        placeholder="Volvo"
                      />
                    </div>
                    <div>
                      <Label>Model *</Label>
                      <Input
                        name="model"
                        value={formData.model}
                        onChange={handleChange}
                        className="mt-1"
                        required
                        placeholder="FH16"
                      />
                    </div>
                    <div>
                      <Label>Year</Label>
                      <Input
                        name="year"
                        type="number"
                        value={formData.year}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="2021"
                        min="1900"
                        max={new Date().getFullYear() + 1}
                      />
                    </div>
                    <div>
                      <Label>License Plate</Label>
                      <Input
                        name="licensePlate"
                        value={formData.licensePlate}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="ABC-1234"
                      />
                    </div>
                  </FormGrid>
                </FormSection>
              </TabsContent>

              {/* Specifications Tab */}
              <TabsContent value="specs" className="space-y-6">
                <FormSection title="Specifications" icon={<Settings className="w-5 h-5" />}>
                  <FormGrid cols={2}>
                    <div>
                      <Label>Serial Number</Label>
                      <Input
                        name="serialNumber"
                        value={formData.serialNumber}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="SN123456789"
                      />
                    </div>
                    <div>
                      <Label>Height</Label>
                      <Input
                        name="height"
                        value={formData.height}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="13'6&quot;"
                      />
                    </div>
                    <div>
                      <Label>Gross Vehicle Weight (lbs)</Label>
                      <Input
                        name="grossVehicleWeight"
                        type="number"
                        value={formData.grossVehicleWeight}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="80000"
                      />
                    </div>
                    <div>
                      <Label>Color</Label>
                      <Input
                        name="color"
                        value={formData.color}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="White"
                      />
                    </div>
                    <div>
                      <Label>Owner's Name</Label>
                      <Input
                        name="ownerName"
                        value={formData.ownerName}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <Label>Cost ($)</Label>
                      <Input
                        name="cost"
                        type="number"
                        step="0.01"
                        value={formData.cost}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="150000.00"
                      />
                    </div>
                    <div>
                      <Label>Fuel Type</Label>
                      <Select value={formData.fuelType} onValueChange={(v) => handleSelectChange("fuelType", v)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="diesel">Diesel</SelectItem>
                          <SelectItem value="gasoline">Gasoline</SelectItem>
                          <SelectItem value="electric">Electric</SelectItem>
                          <SelectItem value="hybrid">Hybrid</SelectItem>
                          <SelectItem value="cng">CNG (Compressed Natural Gas)</SelectItem>
                          <SelectItem value="lng">LNG (Liquefied Natural Gas)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </FormGrid>
                </FormSection>
              </TabsContent>

              {/* Documents Tab */}
              <TabsContent value="documents" className="space-y-6">
                <FormSection title="Documents & Insurance" icon={<FileText className="w-5 h-5" />}>
                  <FormGrid cols={2}>
                    <div>
                      <Label>License Expiry Date</Label>
                      <Input
                        name="licenseExpiryDate"
                        type="date"
                        value={formData.licenseExpiryDate}
                        onChange={handleChange}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Inspection Date</Label>
                      <Input
                        name="inspectionDate"
                        type="date"
                        value={formData.inspectionDate}
                        onChange={handleChange}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Insurance Provider</Label>
                      <Input
                        name="insuranceProvider"
                        value={formData.insuranceProvider}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="ABC Insurance Company"
                      />
                    </div>
                    <div>
                      <Label>Policy Number</Label>
                      <Input
                        name="insurancePolicyNumber"
                        value={formData.insurancePolicyNumber}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="POL-123456"
                      />
                    </div>
                    <div>
                      <Label>Insurance Expiry Date</Label>
                      <Input
                        name="insuranceExpiryDate"
                        type="date"
                        value={formData.insuranceExpiryDate}
                        onChange={handleChange}
                        className="mt-1"
                      />
                    </div>
                  </FormGrid>
                </FormSection>
              </TabsContent>

              {/* Assignment Tab */}
              <TabsContent value="assignment" className="space-y-6">
                <FormSection title="Assignment" icon={<User className="w-5 h-5" />}>
                  <FormGrid cols={2}>
                    <div>
                      <Label>Status *</Label>
                      <Select value={formData.status} onValueChange={(v) => handleSelectChange("status", v)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="available">Available</SelectItem>
                          <SelectItem value="in_use">In Use</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                          <SelectItem value="out_of_service">Out of Service</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Current Driver</Label>
                      <Select value={formData.currentDriver || "none"} onValueChange={(v) => handleSelectChange("currentDriver", v === "none" ? "" : v)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select driver" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {drivers.map(d => (
                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Current Location</Label>
                      <Input
                        name="currentLocation"
                        value={formData.currentLocation}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="Depot, New York"
                      />
                    </div>
                    <div>
                      <Label>Fuel Level (%)</Label>
                      <Input
                        name="fuelLevel"
                        type="number"
                        value={formData.fuelLevel}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="75"
                        min="0"
                        max="100"
                      />
                    </div>
                    <div>
                      <Label>Odometer (miles)</Label>
                      <Input
                        name="odometerReading"
                        type="number"
                        value={formData.odometerReading}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="125000"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Last Known Address</Label>
                      <Input
                        name="lastKnownAddress"
                        value={formData.lastKnownAddress}
                        onChange={handleChange}
                        className="mt-1"
                        placeholder="Depot address or last location"
                      />
                    </div>
                  </FormGrid>
                </FormSection>
              </TabsContent>
            </Tabs>
    </FormPageLayout>
  )
}
