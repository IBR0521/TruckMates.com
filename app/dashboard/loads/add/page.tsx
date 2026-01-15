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
import {
  ArrowLeft,
  Package,
  MapPin,
  Building2,
  Users,
  DollarSign,
  Truck,
  X,
  Plus,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { createLoad } from "@/app/actions/loads"
import { useRouter } from "next/navigation"
import { getDrivers } from "@/app/actions/drivers"
import { getTrucks } from "@/app/actions/trucks"
import { getRoutes } from "@/app/actions/routes"
import { getCustomers, createCustomer } from "@/app/actions/customers"
import { calculateMileage } from "@/app/actions/load-mileage"
import { LoadDeliveryPointsManager } from "@/components/load-delivery-points-manager"
import { createLoadDeliveryPoint } from "@/app/actions/load-delivery-points"
import { FormPageLayout, FormSection, FormGrid } from "@/components/dashboard/form-page-layout"

export default function AddLoadPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [drivers, setDrivers] = useState<any[]>([])
  const [trucks, setTrucks] = useState<any[]>([])
  const [routes, setRoutes] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [deliveryPoints, setDeliveryPoints] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [showAddShipper, setShowAddShipper] = useState(false)
  const [showAddConsignee, setShowAddConsignee] = useState(false)
  const [isCalculatingMiles, setIsCalculatingMiles] = useState(false)

  const [formData, setFormData] = useState({
    // Load Info
    shipmentNumber: "",
    autoNumbering: false,
    loadType: "ftl",
    customerType: "customer",
    customerId: "",
    companyName: "",
    reference: "",
    
    // Origin/Shipper
    shipperName: "",
    shipperAddress: "",
    shipperCity: "",
    shipperState: "",
    shipperZip: "",
    shipperContact: "",
    shipperPhone: "",
    origin: "",
    pickupDate: "",
    pickupTime: "",
    pickupInstructions: "",
    
    // Destination/Consignee
    consigneeName: "",
    consigneeAddress: "",
    consigneeCity: "",
    consigneeState: "",
    consigneeZip: "",
    consigneeContact: "",
    consigneePhone: "",
    destination: "",
    deliveryType: "single",
    estimatedDelivery: "",
    deliveryTime: "",
    deliveryInstructions: "",
    
    // Freight
    contents: "",
    weight: "",
    pieces: "",
    pallets: "",
    freightClass: "",
    isHazardous: false,
    isOversized: false,
    isReefer: false,
    
    // Route
    estimatedMiles: "",
    milesMethod: "manual",
    
    // Charges
    haulingFee: "",
    fuelSurcharge: "",
    accessorialCharges: "",
    discount: "",
    totalRate: "",
    
    // Assignment
    status: "pending",
    driver: "",
    truck: "",
    route: "",
    
    // Special Requirements
    requiresLiftgate: false,
    requiresInsideDelivery: false,
    requiresAppointment: false,
    
    // Notes
    notes: "",
    internalNotes: "",
  })

  const [newCustomer, setNewCustomer] = useState({ name: "", email: "", phone: "", address: "", city: "", state: "", zip: "" })
  const [newShipper, setNewShipper] = useState({ name: "", address: "", city: "", state: "", zip: "", contact: "", phone: "" })
  const [newConsignee, setNewConsignee] = useState({ name: "", address: "", city: "", state: "", zip: "", contact: "", phone: "" })

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

  useEffect(() => {
    if (selectedCustomer) {
      setFormData(prev => ({
        ...prev,
        customerId: selectedCustomer.id,
        companyName: selectedCustomer.name || selectedCustomer.company_name || "",
      }))
    }
  }, [selectedCustomer])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value })
  }

  const calculateMiles = async () => {
    if (!formData.origin || !formData.destination) {
      toast.error("Please enter origin and destination")
      return
    }
    setIsCalculatingMiles(true)
    try {
    const result = await calculateMileage(formData.origin, formData.destination)
      if (result.miles) {
      setFormData(prev => ({ ...prev, estimatedMiles: result.miles!.toString() }))
      toast.success(`Calculated: ${result.miles} miles`)
      } else {
        toast.error(result.error || "Failed to calculate miles")
      }
    } catch (error) {
      toast.error("Failed to calculate miles")
    } finally {
      setIsCalculatingMiles(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const payload: any = {
        shipment_number: formData.autoNumbering ? "" : formData.shipmentNumber,
      origin: formData.origin,
        destination: formData.deliveryType === "multi" ? "Multiple Locations" : formData.destination,
      weight: formData.weight || undefined,
      contents: formData.contents || undefined,
      company_name: formData.companyName || undefined,
        customer_reference: formData.reference || undefined,
        delivery_type: formData.deliveryType,
      load_type: formData.loadType,
      customer_id: formData.customerId || undefined,
      shipper_name: formData.shipperName || undefined,
      shipper_address: formData.shipperAddress || undefined,
      shipper_city: formData.shipperCity || undefined,
      shipper_state: formData.shipperState || undefined,
      shipper_zip: formData.shipperZip || undefined,
        shipper_contact_name: formData.shipperContact || undefined,
        shipper_contact_phone: formData.shipperPhone || undefined,
      consignee_name: formData.consigneeName || undefined,
      consignee_address: formData.consigneeAddress || undefined,
      consignee_city: formData.consigneeCity || undefined,
      consignee_state: formData.consigneeState || undefined,
      consignee_zip: formData.consigneeZip || undefined,
        consignee_contact_name: formData.consigneeContact || undefined,
        consignee_contact_phone: formData.consigneePhone || undefined,
        pickup_time: formData.pickupTime || undefined,
      delivery_time: formData.deliveryTime || undefined,
        pickup_instructions: formData.pickupInstructions || undefined,
      delivery_instructions: formData.deliveryInstructions || undefined,
      pieces: formData.pieces ? parseInt(formData.pieces) : undefined,
      pallets: formData.pallets ? parseInt(formData.pallets) : undefined,
      is_hazardous: formData.isHazardous,
      is_oversized: formData.isOversized,
      requires_liftgate: formData.requiresLiftgate,
      requires_inside_delivery: formData.requiresInsideDelivery,
      requires_appointment: formData.requiresAppointment,
        rate: formData.haulingFee ? parseFloat(formData.haulingFee) : undefined,
      fuel_surcharge: formData.fuelSurcharge ? parseFloat(formData.fuelSurcharge) : undefined,
      accessorial_charges: formData.accessorialCharges ? parseFloat(formData.accessorialCharges) : undefined,
      discount: formData.discount ? parseFloat(formData.discount) : undefined,
      estimated_miles: formData.estimatedMiles ? parseInt(formData.estimatedMiles) : undefined,
        driver_id: formData.driver || undefined,
        truck_id: formData.truck || undefined,
        route_id: formData.route || undefined,
        status: formData.status,
      notes: formData.notes || undefined,
      internal_notes: formData.internalNotes || undefined,
        load_date: formData.pickupDate || undefined,
        estimated_delivery: formData.estimatedDelivery || undefined,
      }

      const result = await createLoad(payload)

    if (result.error) {
        toast.error(result.error)
      setIsSubmitting(false)
      return
    }

    if (formData.deliveryType === "multi" && deliveryPoints.length > 0 && result.data?.id) {
        for (const point of deliveryPoints) {
          await createLoadDeliveryPoint(result.data.id, point)
        }
        toast.success(`Load created with ${deliveryPoints.length} delivery points`)
    } else {
        toast.success("Load created successfully")
    }

    router.push(`/dashboard/loads/${result.data?.id || ""}`)
    } catch (error: any) {
      toast.error(error.message || "Failed to create load")
      setIsSubmitting(false)
    }
  }

  const filteredCustomers = customers.filter(c => 
    (c.name || c.company_name || "").toLowerCase().includes((selectedCustomer?.name || "").toLowerCase())
  )

  return (
    <FormPageLayout
      title="Create Load"
      subtitle="Add a new load to your system"
      backUrl="/dashboard/loads"
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      submitLabel="Create Load"
    >
            <Tabs defaultValue="load-info" className="space-y-6">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="load-info">Load Info</TabsTrigger>
                <TabsTrigger value="shipper">Shipper</TabsTrigger>
                <TabsTrigger value="consignee">Consignee</TabsTrigger>
                <TabsTrigger value="freight">Freight</TabsTrigger>
                <TabsTrigger value="charges">Charges</TabsTrigger>
                <TabsTrigger value="assignment">Assignment</TabsTrigger>
              </TabsList>

              {/* Load Information Tab */}
              <TabsContent value="load-info" className="space-y-6">
                <FormSection title="Load Information" icon={<Package className="w-5 h-5" />}>
                  <FormGrid cols={3}>
                <div>
                      <Label>Load Number *</Label>
                      <div className="flex gap-2 mt-1">
                  <Input
                    value={formData.shipmentNumber}
                          onChange={(e) => setFormData(prev => ({ ...prev, shipmentNumber: e.target.value }))}
                          disabled={formData.autoNumbering}
                          required={!formData.autoNumbering}
                          placeholder="Auto-generated"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, autoNumbering: !prev.autoNumbering }))}
                        className="text-xs text-primary hover:underline mt-1"
                      >
                        {formData.autoNumbering ? "Manual Entry" : "Auto-generate"}
                      </button>
                </div>
                <div>
                      <Label>Load Type</Label>
                      <div className="flex gap-4 mt-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="loadType" value="ftl" checked={formData.loadType === "ftl"} onChange={(e) => handleSelectChange("loadType", e.target.value)} />
                          <span className="text-sm">FTL</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="loadType" value="ltl" checked={formData.loadType === "ltl"} onChange={(e) => handleSelectChange("loadType", e.target.value)} />
                          <span className="text-sm">LTL</span>
                        </label>
                      </div>
                </div>
                <div>
                      <Label>Customer Type</Label>
                      <Select value={formData.customerType} onValueChange={(v) => handleSelectChange("customerType", v)}>
                        <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                          <SelectItem value="customer">Customer</SelectItem>
                          <SelectItem value="carrier">Carrier</SelectItem>
                          <SelectItem value="broker">Broker</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                    <div className="md:col-span-2">
                      <Label>Customer *</Label>
                      <div className="flex gap-2 mt-1">
                        <Select value={formData.customerId} onValueChange={(v) => {
                          const customer = customers.find(c => c.id === v)
                          setSelectedCustomer(customer || null)
                          handleSelectChange("customerId", v)
                        }}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                          <SelectContent>
                            {customers.map(c => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name || c.company_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="outline" size="icon" onClick={() => setShowAddCustomer(!showAddCustomer)}>
                          <Plus className="w-4 h-4" />
                        </Button>
                        </div>
                      {showAddCustomer && (
                        <Card className="mt-2 p-4 border-primary/20">
                          <div className="grid md:grid-cols-2 gap-3">
                            <Input placeholder="Name *" value={newCustomer.name} onChange={(e) => setNewCustomer(prev => ({ ...prev, name: e.target.value }))} />
                            <Input placeholder="Email" value={newCustomer.email} onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))} />
                            <Input placeholder="Phone" value={newCustomer.phone} onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))} />
                            <Input placeholder="Address" value={newCustomer.address} onChange={(e) => setNewCustomer(prev => ({ ...prev, address: e.target.value }))} />
                            <Input placeholder="City" value={newCustomer.city} onChange={(e) => setNewCustomer(prev => ({ ...prev, city: e.target.value }))} />
                            <Input placeholder="State" value={newCustomer.state} onChange={(e) => setNewCustomer(prev => ({ ...prev, state: e.target.value }))} />
                            <Input placeholder="ZIP" value={newCustomer.zip} onChange={(e) => setNewCustomer(prev => ({ ...prev, zip: e.target.value }))} />
                    </div>
                          <div className="flex gap-2 mt-3">
                            <Button type="button" size="sm" onClick={async () => {
                              if (!newCustomer.name) { toast.error("Name required"); return }
                              const result = await createCustomer({ ...newCustomer, customer_type: formData.customerType })
                              if (result.data) {
                                setCustomers([...customers, result.data])
                                setSelectedCustomer(result.data)
                                setFormData(prev => ({ ...prev, customerId: result.data.id, companyName: result.data.name || result.data.company_name || "" }))
                                setNewCustomer({ name: "", email: "", phone: "", address: "", city: "", state: "", zip: "" })
                                setShowAddCustomer(false)
                                toast.success("Customer added")
                              }
                            }}>Add</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setShowAddCustomer(false)}>Cancel</Button>
                  </div>
                        </Card>
                  )}
                </div>
                <div>
                      <Label>Reference</Label>
                      <Input name="reference" value={formData.reference} onChange={handleChange} className="mt-1" />
                </div>
                  </FormGrid>
                </FormSection>
              </TabsContent>

              {/* Shipper Tab */}
              <TabsContent value="shipper" className="space-y-6">
                <FormSection title="Shipper Information" icon={<Building2 className="w-5 h-5" />}>
                  <FormGrid cols={2}>
                <div className="md:col-span-2">
                      <Label>Shipper *</Label>
                      <div className="flex gap-2 mt-1">
                        <Input name="shipperName" value={formData.shipperName} onChange={handleChange} placeholder="Shipper name" />
                        <Button type="button" variant="outline" size="icon" onClick={() => setShowAddShipper(!showAddShipper)}>
                          <Plus className="w-4 h-4" />
                        </Button>
                </div>
                      {showAddShipper && (
                        <Card className="mt-2 p-4 border-primary/20">
                          <div className="grid md:grid-cols-2 gap-3">
                            <Input placeholder="Name *" value={newShipper.name} onChange={(e) => setNewShipper(prev => ({ ...prev, name: e.target.value }))} />
                            <Input placeholder="Address" value={newShipper.address} onChange={(e) => setNewShipper(prev => ({ ...prev, address: e.target.value }))} />
                            <Input placeholder="City" value={newShipper.city} onChange={(e) => setNewShipper(prev => ({ ...prev, city: e.target.value }))} />
                            <Input placeholder="State" value={newShipper.state} onChange={(e) => setNewShipper(prev => ({ ...prev, state: e.target.value }))} />
                            <Input placeholder="ZIP" value={newShipper.zip} onChange={(e) => setNewShipper(prev => ({ ...prev, zip: e.target.value }))} />
                            <Input placeholder="Contact" value={newShipper.contact} onChange={(e) => setNewShipper(prev => ({ ...prev, contact: e.target.value }))} />
                            <Input placeholder="Phone" value={newShipper.phone} onChange={(e) => setNewShipper(prev => ({ ...prev, phone: e.target.value }))} />
                </div>
                          <div className="flex gap-2 mt-3">
                            <Button type="button" size="sm" onClick={() => {
                              if (!newShipper.name) { toast.error("Name required"); return }
                              setFormData(prev => ({
                                ...prev,
                                shipperName: newShipper.name,
                                shipperAddress: newShipper.address,
                                shipperCity: newShipper.city,
                                shipperState: newShipper.state,
                                shipperZip: newShipper.zip,
                                shipperContact: newShipper.contact,
                                shipperPhone: newShipper.phone,
                                origin: `${newShipper.city}, ${newShipper.state}`.replace(/^,\s*|,\s*$/g, ''),
                              }))
                              setNewShipper({ name: "", address: "", city: "", state: "", zip: "", contact: "", phone: "" })
                              setShowAddShipper(false)
                              toast.success("Shipper added")
                            }}>Add to Form</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setShowAddShipper(false)}>Cancel</Button>
                </div>
                        </Card>
                      )}
                </div>
                <div className="md:col-span-2">
                      <Label>Pickup Location *</Label>
                      <Input name="origin" value={formData.origin} onChange={handleChange} className="mt-1" required />
                </div>
                <div>
                      <Label>Pickup Date</Label>
                      <Input name="pickupDate" type="date" value={formData.pickupDate} onChange={handleChange} className="mt-1" />
                </div>
                <div>
                      <Label>Pickup Time</Label>
                      <Input name="pickupTime" type="time" value={formData.pickupTime} onChange={handleChange} className="mt-1" />
                </div>
                <div className="md:col-span-2">
                      <Label>Pickup Instructions</Label>
                      <Textarea name="pickupInstructions" value={formData.pickupInstructions} onChange={handleChange} className="mt-1" rows={2} />
                </div>
                  </FormGrid>
                </FormSection>
              </TabsContent>

              {/* Consignee Tab */}
              <TabsContent value="consignee" className="space-y-6">
                <FormSection title="Consignee Information" icon={<MapPin className="w-5 h-5" />}>
                  <FormGrid cols={2}>
                <div className="md:col-span-2">
                      <Label>Delivery Type *</Label>
                      <Select value={formData.deliveryType} onValueChange={(v) => {
                        handleSelectChange("deliveryType", v)
                        if (v === "single") setDeliveryPoints([])
                      }}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single">Single Destination</SelectItem>
                          <SelectItem value="multi">Multiple Stops</SelectItem>
                        </SelectContent>
                      </Select>
                </div>
                    {formData.deliveryType === "single" ? (
                      <>
                <div className="md:col-span-2">
                          <Label>Consignee *</Label>
                          <div className="flex gap-2 mt-1">
                            <Input name="consigneeName" value={formData.consigneeName} onChange={handleChange} placeholder="Consignee name" />
                            <Button type="button" variant="outline" size="icon" onClick={() => setShowAddConsignee(!showAddConsignee)}>
                              <Plus className="w-4 h-4" />
                            </Button>
                </div>
                          {showAddConsignee && (
                            <Card className="mt-2 p-4 border-primary/20">
                              <div className="grid md:grid-cols-2 gap-3">
                                <Input placeholder="Name *" value={newConsignee.name} onChange={(e) => setNewConsignee(prev => ({ ...prev, name: e.target.value }))} />
                                <Input placeholder="Address" value={newConsignee.address} onChange={(e) => setNewConsignee(prev => ({ ...prev, address: e.target.value }))} />
                                <Input placeholder="City" value={newConsignee.city} onChange={(e) => setNewConsignee(prev => ({ ...prev, city: e.target.value }))} />
                                <Input placeholder="State" value={newConsignee.state} onChange={(e) => setNewConsignee(prev => ({ ...prev, state: e.target.value }))} />
                                <Input placeholder="ZIP" value={newConsignee.zip} onChange={(e) => setNewConsignee(prev => ({ ...prev, zip: e.target.value }))} />
                                <Input placeholder="Contact" value={newConsignee.contact} onChange={(e) => setNewConsignee(prev => ({ ...prev, contact: e.target.value }))} />
                                <Input placeholder="Phone" value={newConsignee.phone} onChange={(e) => setNewConsignee(prev => ({ ...prev, phone: e.target.value }))} />
                </div>
                              <div className="flex gap-2 mt-3">
                                <Button type="button" size="sm" onClick={() => {
                                  if (!newConsignee.name) { toast.error("Name required"); return }
                                  setFormData(prev => ({
                                    ...prev,
                                    consigneeName: newConsignee.name,
                                    consigneeAddress: newConsignee.address,
                                    consigneeCity: newConsignee.city,
                                    consigneeState: newConsignee.state,
                                    consigneeZip: newConsignee.zip,
                                    consigneeContact: newConsignee.contact,
                                    consigneePhone: newConsignee.phone,
                                    destination: `${newConsignee.city}, ${newConsignee.state}`.replace(/^,\s*|,\s*$/g, ''),
                                  }))
                                  setNewConsignee({ name: "", address: "", city: "", state: "", zip: "", contact: "", phone: "" })
                                  setShowAddConsignee(false)
                                  toast.success("Consignee added")
                                }}>Add to Form</Button>
                                <Button type="button" size="sm" variant="outline" onClick={() => setShowAddConsignee(false)}>Cancel</Button>
                </div>
                            </Card>
                          )}
                </div>
                <div className="md:col-span-2">
                          <Label>Drop Off Location *</Label>
                          <Input name="destination" value={formData.destination} onChange={handleChange} className="mt-1" required />
                </div>
                <div>
                          <Label>Delivery Date</Label>
                          <Input name="estimatedDelivery" type="date" value={formData.estimatedDelivery} onChange={handleChange} className="mt-1" />
                </div>
                <div>
                          <Label>Delivery Time</Label>
                          <Input name="deliveryTime" type="time" value={formData.deliveryTime} onChange={handleChange} className="mt-1" />
                </div>
                <div className="md:col-span-2">
                          <Label>Delivery Instructions</Label>
                          <Textarea name="deliveryInstructions" value={formData.deliveryInstructions} onChange={handleChange} className="mt-1" rows={2} />
                </div>
                      </>
                    ) : (
                <div className="md:col-span-2">
                        <LoadDeliveryPointsManager
                          deliveryPoints={deliveryPoints}
                          onDeliveryPointsChange={setDeliveryPoints}
                  />
                </div>
                    )}
                  </FormGrid>
                </FormSection>
              </TabsContent>

              {/* Freight Tab */}
              <TabsContent value="freight" className="space-y-6">
                <FormSection title="Freight Information" icon={<Package className="w-5 h-5" />}>
                  <FormGrid cols={2}>
                <div className="md:col-span-2">
                      <Label>Description</Label>
                      <Input name="contents" value={formData.contents} onChange={handleChange} className="mt-1" />
                </div>
                <div>
                      <Label>Weight</Label>
                      <Input name="weight" value={formData.weight} onChange={handleChange} className="mt-1" placeholder="lbs" />
                </div>
                <div>
                      <Label>Pieces</Label>
                      <Input name="pieces" type="number" value={formData.pieces} onChange={handleChange} className="mt-1" />
                </div>
                <div>
                      <Label>Pallets</Label>
                      <Input name="pallets" type="number" value={formData.pallets} onChange={handleChange} className="mt-1" />
                </div>
                <div>
                      <Label>Freight Class</Label>
                      <Input name="freightClass" type="number" value={formData.freightClass} onChange={handleChange} className="mt-1" placeholder="50-500" />
                </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label>Load Type</Label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox checked={formData.isHazardous} onCheckedChange={(c) => setFormData(prev => ({ ...prev, isHazardous: !!c }))} />
                          <span className="text-sm">HazMat</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox checked={formData.isOversized} onCheckedChange={(c) => setFormData(prev => ({ ...prev, isOversized: !!c }))} />
                          <span className="text-sm">Oversized</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox checked={formData.isReefer} onCheckedChange={(c) => setFormData(prev => ({ ...prev, isReefer: !!c }))} />
                          <span className="text-sm">Reefer</span>
                        </label>
                </div>
                </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label>Special Requirements</Label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox checked={formData.requiresLiftgate} onCheckedChange={(c) => setFormData(prev => ({ ...prev, requiresLiftgate: !!c }))} />
                          <span className="text-sm">Liftgate</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox checked={formData.requiresInsideDelivery} onCheckedChange={(c) => setFormData(prev => ({ ...prev, requiresInsideDelivery: !!c }))} />
                          <span className="text-sm">Inside Delivery</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox checked={formData.requiresAppointment} onCheckedChange={(c) => setFormData(prev => ({ ...prev, requiresAppointment: !!c }))} />
                          <span className="text-sm">Appointment</span>
                        </label>
                      </div>
                    </div>
                  </FormGrid>
                </FormSection>
              </TabsContent>

              {/* Charges Tab */}
              <TabsContent value="charges" className="space-y-6">
                <FormSection title="Charges & Pricing" icon={<DollarSign className="w-5 h-5" />}>
                  <FormGrid cols={2}>
                  <div>
                      <Label>Estimated Miles</Label>
                      <div className="flex gap-2 mt-1">
                        <Input name="estimatedMiles" value={formData.estimatedMiles} onChange={handleChange} placeholder="0" />
                        <Button type="button" variant="outline" onClick={calculateMiles} disabled={isCalculatingMiles}>
                          {isCalculatingMiles ? "Calculating..." : "Calculate"}
                        </Button>
                  </div>
              </div>
                <div>
                      <Label>Hauling Fee</Label>
                      <Input name="haulingFee" value={formData.haulingFee} onChange={handleChange} className="mt-1" placeholder="0.00" />
                </div>
                <div>
                      <Label>Fuel Surcharge</Label>
                      <Input name="fuelSurcharge" value={formData.fuelSurcharge} onChange={handleChange} className="mt-1" placeholder="0.00" />
                </div>
                <div>
                      <Label>Accessorial Charges</Label>
                      <Input name="accessorialCharges" value={formData.accessorialCharges} onChange={handleChange} className="mt-1" placeholder="0.00" />
                </div>
                <div>
                      <Label>Discount</Label>
                      <Input name="discount" value={formData.discount} onChange={handleChange} className="mt-1" placeholder="0.00" />
                </div>
                <div>
                      <Label>Total Rate</Label>
                      <Input name="totalRate" value={formData.totalRate} onChange={handleChange} className="mt-1" placeholder="0.00" readOnly />
                </div>
                  </FormGrid>
                </FormSection>
              </TabsContent>

              {/* Assignment Tab */}
              <TabsContent value="assignment" className="space-y-6">
                <FormSection title="Assignment" icon={<Truck className="w-5 h-5" />}>
                  <FormGrid cols={2}>
                <div>
                      <Label>Status</Label>
                      <Select value={formData.status} onValueChange={(v) => handleSelectChange("status", v)}>
                        <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="in_transit">In Transit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                      <Label>Driver</Label>
                      <Select value={formData.driver} onValueChange={(v) => handleSelectChange("driver", v)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select driver" />
                    </SelectTrigger>
                    <SelectContent>
                          {drivers.map(d => (
                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                      <Label>Truck</Label>
                      <Select value={formData.truck} onValueChange={(v) => handleSelectChange("truck", v)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select truck" />
                    </SelectTrigger>
                    <SelectContent>
                          {trucks.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.truck_number}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                      <Label>Route</Label>
                      <Select value={formData.route} onValueChange={(v) => handleSelectChange("route", v)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select route" />
                    </SelectTrigger>
                    <SelectContent>
                          {routes.map(r => (
                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                    <div className="md:col-span-2">
                      <Label>Notes</Label>
                      <Textarea name="notes" value={formData.notes} onChange={handleChange} className="mt-1" rows={3} />
              </div>
                    <div className="md:col-span-2">
                      <Label>Internal Notes</Label>
                      <Textarea name="internalNotes" value={formData.internalNotes} onChange={handleChange} className="mt-1" rows={2} />
                    </div>
                  </FormGrid>
                </FormSection>
              </TabsContent>
            </Tabs>

    </FormPageLayout>
  )
}
