"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Building2,
  Users,
  TrendingUp,
  AlertCircle,
  DollarSign,
  Clock3,
  Plus,
  Eye,
  MessageSquarePlus,
  ArrowRight,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import {
  getCustomerPerformanceMetrics,
  getVendorPerformanceMetrics,
  getRelationshipInsights,
  getCRMRevenueSnapshot,
  getInactiveCustomers,
  type CustomerPerformanceMetrics,
  type VendorPerformanceMetrics,
} from "@/app/actions/crm-performance"
import { getExpiringCRMDocuments } from "@/app/actions/crm-documents"
import { getCustomers } from "@/app/actions/customers"
import { getVendors } from "@/app/actions/vendors"
import { CRMSectionHeader } from "@/components/crm/crm-section-header"
import { getCommunicationTimeline, logCommunication } from "@/app/actions/crm-communication"

export default function CRMDashboardPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [customerCount, setCustomerCount] = useState(0)
  const [vendorCount, setVendorCount] = useState(0)
  const [customerMetrics, setCustomerMetrics] = useState<CustomerPerformanceMetrics[]>([])
  const [vendorMetrics, setVendorMetrics] = useState<VendorPerformanceMetrics[]>([])
  const [insights, setInsights] = useState<any>(null)
  const [expiringDocuments, setExpiringDocuments] = useState<any[]>([])
  const [revenueSnapshot, setRevenueSnapshot] = useState({ this_month_revenue: 0, outstanding_invoices: 0 })
  const [inactiveCustomers, setInactiveCustomers] = useState<any[]>([])
  const [recentCommunications, setRecentCommunications] = useState<any[]>([])
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false)
  const [isSubmittingQuickLog, setIsSubmittingQuickLog] = useState(false)
  const [quickLog, setQuickLog] = useState({
    customer_id: "",
    customer_name: "",
    type: "note",
    direction: "outbound",
    subject: "",
    message: "",
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setIsLoading(true)
    try {
      const [
        customersListResult,
        vendorsListResult,
        customersResult,
        vendorsResult,
        insightsResult,
        documentsResult,
        revenueResult,
        inactiveResult,
        communicationsResult,
      ] = await Promise.all([
        getCustomers({ limit: 1 }),
        getVendors({ limit: 1 }),
        getCustomerPerformanceMetrics({}),
        getVendorPerformanceMetrics({}),
        getRelationshipInsights(),
        getExpiringCRMDocuments(30),
        getCRMRevenueSnapshot(),
        getInactiveCustomers(30),
        getCommunicationTimeline({ limit: 8 }),
      ])

      if (customersListResult.error) {
        toast.error(customersListResult.error)
      } else {
        setCustomerCount(customersListResult.count ?? 0)
      }

      if (vendorsListResult.error) {
        toast.error(vendorsListResult.error)
      } else {
        setVendorCount(vendorsListResult.count ?? 0)
      }

      if (customersResult.error && !customersResult.error.includes("schema cache") && !customersResult.error.includes("does not exist")) {
        toast.error(customersResult.error)
      }
      setCustomerMetrics(customersResult.data || [])

      if (vendorsResult.error && !vendorsResult.error.includes("does not exist")) {
        toast.error(vendorsResult.error)
      }
      setVendorMetrics(vendorsResult.data || [])

      if (insightsResult.error && !insightsResult.error.includes("schema cache") && !insightsResult.error.includes("does not exist")) {
        toast.error(insightsResult.error)
      }
      setInsights(insightsResult.data || {
        top_customers: [],
        top_vendors: [],
        slow_payers: [],
        low_performers: [],
      })

      if (documentsResult.error && !documentsResult.error.includes("schema cache") && !documentsResult.error.includes("does not exist")) {
        toast.error(documentsResult.error)
      }
      setExpiringDocuments(documentsResult.data || [])

      if (revenueResult.error) {
        toast.error(revenueResult.error)
      } else if (revenueResult.data) {
        setRevenueSnapshot(revenueResult.data)
      }

      if (inactiveResult.error) {
        toast.error(inactiveResult.error)
      } else {
        setInactiveCustomers(inactiveResult.data || [])
      }

      if (communicationsResult.error) {
        toast.error(communicationsResult.error)
      } else {
        setRecentCommunications(communicationsResult.data || [])
      }
    } catch (error) {
      toast.error("Failed to load CRM data")
    } finally {
      setIsLoading(false)
    }
  }

  function openQuickLog(customerId: string, customerName: string) {
    setQuickLog({
      customer_id: customerId,
      customer_name: customerName,
      type: "note",
      direction: "outbound",
      subject: "",
      message: "",
    })
    setIsQuickLogOpen(true)
  }

  async function handleQuickLogSubmit() {
    if (!quickLog.customer_id) {
      toast.error("Customer is required")
      return
    }
    if (!quickLog.subject && !quickLog.message) {
      toast.error("Add a subject or message")
      return
    }
    setIsSubmittingQuickLog(true)
    const result = await logCommunication({
      customer_id: quickLog.customer_id,
      type: quickLog.type as any,
      direction: quickLog.direction as "inbound" | "outbound",
      subject: quickLog.subject || undefined,
      message: quickLog.message || undefined,
      occurred_at: new Date().toISOString(),
    })
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`Communication logged for ${quickLog.customer_name}`)
      setIsQuickLogOpen(false)
      const timelineResult = await getCommunicationTimeline({ limit: 8 })
      if (!timelineResult.error) {
        setRecentCommunications(timelineResult.data || [])
      }
    }
    setIsSubmittingQuickLog(false)
  }

  return (
    <div className="space-y-6">
      <CRMSectionHeader currentPage="dashboard" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">CRM Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Unified relationship management with performance metrics
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/customers/add">
              <Plus className="w-4 h-4 mr-2" />
              Add Customer
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/vendors/add">
              <Plus className="w-4 h-4 mr-2" />
              Add Vendor
            </Link>
          </Button>
        </div>
      </div>

      {/* Key Metrics - cards link to Customers/Vendors where relevant */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link href="/dashboard/customers">
          <Card className="p-4 hover:bg-secondary/30 transition-colors h-full">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Customers</p>
                <p className="text-2xl font-bold">{isLoading ? "—" : customerCount}</p>
              </div>
              <Building2 className="w-8 h-8 text-blue-500" />
            </div>
          </Card>
        </Link>
        <Link href="/dashboard/vendors">
          <Card className="p-4 hover:bg-secondary/30 transition-colors h-full">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Vendors</p>
                <p className="text-2xl font-bold">{isLoading ? "—" : vendorCount}</p>
              </div>
              <Users className="w-8 h-8 text-green-500" />
            </div>
          </Card>
        </Link>
        <Card className="p-4 h-full">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Expiring Documents</p>
              <p className="text-2xl font-bold">{isLoading ? "—" : expiringDocuments.length}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-orange-500" />
          </div>
        </Card>
        <Card className="p-4 h-full">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Revenue Snapshot</p>
              <p className="text-2xl font-bold">
                {isLoading ? "—" : `$${revenueSnapshot.this_month_revenue.toLocaleString()}`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Outstanding: {isLoading ? "—" : `$${revenueSnapshot.outstanding_invoices.toLocaleString()}`}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-purple-500" />
          </div>
        </Card>
      </div>

      {/* Top Performers */}
      {insights && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Top Customers</h3>
              <Link href="/dashboard/customers">
                <Button variant="ghost" size="sm">
                  View all
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="space-y-3">
              {insights.top_customers.slice(0, 5).map((customer: CustomerPerformanceMetrics) => (
                <div
                  key={customer.customer_id}
                  className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{customer.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {customer.on_time_rate}% on-time • {customer.total_loads} loads
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">${customer.total_revenue.toLocaleString()}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openQuickLog(customer.customer_id, customer.name)}
                    >
                      <MessageSquarePlus className="w-4 h-4" />
                    </Button>
                    <Link href={`/dashboard/customers/${customer.customer_id}`}>
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
              {(!insights.top_customers || insights.top_customers.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">No customers yet</p>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Slow Payers</h3>
              <Link href="/dashboard/customers">
                <Button variant="ghost" size="sm">
                  View all
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="space-y-3">
              {insights.slow_payers.slice(0, 5).map((customer: CustomerPerformanceMetrics) => (
                <div
                  key={customer.customer_id}
                  className="flex items-center justify-between p-3 bg-orange-500/10 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{customer.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Avg payment: {customer.avg_payment_days?.toFixed(0)} days
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-orange-500">
                      {customer.avg_payment_days?.toFixed(0)} days
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openQuickLog(customer.customer_id, customer.name)}
                    >
                      <MessageSquarePlus className="w-4 h-4" />
                    </Button>
                    <Link href={`/dashboard/customers/${customer.customer_id}`}>
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
              {(!insights.slow_payers || insights.slow_payers.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">No slow payers found</p>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Low Performers</h3>
              <TrendingUp className="w-5 h-5 text-amber-500" />
            </div>
            <div className="space-y-3">
              {insights.low_performers.slice(0, 5).map((customer: CustomerPerformanceMetrics) => (
                <div
                  key={customer.customer_id}
                  className="flex items-center justify-between p-3 bg-amber-500/10 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{customer.name}</p>
                    <p className="text-sm text-muted-foreground">
                      On-time: {customer.on_time_rate}% • {customer.total_loads} loads
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openQuickLog(customer.customer_id, customer.name)}
                    >
                      <MessageSquarePlus className="w-4 h-4" />
                    </Button>
                    <Link href={`/dashboard/customers/${customer.customer_id}`}>
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
              {(!insights.low_performers || insights.low_performers.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">No low performers found</p>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Inactive Customers */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Re-engage Customers (30+ Days Inactive)</h3>
          <Clock3 className="w-5 h-5 text-yellow-500" />
        </div>
        <div className="space-y-3">
          {inactiveCustomers.slice(0, 8).map((customer) => (
            <div key={customer.customer_id} className="flex items-center justify-between p-3 bg-secondary/40 rounded-lg">
              <div>
                <p className="font-medium">{customer.name}</p>
                <p className="text-sm text-muted-foreground">
                  {customer.days_inactive} days inactive
                  {customer.last_load_date ? ` • Last load ${new Date(customer.last_load_date).toLocaleDateString()}` : " • No load history"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openQuickLog(customer.customer_id, customer.name)}
                >
                  <MessageSquarePlus className="w-4 h-4 mr-1" />
                  Log
                </Button>
                <Link href={`/dashboard/customers/${customer.customer_id}`}>
                  <Button variant="outline" size="sm">Open</Button>
                </Link>
              </div>
            </div>
          ))}
          {inactiveCustomers.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No inactive customers found.</p>
          )}
        </div>
      </Card>

      {/* Vendor Snapshot */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Top Vendors by Spend</h3>
          <Users className="w-5 h-5 text-green-500" />
        </div>
        <div className="space-y-3">
          {(insights?.top_vendors || []).slice(0, 5).map((vendor: VendorPerformanceMetrics) => (
            <div key={vendor.vendor_id} className="flex items-center justify-between p-3 bg-secondary/40 rounded-lg">
              <div>
                <p className="font-medium">{vendor.name}</p>
                <p className="text-sm text-muted-foreground">
                  {vendor.total_expenses} txns • avg ${Number(vendor.avg_expense_amount || 0).toFixed(2)}
                </p>
              </div>
              <p className="font-semibold">${Number(vendor.total_spent || 0).toLocaleString()}</p>
            </div>
          ))}
          {(!insights?.top_vendors || insights.top_vendors.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-4">No vendor spend data yet.</p>
          )}
        </div>
      </Card>

      {/* Recent Communications */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recent Communications</h3>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/customers">Open Customers</Link>
          </Button>
        </div>
        <div className="space-y-2">
          {recentCommunications.map((comm) => (
            <div key={comm.id} className="p-3 rounded-lg border border-border">
              <p className="font-medium">{comm.subject || comm.type}</p>
              <p className="text-sm text-muted-foreground">
                {(comm.customer_name || comm.vendor_name || "Unknown")} • {new Date(comm.occurred_at).toLocaleString()}
              </p>
            </div>
          ))}
          {recentCommunications.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No recent communications logged.</p>
          )}
        </div>
      </Card>

      {/* Expiring Documents */}
      {expiringDocuments.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Expiring Documents</h3>
            <Badge variant="destructive">{expiringDocuments.length}</Badge>
          </div>
          <div className="space-y-2">
            {expiringDocuments.slice(0, 10).map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 bg-orange-500/10 rounded-lg"
              >
                <div>
                  <p className="font-medium">{doc.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {doc.customer_name || doc.vendor_name} • {doc.document_type.toUpperCase()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-orange-500">
                    {doc.days_until_expiration} days
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(doc.expiration_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Dialog open={isQuickLogOpen} onOpenChange={setIsQuickLogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick Log Communication</DialogTitle>
            <DialogDescription>
              Add a call, email, SMS, meeting, or note without leaving the dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Customer</Label>
              <Input value={quickLog.customer_name} disabled />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={quickLog.type} onValueChange={(value) => setQuickLog((prev) => ({ ...prev, type: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="note">Note</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Direction</Label>
                <Select value={quickLog.direction} onValueChange={(value) => setQuickLog((prev) => ({ ...prev, direction: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outbound">Outbound</SelectItem>
                    <SelectItem value="inbound">Inbound</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Subject</Label>
              <Input
                value={quickLog.subject}
                onChange={(e) => setQuickLog((prev) => ({ ...prev, subject: e.target.value }))}
                placeholder="Optional subject"
              />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea
                rows={4}
                value={quickLog.message}
                onChange={(e) => setQuickLog((prev) => ({ ...prev, message: e.target.value }))}
                placeholder="What happened in this communication?"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsQuickLogOpen(false)}>Cancel</Button>
              <Button onClick={handleQuickLogSubmit} disabled={isSubmittingQuickLog}>
                {isSubmittingQuickLog ? "Saving..." : "Save Log"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
