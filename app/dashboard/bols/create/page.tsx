"use client"

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
import { ArrowLeft, FileText, Building2, MapPin, Package } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { createBOL, getBOLTemplates } from "@/app/actions/bol"
import { getLoads } from "@/app/actions/loads"
import { useRouter } from "next/navigation"

export default function CreateBOLPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loads, setLoads] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [selectedLoad, setSelectedLoad] = useState<any | null>(null)
  const [formData, setFormData] = useState({
    load_id: "",
    template_id: "",
    
    // Shipper
    shipper_name: "",
    shipper_address: "",
    shipper_city: "",
    shipper_state: "",
    shipper_zip: "",
    shipper_phone: "",
    shipper_email: "",
    
    // Consignee
    consignee_name: "",
    consignee_address: "",
    consignee_city: "",
    consignee_state: "",
    consignee_zip: "",
    consignee_phone: "",
    consignee_email: "",
    
    // Carrier
    carrier_name: "",
    carrier_mc_number: "",
    carrier_dot_number: "",
    
    // Load Details
    pickup_date: "",
    delivery_date: "",
    freight_charges: "",
    payment_terms: "Collect",
    special_instructions: "",
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (formData.load_id && loads.length > 0) {
      const load = loads.find((l) => l.id === formData.load_id)
      if (load) {
        setSelectedLoad(load)
        // Pre-fill form data from load
        setFormData((prev) => ({
          ...prev,
          shipper_name: prev.shipper_name || load.company_name || "",
          consignee_name: prev.consignee_name || "",
          pickup_date: prev.pickup_date || (load.load_date || ""),
          delivery_date: prev.delivery_date || (load.estimated_delivery || ""),
        }))
      }
    } else {
      setSelectedLoad(null)
    }
  }, [formData.load_id, loads])

  async function loadData() {
    const [loadsResult, templatesResult] = await Promise.all([
      getLoads(),
      getBOLTemplates(),
    ])

    if (loadsResult.data) {
      setLoads(loadsResult.data)
    }
    if (templatesResult.data) {
      setTemplates(templatesResult.data)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    if (!formData.load_id) {
      toast.error("Please select a load")
      setIsSubmitting(false)
      return
    }

    if (!formData.shipper_name || !formData.consignee_name) {
      toast.error("Please fill in shipper and consignee names")
      setIsSubmitting(false)
      return
    }

    const result = await createBOL({
      load_id: formData.load_id,
      template_id: formData.template_id || undefined,
      shipper_name: formData.shipper_name,
      shipper_address: formData.shipper_address || undefined,
      shipper_city: formData.shipper_city || undefined,
      shipper_state: formData.shipper_state || undefined,
      shipper_zip: formData.shipper_zip || undefined,
      shipper_phone: formData.shipper_phone || undefined,
      shipper_email: formData.shipper_email || undefined,
      consignee_name: formData.consignee_name,
      consignee_address: formData.consignee_address || undefined,
      consignee_city: formData.consignee_city || undefined,
      consignee_state: formData.consignee_state || undefined,
      consignee_zip: formData.consignee_zip || undefined,
      consignee_phone: formData.consignee_phone || undefined,
      consignee_email: formData.consignee_email || undefined,
      carrier_name: formData.carrier_name || undefined,
      carrier_mc_number: formData.carrier_mc_number || undefined,
      carrier_dot_number: formData.carrier_dot_number || undefined,
      pickup_date: formData.pickup_date || undefined,
      delivery_date: formData.delivery_date || undefined,
      freight_charges: formData.freight_charges ? parseFloat(formData.freight_charges) : undefined,
      payment_terms: formData.payment_terms || undefined,
      special_instructions: formData.special_instructions || undefined,
    })

    setIsSubmitting(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("BOL created successfully")
      router.push(`/dashboard/bols/${result.data?.id}`)
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
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
        <Link href="/dashboard/bols">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to BOLs
          </Button>
        </Link>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Create Bill of Lading</h1>
      </div>

      <div className="p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Load Selection */}
            <Card className="border-border p-4 md:p-6">
              <div className="flex items-center gap-2 mb-6">
                <Package className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Load Selection</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="load_id">Select Load *</Label>
                  <Select
                    value={formData.load_id}
                    onValueChange={(value) => handleSelectChange("load_id", value)}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Choose a load" />
                    </SelectTrigger>
                    <SelectContent>
                      {loads.map((load) => (
                        <SelectItem key={load.id} value={load.id}>
                          {load.shipment_number} - {load.origin} → {load.destination}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {templates.length > 0 && (
                  <div>
                    <Label htmlFor="template_id">BOL Template (Optional)</Label>
                    <Select
                      value={formData.template_id || "none"}
                      onValueChange={(value) => handleSelectChange("template_id", value === "none" ? "" : value)}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select template" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name} {template.is_default && "(Default)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {selectedLoad && (
                  <div className="md:col-span-2 p-4 bg-secondary/30 rounded-lg border border-border">
                    <p className="text-sm font-medium text-foreground mb-2">Selected Load Details:</p>
                    <div className="grid md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <div>Origin: {selectedLoad.origin}</div>
                      <div>Destination: {selectedLoad.destination}</div>
                      <div>Contents: {selectedLoad.contents || "—"}</div>
                      <div>Weight: {selectedLoad.weight || "—"}</div>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Shipper Information */}
            <Card className="border-border p-4 md:p-6">
              <div className="flex items-center gap-2 mb-6">
                <Building2 className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Shipper Information</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="shipper_name">Shipper Name *</Label>
                  <Input
                    id="shipper_name"
                    name="shipper_name"
                    value={formData.shipper_name}
                    onChange={handleChange}
                    className="mt-2"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="shipper_phone">Phone</Label>
                  <Input
                    id="shipper_phone"
                    name="shipper_phone"
                    value={formData.shipper_phone}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="shipper_address">Address</Label>
                  <Input
                    id="shipper_address"
                    name="shipper_address"
                    value={formData.shipper_address}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="shipper_city">City</Label>
                  <Input
                    id="shipper_city"
                    name="shipper_city"
                    value={formData.shipper_city}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="shipper_state">State</Label>
                  <Select
                    value={formData.shipper_state}
                    onValueChange={(value) => handleSelectChange("shipper_state", value)}
                  >
                    <SelectTrigger className="mt-2">
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
                  <Label htmlFor="shipper_zip">ZIP Code</Label>
                  <Input
                    id="shipper_zip"
                    name="shipper_zip"
                    value={formData.shipper_zip}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="shipper_email">Email</Label>
                  <Input
                    id="shipper_email"
                    name="shipper_email"
                    type="email"
                    value={formData.shipper_email}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
              </div>
            </Card>

            {/* Consignee Information */}
            <Card className="border-border p-4 md:p-6">
              <div className="flex items-center gap-2 mb-6">
                <MapPin className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Consignee Information</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="consignee_name">Consignee Name *</Label>
                  <Input
                    id="consignee_name"
                    name="consignee_name"
                    value={formData.consignee_name}
                    onChange={handleChange}
                    className="mt-2"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="consignee_phone">Phone</Label>
                  <Input
                    id="consignee_phone"
                    name="consignee_phone"
                    value={formData.consignee_phone}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="consignee_address">Address</Label>
                  <Input
                    id="consignee_address"
                    name="consignee_address"
                    value={formData.consignee_address}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="consignee_city">City</Label>
                  <Input
                    id="consignee_city"
                    name="consignee_city"
                    value={formData.consignee_city}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="consignee_state">State</Label>
                  <Select
                    value={formData.consignee_state}
                    onValueChange={(value) => handleSelectChange("consignee_state", value)}
                  >
                    <SelectTrigger className="mt-2">
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
                  <Label htmlFor="consignee_zip">ZIP Code</Label>
                  <Input
                    id="consignee_zip"
                    name="consignee_zip"
                    value={formData.consignee_zip}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="consignee_email">Email</Label>
                  <Input
                    id="consignee_email"
                    name="consignee_email"
                    type="email"
                    value={formData.consignee_email}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
              </div>
            </Card>

            {/* Carrier & Load Details */}
            <Card className="border-border p-4 md:p-6">
              <div className="flex items-center gap-2 mb-6">
                <FileText className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Carrier & Load Details</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="carrier_name">Carrier Name</Label>
                  <Input
                    id="carrier_name"
                    name="carrier_name"
                    value={formData.carrier_name}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="carrier_mc_number">MC Number</Label>
                  <Input
                    id="carrier_mc_number"
                    name="carrier_mc_number"
                    value={formData.carrier_mc_number}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="carrier_dot_number">DOT Number</Label>
                  <Input
                    id="carrier_dot_number"
                    name="carrier_dot_number"
                    value={formData.carrier_dot_number}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="pickup_date">Pickup Date</Label>
                  <Input
                    id="pickup_date"
                    name="pickup_date"
                    type="date"
                    value={formData.pickup_date}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="delivery_date">Delivery Date</Label>
                  <Input
                    id="delivery_date"
                    name="delivery_date"
                    type="date"
                    value={formData.delivery_date}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="freight_charges">Freight Charges ($)</Label>
                  <Input
                    id="freight_charges"
                    name="freight_charges"
                    type="number"
                    step="0.01"
                    value={formData.freight_charges}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="payment_terms">Payment Terms</Label>
                  <Select
                    value={formData.payment_terms}
                    onValueChange={(value) => handleSelectChange("payment_terms", value)}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Collect">Collect</SelectItem>
                      <SelectItem value="Prepaid">Prepaid</SelectItem>
                      <SelectItem value="Third Party">Third Party</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="special_instructions">Special Instructions</Label>
                  <Textarea
                    id="special_instructions"
                    name="special_instructions"
                    value={formData.special_instructions}
                    onChange={handleChange}
                    className="mt-2"
                    rows={3}
                  />
                </div>
              </div>
            </Card>

            {/* Submit Button */}
            <div className="flex justify-end gap-4">
              <Link href="/dashboard/bols">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {isSubmitting ? "Creating..." : "Create BOL"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
