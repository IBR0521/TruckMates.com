"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Phone, Mail, Building2, MapPin, Edit2, DollarSign, Package, FileText, MessageSquare, Calendar } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { use } from "react"
import { getCustomer, getCustomerLoads, getCustomerInvoices, getCustomerHistory } from "@/app/actions/customers"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const [customer, setCustomer] = useState<any>(null)
  const [loads, setLoads] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"overview" | "loads" | "invoices" | "history">("overview")

  useEffect(() => {
    loadData()
  }, [id])

  async function loadData() {
    setIsLoading(true)
    try {
      const [customerResult, loadsResult, invoicesResult, historyResult] = await Promise.all([
        getCustomer(id),
        getCustomerLoads(id),
        getCustomerInvoices(id),
        getCustomerHistory(id),
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
    } catch (error: any) {
      toast.error("Failed to load customer data")
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

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/customers">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">{customer.name}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {customer.company_name || "Customer Details"}
            </p>
          </div>
        </div>
        <Link href={`/dashboard/customers/${id}/edit`}>
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Edit2 className="w-4 h-4 mr-2" />
            Edit Customer
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
                    <div className="mb-4">{getStatusBadge(customer.status)}</div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Type</p>
                    <div className="mb-4">{getTypeBadge(customer.customer_type)}</div>
                  </div>
                  {customer.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Email</p>
                        <a href={`mailto:${customer.email}`} className="text-foreground hover:text-primary">
                          {customer.email}
                        </a>
                      </div>
                    </div>
                  )}
                  {customer.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Phone</p>
                        <a href={`tel:${customer.phone}`} className="text-foreground hover:text-primary">
                          {customer.phone}
                        </a>
                      </div>
                    </div>
                  )}
                  {customer.website && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Website</p>
                      <a href={customer.website} target="_blank" rel="noopener noreferrer" className="text-foreground hover:text-primary">
                        {customer.website}
                      </a>
                    </div>
                  )}
                  {customer.tax_id && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Tax ID / EIN</p>
                      <p className="text-foreground font-mono">{customer.tax_id}</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Address */}
              {(customer.address_line1 || customer.city) && (
                <Card className="border-border p-4 md:p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <MapPin className="w-5 h-5 text-primary" />
                    <h2 className="text-xl font-semibold text-foreground">Address</h2>
                  </div>
                  <div className="text-foreground">
                    {customer.address_line1 && <p>{customer.address_line1}</p>}
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
                    <p className="text-sm text-muted-foreground mb-1">Total Revenue</p>
                    <p className="text-2xl font-bold text-foreground">
                      ${customer.total_revenue?.toFixed(2) || "0.00"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Total Loads</p>
                    <p className="text-2xl font-bold text-foreground">{customer.total_loads || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Payment Terms</p>
                    <p className="text-lg font-medium text-foreground">{customer.payment_terms || "Net 30"}</p>
                  </div>
                  {customer.credit_limit && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Credit Limit</p>
                      <p className="text-lg font-medium text-foreground">
                        ${customer.credit_limit.toFixed(2)}
                      </p>
                    </div>
                  )}
                  {customer.last_load_date && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Last Load Date</p>
                      <p className="text-lg font-medium text-foreground">
                        {new Date(customer.last_load_date).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Primary Contact */}
              {(customer.primary_contact_name || customer.primary_contact_email || customer.primary_contact_phone) && (
                <Card className="border-border p-4 md:p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <MessageSquare className="w-5 h-5 text-primary" />
                    <h2 className="text-xl font-semibold text-foreground">Primary Contact</h2>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    {customer.primary_contact_name && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Name</p>
                        <p className="text-foreground">{customer.primary_contact_name}</p>
                      </div>
                    )}
                    {customer.primary_contact_email && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Email</p>
                        <a href={`mailto:${customer.primary_contact_email}`} className="text-foreground hover:text-primary">
                          {customer.primary_contact_email}
                        </a>
                      </div>
                    )}
                    {customer.primary_contact_phone && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Phone</p>
                        <a href={`tel:${customer.primary_contact_phone}`} className="text-foreground hover:text-primary">
                          {customer.primary_contact_phone}
                        </a>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Notes */}
              {customer.notes && (
                <Card className="border-border p-4 md:p-6">
                  <h2 className="text-xl font-semibold text-foreground mb-4">Notes</h2>
                  <p className="text-foreground whitespace-pre-wrap">{customer.notes}</p>
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
              onClick={() => setActiveTab("loads")}
              className={`px-4 py-2 font-medium transition ${
                activeTab === "loads"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Loads ({loads.length})
            </button>
            <button
              onClick={() => setActiveTab("invoices")}
              className={`px-4 py-2 font-medium transition ${
                activeTab === "invoices"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Invoices ({invoices.length})
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-4 py-2 font-medium transition ${
                activeTab === "history"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              History ({history.length})
            </button>
          </div>

          {/* Loads Tab */}
          {activeTab === "loads" && (
            <Card className="border-border p-4 md:p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-foreground">Loads</h2>
                <Link href="/dashboard/loads/add">
                  <Button size="sm">Add Load</Button>
                </Link>
              </div>
              {loads.length === 0 ? (
                <p className="text-muted-foreground">No loads found for this customer.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 text-sm font-semibold">Shipment #</th>
                        <th className="text-left p-3 text-sm font-semibold">Origin</th>
                        <th className="text-left p-3 text-sm font-semibold">Destination</th>
                        <th className="text-left p-3 text-sm font-semibold">Status</th>
                        <th className="text-left p-3 text-sm font-semibold">Date</th>
                        <th className="text-right p-3 text-sm font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loads.map((load) => (
                        <tr key={load.id} className="border-b border-border/50 hover:bg-secondary/20">
                          <td className="p-3 font-medium">{load.shipment_number}</td>
                          <td className="p-3">{load.origin}</td>
                          <td className="p-3">{load.destination}</td>
                          <td className="p-3">
                            <Badge>{load.status}</Badge>
                          </td>
                          <td className="p-3">
                            {load.load_date ? new Date(load.load_date).toLocaleDateString() : "—"}
                          </td>
                          <td className="p-3 text-right">
                            <Link href={`/dashboard/loads/${load.id}`}>
                              <Button variant="ghost" size="sm">View</Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* Invoices Tab */}
          {activeTab === "invoices" && (
            <Card className="border-border p-4 md:p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-foreground">Invoices</h2>
                <Link href="/dashboard/accounting/invoices/create">
                  <Button size="sm">Create Invoice</Button>
                </Link>
              </div>
              {invoices.length === 0 ? (
                <p className="text-muted-foreground">No invoices found for this customer.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 text-sm font-semibold">Invoice #</th>
                        <th className="text-left p-3 text-sm font-semibold">Amount</th>
                        <th className="text-left p-3 text-sm font-semibold">Status</th>
                        <th className="text-left p-3 text-sm font-semibold">Issue Date</th>
                        <th className="text-left p-3 text-sm font-semibold">Due Date</th>
                        <th className="text-right p-3 text-sm font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice) => (
                        <tr key={invoice.id} className="border-b border-border/50 hover:bg-secondary/20">
                          <td className="p-3 font-medium">{invoice.invoice_number}</td>
                          <td className="p-3">${invoice.amount?.toFixed(2)}</td>
                          <td className="p-3">
                            <Badge>{invoice.status}</Badge>
                          </td>
                          <td className="p-3">
                            {invoice.issue_date ? new Date(invoice.issue_date).toLocaleDateString() : "—"}
                          </td>
                          <td className="p-3">
                            {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "—"}
                          </td>
                          <td className="p-3 text-right">
                            <Link href={`/dashboard/accounting/invoices/${invoice.id}`}>
                              <Button variant="ghost" size="sm">View</Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* History Tab */}
          {activeTab === "history" && (
            <Card className="border-border p-4 md:p-6">
              <h2 className="text-xl font-semibold text-foreground mb-6">Communication History</h2>
              {history.length === 0 ? (
                <p className="text-muted-foreground">No communication history found.</p>
              ) : (
                <div className="space-y-4">
                  {history.map((item) => (
                    <div key={item.id} className="border-b border-border/50 pb-4 last:border-0">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-foreground">{item.subject || item.type}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.type} • {new Date(item.occurred_at).toLocaleString()}
                          </p>
                        </div>
                        <Badge variant={item.direction === "inbound" ? "secondary" : "default"}>
                          {item.direction}
                        </Badge>
                      </div>
                      {item.message && (
                        <p className="text-sm text-foreground mt-2">{item.message}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

