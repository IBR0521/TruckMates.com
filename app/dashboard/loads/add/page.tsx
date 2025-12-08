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
import { ArrowLeft, Package, MapPin, Calendar, DollarSign, User, FileText } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { createLoad } from "@/app/actions/loads"
import { useRouter } from "next/navigation"
import { getDrivers } from "@/app/actions/drivers"
import { getTrucks } from "@/app/actions/trucks"
import { getRoutes } from "@/app/actions/routes"

export default function AddLoadPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [drivers, setDrivers] = useState<any[]>([])
  const [trucks, setTrucks] = useState<any[]>([])
  const [routes, setRoutes] = useState<any[]>([])
  const [formData, setFormData] = useState({
    // Basic Information
    shipmentNumber: "",
    bolNumber: "",
    
    // Origin & Destination
    origin: "",
    originAddress: "",
    originCity: "",
    originState: "",
    originZip: "",
    originContactName: "",
    originContactPhone: "",
    pickupDate: "",
    pickupTime: "",
    
    destination: "",
    destinationAddress: "",
    destinationCity: "",
    destinationState: "",
    destinationZip: "",
    destinationContactName: "",
    destinationContactPhone: "",
    estimatedDelivery: "",
    deliveryTime: "",
    
    // Load Details
    contents: "",
    weight: "",
    weightKg: "",
    pieces: "",
    value: "",
    temperature: "",
    specialInstructions: "",
    
    // Carrier Information
    carrierType: "dry-van",
    requiresLiftgate: "no",
    requiresInsideDelivery: "no",
    requiresAppointment: "no",
    
    // Assignment
    status: "pending",
    driver: "",
    truck: "",
    route: "",
    
    // Pricing
    rate: "",
    rateType: "per-mile",
    fuelSurcharge: "",
    accessorialCharges: "",
    totalRate: "",
    
    // Additional Information
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    customerReference: "",
    notes: "",
  })

  useEffect(() => {
    async function loadData() {
      const [driversResult, trucksResult, routesResult] = await Promise.all([
        getDrivers(),
        getTrucks(),
        getRoutes(),
      ])
      if (driversResult.data) setDrivers(driversResult.data)
      if (trucksResult.data) setTrucks(trucksResult.data)
      if (routesResult.data) setRoutes(routesResult.data)
    }
    loadData()
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

    // Calculate weight in kg if weight is provided
    const weightKg = formData.weightKg 
      ? parseInt(formData.weightKg) 
      : formData.weight 
        ? Math.round(parseFloat(formData.weight.replace(/[^0-9.]/g, "")) * 1000) 
        : null

    const result = await createLoad({
      shipment_number: formData.shipmentNumber,
      origin: formData.origin,
      destination: formData.destination,
      weight: formData.weight,
      weight_kg: weightKg,
      contents: formData.contents,
      value: formData.value ? parseFloat(formData.value) : null,
      carrier_type: formData.carrierType,
      status: formData.status,
      driver_id: formData.driver || null,
      truck_id: formData.truck || null,
      route_id: formData.route || null,
      load_date: formData.pickupDate || null,
      estimated_delivery: formData.estimatedDelivery || null,
    })

    setIsSubmitting(false)

    if (result.error) {
      toast.error(result.error || "Failed to add load")
    } else {
      toast.success("Load added successfully")
      router.push("/dashboard/loads")
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
      <div className="border-b border-border bg-card/50 backdrop-blur px-8 py-4 flex items-center gap-4">
        <Link href="/dashboard/loads">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Add New Load</h1>
      </div>

      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information Section */}
            <Card className="border-border p-6">
              <div className="flex items-center gap-2 mb-6">
                <Package className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Basic Information</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="shipmentNumber">Shipment Number *</Label>
                  <Input
                    id="shipmentNumber"
                    name="shipmentNumber"
                    type="text"
                    placeholder="SHP-001"
                    value={formData.shipmentNumber}
                    onChange={handleChange}
                    className="mt-2"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="bolNumber">BOL Number</Label>
                  <Input
                    id="bolNumber"
                    name="bolNumber"
                    type="text"
                    placeholder="BOL-123456"
                    value={formData.bolNumber}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="status">Status *</Label>
                  <Select value={formData.status} onValueChange={(value) => handleSelectChange("status", value)}>
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="in_transit">In Transit</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            {/* Origin Information Section */}
            <Card className="border-border p-6">
              <div className="flex items-center gap-2 mb-6">
                <MapPin className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Origin Information</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <Label htmlFor="origin">Origin City/State *</Label>
                  <Input
                    id="origin"
                    name="origin"
                    type="text"
                    placeholder="New York, NY"
                    value={formData.origin}
                    onChange={handleChange}
                    className="mt-2"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="originAddress">Street Address</Label>
                  <Input
                    id="originAddress"
                    name="originAddress"
                    type="text"
                    placeholder="123 Main Street"
                    value={formData.originAddress}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="originCity">City</Label>
                  <Input
                    id="originCity"
                    name="originCity"
                    type="text"
                    placeholder="New York"
                    value={formData.originCity}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="originState">State</Label>
                  <Select value={formData.originState} onValueChange={(value) => handleSelectChange("originState", value)}>
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
                  <Label htmlFor="originZip">ZIP Code</Label>
                  <Input
                    id="originZip"
                    name="originZip"
                    type="text"
                    placeholder="10001"
                    value={formData.originZip}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="originContactName">Contact Name</Label>
                  <Input
                    id="originContactName"
                    name="originContactName"
                    type="text"
                    placeholder="John Doe"
                    value={formData.originContactName}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="originContactPhone">Contact Phone</Label>
                  <Input
                    id="originContactPhone"
                    name="originContactPhone"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={formData.originContactPhone}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="pickupDate">Pickup Date</Label>
                  <Input
                    id="pickupDate"
                    name="pickupDate"
                    type="date"
                    value={formData.pickupDate}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="pickupTime">Pickup Time</Label>
                  <Input
                    id="pickupTime"
                    name="pickupTime"
                    type="time"
                    value={formData.pickupTime}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
              </div>
            </Card>

            {/* Destination Information Section */}
            <Card className="border-border p-6">
              <div className="flex items-center gap-2 mb-6">
                <MapPin className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Destination Information</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <Label htmlFor="destination">Destination City/State *</Label>
                  <Input
                    id="destination"
                    name="destination"
                    type="text"
                    placeholder="Philadelphia, PA"
                    value={formData.destination}
                    onChange={handleChange}
                    className="mt-2"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="destinationAddress">Street Address</Label>
                  <Input
                    id="destinationAddress"
                    name="destinationAddress"
                    type="text"
                    placeholder="456 Oak Avenue"
                    value={formData.destinationAddress}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="destinationCity">City</Label>
                  <Input
                    id="destinationCity"
                    name="destinationCity"
                    type="text"
                    placeholder="Philadelphia"
                    value={formData.destinationCity}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="destinationState">State</Label>
                  <Select value={formData.destinationState} onValueChange={(value) => handleSelectChange("destinationState", value)}>
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
                  <Label htmlFor="destinationZip">ZIP Code</Label>
                  <Input
                    id="destinationZip"
                    name="destinationZip"
                    type="text"
                    placeholder="19101"
                    value={formData.destinationZip}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="destinationContactName">Contact Name</Label>
                  <Input
                    id="destinationContactName"
                    name="destinationContactName"
                    type="text"
                    placeholder="Jane Smith"
                    value={formData.destinationContactName}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="destinationContactPhone">Contact Phone</Label>
                  <Input
                    id="destinationContactPhone"
                    name="destinationContactPhone"
                    type="tel"
                    placeholder="+1 (555) 987-6543"
                    value={formData.destinationContactPhone}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="estimatedDelivery">Estimated Delivery Date</Label>
                  <Input
                    id="estimatedDelivery"
                    name="estimatedDelivery"
                    type="date"
                    value={formData.estimatedDelivery}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="deliveryTime">Delivery Time</Label>
                  <Input
                    id="deliveryTime"
                    name="deliveryTime"
                    type="time"
                    value={formData.deliveryTime}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
              </div>
            </Card>

            {/* Load Details Section */}
            <Card className="border-border p-6">
              <div className="flex items-center gap-2 mb-6">
                <Package className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Load Details</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="contents">Contents/Description</Label>
                  <Input
                    id="contents"
                    name="contents"
                    type="text"
                    placeholder="Electronics, Machinery, etc."
                    value={formData.contents}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="pieces">Number of Pieces</Label>
                  <Input
                    id="pieces"
                    name="pieces"
                    type="number"
                    placeholder="50"
                    value={formData.pieces}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="weight">Weight (tons)</Label>
                  <Input
                    id="weight"
                    name="weight"
                    type="text"
                    placeholder="22.5 tons"
                    value={formData.weight}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="weightKg">Weight (kg)</Label>
                  <Input
                    id="weightKg"
                    name="weightKg"
                    type="number"
                    placeholder="22500"
                    value={formData.weightKg}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="value">Declared Value ($)</Label>
                  <Input
                    id="value"
                    name="value"
                    type="number"
                    placeholder="50000"
                    value={formData.value}
                    onChange={handleChange}
                    className="mt-2"
                    step="0.01"
                  />
                </div>
                <div>
                  <Label htmlFor="temperature">Temperature Requirements (°F)</Label>
                  <Input
                    id="temperature"
                    name="temperature"
                    type="text"
                    placeholder="35-40 (Refrigerated)"
                    value={formData.temperature}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="carrierType">Carrier Type</Label>
                  <Select value={formData.carrierType} onValueChange={(value) => handleSelectChange("carrierType", value)}>
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dry-van">Dry Van</SelectItem>
                      <SelectItem value="refrigerated">Refrigerated</SelectItem>
                      <SelectItem value="flatbed">Flatbed</SelectItem>
                      <SelectItem value="step-deck">Step Deck</SelectItem>
                      <SelectItem value="lowboy">Lowboy</SelectItem>
                      <SelectItem value="tanker">Tanker</SelectItem>
                      <SelectItem value="box-truck">Box Truck</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="specialInstructions">Special Instructions</Label>
                  <Textarea
                    id="specialInstructions"
                    name="specialInstructions"
                    placeholder="Any special handling instructions, delivery requirements, etc."
                    value={formData.specialInstructions}
                    onChange={handleChange}
                    className="mt-2 min-h-24"
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="requiresLiftgate">Requires Liftgate</Label>
                  <Select value={formData.requiresLiftgate} onValueChange={(value) => handleSelectChange("requiresLiftgate", value)}>
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="requiresInsideDelivery">Inside Delivery Required</Label>
                  <Select value={formData.requiresInsideDelivery} onValueChange={(value) => handleSelectChange("requiresInsideDelivery", value)}>
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="requiresAppointment">Appointment Required</Label>
                  <Select value={formData.requiresAppointment} onValueChange={(value) => handleSelectChange("requiresAppointment", value)}>
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            {/* Customer Information Section */}
            <Card className="border-border p-6">
              <div className="flex items-center gap-2 mb-6">
                <User className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Customer Information</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="customerName">Customer Name</Label>
                  <Input
                    id="customerName"
                    name="customerName"
                    type="text"
                    placeholder="ABC Logistics"
                    value={formData.customerName}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="customerPhone">Customer Phone</Label>
                  <Input
                    id="customerPhone"
                    name="customerPhone"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={formData.customerPhone}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="customerEmail">Customer Email</Label>
                  <Input
                    id="customerEmail"
                    name="customerEmail"
                    type="email"
                    placeholder="contact@customer.com"
                    value={formData.customerEmail}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="customerReference">Customer Reference #</Label>
                  <Input
                    id="customerReference"
                    name="customerReference"
                    type="text"
                    placeholder="PO-12345"
                    value={formData.customerReference}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
              </div>
            </Card>

            {/* Assignment Section */}
            <Card className="border-border p-6">
              <div className="flex items-center gap-2 mb-6">
                <User className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Assignment</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="driver">Assigned Driver</Label>
                  <Select value={formData.driver || undefined} onValueChange={(value) => handleSelectChange("driver", value)}>
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
                  <Label htmlFor="truck">Assigned Truck</Label>
                  <Select value={formData.truck || undefined} onValueChange={(value) => handleSelectChange("truck", value)}>
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
                  <Label htmlFor="route">Assigned Route</Label>
                  <Select value={formData.route || undefined} onValueChange={(value) => handleSelectChange("route", value)}>
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue placeholder="Select a route (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {routes.map((route) => (
                        <SelectItem key={route.id} value={route.id}>
                          {route.name} - {route.origin} to {route.destination}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            {/* Pricing Section */}
            <Card className="border-border p-6">
              <div className="flex items-center gap-2 mb-6">
                <DollarSign className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Pricing Information</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="rate">Rate ($)</Label>
                  <Input
                    id="rate"
                    name="rate"
                    type="number"
                    placeholder="2500.00"
                    value={formData.rate}
                    onChange={handleChange}
                    className="mt-2"
                    step="0.01"
                  />
                </div>
                <div>
                  <Label htmlFor="rateType">Rate Type</Label>
                  <Select value={formData.rateType} onValueChange={(value) => handleSelectChange("rateType", value)}>
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="per-mile">Per Mile</SelectItem>
                      <SelectItem value="flat-rate">Flat Rate</SelectItem>
                      <SelectItem value="per-pound">Per Pound</SelectItem>
                      <SelectItem value="per-pallet">Per Pallet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="fuelSurcharge">Fuel Surcharge ($)</Label>
                  <Input
                    id="fuelSurcharge"
                    name="fuelSurcharge"
                    type="number"
                    placeholder="150.00"
                    value={formData.fuelSurcharge}
                    onChange={handleChange}
                    className="mt-2"
                    step="0.01"
                  />
                </div>
                <div>
                  <Label htmlFor="accessorialCharges">Accessorial Charges ($)</Label>
                  <Input
                    id="accessorialCharges"
                    name="accessorialCharges"
                    type="number"
                    placeholder="75.00"
                    value={formData.accessorialCharges}
                    onChange={handleChange}
                    className="mt-2"
                    step="0.01"
                  />
                </div>
                <div>
                  <Label htmlFor="totalRate">Total Rate ($)</Label>
                  <Input
                    id="totalRate"
                    name="totalRate"
                    type="number"
                    placeholder="2725.00"
                    value={formData.totalRate}
                    onChange={handleChange}
                    className="mt-2"
                    step="0.01"
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
                  placeholder="Any additional information about the load..."
                  value={formData.notes}
                  onChange={handleChange}
                  className="mt-2 min-h-24"
                  rows={4}
                />
              </div>
            </Card>

            {/* Submit Buttons */}
            <div className="flex gap-4 justify-end">
                <Link href="/dashboard/loads">
                  <Button type="button" variant="outline" className="border-border bg-transparent">
                    Cancel
                  </Button>
                </Link>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isSubmitting ? "Adding Load..." : "Add Load"}
              </Button>
              </div>
            </form>
        </div>
      </main>
    </div>
  )
}
