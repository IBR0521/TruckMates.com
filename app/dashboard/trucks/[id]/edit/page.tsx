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
import { ArrowLeft, Truck, FileText, Wrench, Fuel } from "lucide-react"
import Link from "next/link"
import { use } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { getTruck, updateTruck } from "@/app/actions/trucks"
import { getDrivers } from "@/app/actions/drivers"

export default function EditTruckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
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
    licensePlateState: "",
    licensePlateExpiry: "",
    
    // Vehicle Details
    vehicleType: "semi-truck",
    fuelType: "diesel",
    engineSize: "",
    transmission: "automatic",
    color: "",
    odometerReading: "",
    
    // Capacity & Dimensions
    maxWeight: "",
    cargoCapacity: "",
    length: "",
    width: "",
    height: "",
    
    // Registration & Insurance
    registrationNumber: "",
    registrationExpiry: "",
    insuranceProvider: "",
    insurancePolicyNumber: "",
    insuranceExpiry: "",
    
    // Assignment
    status: "available",
    currentDriver: "",
    currentLocation: "",
    fuelLevel: "",
    
    // Purchase/Lease Information
    purchaseDate: "",
    purchasePrice: "",
    leaseCompany: "",
    leaseExpiry: "",
    
    // Additional Information
    notes: "",
  })

  useEffect(() => {
    async function loadData() {
      const [truckResult, driversResult] = await Promise.all([
        getTruck(id),
        getDrivers(),
      ])
      
      if (driversResult.data) {
        setDrivers(driversResult.data)
      }
      
      if (truckResult.data) {
        const truck = truckResult.data
        setFormData({
          truckNumber: truck.truck_number || "",
          make: truck.make || "",
          model: truck.model || "",
          year: truck.year ? truck.year.toString() : "",
          vin: truck.vin || "",
          licensePlate: truck.license_plate || "",
          licensePlateState: "",
          licensePlateExpiry: "",
          vehicleType: "semi-truck",
          fuelType: "diesel",
          engineSize: "",
          transmission: "automatic",
          color: "",
          odometerReading: truck.mileage ? truck.mileage.toString() : "",
          maxWeight: "",
          cargoCapacity: "",
          length: "",
          width: "",
          height: "",
          registrationNumber: "",
          registrationExpiry: "",
          insuranceProvider: "",
          insurancePolicyNumber: "",
          insuranceExpiry: "",
          status: truck.status || "available",
          currentDriver: truck.current_driver_id || "",
          currentLocation: truck.current_location || "",
          fuelLevel: truck.fuel_level ? truck.fuel_level.toString() : "",
          purchaseDate: "",
          purchasePrice: "",
          leaseCompany: "",
          leaseExpiry: "",
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

    const result = await updateTruck(id, {
      truck_number: formData.truckNumber,
      make: formData.make,
      model: formData.model,
      year: formData.year ? parseInt(formData.year) : undefined,
      vin: formData.vin,
      license_plate: formData.licensePlate,
      status: formData.status,
      current_driver_id: formData.currentDriver || null,
      current_location: formData.currentLocation || null,
      fuel_level: formData.fuelLevel ? parseInt(formData.fuelLevel) : null,
      mileage: formData.odometerReading ? parseInt(formData.odometerReading) : null,
    })

    setIsSubmitting(false)

    if (result.error) {
      toast.error(result.error || "Failed to update vehicle")
    } else {
      toast.success("Vehicle updated successfully")
      router.push(`/dashboard/trucks/${id}`)
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
        <div className="border-b border-border bg-card/50 backdrop-blur px-8 py-4">
          <h1 className="text-2xl font-bold text-foreground">Edit Vehicle</h1>
        </div>
        <main className="flex-1 overflow-auto p-8">
          <div className="max-w-4xl mx-auto">
            <Card className="border-border p-8">
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading vehicle information...</p>
              </div>
            </Card>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-border bg-card/50 backdrop-blur px-8 py-4 flex items-center gap-4">
        <Link href={`/dashboard/trucks/${id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Edit Vehicle</h1>
      </div>

      <main className="flex-1 overflow-auto p-8">
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
              </div>
            </Card>

            {/* License & Registration Section */}
            <Card className="border-border p-6">
              <div className="flex items-center gap-2 mb-6">
                <FileText className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">License & Registration</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
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
                  <Label htmlFor="licensePlateState">License Plate State</Label>
                  <Select value={formData.licensePlateState} onValueChange={(value) => handleSelectChange("licensePlateState", value)}>
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
                  <Label htmlFor="licensePlateExpiry">License Plate Expiry</Label>
                  <Input
                    id="licensePlateExpiry"
                    name="licensePlateExpiry"
                    type="date"
                    value={formData.licensePlateExpiry}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="registrationNumber">Registration Number</Label>
                  <Input
                    id="registrationNumber"
                    name="registrationNumber"
                    type="text"
                    placeholder="REG-123456"
                    value={formData.registrationNumber}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="registrationExpiry">Registration Expiry</Label>
                  <Input
                    id="registrationExpiry"
                    name="registrationExpiry"
                    type="date"
                    value={formData.registrationExpiry}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
              </div>
            </Card>

            {/* Vehicle Specifications Section */}
            <Card className="border-border p-6">
              <div className="flex items-center gap-2 mb-6">
                <Wrench className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Vehicle Specifications</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="vehicleType">Vehicle Type</Label>
                  <Select value={formData.vehicleType} onValueChange={(value) => handleSelectChange("vehicleType", value)}>
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="semi-truck">Semi-Truck</SelectItem>
                      <SelectItem value="box-truck">Box Truck</SelectItem>
                      <SelectItem value="flatbed">Flatbed</SelectItem>
                      <SelectItem value="refrigerated">Refrigerated</SelectItem>
                      <SelectItem value="tanker">Tanker</SelectItem>
                      <SelectItem value="dump-truck">Dump Truck</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="fuelType">Fuel Type</Label>
                  <Select value={formData.fuelType} onValueChange={(value) => handleSelectChange("fuelType", value)}>
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="diesel">Diesel</SelectItem>
                      <SelectItem value="gasoline">Gasoline</SelectItem>
                      <SelectItem value="electric">Electric</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                      <SelectItem value="cng">CNG (Compressed Natural Gas)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="engineSize">Engine Size (Liters)</Label>
                  <Input
                    id="engineSize"
                    name="engineSize"
                    type="text"
                    placeholder="12.8"
                    value={formData.engineSize}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="transmission">Transmission</Label>
                  <Select value={formData.transmission} onValueChange={(value) => handleSelectChange("transmission", value)}>
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="automatic">Automatic</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="automated-manual">Automated Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="maxWeight">Max Weight (lbs)</Label>
                  <Input
                    id="maxWeight"
                    name="maxWeight"
                    type="number"
                    placeholder="80000"
                    value={formData.maxWeight}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="cargoCapacity">Cargo Capacity (cubic ft)</Label>
                  <Input
                    id="cargoCapacity"
                    name="cargoCapacity"
                    type="number"
                    placeholder="3000"
                    value={formData.cargoCapacity}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="length">Length (ft)</Label>
                  <Input
                    id="length"
                    name="length"
                    type="number"
                    placeholder="53"
                    value={formData.length}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="width">Width (ft)</Label>
                  <Input
                    id="width"
                    name="width"
                    type="number"
                    placeholder="8.5"
                    value={formData.width}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="height">Height (ft)</Label>
                  <Input
                    id="height"
                    name="height"
                    type="number"
                    placeholder="13.5"
                    value={formData.height}
                    onChange={handleChange}
                    className="mt-2"
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

            {/* Insurance Information Section */}
            <Card className="border-border p-6">
              <div className="flex items-center gap-2 mb-6">
                <FileText className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Insurance Information</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="insuranceProvider">Insurance Provider</Label>
                  <Input
                    id="insuranceProvider"
                    name="insuranceProvider"
                    type="text"
                    placeholder="ABC Insurance Co."
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
                  <Label htmlFor="insuranceExpiry">Insurance Expiry Date</Label>
                  <Input
                    id="insuranceExpiry"
                    name="insuranceExpiry"
                    type="date"
                    value={formData.insuranceExpiry}
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
              </div>
            </Card>

            {/* Purchase/Lease Information Section */}
            <Card className="border-border p-6">
              <div className="flex items-center gap-2 mb-6">
                <FileText className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Purchase/Lease Information</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="purchaseDate">Purchase Date</Label>
                  <Input
                    id="purchaseDate"
                    name="purchaseDate"
                    type="date"
                    value={formData.purchaseDate}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="purchasePrice">Purchase Price ($)</Label>
                  <Input
                    id="purchasePrice"
                    name="purchasePrice"
                    type="number"
                    placeholder="150000"
                    value={formData.purchasePrice}
                    onChange={handleChange}
                    className="mt-2"
                    step="0.01"
                  />
                </div>
                <div>
                  <Label htmlFor="leaseCompany">Lease Company</Label>
                  <Input
                    id="leaseCompany"
                    name="leaseCompany"
                    type="text"
                    placeholder="ABC Leasing"
                    value={formData.leaseCompany}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="leaseExpiry">Lease Expiry Date</Label>
                  <Input
                    id="leaseExpiry"
                    name="leaseExpiry"
                    type="date"
                    value={formData.leaseExpiry}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
              </div>
            </Card>

            {/* Additional Notes Section */}
            <Card className="border-border p-6">
              <div className="flex items-center gap-2 mb-6">
                <FileText className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Additional Information</h2>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder="Any additional information about the vehicle..."
                  value={formData.notes}
                  onChange={handleChange}
                  className="mt-2 min-h-24"
                  rows={4}
                />
              </div>
            </Card>

            {/* Submit Buttons */}
            <div className="flex gap-4 justify-end">
              <Link href={`/dashboard/trucks/${id}`}>
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
