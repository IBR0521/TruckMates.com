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
import { ArrowLeft, Truck, Fuel, FileText, Shield, DollarSign, Ruler } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { createTruck } from "@/app/actions/trucks"
import { useRouter } from "next/navigation"
import { getDrivers } from "@/app/actions/drivers"

export default function AddVehiclePage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [drivers, setDrivers] = useState<any[]>([])
  const [formData, setFormData] = useState({
    // Basic Information
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
    
    // Assignment & Status
    status: "available",
    currentDriver: "",
    currentLocation: "",
    fuelLevel: "",
    odometerReading: "",
    
    // License & Inspection
    licenseExpiryDate: "",
    inspectionDate: "",
    
    // Insurance
    insuranceProvider: "",
    insurancePolicyNumber: "",
    insuranceExpiryDate: "",
  })

  useEffect(() => {
    async function loadDrivers() {
      const result = await getDrivers()
      if (result.data) {
        setDrivers(result.data)
      }
    }
    loadDrivers()
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
      toast.error(result.error || "Failed to add vehicle")
    } else {
      toast.success("Vehicle added successfully")
      router.push("/dashboard/trucks")
    }
  }


  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex items-center gap-4">
        <Link href="/dashboard/trucks">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Add New Vehicle</h1>
      </div>

      <main className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information Section */}
            <Card className="border-border p-6">
              <div className="flex items-center gap-2 mb-6">
                <Truck className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Basic Information</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="truckNumber">Truck Number *</Label>
                  <Input
                    id="truckNumber"
                    name="truckNumber"
                    type="text"
                    placeholder="TR-001"
                    value={formData.truckNumber}
                    onChange={handleChange}
                    className="mt-2"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="vin">VIN Number</Label>
                  <Input
                    id="vin"
                    name="vin"
                    type="text"
                    placeholder="1HGBH41JXMN109186"
                    value={formData.vin}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="make">Make *</Label>
                  <Input
                    id="make"
                    name="make"
                    type="text"
                    placeholder="Volvo"
                    value={formData.make}
                    onChange={handleChange}
                    className="mt-2"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="model">Model *</Label>
                  <Input
                    id="model"
                    name="model"
                    type="text"
                    placeholder="FH16"
                    value={formData.model}
                    onChange={handleChange}
                    className="mt-2"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="year">Year</Label>
                  <Input
                    id="year"
                    name="year"
                    type="number"
                    placeholder="2021"
                    value={formData.year}
                    onChange={handleChange}
                    className="mt-2"
                    min="1900"
                    max={new Date().getFullYear() + 1}
                  />
                </div>
                <div>
                  <Label htmlFor="licensePlate">License Plate Number</Label>
                  <Input
                    id="licensePlate"
                    name="licensePlate"
                    type="text"
                    placeholder="ABC-1234"
                    value={formData.licensePlate}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="serialNumber">Serial Number</Label>
                  <Input
                    id="serialNumber"
                    name="serialNumber"
                    type="text"
                    placeholder="SN123456789"
                    value={formData.serialNumber}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="height">Height</Label>
                  <Input
                    id="height"
                    name="height"
                    type="text"
                    placeholder="13'6&quot;"
                    value={formData.height}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="grossVehicleWeight">Gross Vehicle Weight (lbs)</Label>
                  <Input
                    id="grossVehicleWeight"
                    name="grossVehicleWeight"
                    type="number"
                    placeholder="80000"
                    value={formData.grossVehicleWeight}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="color">Color</Label>
                  <Input
                    id="color"
                    name="color"
                    type="text"
                    placeholder="White"
                    value={formData.color}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="ownerName">Owner's Name</Label>
                  <Input
                    id="ownerName"
                    name="ownerName"
                    type="text"
                    placeholder="John Doe"
                    value={formData.ownerName}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="cost">Cost ($)</Label>
                  <Input
                    id="cost"
                    name="cost"
                    type="number"
                    step="0.01"
                    placeholder="150000.00"
                    value={formData.cost}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
              </div>
            </Card>

            {/* License & Inspection Section */}
            <Card className="border-border p-6">
              <div className="flex items-center gap-2 mb-6">
                <FileText className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">License & Inspection</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="licenseExpiryDate">License Expiry Date</Label>
                  <Input
                    id="licenseExpiryDate"
                    name="licenseExpiryDate"
                    type="date"
                    value={formData.licenseExpiryDate}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="inspectionDate">Inspection Date</Label>
                  <Input
                    id="inspectionDate"
                    name="inspectionDate"
                    type="date"
                    value={formData.inspectionDate}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
              </div>
            </Card>

            {/* Insurance Information Section */}
            <Card className="border-border p-6">
              <div className="flex items-center gap-2 mb-6">
                <Shield className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Insurance Information</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="insuranceProvider">Insurance Provider</Label>
                  <Input
                    id="insuranceProvider"
                    name="insuranceProvider"
                    type="text"
                    placeholder="ABC Insurance Company"
                    value={formData.insuranceProvider}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="insurancePolicyNumber">Policy Number</Label>
                  <Input
                    id="insurancePolicyNumber"
                    name="insurancePolicyNumber"
                    type="text"
                    placeholder="POL-123456"
                    value={formData.insurancePolicyNumber}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="insuranceExpiryDate">Insurance Expiry Date</Label>
                  <Input
                    id="insuranceExpiryDate"
                    name="insuranceExpiryDate"
                    type="date"
                    value={formData.insuranceExpiryDate}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
              </div>
            </Card>

            {/* Assignment & Status Section */}
            <Card className="border-border p-6">
              <div className="flex items-center gap-2 mb-6">
                <Fuel className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Assignment & Status</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="status">Status *</Label>
                  <Select value={formData.status} onValueChange={(value) => handleSelectChange("status", value)}>
                    <SelectTrigger className="mt-2 w-full">
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
                  <Label htmlFor="currentDriver">Current Driver</Label>
                  <Select value={formData.currentDriver || undefined} onValueChange={(value) => handleSelectChange("currentDriver", value)}>
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue placeholder="Select a driver (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {drivers.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>
                          {driver.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="currentLocation">Current Location</Label>
                  <Input
                    id="currentLocation"
                    name="currentLocation"
                    type="text"
                    placeholder="Depot, New York"
                    value={formData.currentLocation}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="fuelLevel">Fuel Level (%)</Label>
                  <Input
                    id="fuelLevel"
                    name="fuelLevel"
                    type="number"
                    placeholder="75"
                    value={formData.fuelLevel}
                    onChange={handleChange}
                    className="mt-2"
                    min="0"
                    max="100"
                  />
                </div>
                <div>
                  <Label htmlFor="odometerReading">Current Odometer (miles)</Label>
                  <Input
                    id="odometerReading"
                    name="odometerReading"
                    type="number"
                    placeholder="125000"
                    value={formData.odometerReading}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
              </div>
            </Card>

            {/* Submit Buttons */}
            <div className="flex gap-4 justify-end">
                <Link href="/dashboard/trucks">
                  <Button type="button" variant="outline" className="border-border bg-transparent">
                    Cancel
                  </Button>
                </Link>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isSubmitting ? "Adding Vehicle..." : "Add Vehicle"}
              </Button>
              </div>
            </form>
        </div>
      </main>
    </div>
  )
}
