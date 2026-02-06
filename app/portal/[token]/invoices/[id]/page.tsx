"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Loader2, 
  FileText, 
  Calendar, 
  DollarSign,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  Mail
} from "lucide-react"
import { getPortalAccessByToken, getCustomerPortalInvoices } from "@/app/actions/customer-portal"
import { toast } from "sonner"
import Link from "next/link"

export default function CustomerPortalInvoicePage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string
  const invoiceId = params.id as string
  const [isLoading, setIsLoading] = useState(true)
  const [invoice, setInvoice] = useState<any>(null)
  const [portalAccess, setPortalAccess] = useState<any>(null)

  useEffect(() => {
    async function loadData() {
      setIsLoading(true)
      try {
        const accessResult = await getPortalAccessByToken(token)
        if (accessResult.error || !accessResult.data) {
          toast.error(accessResult.error || "Invalid access token")
          router.push("/")
          return
        }
        setPortalAccess(accessResult.data)

        const invoicesResult = await getCustomerPortalInvoices(token)
        if (invoicesResult.error || !invoicesResult.data) {
          toast.error(invoicesResult.error || "Failed to load invoices")
          router.push(`/portal/${token}`)
          return
        }

        const foundInvoice = invoicesResult.data.find((inv: any) => inv.id === invoiceId)
        if (!foundInvoice) {
          toast.error("Invoice not found")
          router.push(`/portal/${token}`)
          return
        }
        setInvoice(foundInvoice)
      } catch (error: any) {
        toast.error("Failed to load invoice details")
        console.error(error)
      } finally {
        setIsLoading(false)
      }
    }

    if (token && invoiceId) {
      loadData()
    }
  }, [token, invoiceId, router])

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "paid":
        return "bg-green-500"
      case "sent":
      case "pending":
        return "bg-yellow-500"
      case "overdue":
        return "bg-red-500"
      case "draft":
        return "bg-gray-500"
      default:
        return "bg-gray-500"
    }
  }

  const formatDate = (date: string | null) => {
    if (!date) return "N/A"
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const formatCurrency = (amount: number | string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(parseFloat(amount?.toString() || "0"))
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading invoice details...</p>
        </div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="p-8 max-w-md w-full">
          <div className="text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Invoice Not Found</h1>
            <p className="text-muted-foreground mb-4">The requested invoice could not be found.</p>
            <Link href={`/portal/${token}`}>
              <Button>Back to Portal</Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  const items = (invoice.items as any[]) || []
  const subtotal = items.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0)
  const tax = parseFloat(invoice.tax || 0)
  const total = subtotal + tax

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Link href={`/portal/${token}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-6 h-6" />
                {invoice.invoice_number || "Invoice"}
              </h1>
              {invoice.description && (
                <p className="text-sm text-muted-foreground mt-1">{invoice.description}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Badge className={getStatusColor(invoice.status)}>
                {invoice.status?.toUpperCase() || "UNKNOWN"}
              </Badge>
              {invoice.amount && (
                <span className="text-2xl font-bold">{formatCurrency(invoice.amount)}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Invoice Details */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Invoice Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {invoice.issue_date && (
                  <div className="flex items-start gap-2">
                    <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Issue Date</p>
                      <p className="text-sm font-medium">{formatDate(invoice.issue_date)}</p>
                    </div>
                  </div>
                )}
                {invoice.due_date && (
                  <div className="flex items-start gap-2">
                    <Clock className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Due Date</p>
                      <p className="text-sm font-medium">{formatDate(invoice.due_date)}</p>
                    </div>
                  </div>
                )}
                {invoice.paid_date && (
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Paid Date</p>
                      <p className="text-sm font-medium">{formatDate(invoice.paid_date)}</p>
                    </div>
                  </div>
                )}
                {invoice.customer_name && (
                  <div className="flex items-start gap-2">
                    <FileText className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Customer</p>
                      <p className="text-sm font-medium">{invoice.customer_name}</p>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Invoice Items */}
            {items.length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4">Items</h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 text-sm font-medium text-muted-foreground">Description</th>
                        <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Quantity</th>
                        <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Rate</th>
                        <th className="text-right py-2 px-3 text-sm font-medium text-muted-foreground">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item: any, index: number) => (
                        <tr key={index} className="border-b">
                          <td className="py-2 px-3 text-sm">{item.description || item.name || "N/A"}</td>
                          <td className="py-2 px-3 text-sm text-right">{item.quantity || 1}</td>
                          <td className="py-2 px-3 text-sm text-right">{formatCurrency(item.rate || item.amount || 0)}</td>
                          <td className="py-2 px-3 text-sm text-right font-medium">{formatCurrency(item.amount || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Totals */}
            <Card className="p-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                {tax > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span className="font-medium">{formatCurrency(tax)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Total</span>
                  <span>{formatCurrency(total || invoice.amount || 0)}</span>
                </div>
              </div>
            </Card>

            {/* Notes */}
            {invoice.notes && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-2">Notes</h2>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status Card */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Status</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Current Status</span>
                  <Badge className={getStatusColor(invoice.status)}>
                    {invoice.status?.toUpperCase() || "UNKNOWN"}
                  </Badge>
                </div>
                {invoice.paid_date && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Paid</span>
                    <span className="text-sm font-medium">{formatDate(invoice.paid_date)}</span>
                  </div>
                )}
                {invoice.due_date && invoice.status !== "paid" && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Due</span>
                    <span className="text-sm font-medium">{formatDate(invoice.due_date)}</span>
                  </div>
                )}
              </div>
            </Card>

            {/* Quick Actions */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Mail className="w-4 h-4 mr-2" />
                  Email Invoice
                </Button>
              </div>
            </Card>

            {/* Payment Information */}
            {invoice.status !== "paid" && (
              <Card className="p-6">
                <h3 className="font-semibold mb-4">Payment</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Please contact {portalAccess?.company?.name || "the company"} to make a payment.
                </p>
                {portalAccess?.company?.phone && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Phone:</span>{" "}
                    <a href={`tel:${portalAccess.company.phone}`} className="text-primary hover:underline">
                      {portalAccess.company.phone}
                    </a>
                  </p>
                )}
                {portalAccess?.company?.email && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Email:</span>{" "}
                    <a href={`mailto:${portalAccess.company.email}`} className="text-primary hover:underline">
                      {portalAccess.company.email}
                    </a>
                  </p>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}









