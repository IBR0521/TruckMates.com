"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Download, Send, Mail, MessageSquare, Share2 } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { use } from "react"
import { exportToPDF } from "@/lib/export-utils"
import { toast } from "sonner"
import { getInvoice } from "@/app/actions/accounting"

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [invoice, setInvoice] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showShareMenu, setShowShareMenu] = useState(false)

  useEffect(() => {
    if (id === "add" || id === "create") {
      router.push("/dashboard/accounting/invoices/create")
      return
    }

    async function loadInvoice() {
      setIsLoading(true)
      const result = await getInvoice(id)
      if (result.error) {
        toast.error(result.error || "Failed to load invoice")
        router.push("/dashboard/accounting/invoices")
        return
      }
      if (result.data) {
        setInvoice(result.data)
      }
      setIsLoading(false)
    }

    loadInvoice()
  }, [id, router])

  if (id === "add" || id === "create") {
    return null
  }

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
          <h1 className="text-3xl font-bold text-foreground">Invoice</h1>
        </div>
        <div className="p-8">
          <div className="max-w-4xl mx-auto">
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Loading invoice...</p>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="w-full">
        <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
          <Link href="/dashboard/accounting/invoices">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Invoices
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-foreground">Invoice Not Found</h1>
        </div>
        <div className="p-8">
          <div className="max-w-4xl mx-auto">
            <Card className="p-8 text-center">
              <p className="text-muted-foreground mb-4">Invoice not found</p>
              <Link href="/dashboard/accounting/invoices">
                <Button>Back to Invoices</Button>
              </Link>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  // Format invoice data
  const invoiceData = {
    id: invoice.id,
    invoice_number: invoice.invoice_number,
    customer: invoice.customer_name,
    load: invoice.loads ? (invoice.loads as any).shipment_number : null,
    amount: `$${Number(invoice.amount).toFixed(2)}`,
    status: invoice.status,
    dueDate: invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "N/A",
    issueDate: invoice.issue_date ? new Date(invoice.issue_date).toLocaleDateString() : "N/A",
    paymentTerms: invoice.payment_terms || "Net 30",
    description: invoice.description || "",
    items: invoice.items && Array.isArray(invoice.items) ? invoice.items : [
      { description: "Service", quantity: 1, rate: Number(invoice.amount), amount: Number(invoice.amount) },
    ],
  }

  const handleDownload = () => {
    try {
      const itemsHtml = invoiceData.items.map((item: any) => `
        <tr>
          <td>${item.description || "Item"}</td>
          <td style="text-align: right;">${item.quantity || 1}</td>
          <td style="text-align: right;">$${Number(item.rate || item.amount || 0).toFixed(2)}</td>
          <td style="text-align: right;">$${Number(item.amount || 0).toFixed(2)}</td>
        </tr>
      `).join("")

      const content = `
        <h1>Invoice ${invoiceData.invoice_number}</h1>
        <div style="margin: 20px 0;">
          <p><strong>Bill To:</strong> ${invoiceData.customer}</p>
          <p><strong>Invoice Date:</strong> ${invoiceData.issueDate}</p>
          <p><strong>Due Date:</strong> ${invoiceData.dueDate}</p>
          <p><strong>Payment Terms:</strong> ${invoiceData.paymentTerms}</p>
          <p><strong>Status:</strong> ${invoiceData.status}</p>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <thead>
            <tr style="border-bottom: 2px solid #ddd;">
              <th style="text-align: left; padding: 8px;">Description</th>
              <th style="text-align: right; padding: 8px;">Qty</th>
              <th style="text-align: right; padding: 8px;">Rate</th>
              <th style="text-align: right; padding: 8px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="text-align: right; padding: 8px; font-weight: bold;">Total:</td>
              <td style="text-align: right; padding: 8px; font-weight: bold; font-size: 1.2em;">${invoiceData.amount}</td>
            </tr>
          </tfoot>
        </table>
        ${invoiceData.description ? `<p style="margin-top: 20px;"><strong>Notes:</strong> ${invoiceData.description}</p>` : ""}
      `
      exportToPDF(content, `invoice-${invoiceData.invoice_number}`)
      toast.success("Invoice downloaded successfully")
    } catch (error) {
      toast.error("Failed to download invoice")
    }
  }

  const handleShare = (method: string) => {
    const message = `Invoice ${invoiceData.invoice_number} - Amount: ${invoiceData.amount} - Due: ${invoiceData.dueDate}`
    const url = window.location.href

    switch (method) {
      case "email":
        window.location.href = `mailto:?subject=Invoice ${invoice.id}&body=${encodeURIComponent(message + "\n" + url)}`
        toast.success("Opening email client...")
        break
      case "whatsapp":
        window.open(`https://wa.me/?text=${encodeURIComponent(message + " " + url)}`, "_blank")
        toast.success("Opening WhatsApp...")
        break
      case "telegram":
        window.open(
          `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(message)}`,
          "_blank",
        )
        toast.success("Opening Telegram...")
        break
    }
    setShowShareMenu(false)
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
        <Link href="/dashboard/accounting/invoices">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Invoices
          </Button>
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Invoice {invoiceData.invoice_number}</h1>
            <p className="text-muted-foreground text-sm mt-1">Issued on {invoiceData.issueDate}</p>
          </div>
          <div className="flex gap-2 relative">
            <Button onClick={handleDownload} variant="outline" className="border-border bg-transparent">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            <Button onClick={() => setShowShareMenu(!showShareMenu)} className="bg-primary hover:bg-primary/90">
              <Share2 className="w-4 h-4 mr-2" />
              Send Invoice
            </Button>
            {showShareMenu && (
              <Card className="absolute top-12 right-0 z-10 border-border p-2 min-w-[180px]">
                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => handleShare("email")}>
                  <Mail className="w-4 h-4 mr-2" />
                  Email
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => handleShare("whatsapp")}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  WhatsApp
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => handleShare("telegram")}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Telegram
                </Button>
              </Card>
            )}
          </div>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card className="border-border p-8">
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">BILL TO</h3>
                <p className="text-lg font-bold text-foreground">{invoiceData.customer}</p>
                {invoice.loads && (invoice.loads as any).shipment_number && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Related Load: {(invoice.loads as any).shipment_number}
                  </p>
                )}
              </div>
              <div className="text-right">
                <div className="mb-4">
                  <span
                    className={`px-4 py-2 rounded-full text-sm font-semibold ${
                      invoiceData.status === "paid" ? "bg-green-500/20 text-green-400" : 
                      invoiceData.status === "overdue" ? "bg-red-500/20 text-red-400" : 
                      "bg-yellow-500/20 text-yellow-400"
                    }`}
                  >
                    {invoiceData.status.charAt(0).toUpperCase() + invoiceData.status.slice(1)}
                  </span>
                </div>
                <div className="space-y-1 text-sm">
                  <p className="text-muted-foreground">
                    Invoice Date: <span className="text-foreground font-medium">{invoiceData.issueDate}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Due Date: <span className="text-foreground font-medium">{invoiceData.dueDate}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Terms: <span className="text-foreground font-medium">{invoiceData.paymentTerms}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-6">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 text-sm font-semibold text-foreground">Description</th>
                    <th className="text-right py-3 text-sm font-semibold text-foreground">Qty</th>
                    <th className="text-right py-3 text-sm font-semibold text-foreground">Rate</th>
                    <th className="text-right py-3 text-sm font-semibold text-foreground">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceData.items.map((item: any, i: number) => (
                    <tr key={i} className="border-b border-border">
                      <td className="py-3 text-foreground">{item.description || "Item"}</td>
                      <td className="text-right py-3 text-foreground">{item.quantity || 1}</td>
                      <td className="text-right py-3 text-foreground">${Number(item.rate || item.amount || 0).toFixed(2)}</td>
                      <td className="text-right py-3 text-foreground font-semibold">${Number(item.amount || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="pt-6 text-right text-lg font-semibold text-foreground">
                      Total Amount:
                    </td>
                    <td className="pt-6 text-right text-2xl font-bold text-primary">{invoiceData.amount}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {invoiceData.description && (
              <div className="border-t border-border pt-6 mt-6">
                <h3 className="text-sm font-semibold text-foreground mb-2">Notes</h3>
                <p className="text-sm text-muted-foreground">{invoiceData.description}</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
