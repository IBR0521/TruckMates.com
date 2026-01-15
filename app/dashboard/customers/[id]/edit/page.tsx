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
import { ArrowLeft, Building2, MapPin, Briefcase, Tag, Share2, FileText } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { getCustomer, updateCustomer } from "@/app/actions/customers"
import { useRouter } from "next/navigation"
import { use } from "react"
import { FormPageLayout, FormSection, FormGrid } from "@/components/dashboard/form-page-layout"

export default function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
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
    credit_limit: "",
    currency: "USD",
    customer_type: "shipper",
    status: "active",
    priority: "normal",
    notes: "",
    primary_contact_name: "",
    primary_contact_email: "",
    primary_contact_phone: "",
  })

  useEffect(() => {
    async function loadData() {
      const result = await getCustomer(id)
      if (result.error) {
        toast.error(result.error)
        router.push("/dashboard/customers")
        return
      }

      if (result.data) {
        const customer = result.data

        setFormData({
          name: customer.name || "",
          company_name: customer.company_name || "",
          email: customer.email || "",
          phone: customer.phone || "",
          website: customer.website || "",
          address_line1: customer.address_line1 || "",
          address_line2: customer.address_line2 || "",
          city: customer.city || "",
          state: customer.state || "",
          zip: customer.zip || "",
          country: customer.country || "USA",
          tax_id: customer.tax_id || "",
          payment_terms: customer.payment_terms || "Net 30",
          credit_limit: customer.credit_limit ? String(customer.credit_limit) : "",
          currency: customer.currency || "USD",
          customer_type: customer.customer_type || "shipper",
          status: customer.status || "active",
          priority: customer.priority || "normal",
          notes: customer.notes || "",
          primary_contact_name: customer.primary_contact_name || customer.contact_person || "",
          primary_contact_email: customer.primary_contact_email || "",
          primary_contact_phone: customer.primary_contact_phone || "",
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
      toast.error("Customer name is required")
      setIsSubmitting(false)
      return
    }

    const result = await updateCustomer(id, {
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
      credit_limit: formData.credit_limit ? parseFloat(formData.credit_limit) : undefined,
      currency: formData.currency,
      customer_type: formData.customer_type,
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
      toast.success("Customer updated successfully")
      router.push(`/dashboard/customers/${id}`)
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
        title="Edit Customer"
        subtitle="Loading customer information..."
        backUrl={`/dashboard/customers/${id}`}
      >
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading customer information...</p>
        </div>
      </FormPageLayout>
    )
  }

  return (
    <FormPageLayout
      title="Edit Customer"
      subtitle="Update customer information"
      backUrl={`/dashboard/customers/${id}`}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      submitLabel="Update Customer"
    >
      <div className="space-y-6">
        {/* Basic Information */}
        <FormSection title="Basic Information" icon={<Building2 className="w-5 h-5" />}>
          <FormGrid cols={2}>
                <div>
                  <Label htmlFor="name">Customer Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="ABC Shipping Company"
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
                    placeholder="ABC Shipping Inc."
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
                    placeholder="contact@abcshipping.com"
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
                    placeholder="https://www.abcshipping.com"
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
                  <Input
                    id="country"
                    name="country"
                    type="text"
                    value={formData.country}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
          </FormGrid>
        </FormSection>

        {/* Business Information */}
        <FormSection title="Business Information" icon={<Briefcase className="w-5 h-5" />}>
          <FormGrid cols={2}>
                <div>
                  <Label htmlFor="customer_type">Customer Type</Label>
                  <Select value={formData.customer_type} onValueChange={(value) => handleSelectChange("customer_type", value)}>
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shipper">Shipper</SelectItem>
                      <SelectItem value="broker">Broker</SelectItem>
                      <SelectItem value="consignee">Consignee</SelectItem>
                      <SelectItem value="3pl">3PL</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => handleSelectChange("status", value)}>
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="prospect">Prospect</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="payment_terms">Payment Terms</Label>
                  <Select value={formData.payment_terms} onValueChange={(value) => handleSelectChange("payment_terms", value)}>
                    <SelectTrigger className="mt-2 w-full">
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
                  <Label htmlFor="credit_limit">Credit Limit ($)</Label>
                  <Input
                    id="credit_limit"
                    name="credit_limit"
                    type="number"
                    step="0.01"
                    placeholder="10000.00"
                    value={formData.credit_limit}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={formData.priority} onValueChange={(value) => handleSelectChange("priority", value)}>
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
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
                    placeholder="john@abcshipping.com"
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
            <Card className="border-border p-4 md:p-6">
              <div className="flex items-center gap-2 mb-6">
                <Tag className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Additional Information</h2>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder="Additional notes about this customer..."
                  value={formData.notes}
                  onChange={handleChange}
                  className="mt-2"
                  rows={4}
                />
              </div>
            </Card>
      </div>
    </FormPageLayout>
  )
}

