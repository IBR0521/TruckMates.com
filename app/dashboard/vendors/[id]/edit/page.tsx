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
import { ArrowLeft, Store, MapPin, Briefcase, Tag } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { getVendor, updateVendor } from "@/app/actions/vendors"
import { useRouter } from "next/navigation"
import { use } from "react"
import { FormPageLayout, FormSection, FormGrid } from "@/components/dashboard/form-page-layout"

export default function EditVendorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    company_name: "",
    email: "",
    phone: "",
    website: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    zip: "",
    country: "USA",
    tax_id: "",
    payment_terms: "Net 30",
    currency: "USD",
    vendor_type: "supplier",
    status: "active",
    priority: "normal",
    notes: "",
    primary_contact_name: "",
    primary_contact_email: "",
    primary_contact_phone: "",
  })

  useEffect(() => {
    async function loadData() {
      const result = await getVendor(id)
      if (result.error) {
        toast.error(result.error)
        router.push("/dashboard/vendors")
        return
      }

      if (result.data) {
        const vendor = result.data

        setFormData({
          name: vendor.name || "",
          company_name: vendor.company_name || "",
          email: vendor.email || "",
          phone: vendor.phone || "",
          website: vendor.website || "",
          address_line1: vendor.address_line1 || "",
          address_line2: vendor.address_line2 || "",
          city: vendor.city || "",
          state: vendor.state || "",
          zip: vendor.zip || "",
          country: vendor.country || "USA",
          tax_id: vendor.tax_id || "",
          payment_terms: vendor.payment_terms || "Net 30",
          currency: vendor.currency || "USD",
          vendor_type: vendor.vendor_type || "supplier",
          status: vendor.status || "active",
          priority: vendor.priority || "normal",
          notes: vendor.notes || "",
          primary_contact_name: vendor.primary_contact_name || "",
          primary_contact_email: vendor.primary_contact_email || "",
          primary_contact_phone: vendor.primary_contact_phone || "",
        })
      }
      setIsLoading(false)
    }
    loadData()
  }, [id, router])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    if (!formData.name.trim()) {
      toast.error("Vendor name is required")
      setIsSubmitting(false)
      return
    }

    const result = await updateVendor(id, {
      name: formData.name.trim(),
      company_name: formData.company_name || undefined,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      website: formData.website || undefined,
      address_line1: formData.address_line1 || undefined,
      address_line2: formData.address_line2 || undefined,
      city: formData.city || undefined,
      state: formData.state || undefined,
      zip: formData.zip || undefined,
      country: formData.country,
      tax_id: formData.tax_id || undefined,
      payment_terms: formData.payment_terms,
      currency: formData.currency,
      vendor_type: formData.vendor_type,
      status: formData.status,
      priority: formData.priority,
      notes: formData.notes || undefined,
      primary_contact_name: formData.primary_contact_name || undefined,
      primary_contact_email: formData.primary_contact_email || undefined,
      primary_contact_phone: formData.primary_contact_phone || undefined,
    })

    setIsSubmitting(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Vendor updated successfully")
      router.push(`/dashboard/vendors/${id}`)
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
        title="Edit Vendor"
        subtitle="Loading vendor information..."
        backUrl={`/dashboard/vendors/${id}`}
      >
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading vendor information...</p>
        </div>
      </FormPageLayout>
    )
  }

  return (
    <FormPageLayout
      title="Edit Vendor"
      subtitle="Update vendor information"
      backUrl={`/dashboard/vendors/${id}`}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      submitLabel="Update Vendor"
    >
      <div className="space-y-6">
        {/* Basic Information */}
        <FormSection title="Basic Information" icon={<Store className="w-5 h-5" />}>
          <FormGrid cols={2}>
                <div>
                  <Label htmlFor="name">Vendor Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="ABC Parts Supply"
                    value={formData.name}
                    onChange={handleChange}
                    className="mt-2"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="company_name">Company Name</Label>
                  <Input
                    id="company_name"
                    name="company_name"
                    type="text"
                    placeholder="ABC Parts Inc."
                    value={formData.company_name}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="contact@abcparts.com"
                    value={formData.email}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={formData.phone}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    name="website"
                    type="url"
                    placeholder="https://www.abcparts.com"
                    value={formData.website}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="tax_id">Tax ID / EIN</Label>
                  <Input
                    id="tax_id"
                    name="tax_id"
                    type="text"
                    placeholder="12-3456789"
                    value={formData.tax_id}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="vendor_type">Vendor Type</Label>
                  <Select value={formData.vendor_type} onValueChange={(value) => handleSelectChange("vendor_type", value)}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="supplier">Supplier</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="fuel">Fuel</SelectItem>
                      <SelectItem value="parts">Parts</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => handleSelectChange("status", value)}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={formData.priority} onValueChange={(value) => handleSelectChange("priority", value)}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="payment_terms">Payment Terms</Label>
                  <Select value={formData.payment_terms} onValueChange={(value) => handleSelectChange("payment_terms", value)}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Net 15">Net 15</SelectItem>
                      <SelectItem value="Net 30">Net 30</SelectItem>
                      <SelectItem value="Net 45">Net 45</SelectItem>
                      <SelectItem value="Net 60">Net 60</SelectItem>
                      <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Select value={formData.currency} onValueChange={(value) => handleSelectChange("currency", value)}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="CAD">CAD</SelectItem>
                      <SelectItem value="MXN">MXN</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
          </FormGrid>
        </FormSection>

        {/* Address Information */}
        <FormSection title="Address" icon={<MapPin className="w-5 h-5" />}>
          <FormGrid cols={2}>
                <div className="md:col-span-2">
                  <Label htmlFor="address_line1">Address Line 1</Label>
                  <Input
                    id="address_line1"
                    name="address_line1"
                    type="text"
                    placeholder="123 Main Street"
                    value={formData.address_line1}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="address_line2">Address Line 2</Label>
                  <Input
                    id="address_line2"
                    name="address_line2"
                    type="text"
                    placeholder="Suite 100"
                    value={formData.address_line2}
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
                  <Label htmlFor="zip">ZIP Code</Label>
                  <Input
                    id="zip"
                    name="zip"
                    type="text"
                    placeholder="10001"
                    value={formData.zip}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Select value={formData.country} onValueChange={(value) => handleSelectChange("country", value)}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USA">United States</SelectItem>
                      <SelectItem value="CAN">Canada</SelectItem>
                      <SelectItem value="MEX">Mexico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
          </FormGrid>
        </FormSection>

        {/* Primary Contact */}
        <FormSection title="Primary Contact" icon={<Tag className="w-5 h-5" />}>
          <FormGrid cols={2}>
                <div>
                  <Label htmlFor="primary_contact_name">Contact Name</Label>
                  <Input
                    id="primary_contact_name"
                    name="primary_contact_name"
                    type="text"
                    placeholder="John Smith"
                    value={formData.primary_contact_name}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="primary_contact_email">Contact Email</Label>
                  <Input
                    id="primary_contact_email"
                    name="primary_contact_email"
                    type="email"
                    placeholder="john@abcparts.com"
                    value={formData.primary_contact_email}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="primary_contact_phone">Contact Phone</Label>
                  <Input
                    id="primary_contact_phone"
                    name="primary_contact_phone"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={formData.primary_contact_phone}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
          </FormGrid>
        </FormSection>

        {/* Notes */}
        <FormSection title="Additional Information" icon={<Tag className="w-5 h-5" />}>
          <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder="Additional notes about this vendor..."
                  value={formData.notes}
                  onChange={handleChange}
                  className="mt-2"
                  rows={4}
                />
          </div>
        </FormSection>
      </div>
    </FormPageLayout>
  )
}

