"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Phone, Mail, Building2, MapPin, DollarSign, Package, FileText, MessageSquare, Calendar, Globe, Hash } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { use } from "react"
import { getCustomer, getCustomerLoads, getCustomerInvoices, getCustomerHistory } from "@/app/actions/customers"
import { createCustomerPortalAccess, revokeCustomerPortalAccess, getCustomerPortalAccess } from "@/app/actions/customer-portal"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { 
  DetailPageLayout, 
  DetailSection, 
  InfoGrid, 
  InfoField, 
  StatusBadge 
} from "@/components/dashboard/detail-page-layout"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { ExternalLink, Copy, Link as LinkIcon, X } from "lucide-react"
import { DocumentManager } from "@/components/crm/document-manager"
import { CommunicationTimeline } from "@/components/crm/communication-timeline"

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const [customer, setCustomer] = useState<any>(null)
  const [loads, setLoads] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"overview" | "loads" | "invoices" | "history" | "documents" | "communications">("overview")
  const [portalAccess, setPortalAccess] = useState<any>(null)
  const [isPortalDialogOpen, setIsPortalDialogOpen] = useState(false)
  const [portalSettings, setPortalSettings] = useState({
    can_view_location: false,
    can_submit_loads: false,
    email_notifications: true,
    sms_notifications: false,
    expires_days: 365,
  })

  useEffect(() => {
    loadData()
  }, [id])

  async function loadData() {
    setIsLoading(true)
    try {
      const [customerResult, loadsResult, invoicesResult, historyResult, portalResult] = await Promise.all([
        getCustomer(id),
        getCustomerLoads(id),
        getCustomerInvoices(id),
        getCustomerHistory(id),
        getCustomerPortalAccess(id),
      ])

      if (customerResult.error) {
        toast.error(customerResult.error)
        router.push("/dashboard/customers")
        return
      }

      setCustomer(customerResult.data)
      setLoads(loadsResult.data || [])
      setInvoices(invoicesResult.data || [])
      setHistory(historyResult.data || [])
      
      if (portalResult.data) {
        setPortalAccess(portalResult.data)
        setPortalSettings({
          can_view_location: portalResult.data.can_view_location || false,
          can_submit_loads: portalResult.data.can_submit_loads || false,
          email_notifications: portalResult.data.email_notifications !== false,
          sms_notifications: portalResult.data.sms_notifications || false,
          expires_days: portalResult.data.expires_at 
            ? Math.ceil((new Date(portalResult.data.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : 365,
        })
      }
    } catch (error: any) {
      toast.error("Failed to load customer data")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreatePortalAccess() {
    try {
      const result = await createCustomerPortalAccess({
        customer_id: id,
        can_view_location: portalSettings.can_view_location,
        can_submit_loads: portalSettings.can_submit_loads,
        email_notifications: portalSettings.email_notifications,
        sms_notifications: portalSettings.sms_notifications,
        expires_days: portalSettings.expires_days,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Portal access created successfully! Customer will receive an email with the portal link.")
        setIsPortalDialogOpen(false)
        await loadData()
      }
    } catch (error: any) {
      toast.error("Failed to create portal access")
    }
  }

  async function handleRevokeAccess() {
    if (!confirm("Are you sure you want to revoke portal access for this customer?")) {
      return
    }

    try {
      const result = await revokeCustomerPortalAccess(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Portal access revoked")
        setPortalAccess(null)
      }
    } catch (error: any) {
      toast.error("Failed to revoke portal access")
    }
  }

  function getPortalUrl() {
    if (!portalAccess?.access_token) return ""
    const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
    return `${baseUrl}/portal/${portalAccess.access_token}`
  }

  function handleCopyPortalUrl() {
    const url = getPortalUrl()
    if (url) {
      navigator.clipboard.writeText(url)
      toast.success("Portal URL copied to clipboard")
    }
  }

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!customer) {
    return null
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/50">Active</Badge>
      case "inactive":
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/50">Inactive</Badge>
      case "prospect":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">Prospect</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const getTypeBadge = (type: string) => {
    const types: Record<string, { label: string; className: string }> = {
      shipper: { label: "Shipper", className: "bg-purple-500/20 text-purple-400 border-purple-500/50" },
      broker: { label: "Broker", className: "bg-orange-500/20 text-orange-400 border-orange-500/50" },
      consignee: { label: "Consignee", className: "bg-cyan-500/20 text-cyan-400 border-cyan-500/50" },
      "3pl": { label: "3PL", className: "bg-pink-500/20 text-pink-400 border-pink-500/50" },
      other: { label: "Other", className: "bg-gray-500/20 text-gray-400 border-gray-500/50" },
    }
    const typeInfo = types[type] || { label: type, className: "bg-gray-500/20 text-gray-400 border-gray-500/50" }
    return <Badge className={typeInfo.className}>{typeInfo.label}</Badge>
  }

  const getStatusVariant = (status: string): "success" | "default" | "info" => {
    switch (status) {
      case "active":
        return "success"
      case "prospect":
        return "info"
      default:
        return "default"
    }
  }

  return (
    <DetailPageLayout
      title={customer.name}
      subtitle={customer.company_name || undefined}
      backUrl="/dashboard/customers"
      editUrl={`/dashboard/customers/${id}/edit`}
    >
      {/* Tabs - Moved to Top */}
      <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto -mx-4 md:-mx-8 px-4 md:px-8">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-3 font-medium text-sm transition whitespace-nowrap ${
            activeTab === "overview"
              ? "text-primary border-b-2 border-primary bg-primary/5"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab("loads")}
          className={`px-4 py-3 font-medium text-sm transition whitespace-nowrap ${
            activeTab === "loads"
              ? "text-primary border-b-2 border-primary bg-primary/5"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          }`}
        >
          Loads
          {loads.length > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-secondary text-foreground">
              {loads.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("invoices")}
          className={`px-4 py-3 font-medium text-sm transition whitespace-nowrap ${
            activeTab === "invoices"
              ? "text-primary border-b-2 border-primary bg-primary/5"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          }`}
        >
          Invoices
          {invoices.length > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-secondary text-foreground">
              {invoices.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-3 font-medium text-sm transition whitespace-nowrap ${
            activeTab === "history"
              ? "text-primary border-b-2 border-primary bg-primary/5"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          }`}
        >
          History
          {history.length > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-secondary text-foreground">
              {history.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("documents")}
          className={`px-4 py-3 font-medium text-sm transition whitespace-nowrap ${
            activeTab === "documents"
              ? "text-primary border-b-2 border-primary bg-primary/5"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          }`}
        >
          Documents
        </button>
        <button
          onClick={() => setActiveTab("communications")}
          className={`px-4 py-3 font-medium text-sm transition whitespace-nowrap ${
            activeTab === "communications"
              ? "text-primary border-b-2 border-primary bg-primary/5"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          }`}
        >
          Communications
        </button>
      </div>

      <div className="space-y-6">
          {/* Overview Tab Content */}
          {activeTab === "overview" && (
            <>
              {/* Basic Information */}
            <DetailSection
              title="Basic Information"
              icon={<Building2 className="w-5 h-5" />}
              description="Customer contact and identification details"
            >
              <InfoGrid cols={2}>
                <InfoField
                  label="Status"
                  value={<StatusBadge status={customer.status || "Unknown"} variant={getStatusVariant(customer.status)} />}
                />
                <InfoField
                  label="Type"
                  value={getTypeBadge(customer.customer_type)}
                />
                  {customer.email && (
                  <InfoField
                    label="Email"
                    value={
                      <a href={`mailto:${customer.email}`} className="text-primary hover:underline">
                          {customer.email}
                        </a>
                    }
                    icon={<Mail className="w-4 h-4" />}
                  />
                  )}
                  {customer.phone && (
                  <InfoField
                    label="Phone"
                    value={
                      <a href={`tel:${customer.phone}`} className="text-primary hover:underline">
                          {customer.phone}
                        </a>
                    }
                    icon={<Phone className="w-4 h-4" />}
                  />
                  )}
                  {customer.website && (
                  <InfoField
                    label="Website"
                    value={
                      <a href={customer.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                        {customer.website}
                        <Globe className="w-3 h-3" />
                      </a>
                    }
                    icon={<Globe className="w-4 h-4" />}
                  />
                  )}
                  {customer.tax_id && (
                  <InfoField
                    label="Tax ID / EIN"
                    value={<span className="font-mono">{customer.tax_id}</span>}
                    icon={<Hash className="w-4 h-4" />}
                  />
                )}
              </InfoGrid>
            </DetailSection>

              {/* Address */}
              {(customer.address_line1 || customer.city) && (
              <DetailSection
                title="Address"
                icon={<MapPin className="w-5 h-5" />}
                description="Physical location and mailing address"
              >
                <div className="space-y-1 text-foreground">
                  {customer.address_line1 && <p className="font-medium">{customer.address_line1}</p>}
                    {customer.address_line2 && <p>{customer.address_line2}</p>}
                    {(customer.city || customer.state || customer.zip) && (
                      <p>
                        {customer.city}
                        {customer.city && customer.state && ", "}
                        {customer.state} {customer.zip}
                      </p>
                    )}
                    {customer.country && customer.country !== "USA" && <p>{customer.country}</p>}
                  </div>
              </DetailSection>
              )}

              {/* Financial Summary */}
            <DetailSection
              title="Financial Summary"
              icon={<DollarSign className="w-5 h-5" />}
              description="Revenue, payment terms, and financial metrics"
            >
              <InfoGrid cols={3}>
                <InfoField
                  label="Total Revenue"
                  value={
                    <span className="text-2xl font-bold">
                      ${customer.total_revenue?.toFixed(2) || "0.00"}
                    </span>
                  }
                />
                <InfoField
                  label="Total Loads"
                  value={
                    <span className="text-2xl font-bold">{customer.total_loads || 0}</span>
                  }
                />
                <InfoField
                  label="Payment Terms"
                  value={<span className="text-lg">{customer.payment_terms || "Net 30"}</span>}
                />
                  {customer.credit_limit && (
                  <InfoField
                    label="Credit Limit"
                    value={<span className="text-lg">${customer.credit_limit.toFixed(2)}</span>}
                  />
                  )}
                  {customer.last_load_date && (
                  <InfoField
                    label="Last Load Date"
                    value={
                      <span className="text-lg">
                        {new Date(customer.last_load_date).toLocaleDateString()}
                      </span>
                    }
                    icon={<Calendar className="w-4 h-4" />}
                  />
                )}
              </InfoGrid>
            </DetailSection>

              {/* Primary Contact */}
              {(customer.primary_contact_name || customer.primary_contact_email || customer.primary_contact_phone) && (
              <DetailSection
                title="Primary Contact"
                icon={<MessageSquare className="w-5 h-5" />}
                description="Main point of contact for this customer"
              >
                <InfoGrid cols={2}>
                    {customer.primary_contact_name && (
                    <InfoField
                      label="Name"
                      value={customer.primary_contact_name}
                    />
                    )}
                    {customer.primary_contact_email && (
                    <InfoField
                      label="Email"
                      value={
                        <a href={`mailto:${customer.primary_contact_email}`} className="text-primary hover:underline">
                          {customer.primary_contact_email}
                        </a>
                      }
                      icon={<Mail className="w-4 h-4" />}
                    />
                    )}
                    {customer.primary_contact_phone && (
                    <InfoField
                      label="Phone"
                      value={
                        <a href={`tel:${customer.primary_contact_phone}`} className="text-primary hover:underline">
                          {customer.primary_contact_phone}
                        </a>
                      }
                      icon={<Phone className="w-4 h-4" />}
                    />
                  )}
                </InfoGrid>
              </DetailSection>
            )}

            {/* Notes */}
            {customer.notes && (
              <DetailSection
                title="Notes"
                icon={<FileText className="w-5 h-5" />}
                description="Additional information and notes about this customer"
              >
                <p className="text-foreground whitespace-pre-wrap leading-relaxed">{customer.notes}</p>
              </DetailSection>
            )}

            {/* Portal Access */}
            <DetailSection
              title="Portal Access"
              icon={<LinkIcon className="w-5 h-5" />}
              description="Customer portal access and permissions"
              action={
                portalAccess ? (
                  <Button variant="outline" size="sm" onClick={handleRevokeAccess}>
                    <X className="w-4 h-4 mr-2" />
                    Revoke Access
                  </Button>
                ) : (
                  <Dialog open={isPortalDialogOpen} onOpenChange={setIsPortalDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <LinkIcon className="w-4 h-4 mr-2" />
                        Create Portal Access
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Portal Access</DialogTitle>
                        <DialogDescription>
                          Generate a secure access token for this customer to access their portal.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Expires In (Days)</Label>
                          <Input
                            type="number"
                            value={portalSettings.expires_days}
                            onChange={(e) => setPortalSettings({ ...portalSettings, expires_days: parseInt(e.target.value) || 365 })}
                            min="1"
                            max="3650"
                          />
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label>View Real-time Location</Label>
                              <p className="text-sm text-muted-foreground">Allow customer to see driver location</p>
                            </div>
                            <Switch
                              checked={portalSettings.can_view_location}
                              onCheckedChange={(checked) => setPortalSettings({ ...portalSettings, can_view_location: checked })}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <Label>Submit Loads</Label>
                              <p className="text-sm text-muted-foreground">Allow customer to submit new loads</p>
                            </div>
                            <Switch
                              checked={portalSettings.can_submit_loads}
                              onCheckedChange={(checked) => setPortalSettings({ ...portalSettings, can_submit_loads: checked })}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <Label>Email Notifications</Label>
                              <p className="text-sm text-muted-foreground">Send email notifications</p>
                            </div>
                            <Switch
                              checked={portalSettings.email_notifications}
                              onCheckedChange={(checked) => setPortalSettings({ ...portalSettings, email_notifications: checked })}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <Label>SMS Notifications</Label>
                              <p className="text-sm text-muted-foreground">Send SMS notifications</p>
                            </div>
                            <Switch
                              checked={portalSettings.sms_notifications}
                              onCheckedChange={(checked) => setPortalSettings({ ...portalSettings, sms_notifications: checked })}
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                          <Button variant="outline" onClick={() => setIsPortalDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button onClick={handleCreatePortalAccess}>
                            Create Access
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )
              }
            >
              {portalAccess ? (
                <div className="space-y-6">
                  <div className="p-4 bg-secondary rounded-lg border border-border">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <Label className="text-sm text-muted-foreground">Portal URL</Label>
                        <p className="font-mono text-xs sm:text-sm mt-1 break-all">{getPortalUrl()}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button variant="outline" size="sm" onClick={handleCopyPortalUrl}>
                          <Copy className="w-4 h-4 sm:mr-2" />
                          <span className="hidden sm:inline">Copy</span>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <a href={getPortalUrl()} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4 sm:mr-2" />
                            <span className="hidden sm:inline">Open</span>
                          </a>
                        </Button>
                      </div>
                    </div>
                  </div>
                  <InfoGrid cols={2}>
                    <InfoField
                      label="Status"
                      value={
                        <StatusBadge 
                          status={portalAccess.is_active ? "Active" : "Inactive"} 
                          variant={portalAccess.is_active ? "success" : "default"}
                        />
                      }
                    />
                    {portalAccess.expires_at && (
                      <InfoField
                        label="Expires"
                        value={new Date(portalAccess.expires_at).toLocaleDateString()}
                        icon={<Calendar className="w-4 h-4" />}
                      />
                    )}
                    {portalAccess.last_accessed_at && (
                      <InfoField
                        label="Last Accessed"
                        value={new Date(portalAccess.last_accessed_at).toLocaleDateString()}
                        icon={<Calendar className="w-4 h-4" />}
                      />
                    )}
                    <InfoField
                      label="Access Count"
                      value={portalAccess.access_count || 0}
                    />
                  </InfoGrid>
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium mb-3">Permissions</p>
                    <div className="flex flex-wrap gap-2">
                      {portalAccess.can_view_loads && (
                        <Badge variant="outline">View Loads</Badge>
                      )}
                      {portalAccess.can_view_location && (
                        <Badge variant="outline">View Location</Badge>
                      )}
                      {portalAccess.can_download_documents && (
                        <Badge variant="outline">Download Documents</Badge>
                      )}
                      {portalAccess.can_view_invoices && (
                        <Badge variant="outline">View Invoices</Badge>
                      )}
                      {portalAccess.can_submit_loads && (
                        <Badge variant="outline">Submit Loads</Badge>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <LinkIcon className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground mb-2 font-medium">No portal access created</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Click "Create Portal Access" to generate a secure access token for this customer.
                  </p>
                </div>
              )}
            </DetailSection>
          </>
        )}

        {/* Loads Tab */}
        {activeTab === "loads" && (
          <DetailSection
            title="Loads"
            icon={<Package className="w-5 h-5" />}
            description={`${loads.length} load${loads.length !== 1 ? "s" : ""} associated with this customer`}
            action={
              <Link href="/dashboard/loads/add">
                <Button size="sm">Add Load</Button>
              </Link>
            }
          >
            {loads.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground font-medium mb-2">No loads found</p>
                <p className="text-sm text-muted-foreground">This customer doesn't have any loads yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Shipment #</th>
                      <th className="text-left p-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Origin</th>
                      <th className="text-left p-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Destination</th>
                      <th className="text-left p-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                      <th className="text-left p-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
                      <th className="text-right p-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loads.map((load) => (
                      <tr key={load.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                        <td className="p-3 font-medium">{load.shipment_number || "—"}</td>
                        <td className="p-3">{load.origin || "—"}</td>
                        <td className="p-3">{load.destination || "—"}</td>
                        <td className="p-3">
                          <Badge variant="outline">{load.status?.replace("_", " ") || "—"}</Badge>
                        </td>
                        <td className="p-3">
                          {load.load_date ? new Date(load.load_date).toLocaleDateString() : "—"}
                        </td>
                        <td className="p-3 text-right">
                          {load.id && typeof load.id === 'string' && load.id.trim() !== '' ? (
                            <Link href={`/dashboard/loads/${load.id}`}>
                              <Button variant="ghost" size="sm">View</Button>
                            </Link>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DetailSection>
        )}

        {/* Invoices Tab */}
        {activeTab === "invoices" && (
          <DetailSection
            title="Invoices"
            icon={<FileText className="w-5 h-5" />}
            description={`${invoices.length} invoice${invoices.length !== 1 ? "s" : ""} for this customer`}
            action={
              <Link href="/dashboard/accounting/invoices/create">
                <Button size="sm">Create Invoice</Button>
              </Link>
            }
          >
            {invoices.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground font-medium mb-2">No invoices found</p>
                <p className="text-sm text-muted-foreground">This customer doesn't have any invoices yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Invoice #</th>
                      <th className="text-left p-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Amount</th>
                      <th className="text-left p-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                      <th className="text-left p-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Issue Date</th>
                      <th className="text-left p-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Due Date</th>
                      <th className="text-right p-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                        <td className="p-3 font-medium">{invoice.invoice_number || "—"}</td>
                        <td className="p-3 font-semibold">${parseFloat(invoice.amount || 0).toFixed(2)}</td>
                        <td className="p-3">
                          <StatusBadge 
                            status={invoice.status || "Unknown"} 
                            variant={
                              invoice.status === "paid" ? "success" :
                              invoice.status === "overdue" ? "danger" :
                              invoice.status === "sent" ? "info" : "default"
                            }
                          />
                        </td>
                        <td className="p-3">
                          {invoice.issue_date ? new Date(invoice.issue_date).toLocaleDateString() : "—"}
                        </td>
                        <td className="p-3">
                          {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "—"}
                        </td>
                        <td className="p-3 text-right">
                          {invoice.id && typeof invoice.id === 'string' && invoice.id.trim() !== '' ? (
                            <Link href={`/dashboard/accounting/invoices/${invoice.id}`}>
                              <Button variant="ghost" size="sm">View</Button>
                            </Link>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DetailSection>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <DetailSection
            title="Communication History"
            icon={<MessageSquare className="w-5 h-5" />}
            description={`${history.length} communication${history.length !== 1 ? "s" : ""} recorded`}
          >
            {history.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground font-medium mb-2">No communication history</p>
                <p className="text-sm text-muted-foreground">No communication records found for this customer.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {history.map((item) => (
                  <div key={item.id} className="border border-border rounded-lg p-4 hover:bg-secondary/20 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <p className="font-semibold text-foreground mb-1">{item.subject || item.type}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="capitalize">{item.type}</span>
                          <span>•</span>
                          <span>{new Date(item.occurred_at).toLocaleString()}</span>
                        </div>
                      </div>
                      <Badge variant={item.direction === "inbound" ? "secondary" : "default"}>
                        {item.direction}
                      </Badge>
                    </div>
                    {item.message && (
                      <p className="text-sm text-foreground mt-3 leading-relaxed">{item.message}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </DetailSection>
        )}

        {/* Documents Tab */}
        {activeTab === "documents" && (
          <Card className="p-6">
            <DocumentManager customerId={id} />
          </Card>
        )}

        {/* Communications Tab */}
        {activeTab === "communications" && (
          <Card className="p-6">
            <CommunicationTimeline customerId={id} />
          </Card>
        )}
      </div>
    </DetailPageLayout>
  )
}

