"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Building2,
  Users,
  TrendingUp,
  AlertCircle,
  Plus,
  Eye,
  ArrowRight,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import {
  getCustomerPerformanceMetrics,
  getVendorPerformanceMetrics,
  getRelationshipInsights,
  type CustomerPerformanceMetrics,
  type VendorPerformanceMetrics,
} from "@/app/actions/crm-performance"
import { getExpiringCRMDocuments } from "@/app/actions/crm-documents"
import { getCustomers } from "@/app/actions/customers"
import { getVendors } from "@/app/actions/vendors"
import { CRMSectionHeader } from "@/components/crm/crm-section-header"

export default function CRMDashboardPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [customerCount, setCustomerCount] = useState(0)
  const [vendorCount, setVendorCount] = useState(0)
  const [customerMetrics, setCustomerMetrics] = useState<CustomerPerformanceMetrics[]>([])
  const [vendorMetrics, setVendorMetrics] = useState<VendorPerformanceMetrics[]>([])
  const [insights, setInsights] = useState<any>(null)
  const [expiringDocuments, setExpiringDocuments] = useState<any[]>([])

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
      ] = await Promise.all([
        getCustomers({ limit: 1 }),
        getVendors({ limit: 1 }),
        getCustomerPerformanceMetrics({}),
        getVendorPerformanceMetrics({}),
        getRelationshipInsights(),
        getExpiringCRMDocuments(30),
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
    } catch (error) {
      toast.error("Failed to load CRM data")
    } finally {
      setIsLoading(false)
    }
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
              <p className="text-sm text-muted-foreground">Avg On-Time Rate</p>
              <p className="text-2xl font-bold">
                {isLoading
                  ? "—"
                  : customerMetrics.length > 0
                    ? Math.round(
                        customerMetrics.reduce((sum, c) => sum + c.on_time_rate, 0) /
                          customerMetrics.length
                      )
                    : 0}
                %
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-500" />
          </div>
        </Card>
      </div>

      {/* Top Performers */}
      {insights && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        </div>
      )}

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
    </div>
  )
}
