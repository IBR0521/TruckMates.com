"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Phone, Mail, Building2, MapPin, Edit2, DollarSign, Wrench, MessageSquare } from "lucide-react"
import { DocumentManager } from "@/components/crm/document-manager"
import { CommunicationTimeline } from "@/components/crm/communication-timeline"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { use } from "react"
import { getVendor, getVendorExpenses, getVendorMaintenance } from "@/app/actions/vendors"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

export default function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const [vendor, setVendor] = useState<any>(null)
  const [expenses, setExpenses] = useState<any[]>([])
  const [maintenance, setMaintenance] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"overview" | "expenses" | "maintenance" | "documents" | "communications">("overview")

  useEffect(() => {
    loadData()
  }, [id])

  async function loadData() {
    setIsLoading(true)
    try {
      const [vendorResult, expensesResult, maintenanceResult] = await Promise.all([
        getVendor(id),
        getVendorExpenses(id),
        getVendorMaintenance(id),
      ])

      if (vendorResult.error) {
        toast.error(vendorResult.error)
        router.push("/dashboard/vendors")
        return
      }

      setVendor(vendorResult.data)
      setExpenses(expensesResult.data || [])
      setMaintenance(maintenanceResult.data || [])
    } catch (error: any) {
      toast.error("Failed to load vendor data")
    } finally {
      setIsLoading(false)
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

  if (!vendor) {
    return null
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/50">Active</Badge>
      case "inactive":
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/50">Inactive</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const getTypeBadge = (type: string) => {
    const types: Record<string, { label: string; className: string }> = {
      supplier: { label: "Supplier", className: "bg-blue-500/20 text-blue-400 border-blue-500/50" },
      maintenance: { label: "Maintenance", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50" },
      fuel: { label: "Fuel", className: "bg-orange-500/20 text-orange-400 border-orange-500/50" },
      parts: { label: "Parts", className: "bg-purple-500/20 text-purple-400 border-purple-500/50" },
      other: { label: "Other", className: "bg-gray-500/20 text-gray-400 border-gray-500/50" },
    }
    const typeInfo = types[type] || { label: type, className: "bg-gray-500/20 text-gray-400 border-gray-500/50" }
    return <Badge className={typeInfo.className}>{typeInfo.label}</Badge>
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/vendors">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">{vendor.name}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {vendor.company_name || "Vendor Details"}
            </p>
          </div>
        </div>
        <Link href={`/dashboard/vendors/${id}/edit`}>
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Edit2 className="w-4 h-4 mr-2" />
            Edit Vendor
          </Button>
        </Link>
      </div>

      {/* Content */}
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Overview Tab Content */}
          {activeTab === "overview" && (
            <>
              {/* Basic Information */}
              <Card className="border-border p-4 md:p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Building2 className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-semibold text-foreground">Basic Information</h2>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Status</p>
                    <div className="mb-4">{getStatusBadge(vendor.status)}</div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Type</p>
                    <div className="mb-4">{getTypeBadge(vendor.vendor_type)}</div>
                  </div>
                  {vendor.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Email</p>
                        <a href={`mailto:${vendor.email}`} className="text-foreground hover:text-primary">
                          {vendor.email}
                        </a>
                      </div>
                    </div>
                  )}
                  {vendor.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Phone</p>
                        <a href={`tel:${vendor.phone}`} className="text-foreground hover:text-primary">
                          {vendor.phone}
                        </a>
                      </div>
                    </div>
                  )}
                  {vendor.website && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Website</p>
                      <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="text-foreground hover:text-primary">
                        {vendor.website}
                      </a>
                    </div>
                  )}
                  {vendor.tax_id && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Tax ID / EIN</p>
                      <p className="text-foreground font-mono">{vendor.tax_id}</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Address */}
              {(vendor.address_line1 || vendor.city) && (
                <Card className="border-border p-4 md:p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <MapPin className="w-5 h-5 text-primary" />
                    <h2 className="text-xl font-semibold text-foreground">Address</h2>
                  </div>
                  <div className="text-foreground">
                    {vendor.address_line1 && <p>{vendor.address_line1}</p>}
                    {vendor.address_line2 && <p>{vendor.address_line2}</p>}
                    {(vendor.city || vendor.state || vendor.zip) && (
                      <p>
                        {vendor.city}
                        {vendor.city && vendor.state && ", "}
                        {vendor.state} {vendor.zip}
                      </p>
                    )}
                    {vendor.country && vendor.country !== "USA" && <p>{vendor.country}</p>}
                  </div>
                </Card>
              )}

              {/* Financial Summary */}
              <Card className="border-border p-4 md:p-6">
                <div className="flex items-center gap-2 mb-6">
                  <DollarSign className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-semibold text-foreground">Financial Summary</h2>
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Total Spent</p>
                    <p className="text-2xl font-bold text-foreground">
                      ${vendor.total_spent?.toFixed(2) || "0.00"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Total Transactions</p>
                    <p className="text-2xl font-bold text-foreground">{vendor.total_transactions || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Payment Terms</p>
                    <p className="text-lg font-medium text-foreground">{vendor.payment_terms || "Net 30"}</p>
                  </div>
                  {vendor.last_transaction_date && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Last Transaction Date</p>
                      <p className="text-lg font-medium text-foreground">
                        {new Date(vendor.last_transaction_date).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Primary Contact */}
              {(vendor.primary_contact_name || vendor.primary_contact_email || vendor.primary_contact_phone) && (
                <Card className="border-border p-4 md:p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <MessageSquare className="w-5 h-5 text-primary" />
                    <h2 className="text-xl font-semibold text-foreground">Primary Contact</h2>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    {vendor.primary_contact_name && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Name</p>
                        <p className="text-foreground">{vendor.primary_contact_name}</p>
                      </div>
                    )}
                    {vendor.primary_contact_email && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Email</p>
                        <a href={`mailto:${vendor.primary_contact_email}`} className="text-foreground hover:text-primary">
                          {vendor.primary_contact_email}
                        </a>
                      </div>
                    )}
                    {vendor.primary_contact_phone && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Phone</p>
                        <a href={`tel:${vendor.primary_contact_phone}`} className="text-foreground hover:text-primary">
                          {vendor.primary_contact_phone}
                        </a>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Notes */}
              {vendor.notes && (
                <Card className="border-border p-4 md:p-6">
                  <h2 className="text-xl font-semibold text-foreground mb-4">Notes</h2>
                  <p className="text-foreground whitespace-pre-wrap">{vendor.notes}</p>
                </Card>
              )}
            </>
          )}

          {/* Tabs */}
          <div className="flex gap-2 border-b border-border">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-2 font-medium transition ${
                activeTab === "overview"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("expenses")}
              className={`px-4 py-2 font-medium transition ${
                activeTab === "expenses"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Expenses ({expenses.length})
            </button>
            <button
              onClick={() => setActiveTab("maintenance")}
              className={`px-4 py-2 font-medium transition ${
                activeTab === "maintenance"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Maintenance ({maintenance.length})
            </button>
            <button
              onClick={() => setActiveTab("documents")}
              className={`px-4 py-2 font-medium transition ${
                activeTab === "documents"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Documents
            </button>
            <button
              onClick={() => setActiveTab("communications")}
              className={`px-4 py-2 font-medium transition ${
                activeTab === "communications"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Communications
            </button>
          </div>

          {/* Expenses Tab */}
          {activeTab === "expenses" && (
            <Card className="border-border p-4 md:p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-foreground">Expenses</h2>
                <Link href="/dashboard/accounting/expenses/add">
                  <Button size="sm">Add Expense</Button>
                </Link>
              </div>
              {expenses.length === 0 ? (
                <p className="text-muted-foreground">No expenses found for this vendor.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 text-sm font-semibold">Date</th>
                        <th className="text-left p-3 text-sm font-semibold">Category</th>
                        <th className="text-left p-3 text-sm font-semibold">Description</th>
                        <th className="text-left p-3 text-sm font-semibold">Amount</th>
                        <th className="text-right p-3 text-sm font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map((expense) => (
                        <tr key={expense.id} className="border-b border-border/50 hover:bg-secondary/20">
                          <td className="p-3">
                            {expense.date ? new Date(expense.date).toLocaleDateString() : "—"}
                          </td>
                          <td className="p-3">{expense.category}</td>
                          <td className="p-3">{expense.description}</td>
                          <td className="p-3 font-medium">${expense.amount?.toFixed(2)}</td>
                          <td className="p-3 text-right">
                            {expense.id && typeof expense.id === 'string' && expense.id.trim() !== '' ? (
                              <Link href={`/dashboard/accounting/expenses/${expense.id}`}>
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
            </Card>
          )}

          {/* Maintenance Tab */}
          {activeTab === "maintenance" && (
            <Card className="border-border p-4 md:p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-foreground">Maintenance Records</h2>
                <Link href="/dashboard/maintenance/add">
                  <Button size="sm">Add Maintenance</Button>
                </Link>
              </div>
              {maintenance.length === 0 ? (
                <p className="text-muted-foreground">No maintenance records found for this vendor.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 text-sm font-semibold">Service Type</th>
                        <th className="text-left p-3 text-sm font-semibold">Scheduled Date</th>
                        <th className="text-left p-3 text-sm font-semibold">Status</th>
                        <th className="text-left p-3 text-sm font-semibold">Cost</th>
                        <th className="text-right p-3 text-sm font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {maintenance.map((record) => (
                        <tr key={record.id} className="border-b border-border/50 hover:bg-secondary/20">
                          <td className="p-3 font-medium">{record.service_type}</td>
                          <td className="p-3">
                            {record.scheduled_date ? new Date(record.scheduled_date).toLocaleDateString() : "—"}
                          </td>
                          <td className="p-3">
                            <Badge>{record.status}</Badge>
                          </td>
                          <td className="p-3">
                            {record.actual_cost ? `$${record.actual_cost.toFixed(2)}` : record.estimated_cost ? `$${record.estimated_cost.toFixed(2)} (est.)` : "—"}
                          </td>
                          <td className="p-3 text-right">
                            {record.id && typeof record.id === 'string' && record.id.trim() !== '' ? (
                              <Link href={`/dashboard/maintenance/${record.id}`}>
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
            </Card>
          )}

          {/* Documents Tab */}
          {activeTab === "documents" && (
            <Card className="border-border p-4 md:p-6">
              <DocumentManager vendorId={id} />
            </Card>
          )}

          {/* Communications Tab */}
          {activeTab === "communications" && (
            <Card className="border-border p-4 md:p-6">
              <CommunicationTimeline vendorId={id} />
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

