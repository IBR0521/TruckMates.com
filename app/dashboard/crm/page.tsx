"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Building2,
  Users,
  TrendingUp,
  Clock,
  DollarSign,
  AlertCircle,
  FileText,
  MessageSquare,
  Search,
  Filter,
  Download,
  Plus,
  Eye,
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
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function CRMDashboardPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "customers" | "vendors" | "documents">("overview")
  const [isLoading, setIsLoading] = useState(true)
  const [customerMetrics, setCustomerMetrics] = useState<CustomerPerformanceMetrics[]>([])
  const [vendorMetrics, setVendorMetrics] = useState<VendorPerformanceMetrics[]>([])
  const [insights, setInsights] = useState<any>(null)
  const [expiringDocuments, setExpiringDocuments] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [relationshipFilter, setRelationshipFilter] = useState<string>("all")

  useEffect(() => {
    loadData()
  }, [activeTab, relationshipFilter])

  async function loadData() {
    setIsLoading(true)
    try {
      if (activeTab === "overview" || activeTab === "customers") {
        const customersResult = await getCustomerPerformanceMetrics({
          relationship_type: relationshipFilter !== "all" ? relationshipFilter : undefined,
        })
        if (customersResult.error) {
          toast.error(customersResult.error)
        } else {
          setCustomerMetrics(customersResult.data || [])
        }
      }

      if (activeTab === "overview" || activeTab === "vendors") {
        const vendorsResult = await getVendorPerformanceMetrics({
          relationship_type: relationshipFilter !== "all" ? relationshipFilter : undefined,
        })
        if (vendorsResult.error) {
          toast.error(vendorsResult.error)
        } else {
          setVendorMetrics(vendorsResult.data || [])
        }
      }

      if (activeTab === "overview") {
        const insightsResult = await getRelationshipInsights()
        if (insightsResult.error) {
          toast.error(insightsResult.error)
        } else {
          setInsights(insightsResult.data)
        }

        const documentsResult = await getExpiringCRMDocuments(30)
        if (documentsResult.error) {
          toast.error(documentsResult.error)
        } else {
          setExpiringDocuments(documentsResult.data || [])
        }
      }
    } catch (error) {
      toast.error("Failed to load CRM data")
    } finally {
      setIsLoading(false)
    }
  }

  const filteredCustomers = customerMetrics.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredVendors = vendorMetrics.filter((v) =>
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
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

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Customers</p>
                  <p className="text-2xl font-bold">{customerMetrics.length}</p>
                </div>
                <Building2 className="w-8 h-8 text-blue-500" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Vendors</p>
                  <p className="text-2xl font-bold">{vendorMetrics.length}</p>
                </div>
                <Users className="w-8 h-8 text-green-500" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Expiring Documents</p>
                  <p className="text-2xl font-bold">{expiringDocuments.length}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-orange-500" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg On-Time Rate</p>
                  <p className="text-2xl font-bold">
                    {customerMetrics.length > 0
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
                <h3 className="text-lg font-semibold mb-4">Top Customers</h3>
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
                      <div className="text-right">
                        <p className="font-semibold">${customer.total_revenue.toLocaleString()}</p>
                        <Link href={`/dashboard/customers/${customer.customer_id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Slow Payers</h3>
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
                      <div className="text-right">
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
                  {insights.slow_payers.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No slow payers found
                    </p>
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
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={relationshipFilter} onValueChange={setRelationshipFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="shipper">Shipper</SelectItem>
                <SelectItem value="broker">Broker</SelectItem>
                <SelectItem value="consignee">Consignee</SelectItem>
                <SelectItem value="3pl">3PL</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {isLoading ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">Loading...</p>
              </Card>
            ) : filteredCustomers.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No customers found</p>
              </Card>
            ) : (
              filteredCustomers.map((customer) => (
                <Card key={customer.customer_id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{customer.name}</h3>
                        <Badge variant="outline">{customer.relationship_type || customer.status}</Badge>
                        {customer.on_time_rate >= 95 && (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
                            Top Performer
                          </Badge>
                        )}
                      </div>
                      {customer.company_name && (
                        <p className="text-sm text-muted-foreground mb-4">{customer.company_name}</p>
                      )}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">On-Time Rate</p>
                          <p className="text-lg font-semibold">{customer.on_time_rate.toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Total Loads</p>
                          <p className="text-lg font-semibold">{customer.total_loads}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Total Revenue</p>
                          <p className="text-lg font-semibold">${customer.total_revenue.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Avg Payment Days</p>
                          <p className="text-lg font-semibold">
                            {customer.avg_payment_days ? customer.avg_payment_days.toFixed(0) : "N/A"}
                          </p>
                        </div>
                      </div>
                    </div>
                    <Link href={`/dashboard/customers/${customer.customer_id}`}>
                      <Button variant="outline">
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="vendors" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search vendors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={relationshipFilter} onValueChange={setRelationshipFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="vendor_repair">Repair</SelectItem>
                <SelectItem value="vendor_fuel">Fuel</SelectItem>
                <SelectItem value="vendor_parts">Parts</SelectItem>
                <SelectItem value="vendor_insurance">Insurance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {isLoading ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">Loading...</p>
              </Card>
            ) : filteredVendors.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No vendors found</p>
              </Card>
            ) : (
              filteredVendors.map((vendor) => (
                <Card key={vendor.vendor_id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{vendor.name}</h3>
                        <Badge variant="outline">{vendor.relationship_type || vendor.status}</Badge>
                      </div>
                      {vendor.company_name && (
                        <p className="text-sm text-muted-foreground mb-4">{vendor.company_name}</p>
                      )}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Total Spent</p>
                          <p className="text-lg font-semibold">${vendor.total_spent.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Transactions</p>
                          <p className="text-lg font-semibold">{vendor.total_expenses}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Per Month</p>
                          <p className="text-lg font-semibold">
                            {vendor.transactions_per_month.toFixed(1)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <Link href={`/dashboard/vendors/${vendor.vendor_id}`}>
                      <Button variant="outline">
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="documents">
          <Card className="p-6">
            <p className="text-muted-foreground">
              Document management will be available in the customer/vendor detail pages.
            </p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}



