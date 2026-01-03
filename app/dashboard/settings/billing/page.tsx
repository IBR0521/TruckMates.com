"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { 
  CreditCard, 
  Save,
  Building2,
  Mail,
  Phone,
} from "lucide-react"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { SubscriptionSection } from "../subscription-section"
import { getBillingInfo, updateBillingInfo } from "@/app/actions/settings-billing"

export default function BillingSettingsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [billing, setBilling] = useState({
    billing_company_name: "",
    billing_email: "",
    billing_phone: "",
    billing_address: "",
    tax_id: "",
    tax_exempt: false,
    payment_method: "card",
    payment_terms: "Net 30",
    billing_notes: "",
  })

  useEffect(() => {
    async function loadSettings() {
      setIsLoading(true)
      try {
        const result = await getBillingInfo()
        if (result.error) {
          toast.error(result.error)
        } else if (result.data) {
          setBilling({
            billing_company_name: result.data.billing_company_name || "",
            billing_email: result.data.billing_email || "",
            billing_phone: result.data.billing_phone || "",
            billing_address: result.data.billing_address || "",
            tax_id: result.data.tax_id || "",
            tax_exempt: result.data.tax_exempt || false,
            payment_method: result.data.payment_method || "card",
            payment_terms: result.data.payment_terms || "Net 30",
            billing_notes: result.data.billing_notes || "",
          })
        }
      } catch (error) {
        toast.error("Failed to load billing settings")
      } finally {
        setIsLoading(false)
      }
    }
    loadSettings()
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const result = await updateBillingInfo({
        billing_company_name: billing.billing_company_name,
        billing_email: billing.billing_email,
        billing_phone: billing.billing_phone,
        billing_address: billing.billing_address,
        tax_id: billing.tax_id,
        tax_exempt: billing.tax_exempt,
        payment_method: billing.payment_method,
        payment_terms: billing.payment_terms,
        billing_notes: billing.billing_notes,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Billing settings saved successfully")
      }
    } catch (error) {
      toast.error("Failed to save billing settings")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="w-full p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <CreditCard className="w-6 h-6" />
            Billing Settings
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your subscription and billing information
          </p>
        </div>

        {isLoading ? (
          <Card className="p-6">
            <p className="text-muted-foreground">Loading...</p>
          </Card>
        ) : (
          <>
            <SubscriptionSection />

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Billing Information</h2>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input
                value={billing.billing_company_name}
                onChange={(e) => setBilling({ ...billing, billing_company_name: e.target.value })}
                placeholder="Enter company name"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={billing.billing_email}
                  onChange={(e) => setBilling({ ...billing, billing_email: e.target.value })}
                  placeholder="billing@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  type="tel"
                  value={billing.billing_phone}
                  onChange={(e) => setBilling({ ...billing, billing_phone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Billing Address</Label>
              <Input
                value={billing.billing_address}
                onChange={(e) => setBilling({ ...billing, billing_address: e.target.value })}
                placeholder="Enter billing address"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tax ID</Label>
                <Input
                  value={billing.tax_id}
                  onChange={(e) => setBilling({ ...billing, tax_id: e.target.value })}
                  placeholder="Enter tax ID"
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Terms</Label>
                <Input
                  value={billing.payment_terms}
                  onChange={(e) => setBilling({ ...billing, payment_terms: e.target.value })}
                  placeholder="Net 30"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Tax Exempt</Label>
                <p className="text-sm text-muted-foreground">Mark if company is tax exempt</p>
              </div>
              <Switch
                checked={billing.tax_exempt}
                onCheckedChange={(checked) => setBilling({ ...billing, tax_exempt: checked })}
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </Card>
          </>
        )}
      </div>
    </div>
  )
}

