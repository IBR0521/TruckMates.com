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
  ArrowLeft,
  Package,
  MapPin,
  User,
  Building2,
  Users,
  DollarSign,
  Calculator,
  Truck,
  Search,
  X,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { createLoad, getLoadSuggestions } from "@/app/actions/loads"
import { useRouter } from "next/navigation"
import { getDrivers } from "@/app/actions/drivers"
import { getTrucks } from "@/app/actions/trucks"
import { getRoutes } from "@/app/actions/routes"
import { getCustomers } from "@/app/actions/customers"
import { calculateMileage } from "@/app/actions/load-mileage"
import { LoadDeliveryPointsManager } from "@/components/load-delivery-points-manager"
import { createLoadDeliveryPoint } from "@/app/actions/load-delivery-points"

export default function AddLoadPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCalculatingMiles, setIsCalculatingMiles] = useState(false)
  const [drivers, setDrivers] = useState<any[]>([])
  const [trucks, setTrucks] = useState<any[]>([])
  const [routes, setRoutes] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [deliveryPoints, setDeliveryPoints] = useState<any[]>([])
  const [customerSearch, setCustomerSearch] = useState("")
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)

  const [formData, setFormData] = useState({
    // Basic Information
    shipmentNumber: "",
    bolNumber: "",
    loadType: "ftl", // 'ftl' or 'ltl'
    
    // Customer
    customerId: "",
    companyName: "",
    
    // Origin & Destination (simplified for now)
    origin: "",
    destination: "",
    pickupDate: "",
    estimatedDelivery: "",
    
    // Detailed Shipper Information
    shipperName: "",
    shipperAddress: "",
    shipperCity: "",
    shipperState: "",
    shipperZip: "",
    shipperContactName: "",
    shipperContactPhone: "",
    shipperContactEmail: "",
    pickupTime: "",
    pickupTimeWindowStart: "",
    pickupTimeWindowEnd: "",
    pickupInstructions: "",
    
    // Detailed Consignee Information
    consigneeName: "",
    consigneeAddress: "",
    consigneeCity: "",
    consigneeState: "",
    consigneeZip: "",
    consigneeContactName: "",
    consigneeContactPhone: "",
    consigneeContactEmail: "",
    deliveryTime: "",
    deliveryTimeWindowStart: "",
    deliveryTimeWindowEnd: "",
    deliveryInstructions: "",
    
    // Enhanced Freight Details
    contents: "",
    weight: "",
    pieces: "",
    pallets: "",
    boxes: "",
    length: "",
    width: "",
    height: "",
    temperature: "",
    isHazardous: false,
    isOversized: false,
    specialInstructions: "",
    
    // Carrier Information
    carrierType: "dry-van",
    
    // Special Requirements
    requiresLiftgate: false,
    requiresInsideDelivery: false,
    requiresAppointment: false,
    appointmentTime: "",
    
    // Pricing & Financial
    rate: "",
    rateType: "per-mile",
    fuelSurcharge: "",
    accessorialCharges: "",
    discount: "",
    advance: "",
    estimatedMiles: "",
    estimatedProfit: "",
    estimatedRevenue: "",
    
    // Assignment
    status: "pending",
    driver: "",
    truck: "",
    route: "",
    
    // Additional Information
    customerReference: "",
    notes: "",
    internalNotes: "",
    
    // Delivery Type
    deliveryType: "single",
    requiresSplitDelivery: false,
  })

  useEffect(() => {
    async function loadData() {
      const [driversResult, trucksResult, routesResult, customersResult] = await Promise.all([
        getDrivers(),
        getTrucks(),
        getRoutes(),
        getCustomers(),
      ])
      if (driversResult.data) setDrivers(driversResult.data)
      if (trucksResult.data) setTrucks(trucksResult.data)
      if (routesResult.data) setRoutes(routesResult.data)
      if (customersResult.data) setCustomers(customersResult.data)
    }
    loadData()
  }, [])

  // Auto-fill customer data when selected
  useEffect(() => {
    if (selectedCustomer) {
      setFormData(prev => ({
        ...prev,
        customerId: selectedCustomer.id,
        companyName: selectedCustomer.name || selectedCustomer.company_name || "",
        // Auto-fill consignee info from customer if available
        consigneeName: selectedCustomer.name || selectedCustomer.company_name || "",
        consigneeAddress: selectedCustomer.address || selectedCustomer.address_line1 || "",
        consigneeCity: selectedCustomer.city || "",
        consigneeState: selectedCustomer.state || "",
        consigneeZip: selectedCustomer.zip || selectedCustomer.zip_code || "",
        consigneeContactName: selectedCustomer.primary_contact_name || "",
        consigneeContactPhone: selectedCustomer.phone || selectedCustomer.primary_contact_phone || "",
        consigneeContactEmail: selectedCustomer.email || selectedCustomer.primary_contact_email || "",
      }))
    }
  }, [selectedCustomer])

  // Smart suggestions when origin/destination changes
  useEffect(() => {
    async function fetchSuggestions() {
      if (formData.origin && formData.destination) {
        const suggestionsResult = await getLoadSuggestions(formData.origin, formData.destination)
        if (suggestionsResult.data && !suggestionsResult.error) {
          const suggestions = suggestionsResult.data
          
          // Auto-suggest driver if available and not already set
          if (suggestions.suggestedDriver && !formData.driver) {
            setFormData(prev => ({ ...prev, driver: suggestions.suggestedDriver.id }))
            toast.success(`Suggested driver: ${suggestions.suggestedDriver.name}`)
          }
          
          // Auto-suggest truck if available and not already set
          if (suggestions.suggestedTruck && !formData.truck) {
            setFormData(prev => ({ ...prev, truck: suggestions.suggestedTruck.id }))
            toast.success(`Suggested truck: ${suggestions.suggestedTruck.truck_number}`)
          }
          
          // Auto-suggest customer if available and not already set
          if (suggestions.lastUsedCustomer && !formData.customerId) {
            setSelectedCustomer(suggestions.lastUsedCustomer)
            setFormData(prev => ({
              ...prev,
              customerId: suggestions.lastUsedCustomer.id,
              companyName: suggestions.lastUsedCustomer.name || suggestions.lastUsedCustomer.company_name || "",
            }))
          }
        }
      }
    }

    // Debounce suggestions
    const timeoutId = setTimeout(() => {
      fetchSuggestions()
    }, 1000)

    return () => clearTimeout(timeoutId)
  }, [formData.origin, formData.destination])

  // Filter customers based on search
  const filteredCustomers = customers.filter((customer) =>
    customer.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    customer.company_name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    customer.email?.toLowerCase().includes(customerSearch.toLowerCase())
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked
    
    if (type === "checkbox") {
      setFormData({ ...formData, [name]: checked })
    } else {
      setFormData({ ...formData, [name]: value })
    }
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value })
  }

  // Calculate mileage
  const handleCalculateMiles = async () => {
    if (!formData.origin || !formData.destination) {
      toast.error("Please enter both origin and destination")
      return
    }

    setIsCalculatingMiles(true)
    const result = await calculateMileage(formData.origin, formData.destination)
    setIsCalculatingMiles(false)

    if (result.error) {
      toast.error(result.error)
    } else if (result.miles) {
      setFormData(prev => ({ ...prev, estimatedMiles: result.miles!.toString() }))
      toast.success(`Calculated: ${result.miles} miles`)
    }
  }

  // Calculate profit/revenue
  useEffect(() => {
    const rate = parseFloat(formData.rate) || 0
    const fuelSurcharge = parseFloat(formData.fuelSurcharge) || 0
    const accessorial = parseFloat(formData.accessorialCharges) || 0
    const discount = parseFloat(formData.discount) || 0
    const advance = parseFloat(formData.advance) || 0
    const miles = parseFloat(formData.estimatedMiles) || 0

    let revenue = 0
    if (formData.rateType === "per-mile" && miles > 0) {
      revenue = rate * miles
    } else if (formData.rateType === "flat-rate") {
      revenue = rate
    } else if (formData.rateType === "per-ton") {
      const weight = parseFloat(formData.weight) || 0
      revenue = rate * weight
    }

    revenue = revenue + fuelSurcharge + accessorial - discount
    const totalRate = revenue
    const estimatedProfit = totalRate - advance // Simplified - in reality, you'd subtract expenses

    setFormData(prev => ({
      ...prev,
      totalRate: totalRate.toFixed(2),
      estimatedRevenue: revenue.toFixed(2),
      estimatedProfit: estimatedProfit.toFixed(2),
    }))
  }, [formData.rate, formData.rateType, formData.fuelSurcharge, formData.accessorialCharges, formData.discount, formData.advance, formData.estimatedMiles, formData.weight])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Validate required fields
    if (!formData.shipmentNumber || !formData.origin) {
      toast.error("Please fill in all required fields (Shipment Number, Origin)")
      setIsSubmitting(false)
      return
    }

    // Validate destination for single delivery
    if (formData.deliveryType === "single" && !formData.destination) {
      toast.error("Please provide a destination for single delivery")
      setIsSubmitting(false)
      return
    }

    // Validate delivery points if multi-delivery
    if (formData.deliveryType === "multi") {
      if (deliveryPoints.length === 0) {
        toast.error("Please add at least one delivery point for multi-delivery loads")
        setIsSubmitting(false)
        return
      }
    }

    // Auto-calculate weight in kg if weight is provided
    const weightKg = formData.weight 
      ? Math.round(parseFloat(formData.weight.replace(/[^0-9.]/g, "")) * 1000) 
      : null

    const destination = formData.deliveryType === "multi" && !formData.destination
      ? "Multiple Locations"
      : formData.destination

    const result = await createLoad({
      shipment_number: formData.shipmentNumber,
      origin: formData.origin,
      destination: destination,
      weight: formData.weight || undefined,
      weight_kg: weightKg ?? undefined,
      contents: formData.contents || undefined,
      value: formData.estimatedRevenue ? parseFloat(formData.estimatedRevenue) : undefined,
      carrier_type: formData.carrierType,
      status: formData.status,
      driver_id: formData.driver || undefined,
      truck_id: formData.truck || undefined,
      route_id: formData.route || null,
      load_date: formData.pickupDate || null,
      estimated_delivery: formData.estimatedDelivery || null,
      delivery_type: formData.deliveryType,
      company_name: formData.companyName || undefined,
      customer_reference: formData.customerReference || undefined,
      requires_split_delivery: formData.requiresSplitDelivery,
      // New TruckLogics fields
      load_type: formData.loadType,
      customer_id: formData.customerId || undefined,
      bol_number: formData.bolNumber || undefined,
      // Shipper
      shipper_name: formData.shipperName || undefined,
      shipper_address: formData.shipperAddress || undefined,
      shipper_city: formData.shipperCity || undefined,
      shipper_state: formData.shipperState || undefined,
      shipper_zip: formData.shipperZip || undefined,
      shipper_contact_name: formData.shipperContactName || undefined,
      shipper_contact_phone: formData.shipperContactPhone || undefined,
      shipper_contact_email: formData.shipperContactEmail || undefined,
      pickup_time: formData.pickupTime || undefined,
      pickup_time_window_start: formData.pickupTimeWindowStart || undefined,
      pickup_time_window_end: formData.pickupTimeWindowEnd || undefined,
      pickup_instructions: formData.pickupInstructions || undefined,
      // Consignee
      consignee_name: formData.consigneeName || undefined,
      consignee_address: formData.consigneeAddress || undefined,
      consignee_city: formData.consigneeCity || undefined,
      consignee_state: formData.consigneeState || undefined,
      consignee_zip: formData.consigneeZip || undefined,
      consignee_contact_name: formData.consigneeContactName || undefined,
      consignee_contact_phone: formData.consigneeContactPhone || undefined,
      consignee_contact_email: formData.consigneeContactEmail || undefined,
      delivery_time: formData.deliveryTime || undefined,
      delivery_time_window_start: formData.deliveryTimeWindowStart || undefined,
      delivery_time_window_end: formData.deliveryTimeWindowEnd || undefined,
      delivery_instructions: formData.deliveryInstructions || undefined,
      // Enhanced freight
      pieces: formData.pieces ? parseInt(formData.pieces) : undefined,
      pallets: formData.pallets ? parseInt(formData.pallets) : undefined,
      boxes: formData.boxes ? parseInt(formData.boxes) : undefined,
      length: formData.length ? parseFloat(formData.length) : undefined,
      width: formData.width ? parseFloat(formData.width) : undefined,
      height: formData.height ? parseFloat(formData.height) : undefined,
      temperature: formData.temperature ? parseFloat(formData.temperature) : undefined,
      is_hazardous: formData.isHazardous,
      is_oversized: formData.isOversized,
      special_instructions: formData.specialInstructions || undefined,
      // Special requirements
      requires_liftgate: formData.requiresLiftgate,
      requires_inside_delivery: formData.requiresInsideDelivery,
      requires_appointment: formData.requiresAppointment,
      appointment_time: formData.appointmentTime || undefined,
      // Pricing
      rate: formData.rate ? parseFloat(formData.rate) : undefined,
      rate_type: formData.rateType,
      fuel_surcharge: formData.fuelSurcharge ? parseFloat(formData.fuelSurcharge) : undefined,
      accessorial_charges: formData.accessorialCharges ? parseFloat(formData.accessorialCharges) : undefined,
      discount: formData.discount ? parseFloat(formData.discount) : undefined,
      advance: formData.advance ? parseFloat(formData.advance) : undefined,
      total_rate: formData.totalRate ? parseFloat(formData.totalRate) : undefined,
      estimated_miles: formData.estimatedMiles ? parseInt(formData.estimatedMiles) : undefined,
      estimated_profit: formData.estimatedProfit ? parseFloat(formData.estimatedProfit) : undefined,
      estimated_revenue: formData.estimatedRevenue ? parseFloat(formData.estimatedRevenue) : undefined,
      // Notes
      notes: formData.notes || undefined,
      internal_notes: formData.internalNotes || undefined,
    })

    if (result.error) {
      toast.error(result.error || "Failed to add load")
      setIsSubmitting(false)
      return
    }

    // Create delivery points if multi-delivery
    if (formData.deliveryType === "multi" && deliveryPoints.length > 0 && result.data?.id) {
      try {
        for (const point of deliveryPoints) {
          await createLoadDeliveryPoint(result.data.id, point)
        }
        toast.success(`Load added successfully with ${deliveryPoints.length} delivery points`)
      } catch (error: any) {
        toast.error(`Load created but failed to add some delivery points: ${error.message}`)
      }
    } else {
      toast.success("Load added successfully")
    }

    setIsSubmitting(false)
    router.push(`/dashboard/loads/${result.data?.id || ""}`)
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
        <Link href="/dashboard/loads">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Loads
          </Button>
        </Link>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Add New Load</h1>
      </div>

      {/* Content */}
      <div className="p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Basic Information Section */}
            <Card className="border-border p-4 md:p-6">
              <div className="flex items-center gap-2 mb-6">
                <Package className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Basic Information</h2>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
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
                    placeholder="BOL-001"
                    value={formData.bolNumber}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="loadType">Load Type *</Label>
                  <Select value={formData.loadType} onValueChange={(value) => handleSelectChange("loadType", value)}>
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ftl">Full Truckload (FTL)</SelectItem>
                      <SelectItem value="ltl">Less Than Truckload (LTL)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            {/* Customer Selection Section */}
            <Card className="border-border p-4 md:p-6">
              <div className="flex items-center gap-2 mb-6">
                <Building2 className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Customer</h2>
              </div>
              <div className="space-y-4">
                <div className="relative">
                  <Label>Select Customer</Label>
                  <div className="mt-2 flex gap-2">
                    <div className="flex-1 relative">
                      <Input
                        placeholder="Search customer by name or email..."
                        value={customerSearch}
                        onChange={(e) => {
                          setCustomerSearch(e.target.value)
                          setShowCustomerSearch(true)
                        }}
                        onFocus={() => setShowCustomerSearch(true)}
                      />
                      {showCustomerSearch && filteredCustomers.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {filteredCustomers.map((customer) => (
                            <button
                              key={customer.id}
                              type="button"
                              className="w-full text-left px-4 py-2 hover:bg-secondary cursor-pointer"
                              onClick={() => {
                                setSelectedCustomer(customer)
                                setCustomerSearch(customer.name || customer.company_name || "")
                                setShowCustomerSearch(false)
                              }}
                            >
                              <div className="font-medium">{customer.name || customer.company_name}</div>
                              {customer.email && (
                                <div className="text-sm text-muted-foreground">{customer.email}</div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {selectedCustomer && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setSelectedCustomer(null)
                          setCustomerSearch("")
                          setFormData(prev => ({ ...prev, customerId: "", companyName: "" }))
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  {selectedCustomer && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Selected: {selectedCustomer.name || selectedCustomer.company_name}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="companyName">Company/Customer Name *</Label>
                  <Input
                    id="companyName"
                    name="companyName"
                    type="text"
                    placeholder="Enter company name"
                    value={formData.companyName}
                    onChange={handleChange}
                    className="mt-2"
                    required
                  />
                </div>
              </div>
            </Card>

            {/* Shipper Information Section */}
            <Card className="border-border p-4 md:p-6">
              <div className="flex items-center gap-2 mb-6">
                <MapPin className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Shipper Information (Pickup Location)</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <Label htmlFor="shipperName">Shipper Name</Label>
                  <Input
                    id="shipperName"
                    name="shipperName"
                    type="text"
                    value={formData.shipperName}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="shipperAddress">Address</Label>
                  <Input
                    id="shipperAddress"
                    name="shipperAddress"
                    type="text"
                    value={formData.shipperAddress}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="shipperCity">City</Label>
                  <Input
                    id="shipperCity"
                    name="shipperCity"
                    type="text"
                    value={formData.shipperCity}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="shipperState">State</Label>
                  <Input
                    id="shipperState"
                    name="shipperState"
                    type="text"
                    value={formData.shipperState}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="shipperZip">ZIP Code</Label>
                  <Input
                    id="shipperZip"
                    name="shipperZip"
                    type="text"
                    value={formData.shipperZip}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="origin">Origin (City, State) *</Label>
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
                <div>
                  <Label htmlFor="pickupTimeWindowStart">Time Window Start</Label>
                  <Input
                    id="pickupTimeWindowStart"
                    name="pickupTimeWindowStart"
                    type="time"
                    value={formData.pickupTimeWindowStart}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="pickupTimeWindowEnd">Time Window End</Label>
                  <Input
                    id="pickupTimeWindowEnd"
                    name="pickupTimeWindowEnd"
                    type="time"
                    value={formData.pickupTimeWindowEnd}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="shipperContactName">Contact Name</Label>
                  <Input
                    id="shipperContactName"
                    name="shipperContactName"
                    type="text"
                    value={formData.shipperContactName}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="shipperContactPhone">Contact Phone</Label>
                  <Input
                    id="shipperContactPhone"
                    name="shipperContactPhone"
                    type="tel"
                    value={formData.shipperContactPhone}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="shipperContactEmail">Contact Email</Label>
                  <Input
                    id="shipperContactEmail"
                    name="shipperContactEmail"
                    type="email"
                    value={formData.shipperContactEmail}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="pickupInstructions">Pickup Instructions</Label>
                  <Textarea
                    id="pickupInstructions"
                    name="pickupInstructions"
                    value={formData.pickupInstructions}
                    onChange={handleChange}
                    className="mt-2"
                    rows={3}
                  />
                </div>
              </div>
            </Card>

            {/* Consignee Information Section */}
            <Card className="border-border p-4 md:p-6">
              <div className="flex items-center gap-2 mb-6">
                <MapPin className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Consignee Information (Delivery Location)</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <Label htmlFor="consigneeName">Consignee Name</Label>
                  <Input
                    id="consigneeName"
                    name="consigneeName"
                    type="text"
                    value={formData.consigneeName}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="consigneeAddress">Address</Label>
                  <Input
                    id="consigneeAddress"
                    name="consigneeAddress"
                    type="text"
                    value={formData.consigneeAddress}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="consigneeCity">City</Label>
                  <Input
                    id="consigneeCity"
                    name="consigneeCity"
                    type="text"
                    value={formData.consigneeCity}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="consigneeState">State</Label>
                  <Input
                    id="consigneeState"
                    name="consigneeState"
                    type="text"
                    value={formData.consigneeState}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="consigneeZip">ZIP Code</Label>
                  <Input
                    id="consigneeZip"
                    name="consigneeZip"
                    type="text"
                    value={formData.consigneeZip}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="destination">Destination (City, State) *</Label>
                  <Input
                    id="destination"
                    name="destination"
                    type="text"
                    placeholder="Philadelphia, PA"
                    value={formData.destination}
                    onChange={handleChange}
                    className="mt-2"
                    required={formData.deliveryType === "single"}
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
                <div>
                  <Label htmlFor="deliveryTimeWindowStart">Time Window Start</Label>
                  <Input
                    id="deliveryTimeWindowStart"
                    name="deliveryTimeWindowStart"
                    type="time"
                    value={formData.deliveryTimeWindowStart}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="deliveryTimeWindowEnd">Time Window End</Label>
                  <Input
                    id="deliveryTimeWindowEnd"
                    name="deliveryTimeWindowEnd"
                    type="time"
                    value={formData.deliveryTimeWindowEnd}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="consigneeContactName">Contact Name</Label>
                  <Input
                    id="consigneeContactName"
                    name="consigneeContactName"
                    type="text"
                    value={formData.consigneeContactName}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="consigneeContactPhone">Contact Phone</Label>
                  <Input
                    id="consigneeContactPhone"
                    name="consigneeContactPhone"
                    type="tel"
                    value={formData.consigneeContactPhone}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="consigneeContactEmail">Contact Email</Label>
                  <Input
                    id="consigneeContactEmail"
                    name="consigneeContactEmail"
                    type="email"
                    value={formData.consigneeContactEmail}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="deliveryInstructions">Delivery Instructions</Label>
                  <Textarea
                    id="deliveryInstructions"
                    name="deliveryInstructions"
                    value={formData.deliveryInstructions}
                    onChange={handleChange}
                    className="mt-2"
                    rows={3}
                  />
                </div>
              </div>
            </Card>

            {/* Freight Details Section */}
            <Card className="border-border p-4 md:p-6">
              <div className="flex items-center gap-2 mb-6">
                <Package className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Freight Details</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
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
                  <Label htmlFor="weight">Weight (tons)</Label>
                  <Input
                    id="weight"
                    name="weight"
                    type="text"
                    placeholder="22.5"
                    value={formData.weight}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="pieces">Pieces</Label>
                  <Input
                    id="pieces"
                    name="pieces"
                    type="number"
                    placeholder="100"
                    value={formData.pieces}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="pallets">Pallets</Label>
                  <Input
                    id="pallets"
                    name="pallets"
                    type="number"
                    placeholder="10"
                    value={formData.pallets}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="boxes">Boxes</Label>
                  <Input
                    id="boxes"
                    name="boxes"
                    type="number"
                    placeholder="50"
                    value={formData.boxes}
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
                    placeholder="48"
                    value={formData.length}
                    onChange={handleChange}
                    className="mt-2"
                    step="0.01"
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
                    step="0.01"
                  />
                </div>
                <div>
                  <Label htmlFor="height">Height (ft)</Label>
                  <Input
                    id="height"
                    name="height"
                    type="number"
                    placeholder="9.5"
                    value={formData.height}
                    onChange={handleChange}
                    className="mt-2"
                    step="0.01"
                  />
                </div>
                <div>
                  <Label htmlFor="temperature">Temperature (°F)</Label>
                  <Input
                    id="temperature"
                    name="temperature"
                    type="number"
                    placeholder="32"
                    value={formData.temperature}
                    onChange={handleChange}
                    className="mt-2"
                    step="0.1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">For reefer loads</p>
                </div>
                <div className="md:col-span-2">
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
                <div className="md:col-span-2 flex gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isHazardous"
                      name="isHazardous"
                      checked={formData.isHazardous}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isHazardous: !!checked }))}
                    />
                    <Label htmlFor="isHazardous" className="cursor-pointer">Hazardous Materials</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isOversized"
                      name="isOversized"
                      checked={formData.isOversized}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isOversized: !!checked }))}
                    />
                    <Label htmlFor="isOversized" className="cursor-pointer">Oversized Load</Label>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="specialInstructions">Special Instructions</Label>
                  <Textarea
                    id="specialInstructions"
                    name="specialInstructions"
                    value={formData.specialInstructions}
                    onChange={handleChange}
                    className="mt-2"
                    rows={3}
                  />
                </div>
              </div>
            </Card>

            {/* Special Requirements Section */}
            <Card className="border-border p-4 md:p-6">
              <div className="flex items-center gap-2 mb-6">
                <Truck className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Special Requirements</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="requiresLiftgate"
                    name="requiresLiftgate"
                    checked={formData.requiresLiftgate}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, requiresLiftgate: !!checked }))}
                  />
                  <Label htmlFor="requiresLiftgate" className="cursor-pointer">Requires Liftgate</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="requiresInsideDelivery"
                    name="requiresInsideDelivery"
                    checked={formData.requiresInsideDelivery}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, requiresInsideDelivery: !!checked }))}
                  />
                  <Label htmlFor="requiresInsideDelivery" className="cursor-pointer">Requires Inside Delivery</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="requiresAppointment"
                    name="requiresAppointment"
                    checked={formData.requiresAppointment}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, requiresAppointment: !!checked }))}
                  />
                  <Label htmlFor="requiresAppointment" className="cursor-pointer">Requires Appointment</Label>
                </div>
                {formData.requiresAppointment && (
                  <div>
                    <Label htmlFor="appointmentTime">Appointment Time</Label>
                    <Input
                      id="appointmentTime"
                      name="appointmentTime"
                      type="datetime-local"
                      value={formData.appointmentTime}
                      onChange={handleChange}
                      className="mt-2"
                    />
                  </div>
                )}
              </div>
            </Card>

            {/* Pricing & Charges Section */}
            <Card className="border-border p-4 md:p-6">
              <div className="flex items-center gap-2 mb-6">
                <DollarSign className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Pricing & Charges</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="rateType">Rate Type</Label>
                  <Select value={formData.rateType} onValueChange={(value) => handleSelectChange("rateType", value)}>
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="per-mile">Per Mile</SelectItem>
                      <SelectItem value="flat-rate">Flat Rate</SelectItem>
                      <SelectItem value="per-ton">Per Ton</SelectItem>
                      <SelectItem value="per-hundred-weight">Per Hundred Weight (CWT)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="rate">Rate ($)</Label>
                  <Input
                    id="rate"
                    name="rate"
                    type="number"
                    placeholder="2.50"
                    value={formData.rate}
                    onChange={handleChange}
                    className="mt-2"
                    step="0.01"
                  />
                </div>
                <div>
                  <Label htmlFor="fuelSurcharge">Fuel Surcharge ($)</Label>
                  <Input
                    id="fuelSurcharge"
                    name="fuelSurcharge"
                    type="number"
                    placeholder="0.00"
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
                    placeholder="0.00"
                    value={formData.accessorialCharges}
                    onChange={handleChange}
                    className="mt-2"
                    step="0.01"
                  />
                </div>
                <div>
                  <Label htmlFor="discount">Discount ($)</Label>
                  <Input
                    id="discount"
                    name="discount"
                    type="number"
                    placeholder="0.00"
                    value={formData.discount}
                    onChange={handleChange}
                    className="mt-2"
                    step="0.01"
                  />
                </div>
                <div>
                  <Label htmlFor="advance">Advance ($)</Label>
                  <Input
                    id="advance"
                    name="advance"
                    type="number"
                    placeholder="0.00"
                    value={formData.advance}
                    onChange={handleChange}
                    className="mt-2"
                    step="0.01"
                  />
                </div>
                <div>
                  <Label htmlFor="estimatedMiles">Estimated Miles</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="estimatedMiles"
                      name="estimatedMiles"
                      type="number"
                      placeholder="250"
                      value={formData.estimatedMiles}
                      onChange={handleChange}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCalculateMiles}
                      disabled={isCalculatingMiles}
                    >
                      {isCalculatingMiles ? "Calculating..." : <Calculator className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>Total Rate ($)</Label>
                  <Input
                    type="text"
                    value={formData.totalRate || "0.00"}
                    readOnly
                    className="mt-2 bg-muted"
                  />
                </div>
                <div>
                  <Label>Estimated Revenue ($)</Label>
                  <Input
                    type="text"
                    value={formData.estimatedRevenue || "0.00"}
                    readOnly
                    className="mt-2 bg-muted"
                  />
                </div>
                <div>
                  <Label>Estimated Profit ($)</Label>
                  <Input
                    type="text"
                    value={formData.estimatedProfit || "0.00"}
                    readOnly
                    className="mt-2 bg-muted"
                  />
                </div>
              </div>
            </Card>

            {/* Assignment Section */}
            <Card className="border-border p-4 md:p-6">
              <div className="flex items-center gap-2 mb-6">
                <Users className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Assignment</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
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
                <div>
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

            {/* Additional Notes Section */}
            <Card className="border-border p-4 md:p-6">
              <div className="flex items-center gap-2 mb-6">
                <User className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Additional Information</h2>
              </div>
              <div className="space-y-6">
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
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    className="mt-2"
                    rows={3}
                    placeholder="Public notes visible to customer..."
                  />
                </div>
                <div>
                  <Label htmlFor="internalNotes">Internal Notes</Label>
                  <Textarea
                    id="internalNotes"
                    name="internalNotes"
                    value={formData.internalNotes}
                    onChange={handleChange}
                    className="mt-2"
                    rows={3}
                    placeholder="Private notes for internal use only..."
                  />
                </div>
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
      </div>
    </div>
  )
}
