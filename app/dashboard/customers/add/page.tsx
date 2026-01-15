"use client"

import { useState } from "react"
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
import { ArrowLeft, Building2, MapPin, Briefcase, Tag, Mail, Share2, FileText } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { createCustomer } from "@/app/actions/customers"
import { useRouter } from "next/navigation"
import { FormPageLayout, FormSection, FormGrid } from "@/components/dashboard/form-page-layout"

export default function AddCustomerPage() {
  const router = useRouter()
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
    // Mailing Address
    mailing_address_line1: "",
    mailing_address_line2: "",
    mailing_city: "",
    mailing_state: "",
    mailing_zip: "",
    mailing_country: "USA",
    // Physical Address
    physical_address_line1: "",
    physical_address_line2: "",
    physical_city: "",
    physical_state: "",
    physical_zip: "",
    physical_country: "USA",
    // Social Media
    facebook_url: "",
    twitter_url: "",
    linkedin_url: "",
    instagram_url: "",
    tax_id: "",
    payment_terms: "Net 30",
    credit_limit: "",
    currency: "USD",
    customer_type: "shipper",
    status: "active",
    priority: "normal",
    notes: "",
    terms: "",
    primary_contact_name: "",
    primary_contact_email: "",
    primary_contact_phone: "",
  })

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

    const result = await createCustomer({
      name: formData.name.trim(),
      company_name: formData.company_name || undefined,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      website: formData.website || undefined,
      address_line1: formData.physical_address_line1 || undefined,
      address_line2: formData.physical_address_line2 || undefined,
      city: formData.physical_city || undefined,
      state: formData.physical_state || undefined,
      zip: formData.physical_zip || undefined,
      country: formData.physical_country || "USA",
      mailing_address_line1: formData.mailing_address_line1 || undefined,
      mailing_address_line2: formData.mailing_address_line2 || undefined,
      mailing_city: formData.mailing_city || undefined,
      mailing_state: formData.mailing_state || undefined,
      mailing_zip: formData.mailing_zip || undefined,
      mailing_country: formData.mailing_country || "USA",
      physical_address_line1: formData.physical_address_line1 || undefined,
      physical_address_line2: formData.physical_address_line2 || undefined,
      physical_city: formData.physical_city || undefined,
      physical_state: formData.physical_state || undefined,
      physical_zip: formData.physical_zip || undefined,
      physical_country: formData.physical_country || "USA",
      facebook_url: formData.facebook_url || undefined,
      twitter_url: formData.twitter_url || undefined,
      linkedin_url: formData.linkedin_url || undefined,
      instagram_url: formData.instagram_url || undefined,
      tax_id: formData.tax_id || undefined,
      payment_terms: formData.payment_terms,
      credit_limit: formData.credit_limit ? parseFloat(formData.credit_limit) : undefined,
      currency: formData.currency,
      customer_type: formData.customer_type,
      status: formData.status,
      priority: formData.priority,
      notes: formData.notes || undefined,
      terms: formData.terms || undefined,
      primary_contact_name: formData.primary_contact_name || undefined,
      primary_contact_email: formData.primary_contact_email || undefined,
      primary_contact_phone: formData.primary_contact_phone || undefined,
    })

    setIsSubmitting(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Customer added successfully")
      router.push("/dashboard/customers")
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
    <FormPageLayout
      title="Add New Customer"
      subtitle="Create a new customer in your system"
      backUrl="/dashboard/customers"
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      submitLabel="Add Customer"
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

            {/* Social Media */}
            <FormSection title="Social Media" icon={<Share2 className="w-5 h-5" />}>
              <FormGrid cols={2}>
                <div>
                  <Label htmlFor="facebook_url">Facebook URL</Label>
                  <Input
                    id="facebook_url"
                    name="facebook_url"
                    type="url"
                    placeholder="https://facebook.com/company"
                    value={formData.facebook_url}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="twitter_url">Twitter URL</Label>
                  <Input
                    id="twitter_url"
                    name="twitter_url"
                    type="url"
                    placeholder="https://twitter.com/company"
                    value={formData.twitter_url}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="linkedin_url">LinkedIn URL</Label>
                  <Input
                    id="linkedin_url"
                    name="linkedin_url"
                    type="url"
                    placeholder="https://linkedin.com/company/company"
                    value={formData.linkedin_url}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="instagram_url">Instagram URL</Label>
                  <Input
                    id="instagram_url"
                    name="instagram_url"
                    type="url"
                    placeholder="https://instagram.com/company"
                    value={formData.instagram_url}
                    onChange={handleChange}
                    className="mt-2"
                  />
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

            {/* Terms and Notes */}
            <FormSection title="Terms and Additional Information" icon={<FileText className="w-5 h-5" />}>
              <div className="space-y-6">
                <div>
                  <Label htmlFor="terms">Terms & Conditions</Label>
                  <Textarea
                    id="terms"
                    name="terms"
                    placeholder="Terms and conditions for this customer..."
                    value={formData.terms}
                    onChange={handleChange}
                    className="mt-2"
                    rows={4}
                  />
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
              </div>
            </FormSection>
      </div>
    </FormPageLayout>
  )
}


